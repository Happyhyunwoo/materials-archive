"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Papa from "papaparse";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Search,
  Code2,
  BookOpen,
  FileText,
  ExternalLink,
  AlertTriangle,
  RefreshCcw,
  Tag as TagIcon,
  CalendarDays,
} from "lucide-react";

/* =======================
   Fallback Sheet CSV URL
   - Prefer setting NEXT_PUBLIC_SHEET_CSV_URL in Vercel.
   - If env var is missing, this fallback is used.
======================= */
const FALLBACK_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-REPLACE_WITH_YOURS/pub?output=csv";

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
  icon?: React.ReactNode;
}> = [
  { key: "all", label: "All", match: CATEGORY_KEYS },
  { key: "python", label: "Python code", match: ["python"], icon: <Code2 className="h-4 w-4" /> },
  { key: "lecture", label: "Lecture", match: ["lecture"], icon: <BookOpen className="h-4 w-4" /> },
  { key: "article", label: "Article", match: ["article"], icon: <FileText className="h-4 w-4" /> },
];

/* =======================
   Small class joiner (avoid "@/lib/cn" dependency)
======================= */
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const c = normalizeList(raw, ",");
  if (c.length > 1) return c;
  const sc = normalizeList(raw, ";");
  if (sc.length > 1) return sc;
  const p = normalizeList(raw, "|");
  if (p.length > 1) return p;
  return raw.split(/\s+/g).map((v) => v.trim()).filter(Boolean);
}

function normalizeCategories(s: string): Category[] {
  const raw = (s || "").trim();
  if (!raw) return [];

  const tokens =
    normalizeList(raw, ",").length > 1
      ? normalizeList(raw, ",")
      : normalizeList(raw, ";").length > 1
        ? normalizeList(raw, ";")
        : normalizeList(raw, "|").length > 1
          ? normalizeList(raw, "|")
          : [raw];

  return tokens
    .map((c) => {
      const x = (c || "").toLowerCase().trim();
      if (x === "tool") return "python";
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
      if (!url && name.startsWith("http")) return { name: "File", url: name };
      return { name: name || "File", url };
    })
    .filter((x) => x.url);
}

