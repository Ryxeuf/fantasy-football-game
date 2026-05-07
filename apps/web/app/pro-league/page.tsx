"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api-client";

import { WalletBadge } from "./_components/WalletBadge";

/**
 * Page d'accueil Pro League — sprint Pro League lot 1.C.1.
 *
 * Affiche :
 * - Header branding "Old World League"
 * - Saison courante (statut, year)
 * - Round courant + compte à rebours T-21h mardi pour le prochain match
 * - Cards "Prochains matchs" avec couleurs équipe
 * - Top 8 du classement live
 *
 * Pas d'auth — public.
 */

interface HubLeague {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly branding: unknown;
}

interface HubSeason {
  readonly id: string;
  readonly year: number;
  readonly status: string;
  readonly engineVer: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

interface HubRound {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string | null;
}

interface HubTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

interface HubMatch {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string;
  readonly homeTeam: HubTeam;
  readonly awayTeam: HubTeam;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
}

interface HubStandingsEntry {
  readonly teamSlug: string;
  readonly teamName: string;
  readonly teamCity: string;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
}

interface HubData {
  readonly league: HubLeague;
  readonly season: HubSeason | null;
  readonly currentRound: HubRound | null;
  readonly nextMatches: readonly HubMatch[];
  readonly standings: readonly HubStandingsEntry[];
}

function formatRelativeTo(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return "en cours";
  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / 86_400);
  const hours = Math.floor((diffSec % 86_400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  if (days >= 1) return `J-${days}j ${hours}h`;
  if (hours >= 1) return `T-${hours}h${minutes.toString().padStart(2, "0")}`;
  return `T-${minutes}min`;
}

function MatchCard({ match, now }: { match: HubMatch; now: Date }): JSX.Element {
  const at = new Date(match.scheduledAt);
  const formatted = at.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Link
      href={`/pro-league/matches/${match.id}/live`}
      className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900 p-3 transition hover:bg-slate-800"
      data-testid="match-card"
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Round {match.roundNumber}</span>
        <span className="font-mono">{formatRelativeTo(at, now)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <TeamPill team={match.homeTeam} />
        <span className="font-mono text-xs text-slate-500">vs</span>
        <TeamPill team={match.awayTeam} alignRight />
      </div>
      <div className="mt-1 text-xs text-slate-500">{formatted}</div>
    </Link>
  );
}

function TeamPill({
  team,
  alignRight = false,
}: {
  team: HubTeam;
  alignRight?: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex flex-1 items-center gap-2 ${alignRight ? "flex-row-reverse text-right" : ""}`}
    >
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-700"
        style={{ background: team.primaryColor ?? "#475569" }}
      />
      <div className={alignRight ? "flex flex-col items-end" : "flex flex-col"}>
        <span className="text-sm font-semibold text-slate-100">
          {team.name}
        </span>
        <span className="text-xs text-slate-500">{team.city}</span>
      </div>
    </div>
  );
}

function StandingsTable({
  rows,
}: {
  rows: readonly HubStandingsEntry[];
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Le classement apparaîtra après la première journée.
      </p>
    );
  }
  return (
    <table
      data-testid="standings-table"
      className="w-full table-fixed text-sm"
    >
      <thead>
        <tr className="text-left text-xs uppercase text-slate-500">
          <th className="w-8 py-1">#</th>
          <th className="py-1">Équipe</th>
          <th className="w-10 py-1 text-center">J</th>
          <th className="w-10 py-1 text-center">Pts</th>
          <th className="w-12 py-1 text-center">TD</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => (
          <tr
            key={s.teamSlug}
            className="border-t border-slate-800 hover:bg-slate-900"
          >
            <td className="py-1 font-mono text-slate-400">{i + 1}</td>
            <td className="py-1">
              <span className="font-medium text-slate-100">{s.teamName}</span>
              <span className="ml-1 text-xs text-slate-500">{s.teamCity}</span>
            </td>
            <td className="py-1 text-center font-mono text-slate-400">
              {s.played}
            </td>
            <td className="py-1 text-center font-mono font-semibold text-slate-100">
              {s.points}
            </td>
            <td className="py-1 text-center font-mono text-slate-400">
              {s.tdFor}-{s.tdAgainst}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ProLeagueHubPage(): JSX.Element {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Refresh "now" toutes les 60s pour que le compte à rebours bouge.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<HubData>("/pro-league/seasons/current")
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

  const motto = useMemo(() => {
    const branding = data?.league.branding as
      | { motto?: string }
      | null
      | undefined;
    return branding?.motto ?? null;
  }, [data?.league.branding]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header data-testid="hub-header" className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-wide text-slate-50">
            {data?.league.name ?? "Pro League"}
          </h1>
          <WalletBadge />
        </div>
        {motto ? (
          <p className="mt-1 text-sm italic text-slate-400">"{motto}"</p>
        ) : null}
        {data?.season ? (
          <p className="mt-2 text-sm text-slate-300">
            Saison {data.season.year} · {data.season.status} · engine{" "}
            <span className="font-mono">{data.season.engineVer}</span>
          </p>
        ) : null}
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
      ) : !data?.season ? (
        <p className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400">
          Aucune saison active pour le moment. La prochaine kickoff sera
          annoncée bientôt.
        </p>
      ) : (
        <>
          {data.currentRound ? (
            <section
              data-testid="current-round"
              className="mb-6 rounded border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Round {data.currentRound.roundNumber}
                  </h2>
                  <p className="text-xs uppercase text-slate-500">
                    {data.currentRound.status}
                  </p>
                </div>
                {data.currentRound.scheduledAt ? (
                  <span className="font-mono text-sm text-emerald-300">
                    {formatRelativeTo(
                      new Date(data.currentRound.scheduledAt),
                      now,
                    )}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          <section data-testid="next-matches" className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Prochains matchs
            </h2>
            {data.nextMatches.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucun match programmé.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.nextMatches.map((m) => (
                  <MatchCard key={m.id} match={m} now={now} />
                ))}
              </div>
            )}
          </section>

          <section data-testid="standings">
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Classement
            </h2>
            <StandingsTable rows={data.standings} />
          </section>
        </>
      )}
    </main>
  );
}
