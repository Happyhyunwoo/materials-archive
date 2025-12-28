"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { ExternalLink, Github, Search, RefreshCcw, AlertTriangle } from "lucide-react";

type ProjectRow = {
  id?: string;
  title?: string;
  status?: string;
  description?: string;
  tags?: string;
  startdate?: string;
  enddate?: string;
  url?: string;
  repo?: string;
  order?: string | number;

  // Image slot (recommended: "/projects/your-image.png")
  imageurl?: string;
};

type Project = {
  id: string;
  title: string;
  status?: string;
  description?: string;
  tags: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  repo?: string;
  order: number;

  imageUrl?: string;
};

function detectDelimiter(text: string): { delimiter?: string; reason: string } {
  const firstLine = (text || "").split(/\r?\n/)[0] || "";
  if (firstLine.includes("\t")) return { delimiter: "\t", reason: "TAB delimiter detected in header" };
  if (firstLine.includes(",")) return { delimiter: ",", reason: "Comma delimiter detected in header" };
  if (firstLine.includes(";")) return { delimiter: ";", reason: "Semicolon delimiter detected in header" };
  return { delimiter: undefined, reason: "No obvious delimiter; using Papa default" };
}

function normalizeTags(s?: string): string[] {
  const raw = (s || "").trim();
  if (!raw) return [];
  const comma = raw.split(",").map((x) => x.trim()).filter(Boolean);
  if (comma.length > 1) return comma;
  const semi = raw.split(";").map((x) => x.trim()).filter(Boolean);
  if (semi.length > 1) return semi;
  const pipe = raw.split("|").map((x) => x.trim()).filter(Boolean);
  if (pipe.length > 1) return pipe;
  return raw.split(/\s+/g).map((x) => x.trim()).filter(Boolean);
}

function isHttpUrl(s?: string) {
  const v = (s || "").trim();
  return v.startsWith("http://") || v.startsWith("https://");
}

// Allow local public paths like "/projects/foo.png"
function isLocalPublicPath(s?: string) {
  const v = (s || "").trim();
  return v.startsWith("/");
}

function toNumber(v: unknown, fallback = 9999) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(s?: string) {
  const raw = (s || "").trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw; // keep as-is if not parseable
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toProject(r: ProjectRow): Project {
  const imgRaw = (r.imageurl || "").trim();
  const imageUrl = imgRaw && (isHttpUrl(imgRaw) || isLocalPublicPath(imgRaw)) ? imgRaw : undefined;

  return {
    id: (r.id || "").trim(),
    title: (r.title || "").trim(),
    status: (r.status || "").trim() || undefined,
    description: (r.description || "").trim() || undefined,
    tags: normalizeTags(r.tags),
    startDate: normalizeDate(r.startdate),
    endDate: normalizeDate(r.enddate),
    url: isHttpUrl(r.url) ? (r.url || "").trim() : undefined,
    repo: isHttpUrl(r.repo) ? (r.repo || "").trim() : undefined,
    order: toNumber(r.order, 9999),
    imageUrl,
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [usedUrl, setUsedUrl] = useState<string>("");
  const [diag, setDiag] = useState<{
    status?: number;
    delimiter?: string;
    delimiterReason?: string;
    headerLine?: string;
    parsedFields?: string[];
  } | null>(null);

  const sheetUrl = (process.env.NEXT_PUBLIC_PROJECTS_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setDiag(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_PROJECTS_SHEET_CSV_URL is not set.");

      setUsedUrl(sheetUrl);

      const res = await fetch(sheetUrl, { cache: "no-store" });
      const status = res.status;
      if (!res.ok) throw new Error(`HTTP ${status}`);

      const text = await res.text();
      const { delimiter, reason } = detectDelimiter(text);

      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (h: string) => (h || "").trim().toLowerCase(),
      });

      const rows: ProjectRow[] = ((parsed.data as any[]) || []).map((r: any) => ({
        id: r?.id ?? r?.["ID"] ?? r?.["Id"],
        title: r?.title ?? r?.["Title"],
        status: r?.status,
        description: r?.description ?? r?.desc ?? r?.summary,
        tags: r?.tags ?? r?.tag,
        startdate: r?.startdate ?? r?.start_date ?? r?.start,
        enddate: r?.enddate ?? r?.end_date ?? r?.end,
        url: r?.url ?? r?.link ?? r?.website,
        repo: r?.repo ?? r?.github ?? r?.repository,
        order: r?.order,

        // Image slot in sheet: imageurl / image_url / image
        imageurl: r?.imageurl ?? r?.image_url ?? r?.image,
      }));

      const data = rows
        .map(toProject)
        .filter((p) => p.id && p.title)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

      setProjects(data);

      setDiag({
        status,
        delimiter: delimiter ?? "(Papa default)",
        delimiterReason: reason,
        headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 200),
        parsedFields:
          parsed.meta && (parsed.meta as any).fields ? ((parsed.meta as any).fields as string[]) : [],
      });
    } catch (e: any) {
      setProjects([]);
      setErrMsg(e?.message ? String(e.message) : "Unknown error while loading Projects sheet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const hay = [p.title, p.status || "", p.description || "", p.tags.join(" "), p.startDate || "", p.endDate || ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">Projects</div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[520px]">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search: title, tags, status..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <button
              onClick={load}
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm shadow-sm hover:bg-gray-50"
              type="button"
              title="Reload"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-600">{loading ? "Loading…" : `Showing ${filtered.length} project(s)`}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : errMsg ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-6 text-sm">
              <div className="text-red-700">{errMsg}</div>
              <div className="mt-2 text-xs text-gray-600">
                Used URL: <span className="font-mono break-all">{usedUrl || "(empty)"}</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <AlertTriangle className="h-4 w-4" />
                Diagnostics
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium">HTTP status:</span> {diag?.status ?? "(unknown)"}
                </div>
                <div>
                  <span className="font-medium">Delimiter:</span> {diag?.delimiter ?? "(unknown)"}{" "}
                  <span className="text-gray-500">({diag?.delimiterReason ?? ""})</span>
                </div>
                <div>
                  <span className="font-medium">Header line:</span>
                  <div className="mt-1 rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-700">
                    {diag?.headerLine || "(none)"}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Parsed fields:</span>{" "}
                  <span className="font-mono text-xs">{(diag?.parsedFields || []).join(", ") || "(none)"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
            No results. Ensure rows have both <span className="font-mono">id</span> and <span className="font-mono">title</span>.
            <div className="mt-2 text-xs text-gray-500">
              To show images, add <span className="font-mono">imageurl</span> column with values like{" "}
              <span className="font-mono">/projects/project-picture-1.png</span>.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                {p.imageUrl ? (
                  <div className="h-40 w-full bg-gray-50">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="h-10 bg-white" />
                )}

                <div className="p-6">
                  <div className="text-base font-semibold text-gray-900">{p.title}</div>

                  {(p.status || p.startDate || p.endDate) && (
                    <div className="mt-2 text-sm text-gray-600">
                      {[p.status, [p.startDate, p.endDate].filter(Boolean).join("–")].filter(Boolean).join(" · ")}
                    </div>
                  )}

                  {p.description ? (
                    <div className="mt-3 text-sm text-gray-600">{p.description}</div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-400">No description.</div>
                  )}

                  {(p.url || p.repo) && (
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                        >
                          Website <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                      )}
                      {p.repo && (
                        <a
                          href={p.repo}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                        >
                          Repo <Github className="h-4 w-4 text-gray-500" />
                        </a>
                      )}
                    </div>
                  )}

                  {p.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.tags.slice(0, 12).map((t) => (
                        <span key={`${p.id}-${t}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

