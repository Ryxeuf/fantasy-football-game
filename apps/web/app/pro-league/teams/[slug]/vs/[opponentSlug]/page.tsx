"use client";

/**
 * Sprint Q lot Q.A.3 — Page detail head-to-head entre 2 teams.
 *
 * Affiche :
 *  - Header avec les 2 teams + W-D-L bilan
 *  - Streak actuel (perspective teamA)
 *  - Liste des matchs head-to-head recents (20 max)
 */

import Link from "next/link";
import { JSX, useEffect, useState } from "react";

import { apiRequest } from "../../../../../lib/api-client";

interface TeamBrief {
  id: string;
  slug: string;
  city: string;
  name: string;
  race: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

interface MatchBrief {
  matchId: string;
  seasonYear: number | null;
  scheduledAt: string | null;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: "home" | "away" | "draw" | null;
}

interface RivalryRecord {
  totalMatches: number;
  winsA: number;
  winsB: number;
  draws: number;
  totalTdA: number;
  totalTdB: number;
}

interface RivalrySummary {
  teamA: TeamBrief;
  teamB: TeamBrief;
  record: RivalryRecord;
  lastMatch: MatchBrief | null;
  streakA: { kind: "win" | "loss" | "draw" | "none"; length: number };
  recentMatches: MatchBrief[];
}

interface PageProps {
  params: { slug: string; opponentSlug: string };
}

export default function HeadToHeadPage({ params }: PageProps): JSX.Element {
  const [summary, setSummary] = useState<RivalrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<{ summary: RivalrySummary }>(
      `/pro-league/teams/${encodeURIComponent(params.slug)}/head-to-head/${encodeURIComponent(params.opponentSlug)}`,
    )
      .then((d) => {
        if (!cancelled) setSummary(d.summary);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug, params.opponentSlug]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl bg-slate-950 p-6 text-slate-100">
        <BackLink slug={params.slug} />
        <p className="mt-4 text-sm text-slate-400" data-testid="h2h-loading">
          Chargement…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl bg-slate-950 p-6 text-slate-100">
        <BackLink slug={params.slug} />
        <p
          className="mt-4 rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
          data-testid="h2h-error"
        >
          {error}
        </p>
      </main>
    );
  }

  if (!summary) return <></>;

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-slate-950 p-6 text-slate-100 space-y-6">
      <BackLink slug={params.slug} />

      <header
        className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        data-testid="h2h-header"
      >
        <div className="grid grid-cols-3 items-center gap-3">
          <TeamHero team={summary.teamA} align="left" />
          <div className="text-center">
            <div className="font-mono text-3xl text-amber-300">
              {summary.record.winsA} - {summary.record.draws} - {summary.record.winsB}
            </div>
            <div className="text-xs uppercase text-slate-500">
              W - D - L
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {summary.record.totalMatches} match
              {summary.record.totalMatches > 1 ? "es" : ""}
            </div>
          </div>
          <TeamHero team={summary.teamB} align="right" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
          <div data-testid="h2h-tds">
            <span className="text-xs uppercase text-slate-500">
              TD cumules
            </span>
            <div className="font-mono">
              {summary.record.totalTdA} - {summary.record.totalTdB}
            </div>
          </div>
          <div data-testid="h2h-streak">
            <span className="text-xs uppercase text-slate-500">
              Streak {summary.teamA.slug}
            </span>
            <div
              className={`font-mono ${summary.streakA.kind === "win" ? "text-emerald-400" : summary.streakA.kind === "loss" ? "text-rose-400" : "text-slate-300"}`}
            >
              {summary.streakA.kind === "none"
                ? "—"
                : `${summary.streakA.length} ${summary.streakA.kind}${summary.streakA.length > 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
      </header>

      <section
        className="rounded-lg border border-slate-800 bg-slate-900 p-4"
        data-testid="h2h-matches"
      >
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-400">
          Derniers matchs ({summary.recentMatches.length})
        </h2>
        {summary.recentMatches.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun match joue entre ces 2 equipes.
          </p>
        ) : (
          <ul className="space-y-1">
            {summary.recentMatches.map((m) => (
              <MatchRow
                key={m.matchId}
                match={m}
                teamAId={summary.teamA.id}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function BackLink({ slug }: { slug: string }): JSX.Element {
  return (
    <Link
      href={`/pro-league/teams/${slug}` as never}
      className="text-sm text-slate-500 hover:text-slate-300"
    >
      ← retour equipe
    </Link>
  );
}

function TeamHero({
  team,
  align,
}: {
  team: TeamBrief;
  align: "left" | "right";
}): JSX.Element {
  return (
    <div
      className={align === "left" ? "text-left" : "text-right"}
      data-testid={`h2h-team-${team.slug}`}
    >
      <div className="text-xs text-slate-500">{team.city}</div>
      <div className="text-lg font-bold text-slate-100">{team.name}</div>
      <div className="text-xs text-slate-500">{team.race}</div>
    </div>
  );
}

function MatchRow({
  match,
  teamAId,
}: {
  match: MatchBrief;
  teamAId: string;
}): JSX.Element {
  const aIsHome = match.homeTeamId === teamAId;
  const aScore = aIsHome ? match.scoreHome : match.scoreAway;
  const bScore = aIsHome ? match.scoreAway : match.scoreHome;

  let resultBadge: { label: string; color: string };
  if (match.outcome === "draw") {
    resultBadge = { label: "D", color: "bg-slate-700 text-slate-300" };
  } else if (
    (match.outcome === "home" && aIsHome) ||
    (match.outcome === "away" && !aIsHome)
  ) {
    resultBadge = {
      label: "W",
      color: "bg-emerald-900/60 text-emerald-300",
    };
  } else {
    resultBadge = { label: "L", color: "bg-rose-900/60 text-rose-300" };
  }

  return (
    <li
      className="flex items-center justify-between rounded border border-slate-800 px-2 py-1"
      data-testid={`h2h-match-${match.matchId}`}
    >
      <Link
        href={`/pro-league/matches/${match.matchId}` as never}
        className="flex items-center gap-3 text-sm hover:text-amber-300"
      >
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-xs ${resultBadge.color}`}
        >
          {resultBadge.label}
        </span>
        <span className="font-mono text-slate-200">
          {aScore ?? "?"} - {bScore ?? "?"}
        </span>
        <span className="text-xs text-slate-500">
          {aIsHome ? "(home)" : "(away)"}
        </span>
      </Link>
      <span className="text-xs text-slate-500">
        {match.seasonYear ?? "—"}
      </span>
    </li>
  );
}
