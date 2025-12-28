"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ExternalLink,
  FileText,
  Search,
  RefreshCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type PublicationRow = {
  id?: string;
  title?: string;
  authors?: string;
  year?: string | number;

  // New schema (preferred)
  journal?: string;

  // Backward-compat schema (keep)
  venue?: string; // journal/conference
  type?: string; // journal, conference, etc.

  tags?: string;
  url?: string; // landing page
  pdf?: string; // direct pdf link
  doi?: string;
  abstract?: string;
  order?: string | number;
};

type Publication = {
  id: string;
  title: string;
  authors?: string;
  year?: number;

  journal?: string; // preferred display field
  venue?: string; // fallback for legacy data
  type?: string;

  tags: string[];
  url?: string;
  pdf?: string;
  doi?: string;
  abstract?: string;
  order: number;
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

function toNumber(v: unknown, fallback = 9999) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toYear(v: unknown): number | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/\b(\d{4})\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1900 || n > 2100) return undefined;
  return n;
}

function toPublication(r: PublicationRow): Publication {
  const url = isHttpUrl(r.url) ? String(r.url).trim() : undefined;
  const pdf = isHttpUrl(r.pdf) ? String(r.pdf).trim() : undefined;
  const doi = (r.doi || "").trim() || undefined;

  // If DOI is provided but url missing, build doi.org link
  const doiUrl = !url && doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : undefined;

  const journal = (r.journal || "").trim() || undefined;
  const venue = (r.venue || "").trim() || undefined;

  return {
    id: (r.id || "").trim(),
    title: (r.title || "").trim(),
    authors: (r.authors || "").trim() || undefined,
    year: toYear(r.year),

    journal,
    venue,
    type: (r.type || "").trim() || undefined,

    tags: normalizeTags(r.tags),
    url: url || doiUrl,
    pdf,
    doi,
    abstract: (r.abstract || "").trim() || undefined,
    order: toNumber(r.order, 9999),
  };
}

export default function PublicationsPage() {
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Abstract toggle (one open at a time)
  const [openAbsId, setOpenAbsId] = useState<string | null>(null);

  const [usedUrl, setUsedUrl] = useState<string>("");
  const [diag, setDiag] = useState<{
    status?: number;
    delimiter?: string;
    delimiterReason?: string;
    headerLine?: string;
    parsedFields?: string[];
  } | null>(null);

  // NOTE: uses your existing env var name
  const sheetUrl = (process.env.NEXT_PUBLIC_PUBLICATIONS_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setDiag(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_PUBLICATIONS_SHEET_CSV_URL is not set.");

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

      const rows: PublicationRow[] = ((parsed.data as any[]) || []).map((r: any) => ({
        // Core fields
        id: r?.id ?? r?.["ID"] ?? r?.["Id"],
        title: r?.title ?? r?.["Title"],
        authors: r?.authors ?? r?.author ?? r?.["Authors"],
        year: r?.year ?? r?.["Year"] ?? r?.date ?? r?.["년도"],

        // New schema
        journal: r?.journal ?? r?.["Journal"] ?? r?.["저널"],

        // Legacy schema
        venue: r?.venue ?? r?.conference ?? r?.["Venue"],
        type: r?.type ?? r?.category,

        tags: r?.tags ?? r?.tag,
        url: r?.url ?? r?.link ?? r?.website,
        pdf: r?.pdf ?? r?.fulltext ?? r?.file,
        doi: r?.doi,
        abstract: r?.abstract ?? r?.summary ?? r?.["Abstract"] ?? r?.["초록"],
        order: r?.order,
      }));

      const data = rows
        .map(toPublication)
        .filter((p) => p.id && p.title)
        .sort((a, b) => {
          // 1) order asc if provided
          const od = a.order - b.order;
          if (Number.isFinite(od) && od !== 0) return od;

          // 2) year desc
          const ay = a.year ?? -Infinity;
          const by = b.year ?? -Infinity;
          if (by !== ay) return by - ay;

          // 3) title
          return a.title.localeCompare(b.title);
        });

      setPubs(data);

      setDiag({
        status,
        delimiter: delimiter ?? "(Papa default)",
        delimiterReason: reason,
        headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 200),
        parsedFields:
          parsed.meta && (parsed.meta as any).fields ? ((parsed.meta as any).fields as string[]) : [],
      });
    } catch (e: any) {
      setPubs([]);
      setErrMsg(e?.message ? String(e.message) : "Unknown error while loading Publications sheet.");
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
    if (!q) return pubs;
    return pubs.filter((p) => {
      const hay = [
        p.title,
        p.authors || "",
        p.journal || "",
        p.venue || "",
        p.type || "",
        p.tags.join(" "),
        String(p.year ?? ""),
        p.doi || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pubs, query]);

  function toggleAbstract(id: string) {
    setOpenAbsId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">Publications</div>

          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[520px]">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search: title, authors, journal, year..."
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

          <div className="mt-3 text-xs text-gray-600">{loading ? "Loading…" : `Showing ${filtered.length} item(s)`}</div>
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
            No results. Check your sheet headers and ensure rows have both <span className="font-mono">id</span> and{" "}
            <span className="font-mono">title</span>.
            <div className="mt-2 text-xs text-gray-500">
              Recommended headers: <span className="font-mono">id, year, authors, title, journal, pdf, abstract</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => {
              const venueLabel = p.journal || p.venue || "";
              const open = openAbsId === p.id;

              return (
                <div key={p.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="text-base font-semibold text-gray-900">{p.title}</div>

                  <div className="mt-2 text-sm text-gray-700">
                    {[p.authors, venueLabel, p.year ? String(p.year) : ""].filter(Boolean).join(" · ")}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        Link <ExternalLink className="h-4 w-4 text-gray-500" />
                      </a>
                    )}

                    {p.pdf && (
                      <a
                        href={p.pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        PDF <FileText className="h-4 w-4 text-gray-500" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleAbstract(p.id)}
                      disabled={!p.abstract}
                      aria-expanded={open}
                      aria-controls={`abs-${p.id}`}
                      title={p.abstract ? "Show abstract" : "No abstract available"}
                      className={cx(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2",
                        p.abstract ? "bg-white hover:bg-gray-50" : "bg-gray-50 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      Abstract {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                    </button>
                  </div>

                  {open && (
                    <div
                      id={`abs-${p.id}`}
                      className="mt-3 rounded-xl border bg-gray-50 p-4 text-sm leading-6 text-gray-700"
                    >
                      {p.abstract}
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
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

