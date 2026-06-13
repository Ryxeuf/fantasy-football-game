"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamLogo from "../../components/TeamLogo";
import { useLanguage } from "../../contexts/LanguageContext";
import type { RosterSummary, Season } from "../TeamsListClient";
import {
  getRosterMeta,
  DIFFICULTY_LABELS,
  DIFFICULTY_RANK,
  PLAYSTYLE_LABELS,
  type Lang,
} from "../roster-meta";
import { canonicalMatchup } from "../matchup";
import { COMPARATOR_I18N } from "./comparator-i18n";

const API_BASE_PUBLIC =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8201";

const MAX_SELECTION = 3;
const MIN_SELECTION = 2;

interface RosterComparatorClientProps {
  initialRosters: RosterSummary[];
  initialSeason: Season;
  /** Slugs pré-sélectionnés (lien partagé), optionnel. */
  initialSelected?: string[];
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case "I":
      return "bg-emerald-100 text-emerald-800 ring-emerald-300";
    case "II":
      return "bg-sky-100 text-sky-800 ring-sky-300";
    case "III":
      return "bg-amber-100 text-amber-800 ring-amber-300";
    case "IV":
      return "bg-orange-100 text-orange-800 ring-orange-300";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-300";
  }
}

/** Petite échelle visuelle 1→3 pour la difficulté (jetons or). */
function DifficultyScale({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            i <= rank ? "bg-nuffle-gold" : "bg-nuffle-bronze/20"
          }`}
        />
      ))}
    </span>
  );
}

export default function RosterComparatorClient({
  initialRosters,
  initialSeason,
  initialSelected,
}: RosterComparatorClientProps) {
  const { language } = useLanguage();
  const lang: Lang = language === "en" ? "en" : "fr";
  const tr = COMPARATOR_I18N[lang];

  const [rosters, setRosters] = useState<RosterSummary[]>(initialRosters);
  const [selected, setSelected] = useState<string[]>(() => {
    const known = new Set(initialRosters.map((r) => r.slug));
    return (initialSelected ?? []).filter((s) => known.has(s)).slice(0, MAX_SELECTION);
  });
  const [query, setQuery] = useState("");

  // Re-fetch English names when the user toggles away from the default (fr).
  useEffect(() => {
    if (language === "fr") {
      setRosters(initialRosters);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_PUBLIC}/api/rosters?lang=en&ruleset=${initialSeason}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setRosters(
          data.rosters.map((r: any) => ({
            slug: r.slug,
            name: r.name,
            budget: r.budget,
            tier: r.tier,
            naf: r.naf,
            positionCount: r._count?.positions ?? 0,
          })),
        );
      } catch {
        // Keep the initial server-rendered rosters on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language, initialRosters, initialSeason]);

  const bySlug = useMemo(
    () => new Map(rosters.map((r) => [r.slug, r])),
    [rosters],
  );

  const selectedRosters = useMemo(
    () => selected.map((s) => bySlug.get(s)).filter((r): r is RosterSummary => Boolean(r)),
    [selected, bySlug],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rosters.filter((r) => r.name.toLowerCase().includes(q))
      : rosters;
    return [...list].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
      return a.name.localeCompare(b.name);
    });
  }, [rosters, query]);

  const atMax = selected.length >= MAX_SELECTION;

  function toggle(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, slug];
    });
  }

  // Lien partageable indexable quand exactement 2 équipes sont choisies.
  const shareMatchup =
    selectedRosters.length === 2
      ? canonicalMatchup(selectedRosters[0].slug, selectedRosters[1].slug)
      : null;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6 font-body">
      <nav
        aria-label="Fil d'Ariane"
        className="text-sm font-subtitle text-nuffle-bronze/80"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-nuffle-gold transition-colors">
              {lang === "en" ? "Home" : "Accueil"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/teams" className="hover:text-nuffle-gold transition-colors">
              {lang === "en" ? "Teams" : "Équipes"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-nuffle-anthracite font-semibold" aria-current="page">
            {lang === "en" ? "Compare" : "Comparer"}
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-nuffle-anthracite leading-tight">
          {tr.pageTitle}
        </h1>
        <p className="mt-2 text-nuffle-bronze/90 max-w-3xl">{tr.pageIntro}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-subtitle">
          <Link
            href="/teams/tier-list"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1B1610] px-4 py-1.5 font-bold uppercase tracking-wide text-nuffle-gold ring-1 ring-nuffle-gold/50 hover:bg-[#241c12] transition-colors"
          >
            🏆 {tr.tierList}
          </Link>
          <Link
            href="/teams"
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-nuffle-bronze/40 px-4 py-1.5 font-bold uppercase tracking-wide text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite transition-colors"
          >
            {tr.backToTeams}
          </Link>
        </div>
      </header>

      {/* Sélecteur d'équipes */}
      <section className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-4 sm:p-6 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl text-nuffle-anthracite">
              {tr.pick}
            </h2>
            <p className="text-sm text-nuffle-bronze/80 mt-0.5">{tr.pickHint}</p>
          </div>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="self-start sm:self-auto text-sm font-subtitle font-semibold text-nuffle-red hover:underline"
            >
              {tr.clear} ({selected.length})
            </button>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="roster-search" className="sr-only">
            {tr.search}
          </label>
          <input
            id="roster-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr.search}
            className="w-full rounded-xl border border-nuffle-bronze/30 bg-white/70 px-4 py-2.5 text-nuffle-anthracite placeholder:text-nuffle-bronze/50 focus:outline-none focus:ring-2 focus:ring-nuffle-gold/60"
          />
        </div>

        {atMax && (
          <p className="mt-2 text-xs font-subtitle text-nuffle-bronze/70">
            {tr.maxReached}
          </p>
        )}

        <div
          className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
          data-testid="comparator-picker"
        >
          {filtered.map((roster) => {
            const isSelected = selected.includes(roster.slug);
            const disabled = !isSelected && atMax;
            return (
              <button
                key={roster.slug}
                type="button"
                onClick={() => toggle(roster.slug)}
                disabled={disabled}
                aria-pressed={isSelected}
                data-testid={`picker-${roster.slug}`}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  isSelected
                    ? "border-nuffle-gold bg-nuffle-gold/10 ring-1 ring-nuffle-gold/50"
                    : disabled
                      ? "border-nuffle-bronze/10 bg-white/40 opacity-50 cursor-not-allowed"
                      : "border-nuffle-bronze/20 bg-white/70 hover:border-nuffle-gold/60 hover:-translate-y-0.5"
                }`}
              >
                <TeamLogo slug={roster.slug} size={32} title={roster.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-subtitle font-semibold text-sm text-nuffle-anthracite">
                    {roster.name}
                  </span>
                  <span className="block text-xs text-nuffle-bronze/70">
                    {tr.tier} {roster.tier}
                  </span>
                </span>
                {isSelected && (
                  <span className="text-nuffle-gold font-bold" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="mt-4 text-center text-nuffle-bronze/70">{tr.emptyState}</p>
        )}
      </section>

      {/* Comparaison */}
      {selectedRosters.length < MIN_SELECTION ? (
        <p
          className="rounded-xl border border-dashed border-nuffle-bronze/30 bg-white/40 px-4 py-6 text-center text-nuffle-bronze/80 font-subtitle"
          data-testid="comparator-hint"
        >
          {tr.minSelection}
        </p>
      ) : (
        <section data-testid="comparator-result" className="space-y-4">
          {shareMatchup && (
            <div className="rounded-xl border border-nuffle-bronze/20 bg-white/60 px-4 py-3 text-sm">
              <span className="font-subtitle font-semibold text-nuffle-bronze">
                {tr.shareableLink} :{" "}
              </span>
              <Link
                href={`/teams/comparer/${shareMatchup}`}
                className="font-mono text-nuffle-gold hover:underline break-all"
              >
                /teams/comparer/{shareMatchup}
              </Link>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-nuffle-bronze/20 bg-[#FBF7EC] shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#1B1610] text-left px-4 py-3 font-subtitle text-xs uppercase tracking-wide text-nuffle-gold">
                    {/* coin */}
                  </th>
                  {selectedRosters.map((roster) => (
                    <th
                      key={roster.slug}
                      className="bg-[#1B1610] px-4 py-3 text-center align-bottom min-w-[160px]"
                    >
                      <span className="flex flex-col items-center gap-2">
                        <TeamLogo slug={roster.slug} size={44} title={roster.name} />
                        <span className="font-heading font-bold text-nuffle-ivory leading-tight">
                          {roster.name}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-nuffle-bronze/15">
                <ComparisonRow label={tr.tier}>
                  {selectedRosters.map((r) => (
                    <td key={r.slug} className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${tierBadgeClass(r.tier)}`}
                      >
                        {tr.tier} {r.tier}
                      </span>
                    </td>
                  ))}
                </ComparisonRow>

                <ComparisonRow label={tr.budget}>
                  {selectedRosters.map((r) => (
                    <td key={r.slug} className="px-4 py-3 text-center font-score text-lg text-nuffle-anthracite">
                      {r.budget}k
                    </td>
                  ))}
                </ComparisonRow>

                <ComparisonRow label={tr.positions}>
                  {selectedRosters.map((r) => (
                    <td key={r.slug} className="px-4 py-3 text-center font-semibold text-nuffle-anthracite">
                      {r.positionCount}
                    </td>
                  ))}
                </ComparisonRow>

                <ComparisonRow label={tr.difficulty}>
                  {selectedRosters.map((r) => {
                    const meta = getRosterMeta(r.slug);
                    return (
                      <td key={r.slug} className="px-4 py-3">
                        <span className="flex flex-col items-center gap-1.5">
                          <DifficultyScale rank={DIFFICULTY_RANK[meta.difficulty]} />
                          <span className="text-xs font-subtitle text-nuffle-bronze">
                            {DIFFICULTY_LABELS[lang][meta.difficulty]}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </ComparisonRow>

                <ComparisonRow label={tr.playStyle}>
                  {selectedRosters.map((r) => {
                    const meta = getRosterMeta(r.slug);
                    return (
                      <td key={r.slug} className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full border border-nuffle-bronze/30 bg-white/60 px-3 py-0.5 text-xs font-subtitle font-semibold text-nuffle-bronze">
                          {PLAYSTYLE_LABELS[lang][meta.playStyle]}
                        </span>
                      </td>
                    );
                  })}
                </ComparisonRow>

                <ComparisonRow label={tr.nafApproved}>
                  {selectedRosters.map((r) => (
                    <td key={r.slug} className="px-4 py-3 text-center">
                      {r.naf ? (
                        <span className="text-nuffle-gold font-bold">NAF</span>
                      ) : (
                        <span className="text-nuffle-bronze/70">{tr.official}</span>
                      )}
                    </td>
                  ))}
                </ComparisonRow>

                <ComparisonRow label={tr.starPlayers}>
                  {selectedRosters.map((r) => {
                    const meta = getRosterMeta(r.slug);
                    return (
                      <td key={r.slug} className="px-4 py-3 text-center align-top">
                        {meta.starPlayers.length > 0 ? (
                          <ul className="space-y-0.5 text-xs text-nuffle-anthracite/80">
                            {meta.starPlayers.map((sp) => (
                              <li key={sp}>{sp}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-nuffle-bronze/50">{tr.noStars}</span>
                        )}
                      </td>
                    );
                  })}
                </ComparisonRow>

                <ComparisonRow label={tr.summary}>
                  {selectedRosters.map((r) => {
                    const meta = getRosterMeta(r.slug);
                    return (
                      <td key={r.slug} className="px-4 py-3 align-top text-left text-xs text-nuffle-anthracite/80 leading-relaxed">
                        {lang === "en" ? meta.shortEn : meta.shortFr}
                      </td>
                    );
                  })}
                </ComparisonRow>

                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[#FBF7EC] px-4 py-3 text-left font-subtitle text-xs uppercase tracking-wide text-nuffle-bronze/70"
                  >
                    {tr.viewDetail}
                  </th>
                  {selectedRosters.map((r) => (
                    <td key={r.slug} className="px-4 py-3 text-center">
                      <Link
                        href={`/teams/${r.slug}?ruleset=${initialSeason}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-nuffle-gold/15 px-3 py-1.5 text-xs font-subtitle font-bold text-nuffle-bronze hover:bg-nuffle-gold/30 transition-colors"
                      >
                        {tr.viewDetail} →
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-[#FBF7EC] px-4 py-3 text-left font-subtitle text-xs uppercase tracking-wide text-nuffle-bronze/70 whitespace-nowrap"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}
