"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fold,
  searchRecords,
  countByType,
  type SearchRecord,
  type SearchType,
} from "./search";

const TYPE_META: Record<SearchType, { label: string; chip: string }> = {
  rule: { label: "Règles", chip: "bg-nuffle-gold/15 text-nuffle-bronze" },
  skill: { label: "Compétences", chip: "bg-emerald-100 text-emerald-800" },
  position: { label: "Positions", chip: "bg-indigo-100 text-indigo-800" },
  roster: { label: "Équipes", chip: "bg-amber-100 text-amber-800" },
  star: { label: "Star Players", chip: "bg-purple-100 text-purple-800" },
};

const TYPE_ORDER: SearchType[] = ["rule", "skill", "position", "roster", "star"];

/** Surligne les termes de la requête dans un extrait (insensible aux accents). */
function highlight(text: string, terms: string[]): ReactNode {
  if (terms.length === 0) return text;
  const chars = Array.from(text);
  const folded = chars.map((c) => fold(c)).join("");
  const marked = new Array<boolean>(chars.length).fill(false);
  for (const term of terms) {
    let idx = folded.indexOf(term);
    while (idx >= 0) {
      for (let i = idx; i < idx + term.length; i++) marked[i] = true;
      idx = folded.indexOf(term, idx + term.length);
    }
  }
  const nodes: ReactNode[] = [];
  let buf = "";
  let cur = false;
  let key = 0;
  const flush = () => {
    if (!buf) return;
    nodes.push(
      cur ? (
        <mark
          key={key++}
          className="rounded bg-nuffle-gold/30 px-0.5 text-nuffle-anthracite"
        >
          {buf}
        </mark>
      ) : (
        <span key={key++}>{buf}</span>
      ),
    );
    buf = "";
  };
  for (let i = 0; i < chars.length; i++) {
    if (marked[i] !== cur) {
      flush();
      cur = marked[i];
    }
    buf += chars[i];
  }
  flush();
  return nodes;
}

interface SearchClientProps {
  readonly records: readonly SearchRecord[];
}

export default function SearchClient({ records }: SearchClientProps): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [activeType, setActiveType] = useState<SearchType | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronise l'URL (partageable) sans recharger, en différé.
  useEffect(() => {
    const handle = setTimeout(() => {
      const sp = new URLSearchParams();
      if (query.trim()) sp.set("q", query.trim());
      const qs = sp.toString();
      router.replace(qs ? `/recherche?${qs}` : "/recherche", { scroll: false });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allHits = useMemo(
    () => searchRecords(records, query),
    [records, query],
  );
  const counts = useMemo(() => countByType(allHits), [allHits]);
  const terms = useMemo(
    () => fold(query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2),
    [query],
  );
  const hits = useMemo(
    () =>
      activeType === "all"
        ? allHits
        : allHits.filter((h) => h.record.type === activeType),
    [allHits, activeType],
  );

  const trimmed = query.trim();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-bold text-nuffle-anthracite">
          Recherche
        </h1>
        <p className="text-sm text-nuffle-anthracite/65">
          Règles, compétences, positions, équipes et star players.
        </p>
      </header>

      {/* Champ de recherche */}
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nuffle-anthracite/40"
        >
          🔍
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une règle, une compétence, une position…"
          aria-label="Rechercher"
          data-testid="search-input"
          className="w-full rounded-2xl border border-nuffle-bronze/25 bg-white py-3 pl-11 pr-4 text-[15px] text-nuffle-anthracite shadow-sm outline-none transition focus:border-nuffle-gold focus:ring-2 focus:ring-nuffle-gold/30"
        />
      </div>

      {trimmed.length === 0 ? (
        <p className="rounded-xl border border-dashed border-nuffle-bronze/25 bg-nuffle-ivory/30 px-4 py-8 text-center text-sm text-nuffle-anthracite/55">
          Saisissez un terme pour explorer tout le contenu public du site.
        </p>
      ) : (
        <>
          {/* Filtres par type */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par type">
            <FilterChip
              label="Tout"
              count={allHits.length}
              active={activeType === "all"}
              onClick={() => setActiveType("all")}
            />
            {TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => (
              <FilterChip
                key={t}
                label={TYPE_META[t].label}
                count={counts[t]}
                active={activeType === t}
                onClick={() => setActiveType(t)}
              />
            ))}
          </div>

          <p className="text-xs text-nuffle-anthracite/55" data-testid="search-count">
            {hits.length} résultat{hits.length > 1 ? "s" : ""}
            {activeType === "all" ? "" : ` · ${TYPE_META[activeType].label}`}
          </p>

          {hits.length === 0 ? (
            <p className="rounded-xl border border-nuffle-bronze/20 bg-white px-4 py-8 text-center text-sm text-nuffle-anthracite/60">
              Aucun résultat pour «&nbsp;{trimmed}&nbsp;».
            </p>
          ) : (
            <ul className="space-y-2" data-testid="search-results">
              {hits.map((hit) => {
                const meta = TYPE_META[hit.record.type];
                return (
                  <li key={hit.record.id}>
                    <Link
                      href={hit.record.url}
                      className="group block rounded-xl border border-nuffle-bronze/20 bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-nuffle-gold/60 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                        <span className="truncate font-heading font-semibold text-nuffle-anthracite group-hover:text-nuffle-gold">
                          {highlight(hit.record.title, terms)}
                        </span>
                        {hit.record.subtitle && (
                          <span className="ml-auto hidden truncate text-xs text-nuffle-anthracite/50 sm:block">
                            {hit.record.subtitle}
                          </span>
                        )}
                      </div>
                      {hit.snippet && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-nuffle-anthracite/70">
                          {highlight(hit.snippet, terms)}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-nuffle-anthracite text-white"
          : "bg-white text-nuffle-anthracite/70 ring-1 ring-inset ring-nuffle-bronze/25 hover:bg-nuffle-ivory/50"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          active ? "bg-white/20" : "bg-nuffle-anthracite/10"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
