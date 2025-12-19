"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import Image from "next/image";
import { ExternalLink, Search, RefreshCcw, AlertTriangle, CalendarDays } from "lucide-react";

type NewsRow = {
  id?: string;
  title?: string;
  date?: string;
  summary?: string;
  url?: string;
  tags?: string;
  imageurl?: string;
};

type NewsItem = {
  id: string;
  title: string;
  date?: string;     // normalized YYYY-MM-DD if parseable
  summary?: string;
  url?: string;
  tags: string[];
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

function normalizeDate(s?: string) {
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

function toNewsItem(r: NewsRow): NewsItem {
  const imageUrl = isHttpUrl(r.imageurl) ? (r.imageurl || "").trim() : undefined;
  return {
    id: (r.id || "").trim(),
    title: (r.title || "").trim(),
    date: normalizeDate(r.date),
    summary: (r.summary || "").trim() || undefined,
    url: isHttpUrl(r.url) ? (r.url || "").trim() : undefined,
    tags: normalizeTags(r.tags),
    imageUrl,
  };
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
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

  const sheetUrl = (process.env.NEXT_PUBLIC_NEWS_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setDiag(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_NEWS_SHEET_CSV_URL is not set.");

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

      const rows: NewsRow[] = ((parsed.data as any[]) || []).map((r: any) => ({
        id: r?.id ?? r?.["ID"] ?? r?.["Id"],
        title: r?.title ?? r?.["Title"],
        date: r?.date ?? r?.createdat ?? r?.created_at ?? r?.["날짜"],
        summary: r?.summary ?? r?.description ?? r?.desc,
        url: r?.url ?? r?.link ?? r?.website,
        tags: r?.tags ?? r?.tag,
        imageurl: r?.imageurl ?? r?.image_url ?? r?.image,
      }));

      const data = rows
        .map(toNewsItem)
        .filter((n) => n.id && n.title)
        .sort((a, b) => {
          const ax = a.date ? Date.parse(a.date) : NaN;
          const bx = b.date ? Date.parse(b.date) : NaN;
          if (Number.isNaN(ax) && Number.isNaN(bx)) return a.title.localeCompare(b.title);
          if (Number.isNaN(ax)) return 1;
          if (Number.isNaN(bx)) return -1;
          return bx - ax;
        });

      setItems(data);

      setDiag({
        status,
        delimiter: delimiter ?? "(Papa default)",
        delimiterReason: reason,
        headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 200),
        parsedFields:
          parsed.meta && (parsed.meta as any).fields ? ((parsed.meta as any).fields as string[]) : [],
      });
    } catch (e: any) {
      setItems([]);
      setErrMsg(e?.message ? String(e.message) : "Unknown error while loading News sheet.");
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
    if (!q) return items;
    return items.filter((n) => {
      const hay = [n.title, n.summary || "", n.tags.join(" "), n.date || ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">News</div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[520px]">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-xl border bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search: title, tags, date..."
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
            No results. Ensure rows have both <span className="font-mono">id</span> and <span className="font-mono">title</span>.
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((n) => (
              <article key={n.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-gray-900">{n.title}</div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                      <CalendarDays className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Date:</span>
                      <span className="font-mono">{n.date || "-"}</span>
                    </div>

                    {n.summary ? (
                      <div className="mt-3 text-sm text-gray-600">{n.summary}</div>
                    ) : (
                      <div className="mt-3 text-sm text-gray-400">No summary.</div>
                    )}

                    {n.url && (
                      <div className="mt-4">
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          Read more <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                      </div>
                    )}

                    {n.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {n.tags.slice(0, 12).map((t) => (
                          <span key={`${n.id}-${t}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {n.imageUrl && (
                    <div className="relative h-40 w-full overflow-hidden rounded-2xl border bg-gray-50 md:h-32 md:w-56">
                      {/* If you use external image URLs, you may need next.config.js images.remotePatterns */}
                      <Image src={n.imageUrl} alt={n.title} fill className="object-cover" />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

