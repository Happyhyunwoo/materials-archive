"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Papa from "papaparse";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";
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
  Library,
} from "lucide-react";

/* =======================
   Optional hard-coded fallback
======================= */
const FALLBACK_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/XXXXXXXXXXXXXXXXXXXXXXXX/pub?output=csv";

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
  return raw.split(/\s+/g).filter(Boolean);
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
    .map((c) => c.toLowerCase().trim())
    .filter((x): x is Category =>
      (CATEGORY_KEYS as readonly string[]).includes(x)
    );
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
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
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
      return <Library className="h-3.5 w-3.5" />;
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

  const sheetUrl =
    process.env.NEXT_PUBLIC_SHEET_CSV_URL?.trim() ||
    FALLBACK_SHEET_CSV_URL;

  async function load() {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch(sheetUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.toLowerCase().trim(),
      });
      const data = ((parsed.data as any[]) || [])
  .map(toResource)
  .filter((r) => r.id && r.title);

      setRows(data);
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const active = TABS.find((t) => t.key === tab)!;
    return rows.filter((r) => {
      if (tab !== "all" && !r.categories.some((c) => active.match.includes(c))) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.join(" ").toLowerCase().includes(q)
      );
    });
  }, [rows, tab, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {/* Yonsei logo header */}
          <div className="mb-6 flex items-center gap-4 rounded-2xl border bg-white px-6 py-4 shadow-sm">
            <Image
              src="/yonsei-logo.png"
              alt="Yonsei University"
              width={56}
              height={56}
              priority
            />
            <div>
              <div className="text-xl font-semibold tracking-tight text-gray-900">
                Yonsei HW Lab
              </div>
              <div className="text-sm text-gray-600">
                Materials Archive
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[520px]">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-xl border bg-white px-10 py-3 text-sm"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm shadow-sm hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload
            </button>
          </div>

          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-5">
            <Tabs.List className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <Tabs.Trigger
                  key={t.key}
                  value={t.key}
                  className="rounded-xl border bg-white px-4 py-2 text-sm shadow-sm data-[state=active]:ring-2"
                >
                  <span className="inline-flex items-center gap-2">
                    {t.icon}
                    {t.label}
                  </span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : errMsg ? (
          <div className="text-sm text-red-700">{errMsg}</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* =======================
   Card
======================= */
function ResourceCard({ r }: { r: Resource }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-base font-semibold">{r.title}</div>

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
        <CalendarDays className="h-4 w-4" />
        {r.createdAt || "-"}
      </div>

      <div className="mt-3 text-sm text-gray-600">{r.description}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        {r.categories.map((c) => (
          <span
            key={c}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs",
              categoryBadgeClass(c)
            )}
          >
            {categoryIcon(c)}
            {categoryLabel(c)}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {r.fileItems.map((f, i) => (
          <a
            key={i}
            href={f.url}
            target="_blank"
            className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <span className="truncate">{f.name}</span>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </a>
        ))}
      </div>
    </div>
  );
}

