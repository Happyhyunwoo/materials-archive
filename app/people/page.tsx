"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { ExternalLink, Mail, IdCard } from "lucide-react";

/* =======================
   Types
======================= */

type PeopleRow = {
  id?: string;
  name?: string;
  role?: string;
  status?: string;
  interests?: string;
  methods?: string;
  website?: string;
  orcid?: string;
  email?: string;
  affiliation?: string;
  order?: string | number;
};

type Person = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  interests: string[];
  methods: string[];
  website?: string;
  orcid?: string;
  email?: string;
  affiliation?: string;
  order: number;
};

/* =======================
   Utilities
======================= */

function normalizeList(s: string): string[] {
  const raw = (s || "").trim();
  if (!raw) return [];
  if (raw.includes(",")) return raw.split(",").map(x => x.trim()).filter(Boolean);
  if (raw.includes(";")) return raw.split(";").map(x => x.trim()).filter(Boolean);
  if (raw.includes("|")) return raw.split("|").map(x => x.trim()).filter(Boolean);
  return raw.split(/\s+/).filter(Boolean);
}

function isHttpUrl(s?: string) {
  const v = (s || "").trim();
  return v.startsWith("http://") || v.startsWith("https://");
}

function normalizeOrcid(s?: string) {
  const raw = (s || "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(raw)) {
    return `https://orcid.org/${raw}`;
  }
  return raw;
}

function toNumber(v: unknown, fallback = 9999) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function toPerson(r: PeopleRow): Person {
  return {
    id: (r.id || "").trim(),
    name: (r.name || "").trim(),
    role: (r.role || "").trim() || undefined,
    status: (r.status || "").trim() || undefined,
    interests: normalizeList(r.interests || ""),
    methods: normalizeList(r.methods || ""),
    website: isHttpUrl(r.website) ? r.website!.trim() : undefined,
    orcid: normalizeOrcid(r.orcid),
    email: (r.email || "").trim() || undefined,
    affiliation: (r.affiliation || "").trim() || undefined,
    order: toNumber(r.order),
  };
}

function detectDelimiter(text: string): { delimiter?: string; reason: string } {
  const header = (text || "").split(/\r?\n/)[0] || "";
  if (header.includes("\t")) return { delimiter: "\t", reason: "TAB detected" };
  if (header.includes(",")) return { delimiter: ",", reason: "Comma detected" };
  if (header.includes(";")) return { delimiter: ";", reason: "Semicolon detected" };
  return { delimiter: undefined, reason: "Papa default" };
}

/* =======================
   Page
======================= */

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [usedUrl, setUsedUrl] = useState("");
  const [diag, setDiag] = useState<any>(null);

  const sheetUrl = (process.env.NEXT_PUBLIC_PEOPLE_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_PEOPLE_SHEET_CSV_URL is not set.");

      setUsedUrl(sheetUrl);

      const res = await fetch(sheetUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const { delimiter, reason } = detectDelimiter(text);

      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: h => h.trim().toLowerCase(),
      });

      const rows: PeopleRow[] = (parsed.data as any[]).map(r => ({
        id: r.id,
        name: r.name,
        role: r.role,
        status: r.status,
        interests: r.interests,
        methods: r.methods,
        website: r.website,
        orcid: r.orcid,
        email: r.email,
        affiliation: r.affiliation,
        order: r.order,
      }));

      const data = rows
        .map(toPerson)
        .filter(p => p.id && p.name)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

      setPeople(data);

      setDiag({
        delimiter: delimiter ?? "(default)",
        reason,
        fields: parsed.meta?.fields || [],
      });
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to load People sheet.");
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sheetUrl]);

  const grouped = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of people) {
      const key = p.status || "People";
      map.set(key, [...(map.get(key) || []), p]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [people]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-2xl font-semibold text-gray-900">People</div>
          <div className="text-sm text-gray-600">Lab members and collaborators.</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : errMsg ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-red-700">
            {errMsg}
            <div className="mt-2 text-xs text-gray-500">
              URL: <span className="font-mono break-all">{usedUrl}</span>
            </div>
          </div>
        ) : people.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
            No results. Check that the sheet has both <code>id</code> and <code>name</code>.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([group, members]) => (
              <section key={group}>
                <div className="mb-4 text-sm font-semibold text-gray-900">{group}</div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {members.map(p => (
                    <PersonCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-gray-500">
          People directory powered by Google Sheets.
        </div>
      </footer>
    </div>
  );
}

/* =======================
   Card (NO IMAGES)
======================= */

function PersonCard({ p }: { p: Person }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Initial-only placeholder */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-gray-50 text-sm font-semibold text-gray-500">
          {p.name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-gray-900">{p.name}</div>
          <div className="mt-1 text-sm text-gray-600">
            {[p.role, p.affiliation].filter(Boolean).join(" · ") || " "}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {p.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 hover:bg-gray-50"
              >
                Website <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {p.orcid && (
              <a
                href={p.orcid}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 hover:bg-gray-50"
              >
                ORCID <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 hover:bg-gray-50"
              >
                Email <Mail className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {(p.interests.length > 0 || p.methods.length > 0) && (
        <div className="mt-4 space-y-3 text-sm">
          {p.interests.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-900">Interests</div>
              <div className="mt-1 text-gray-600">{p.interests.join(", ")}</div>
            </div>
          )}
          {p.methods.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-900">Methods</div>
              <div className="mt-1 text-gray-600">{p.methods.join(", ")}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