function normalizeCreatedAt(s?: string) {
  const raw = (s || "").trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toResource(r: ResourceRow): Resource {
  return {
    id: (r.id || "").trim(),
    title: (r.title || "").trim(),
    description: (r.description || "").trim(),
    categories: normalizeCategories(r.categories || ""),
    tags: normalizeTags(r.tags || ""),
    fileItems: normalizeFiles(r.files || ""),
    createdAt: normalizeCreatedAt(r.createdAt),
  };
}

function detectDelimiter(text: string): { delimiter?: string; reason: string } {
  const firstLine = (text || "").split(/\r?\n/)[0] || "";
  if (firstLine.includes("\t")) return { delimiter: "\t", reason: "TAB delimiter detected in header" };
  if (firstLine.includes(",")) return { delimiter: ",", reason: "Comma delimiter detected in header" };
  if (firstLine.includes(";")) return { delimiter: ";", reason: "Semicolon delimiter detected in header" };
  return { delimiter: undefined, reason: "No obvious delimiter; using Papa default" };
}

function categoryLabel(cat: Category) {
  if (cat === "python") return "Python code";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function categoryIcon(cat: Category) {
  switch (cat) {
    case "python":
      return <Code2 className="h-3.5 w-3.5" />;
    case "lecture":
      return <BookOpen className="h-3.5 w-3.5" />;
    case "article":
      return <FileText className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function categoryBadgeClass(cat: Category) {
  switch (cat) {
    case "python":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "lecture":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "article":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

/* =======================
   Component
======================= */
export default function Archive() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Diagnostics
  const [usedUrl, setUsedUrl] = useState<string>("");
  const [diag, setDiag] = useState<{
    status?: number;
    delimiter?: string;
    delimiterReason?: string;
    headerLine?: string;
    parsedFields?: string[];
  } | null>(null);

  const sheetUrl =
    (process.env.NEXT_PUBLIC_SHEET_CSV_URL || "").trim() ||
    (FALLBACK_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setDiag(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_SHEET_CSV_URL is not set (and no fallback URL is configured).");

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

      const normalizedRows: ResourceRow[] = ((parsed.data as any[]) || []).map((r: any) => ({
        id: r?.id ?? r?.["ID"] ?? r?.["Id"],
        title: r?.title ?? r?.["Title"],
        description: r?.description ?? r?.["desc"] ?? r?.["설명"],
        categories: r?.categories ?? r?.["category"] ?? r?.["카테고리"],
        tags: r?.tags ?? r?.["tag"] ?? r?.["태그"],
        files: r?.files ?? r?.["file"] ?? r?.["자료"] ?? r?.["링크"],
        createdAt:
          r?.createdat ??
          r?.["created_at"] ??
          r?.["createdat"] ??
          r?.["date"] ??
          r?.["날짜"],
      }));

      const data = normalizedRows.map(toResource).filter((x) => x.id && x.title);
      setRows(data);

      setDiag({
        status,
        delimiter: delimiter ?? "(Papa default)",
        delimiterReason: reason,
        headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 200),
        parsedFields: (parsed.meta && (parsed.meta as any).fields) ? (parsed.meta as any).fields : [],
      });
    } catch (e: any) {
      setRows([]);
      setErrMsg(e?.message ? String(e.message) : "Unknown error while loading sheet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl]);

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = { all: rows.length, python: 0, lecture: 0, article: 0 };
    for (const r of rows) {
      if (r.categories.includes("python")) base.python += 1;
      if (r.categories.includes("lecture")) base.lecture += 1;
      if (r.categories.includes("article")) base.article += 1;
    }
    return base;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const ax = a.createdAt ? Date.parse(a.createdAt) : NaN;
      const bx = b.createdAt ? Date.parse(b.createdAt) : NaN;
      if (Number.isNaN(ax) && Number.isNaN(bx)) return 0;
      if (Number.isNaN(ax)) return 1;
      if (Number.isNaN(bx)) return -1;
      return bx - ax;
    });
    return copy;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = TABS.find((t) => t.key === tab) || TABS[0];

    return sortedRows
      .filter((r) => {
        if (active.key === "all") return true;
        return r.categories.some((c) => active.match.includes(c));
      })
      .filter((r) => {
        if (!q) return true;
        const hay = [
          r.title,
          r.description,
          r.tags.join(" "),
          r.categories.map(categoryLabel).join(" "),
          r.fileItems.map((f) => f.name).join(" "),
          r.createdAt || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [sortedRows, query, tab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="mb-6 flex items-center gap-4 rounded-2xl border bg-white px-6 py-4 shadow-sm">
            <Image src="/yonsei-logo.png" alt="Yonsei University" width={56} height={56} priority />
            <div>
              <div className="text-xl font-semibold tracking-tight text-gray-900">Yonsei HW Lab</div>
              <div className="text-sm text-gray-600">Materials Archive</div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[520px]">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search: title, tags, file names, date..."
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

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <Tabs.List className="inline-flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <Tabs.Trigger
                    key={t.key}
                    value={t.key}
                    className={cx(
                      "rounded-xl border bg-white px-4 py-2 text-sm shadow-sm",
                      "hover:bg-gray-50 data-[state=active]:border-gray-900 data-[state=active]:ring-2 data-[state=active]:ring-gray-200"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {t.icon}
                      <span>{t.label}</span>
                      <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs text-gray-700">
                        {counts[t.key]}
                      </span>
                    </span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs.Root>

            <div className="text-xs text-gray-600">{loading ? "Loading…" : `Showing ${filtered.length} result(s)`}</div>
          </div>
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
            No results.
            <div className="mt-2 text-sm text-gray-600">
              Check your Google Sheets CSV link, column headers, and whether the row has both <span className="font-mono">id</span>{" "}
              and <span className="font-mono">title</span>.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-gray-500">Public archive powered by Google Sheets export.</div>
      </footer>
    </div>
  );
}

/* =======================
   Card
======================= */
function ResourceCard({ r }: { r: Resource }) {
  const cats = Array.from(new Set(r.categories));
  const tags = r.tags;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-snug">{r.title}</div>

          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span className="font-medium">Uploaded:</span>
            <span className="font-mono">{r.createdAt || "-"}</span>
          </div>
        </div>
      </div>

      {r.description ? (
        <div className="mt-3 text-sm text-gray-600">{r.description}</div>
      ) : (
        <div className="mt-3 text-sm text-gray-400">No description.</div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {cats.length === 0 ? (
          <span className="text-xs text-gray-400">No category.</span>
        ) : (
          cats.map((c) => (
            <span
              key={`${r.id}-c-${c}`}
              className={cx("inline-flex items-center rounded-xl border px-3 py-1 text-xs", categoryBadgeClass(c))}
            >
              <span className="inline-flex items-center gap-1.5">
                {categoryIcon(c)}
                {categoryLabel(c)}
              </span>
            </span>
          ))
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 10).map((t) => (
            <Tag key={`${r.id}-t-${t}`}>{t}</Tag>
          ))}
          {tags.length > 10 && <Tag>+{tags.length - 10}</Tag>}
        </div>
      )}

      <div className="mt-5 border-t pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm">Files</span>
            <span className="rounded-md bg-black/5 px-2 py-0.5 text-xs text-gray-700">{r.fileItems.length}</span>
          </span>
        </div>

        {r.fileItems.length === 0 ? (
          <div className="text-sm text-gray-400">No files.</div>
        ) : (
          <div className="space-y-2">
            {r.fileItems.map((f, idx) => (
              <a
                key={`${r.id}-f-${idx}`}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                title={f.url}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-900">{f.name}</div>
                  <div className="truncate text-xs text-gray-500">{f.url}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-700" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
      <TagIcon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

