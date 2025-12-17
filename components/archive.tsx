"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Search, Code2, BookOpen, FileText, AlertTriangle } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

/* =======================
   Types
======================= */

type ResourceRow = {
  id?: string;
  title?: string;
  description?: string;
  categories?: string;
  tags?: string;
  files?: string;
  createdAt?: string;
};

type FileItem = { name: string; url: string };

const CATEGORY_KEYS = ["article", "lecture", "python"] as const;
type Category = (typeof CATEGORY_KEYS)[number];

type Resource = {
  id: string;
  title: string;
  description: string;
  categories: Category[];
  tags: string[];
  fileItems: FileItem[];
  createdAt?: string;
};

type TabKey = "all" | "python" | "lecture" | "article";

const TABS: ReadonlyArray<{
  key: TabKey;
  label: string;
  match: readonly Category[];
}> = [
  { key: "all", label: "All", match: CATEGORY_KEYS },
  { key: "python", label: "Python code", match: ["python"] },
  { key: "lecture", label: "Lecture", match: ["lecture"] },
  { key: "article", label: "Article", match: ["article"] },
];

/* =======================
   Helpers
======================= */

function normalizeList(s: string, sep = ",") {
  return (s || "")
    .split(sep)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeTags(s: string): string[] {
  const raw = (s || "").trim();
  if (!raw) return [];
  // prefer commas, then semicolons, then pipes, then whitespace
  const c = normalizeList(raw, ",");
  if (c.length > 1) return c;
  const sc = normalizeList(raw, ";");
  if (sc.length > 1) return sc;
  const p = normalizeList(raw, "|");
  if (p.length > 1) return p;

  return raw
    .split(/\s+/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeCategories(s: string): Category[] {
  const raw = (s || "").trim();
  if (!raw) return [];

  // allow comma/semicolon/pipe; single token also allowed
  const candidates =
    normalizeList(raw, ",").length > 1
      ? normalizeList(raw, ",")
      : normalizeList(raw, ";").length > 1
        ? normalizeList(raw, ";")
        : normalizeList(raw, "|").length > 1
          ? normalizeList(raw, "|")
          : [raw];

  return candidates
    .map((c) => {
      const x = c.toLowerCase().trim();
      if (x === "tool") return "python"; // backward compatibility
      if (x === "python code") return "python";
      if (x === "py") return "python";
      return x;
    })
    .filter((x): x is Category => (CATEGORY_KEYS as readonly string[]).includes(x));
}

function normalizeFiles(s: string): FileItem[] {
  return (s || "")
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((part) => {
      const [nameRaw, urlRaw] = part.split("::");
      const name = (nameRaw || "").trim();
      const url = (urlRaw || "").trim();

      // URL-only fallback
      if (!url && name.startsWith("http")) return { name: "File", url: name };

      return { name: name || "File", url };
    })
    .filter((x) => x.url);
}

function toResource(r: ResourceRow): Resource {
  const id = (r.id || "").trim();
  const title = (r.title || "").trim();
  return {
    id,
    title,
    description: (r.description || "").trim(),
    categories: normalizeCategories(r.categories || ""),
    tags: normalizeTags(r.tags || ""),
    fileItems: normalizeFiles(r.files || ""),
    createdAt: (r.createdAt || "").trim() || undefined,
  };
}

function tabIcon(key: TabKey) {
  if (key === "python") return <Code2 className="h-4 w-4" />;
  if (key === "lecture") return <BookOpen className="h-4 w-4" />;
  if (key === "article") return <FileText className="h-4 w-4" />;
  return null;
}

function categoryBadgeLabel(cat: Category) {
  if (cat === "python") return "Python code";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function detectDelimiter(text: string): { delimiter?: string; reason: string } {
  const firstLine = (text || "").split(/\r?\n/)[0] || "";
  // detect by presence; prioritize tab if it exists (common when people paste)
  if (firstLine.includes("\t")) return { delimiter: "\t", reason: "Detected TAB in header line" };
  if (firstLine.includes(",")) return { delimiter: ",", reason: "Detected comma in header line" };
  if (firstLine.includes(";")) return { delimiter: ";", reason: "Detected semicolon in header line" };
  // fallback: let Papa decide
  return { delimiter: undefined, reason: "No obvious delimiter; using Papa default" };
}

/* =======================
   Main Component
======================= */

export default function Archive() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);

  // Visible diagnostics (so “No results” is actionable)
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState<{
    delimiterReason?: string;
    detectedDelimiter?: string;
    headerLine?: string;
    parsedFields?: string[];
    sampleRow?: Record<string, unknown>;
  } | null>(null);

  const sheetUrl = process.env.NEXT_PUBLIC_SHEET_CSV_URL;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrMsg(null);
      setDiag(null);

      try {
        if (!sheetUrl) throw new Error("NEXT_PUBLIC_SHEET_CSV_URL is not set.");

        const res = await fetch(sheetUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch sheet export: HTTP ${res.status}`);

        const text = await res.text();

        const { delimiter, reason } = detectDelimiter(text);

        const parsed = Papa.parse<ResourceRow>(text, {
          header: true,
          skipEmptyLines: true,
          delimiter, // may be undefined; Papa default
          transformHeader: (h) => (h || "").trim().toLowerCase(),
        });

        // Map flexible headers to our expected ones (all lowercase already)
        // This protects against minor header variations.
        const normalizedData: ResourceRow[] = (parsed.data || []).map((row: any) => {
          const r = row || {};
          return {
            id: r.id ?? r["ID"] ?? r["Id"] ?? r["아이디"],
            title: r.title ?? r["Title"] ?? r["제목"],
            description: r.description ?? r["desc"] ?? r["설명"],
            categories: r.categories ?? r["category"] ?? r["카테고리"],
            tags: r.tags ?? r["tag"] ?? r["태그"],
            files: r.files ?? r["file"] ?? r["자료"] ?? r["링크"],
            createdAt: r.createdat ?? r["createdat"] ?? r["created_at"] ?? r["date"] ?? r["날짜"],
          };
        });

        const data = normalizedData
          .map(toResource)
          .filter((r) => r.id && r.title);

        if (!cancelled) {
          setRows(data);
          setDiag({
            detectedDelimiter: delimiter ?? "(Papa default)",
            delimiterReason: reason,
            headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 250),
            parsedFields: parsed.meta?.fields || [],
            sampleRow: (parsed.data && (parsed.data[0] as any)) || undefined,
          });
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setRows([]);
          setErrMsg(e?.message ? String(e.message) : "Unknown error while loading sheet.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sheetUrl]);

  const counts = useMemo(() => {
    const base = { all: rows.length, python: 0, lecture: 0, article: 0 } as Record<TabKey, number>;
    for (const r of rows) {
      if (r.categories.includes("python")) base.python += 1;
      if (r.categories.includes("lecture")) base.lecture += 1;
      if (r.categories.includes("article")) base.article += 1;
    }
    return base;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = TABS.find((t) => t.key === tab) || TABS[0];

    return rows
      .filter((r) => {
        if (active.key === "all") return true;
        return r.categories.some((c) => active.match.includes(c));
      })
      .filter((r) => {
        if (!q) return true;
        const hay = [r.title, r.description, r.tags.join(" "), r.categories.join(" ")]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [rows, query, tab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-tight">Yonsei HW Lab</div>
              <div className="mt-1 text-sm text-gray-600">Materials Archive</div>
            </div>

            <div className="w-full md:w-[420px]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Search (title / description / tags)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {loading ? "Loading…" : `${filtered.length} result(s)`}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <Tabs.List className="inline-flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <TabTrigger key={t.key} value={t.key}>
                    <span className="inline-flex items-center gap-2">
                      {tabIcon(t.key)}
                      <span>{t.label}</span>
                      <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs text-gray-700">
                        {counts[t.key]}
                      </span>
                    </span>
                  </TabTrigger>
                ))}
              </Tabs.List>
            </Tabs.Root>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
              No results. Check (1) your Google Sheets CSV link, (2) column headers, and (3) whether the row has both{" "}
              <code className="rounded bg-gray-100 px-1">id</code> and{" "}
              <code className="rounded bg-gray-100 px-1">title</code>.
            </div>

            {(errMsg || diag) && (
              <div className="rounded-2xl border bg-white p-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <AlertTriangle className="h-4 w-4" />
                  Diagnostics (for debugging)
                </div>

                {errMsg ? (
                  <div className="text-sm text-red-700">
                    <div className="font-medium">Fetch/parse error:</div>
                    <div className="mt-1 whitespace-pre-wrap">{errMsg}</div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Delimiter:</span>{" "}
                      {diag?.detectedDelimiter}{" "}
                      <span className="text-gray-500">({diag?.delimiterReason})</span>
                    </div>
                    <div>
                      <span className="font-medium">Header line (first 250 chars):</span>
                      <div className="mt-1 rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-700">
                        {diag?.headerLine || "(none)"}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Parsed fields:</span>{" "}
                      <span className="font-mono text-xs">{(diag?.parsedFields || []).join(", ") || "(none)"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* =======================
   Subcomponents
======================= */

function TabTrigger({ value, children }: { value: TabKey; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "rounded-xl border bg-white px-4 py-2 text-sm shadow-sm",
        "hover:bg-gray-50 data-[state=active]:border-gray-900 data-[state=active]:ring-2",
        "data-[state=active]:ring-gray-200"
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

function Card({ r }: { r: Resource }) {
  const uniqueCats = Array.from(new Set(r.categories));

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold leading-snug">{r.title}</div>

      {r.description ? (
        <div className="mt-2 text-sm text-gray-600 line-clamp-3">{r.description}</div>
      ) : (
        <div className="mt-2 text-sm text-gray-400">No description.</div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {uniqueCats.map((c) => (
          <Chip key={`${r.id}-${c}`}>{categoryBadgeLabel(c)}</Chip>
        ))}
      </div>

      {r.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.tags.map((t) => (
            <Tag key={`${r.id}-tag-${t}`}>{t}</Tag>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="text-base">📎</span>
          {r.fileItems.length} file(s)
        </span>
      </div>

      {r.fileItems.length > 0 && (
        <div className="mt-4 space-y-2">
          {r.fileItems.map((f, idx) => (
            <a
              key={`${r.id}-file-${idx}`}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              title={f.url}
            >
              {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl border bg-gray-50 px-3 py-1 text-xs text-gray-700">
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
      #{children}
    </span>
  );
}

