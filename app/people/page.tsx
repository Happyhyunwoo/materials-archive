"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Papa from "papaparse";
import { ExternalLink, Mail, IdCard } from "lucide-react";

type PeopleRow = {
  id?: string;
  name?: string;
  role?: string;
  status?: string;
  interests?: string;
  methods?: string;
  photoUrl?: string;
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
  photoUrl?: string;
  website?: string;
  orcid?: string;
  email?: string;
  affiliation?: string;
  order: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeList(s: string): string[] {
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

function normalizeOrcid(s?: string) {
  const raw = (s || "").trim();
  if (!raw) return undefined;
  // Accept either full URL or bare ORCID iD
  if (raw.startsWith("http")) return raw;
  // Very light validation: 0000-0000-0000-0000 pattern
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(raw)) return `https://orcid.org/${raw}`;
  return raw; // keep as-is if user stored something else
}

function toNumber(v: unknown, fallback = 9999) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toPerson(r: PeopleRow): Person {
  const id = (r.id || "").trim();
  const name = (r.name || "").trim();

  const photoUrl = isHttpUrl(r.photoUrl) ? (r.photoUrl || "").trim() : undefined;
  const website = isHttpUrl(r.website) ? (r.website || "").trim() : undefined;

  return {
    id,
    name,
    role: (r.role || "").trim() || undefined,
    status: (r.status || "").trim() || undefined,
    interests: normalizeList(r.interests || ""),
    methods: normalizeList(r.methods || ""),
    photoUrl,
    website,
    orcid: normalizeOrcid(r.orcid),
    email: (r.email || "").trim() || undefined,
    affiliation: (r.affiliation || "").trim() || undefined,
    order: toNumber(r.order, 9999),
  };
}

function detectDelimiter(text: string): { delimiter?: string; reason: string } {
  const firstLine = (text || "").split(/\r?\n/)[0] || "";
  if (firstLine.includes("\t")) return { delimiter: "\t", reason: "TAB delimiter detected in header" };
  if (firstLine.includes(",")) return { delimiter: ",", reason: "Comma delimiter detected in header" };
  if (firstLine.includes(";")) return { delimiter: ";", reason: "Semicolon delimiter detected in header" };
  return { delimiter: undefined, reason: "No obvious delimiter; using Papa default" };
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Diagnostics (useful while you iterate)
  const [usedUrl, setUsedUrl] = useState<string>("");
  const [diag, setDiag] = useState<{
    status?: number;
    delimiter?: string;
    delimiterReason?: string;
    headerLine?: string;
    parsedFields?: string[];
  } | null>(null);

  const sheetUrl = (process.env.NEXT_PUBLIC_PEOPLE_SHEET_CSV_URL || "").trim();

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setDiag(null);

    try {
      if (!sheetUrl) throw new Error("NEXT_PUBLIC_PEOPLE_SHEET_CSV_URL is not set.");

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

      const normalizedRows: PeopleRow[] = ((parsed.data as any[]) || []).map((r: any) => ({
        id: r?.id ?? r?.["ID"] ?? r?.["Id"],
        name: r?.name ?? r?.["Name"],
        role: r?.role,
        status: r?.status,
        interests: r?.interests,
        methods: r?.methods,
        photoUrl: r?.photourl ?? r?.["photoUrl"] ?? r?.["photo_url"] ?? r?.["photo"],
        website: r?.website ?? r?.["site"],
        orcid: r?.orcid,
        email: r?.email,
        affiliation: r?.affiliation,
        order: r?.order,
      }));

      const data = normalizedRows
        .map(toPerson)
        .filter((p) => p.id && p.name)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

      setPeople(data);

      setDiag({
        status,
        delimiter: delimiter ?? "(Papa default)",
        delimiterReason: reason,
        headerLine: (text.split(/\r?\n/)[0] || "").slice(0, 200),
        parsedFields:
          parsed.meta && (parsed.meta as any).fields ? ((parsed.meta as any).fields as string[]) : [],
      });
    } catch (e: any) {
      setPeople([]);
      setErrMsg(e?.message ? String(e.message) : "Unknown error while loading People sheet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl]);

  const grouped = useMemo(() => {
    // Simple grouping by status; falls back to "People"
    const map = new Map<string, Person[]>();
    for (const p of people) {
      const key = (p.status || "").trim() || "People";
      map.set(key, [...(map.get(key) || []), p]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [people]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-2 text-2xl font-semibold tracking-tight text-gray-900">People</div>
          <div className="text-sm text-gray-600">Lab members and collaborators.</div>
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
                <IdCard className="h-4 w-4" />
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
        ) : people.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
            No results.
            <div className="mt-2 text-sm text-gray-600">
              Check the People sheet CSV link and ensure rows have both <span className="font-mono">id</span> and{" "}
              <span className="font-mono">name</span>.
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([groupName, members]) => (
              <section key={groupName}>
                <div className="mb-4 text-sm font-semibold text-gray-900">{groupName}</div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {members.map((p) => (
                    <PersonCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-gray-500">People directory powered by Google Sheets.</div>
      </footer>
    </div>
  );
}

function PersonCard({ p }: { p: Person }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl border bg-gray-50">
          {p.photoUrl ? (
            // next/image requires a configured remotePatterns in next.config.js for arbitrary domains.
            // If you have not configured that yet, consider leaving photoUrl blank or using a local image.
            <Image src={p.photoUrl} alt={p.name} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No photo</div>
          )}
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
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-1 hover:bg-gray-50"
              >
                Website <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
              </a>
            )}
            {p.orcid && (
              <a
                href={p.orcid}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-1 hover:bg-gray-50"
              >
                ORCID <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
              </a>
            )}
            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-1 hover:bg-gray-50"
              >
                Email <Mail className="h-3.5 w-3.5 text-gray-500" />
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
              <div className="mt-1 text-sm text-gray-600">{p.interests.join(", ")}</div>
            </div>
          )}
          {p.methods.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-900">Methods</div>
              <div className="mt-1 text-sm text-gray-600">{p.methods.join(", ")}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

