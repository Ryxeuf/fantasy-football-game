"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Page classement détaillé Pro League — sprint Pro League lot 1.C.5.
 *
 * Affiche les 16 équipes triées par points (desc), tdFor (desc) avec :
 * - rang, équipe (couleur primaire), city, race
 * - V/N/D, points
 * - TD+/-/diff, casualties+/-/diff
 * - Forme : 5 derniers résultats (badges colorés)
 *
 * Public, pas d'auth.
 */

type FormChar = "W" | "D" | "L";

interface StandingsTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

interface StandingsRow {
  readonly rank: number;
  readonly team: StandingsTeam;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
  readonly tdDiff: number;
  readonly casualtiesFor: number;
  readonly casualtiesAgainst: number;
  readonly casualtiesDiff: number;
  readonly teamValue: number;
  readonly form: readonly FormChar[];
}

type StandingsSortKey = "rank" | "tv";

function formatTv(gp: number): string {
  if (gp === 0) return "—";
  return `${(gp / 1000).toFixed(0)}k`;
}

interface StandingsSnapshot {
  readonly leagueSlug: string;
  readonly seasonId: string;
  readonly seasonYear: number;
  readonly seasonStatus: string;
  readonly rows: readonly StandingsRow[];
}

const FORM_BADGE_STYLES: Record<FormChar, string> = {
  W: "bg-emerald-700 text-emerald-50",
  D: "bg-slate-600 text-slate-50",
  L: "bg-rose-700 text-rose-50",
};

function FormBadges({ form }: { form: readonly FormChar[] }): JSX.Element {
  const { t } = useLanguage();
  if (form.length === 0) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  const titleFor = (c: FormChar): string => {
    if (c === "W") return t.proLeague.standings.formWin;
    if (c === "D") return t.proLeague.standings.formDraw;
    return t.proLeague.standings.formLoss;
  };
  return (
    <div className="flex gap-0.5" data-testid="form-badges">
      {form.map((c, i) => (
        <span
          key={i}
          className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold font-mono ${FORM_BADGE_STYLES[c]}`}
          title={titleFor(c)}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function formatDiff(d: number): string {
  if (d > 0) return `+${d}`;
  return `${d}`;
}

function diffColorClass(d: number): string {
  if (d > 0) return "text-emerald-300";
  if (d < 0) return "text-rose-300";
  return "text-slate-400";
}

export default function ProLeagueStandingsPage(): JSX.Element {
  const { t } = useLanguage();
  const [data, setData] = useState<StandingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StandingsSortKey>("rank");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<StandingsSnapshot>("/pro-league/seasons/current/standings")
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-slate-50">
            {t.proLeague.standings.title}
          </h1>
          {data ? (
            <p className="mt-1 text-sm text-slate-400">
              {t.proLeague.standings.seasonInfo
                .replace("{year}", String(data.seasonYear))
                .replace("{status}", data.seasonStatus)}
            </p>
          ) : null}
        </div>
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          {t.proLeague.common.backToHub}
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">{t.proLeague.common.loading}</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data || data.rows.length === 0 ? (
        <p className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400">
          {t.proLeague.standings.emptyState}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table
            data-testid="standings-table"
            className="w-full text-sm"
          >
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-10 px-2 py-2 text-left">
                  {t.proLeague.standings.thRank}
                </th>
                <th className="px-2 py-2 text-left">
                  {t.proLeague.standings.thTeam}
                </th>
                <th className="w-10 px-2 py-2 text-center">
                  {t.proLeague.standings.thPlayed}
                </th>
                <th className="w-10 px-2 py-2 text-center">
                  {t.proLeague.standings.thWins}
                </th>
                <th className="w-10 px-2 py-2 text-center">
                  {t.proLeague.standings.thDraws}
                </th>
                <th className="w-10 px-2 py-2 text-center">
                  {t.proLeague.standings.thLosses}
                </th>
                <th className="w-12 px-2 py-2 text-center">
                  {t.proLeague.standings.thPoints}
                </th>
                <th className="w-20 px-2 py-2 text-center">
                  {t.proLeague.standings.thTd}
                </th>
                <th className="w-12 px-2 py-2 text-center">
                  {t.proLeague.standings.thDiff}
                </th>
                <th className="w-20 px-2 py-2 text-center">
                  {t.proLeague.standings.thCas}
                </th>
                <th className="w-12 px-2 py-2 text-center">
                  {t.proLeague.standings.thDiff}
                </th>
                <th
                  data-testid="standings-tv-header"
                  className={`w-14 cursor-pointer px-2 py-2 text-center hover:bg-slate-800 ${
                    sortKey === "tv" ? "text-amber-300" : ""
                  }`}
                  title="Lot I — Team Value totale (somme tvCached actifs). Click pour trier."
                  onClick={() =>
                    setSortKey((k) => (k === "tv" ? "rank" : "tv"))
                  }
                >
                  TV {sortKey === "tv" ? "↓" : ""}
                </th>
                <th className="w-24 px-2 py-2 text-center">
                  {t.proLeague.standings.thForm}
                </th>
              </tr>
            </thead>
            <tbody>
              {(sortKey === "tv"
                ? [...data.rows].sort(
                    (a, b) => b.teamValue - a.teamValue,
                  )
                : data.rows
              ).map((r) => (
                <tr
                  key={r.team.slug}
                  className="border-t border-slate-800 hover:bg-slate-900"
                >
                  <td className="px-2 py-2 font-mono text-slate-400">
                    {r.rank}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 flex-none rounded-full ring-1 ring-slate-700"
                        style={{
                          background: r.team.primaryColor ?? "#475569",
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-100">
                          {r.team.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {r.team.city} · {r.team.race}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-400">
                    {r.played}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-emerald-300">
                    {r.wins}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-300">
                    {r.draws}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-rose-300">
                    {r.losses}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-50">
                    {r.points}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-300">
                    {r.tdFor}–{r.tdAgainst}
                  </td>
                  <td
                    className={`px-2 py-2 text-center font-mono ${diffColorClass(r.tdDiff)}`}
                  >
                    {formatDiff(r.tdDiff)}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-300">
                    {r.casualtiesFor}–{r.casualtiesAgainst}
                  </td>
                  <td
                    className={`px-2 py-2 text-center font-mono ${diffColorClass(r.casualtiesDiff)}`}
                  >
                    {formatDiff(r.casualtiesDiff)}
                  </td>
                  <td
                    data-testid={`standings-tv-${r.team.slug}`}
                    className={`px-2 py-2 text-center font-mono ${
                      sortKey === "tv" ? "text-amber-300" : "text-slate-300"
                    }`}
                  >
                    {formatTv(r.teamValue)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-center">
                      <FormBadges form={r.form} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
