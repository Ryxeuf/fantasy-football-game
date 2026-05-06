"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

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
  readonly form: readonly FormChar[];
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
  if (form.length === 0) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <div className="flex gap-0.5" data-testid="form-badges">
      {form.map((c, i) => (
        <span
          key={i}
          className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold font-mono ${FORM_BADGE_STYLES[c]}`}
          title={c === "W" ? "Win" : c === "D" ? "Draw" : "Loss"}
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
  const [data, setData] = useState<StandingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            Classement
          </h1>
          {data ? (
            <p className="mt-1 text-sm text-slate-400">
              Saison {data.seasonYear} · {data.seasonStatus}
            </p>
          ) : null}
        </div>
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Hub
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data || data.rows.length === 0 ? (
        <p className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400">
          Pas encore de matchs joués cette saison — le classement
          apparaîtra après la première journée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table
            data-testid="standings-table"
            className="w-full text-sm"
          >
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-10 px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Équipe</th>
                <th className="w-10 px-2 py-2 text-center">J</th>
                <th className="w-10 px-2 py-2 text-center">V</th>
                <th className="w-10 px-2 py-2 text-center">N</th>
                <th className="w-10 px-2 py-2 text-center">D</th>
                <th className="w-12 px-2 py-2 text-center">Pts</th>
                <th className="w-20 px-2 py-2 text-center">TD</th>
                <th className="w-12 px-2 py-2 text-center">+/-</th>
                <th className="w-20 px-2 py-2 text-center">Cas</th>
                <th className="w-12 px-2 py-2 text-center">+/-</th>
                <th className="w-24 px-2 py-2 text-center">Forme</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
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
