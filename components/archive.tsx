"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Search } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

/* =======================
   Types
======================= */

type ResourceRow = {
  id: string;
  title: string;
  description: string;
  categories: string; // comma-separated
  tags: string;       // comma-separated
  files: string;      // name::url | name::url
  createdAt?: string;
};

type FileItem = {
  name: string;
  url: string;
};

type Resource = {
  id: string;
  title: string;
  description: string;
  categories: string[];
  tags: string[];
  fileItems: FileItem[];
  createdAt?: string;
};

/* =======================
   Helpers
======================= */

function normalizeList(s: string, sep = ","): string[] {
  return (s || "")
    .split(sep)
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizeFiles(s: string): FileItem[] {
  return (s || "")
    .split("|")
    .map(v => v.trim())
    .filter(Boolean)
    .map(part => {
      const [nameRaw, urlRaw] = part.split("::");
      const name = (nameRaw || "").trim();
      const url = (urlRaw || "").trim();

      // fallback: URL만 들어온 경우
      if (!url && name.startsWith("http")) {
        return { name: "File", url: name };
      }

      return {
        name: name || "File",
        url,
      };
    })
    .filter(f => f.url);
}

function toResource(r: ResourceRow): Resource {
  return {
    id: (r.id || "").trim(),
    title: (r.title || "").trim(),
    description: (r.description || "").trim(),
    categories: normalizeList(r.categories).map(c => c.toLowerCase()),
    tags: normalizeList(r.tags),
    fileItems: normalizeFiles(r.files),
    createdAt: r.createdAt?.trim(),
  };
}

/* =======================
   Tabs
======================= */

const TAB_KEYS = ["all", "article", "lecture", "tool"] as const;
type TabKey = typeof TAB_KEYS[number];

/* =======================
   Main Component
======================= */

export default function Archive() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);

  const sheetUrl = process.env.NEXT_PUBLIC_SHEET_CSV_URL;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!sheetUrl) {
          throw new Error("NEXT_PUBLIC_SHEET_CSV_URL is not set");
        }

        const res = await fetch(sheetUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch CSV: ${res.status}`);
        }

        const csvText = await res.text();
        const parsed = Papa.parse<ResourceRow>(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const data = (parsed.data || [])
          .map(toResource)
          .filter(r => r.id && r.title);

        if (!cancelled) setRows(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setRows([]);
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
    const c: Record<TabKey, number> = {
      all: rows.length,
      article: 0,
      lecture: 0,
      tool: 0,
    };

    for (const r of rows) {
      if (r.categories.includes("article")) c.article += 1;
      if (r.categories.includes("lecture")) c.lecture += 1;
      if (r.categories.includes("tool")) c.tool += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => (tab === "all" ? true : r.categories.includes(tab)))
      .filter(r => {
        if (!q) return true;
        const hay = [
          r.title,
          r.description,
          r.tags.join(" "),
          r.categories.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [rows, query, tab]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg border flex items-center justify-center">
              <span className="text-sm font-semibold">📘</span>
            </div>
            <div className="text-xl font-semibold">Materials Archive</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Search */}
        <div className="mb-5">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <input
              className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2"
              placeholder="Search by title, description, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <Tabs.List className="inline-flex rounded-xl bg-gray-100 p-1">
            <TabTrigger value="all">All ({counts.all})</TabTrigger>
            <TabTrigger value="article">article ({counts.article})</TabTrigger>
            <TabTrigger value="lecture">lecture ({counts.lecture})</TabTrigger>
            <TabTrigger value="tool">tool ({counts.tool})</TabTrigger>
          </Tabs.List>
        </Tabs.Root>

        {/* Cards */}
        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-600">No results.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(r => (
                <Card key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* =======================
   Subcomponents
======================= */

function TabTrigger({
  value,
  children,
}: {
  value: TabKey;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "px-4 py-2 text-sm rounded-lg",
        "data-[state=active]:bg-white data-[state=active]:shadow",
        "text-gray-700"
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

function Card({ r }: { r: Resource }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold">{r.title}</div>

      <div className="mt-2 text-sm text-gray-600 line-clamp-2">
        {r.description}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {r.categories.map(c => (
          <Chip key={`${r.id}-${c}`}>{c}</Chip>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="text-base">📄</span>
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
    <span className="inline-flex items-center gap-2 rounded-xl border bg-gray-50 px-3 py-1 text-xs text-gray-700">
      <span className="text-sm">🏷️</span>
      {children}
    </span>
  );
}

