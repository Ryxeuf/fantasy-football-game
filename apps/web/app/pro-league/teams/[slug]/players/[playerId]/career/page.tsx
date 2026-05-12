"use client";

/**
 * Sprint Q lot Q.A.2 — Page career joueur dediee.
 *
 * Sub-page de la fiche joueur principale, focus narratif :
 *  - Header avec career counters
 *  - Mini-graphique SPP cumule sur les 20 derniers matchs
 *  - Top 5 matches (par SPP gagne)
 *  - Section Rivalries : top 3 nemesis (loss) + top 3 souffre-douleur (win)
 *  - Counters casualties (recues vs infligees)
 *
 * Toutes les donnees viennent de `/api/pro-league/players/:id/career`
 * (snapshot lazy compute) + `/api/pro-league/players/:id/history?limit=20`.
 */

import Link from "next/link";
import { JSX, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../../../../../../lib/api-client";

interface PlayerTeamBrief {
  slug: string;
  name: string;
  city: string;
  primaryColor: string | null;
}

interface PlayerDetailMinimal {
  id: string;
  name: string;
  position: string;
  team: PlayerTeamBrief;
}

interface TopMatchEntry {
  matchId: string;
  sppTotal: number;
}

interface CareerSnapshot {
  playerId: string;
  matchesPlayed: number;
  tdTotal: number;
  casTotal: number;
  compTotal: number;
  mvpTotal: number;
  sppTotal: number;
  bestMatchId: string | null;
  bestMatchSpp: number | null;
  worstMatchId: string | null;
  worstMatchSpp: number | null;
  topNemesisTeamId: string | null;
  topVictoryTeamId: string | null;
  topMatches: TopMatchEntry[];
  topNemesisIds: string[];
  topVictoryIds: string[];
  casualtiesReceived: number;
  casualtiesDealt: number;
  streakKind: "win" | "loss" | "draw" | "none";
  streakLength: number;
  recomputedAt: string;
}

interface CareerResponse {
  snapshot: CareerSnapshot;
}

interface PlayerMatchHistoryEntry {
  matchId: string;
  roundNumber: number;
  scheduledAt: string;
  status: string;
  isHome: boolean;
  opponent: PlayerTeamBrief;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  spp: {
    tdCount: number;
    casCount: number;
    compCount: number;
    mvpCount: number;
    totalSpp: number;
  };
}

interface HistoryResponse {
  matches: PlayerMatchHistoryEntry[];
}

interface PageProps {
  params: { slug: string; playerId: string };
}

export default function PlayerCareerPage({ params }: PageProps): JSX.Element {
  const { slug, playerId } = params;
  const [player, setPlayer] = useState<PlayerDetailMinimal | null>(null);
  const [career, setCareer] = useState<CareerSnapshot | null>(null);
  const [history, setHistory] = useState<PlayerMatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiRequest<PlayerDetailMinimal>(`/api/pro-league/players/${playerId}`),
      apiRequest<CareerResponse>(`/api/pro-league/players/${playerId}/career`),
      apiRequest<HistoryResponse>(
        `/api/pro-league/players/${playerId}/history?limit=20`,
      ).catch(() => ({ matches: [] }) as HistoryResponse),
    ])
      .then(([p, c, h]) => {
        if (cancelled) return;
        setPlayer(p);
        setCareer(c.snapshot);
        setHistory(h.matches);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (loading) {
    return (
      <div className="p-6 text-slate-400" data-testid="career-loading">
        <BackLink slug={slug} playerId={playerId} />
        <div className="mt-4">Chargement…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" data-testid="career-page-error">
        <BackLink slug={slug} playerId={playerId} />
        <div className="mt-4 rounded-lg border border-rose-700 bg-rose-900/30 p-4 text-rose-200">
          {error}
        </div>
      </div>
    );
  }

  if (!player || !career) return <></>;

  return (
    <div className="p-6 space-y-6">
      <BackLink slug={slug} playerId={playerId} />

      <header className="space-y-1">
        <h1 className="text-3xl font-heading font-bold text-slate-100">
          Carriere — {player.name}
        </h1>
        <p className="text-sm text-slate-400">
          {player.position} · {player.team.city} {player.team.name}
        </p>
      </header>

      <CareerCountersBlock career={career} />

      {history.length > 0 && (
        <SppTimelineChart history={history} />
      )}

      <TopMatchesSection topMatches={career.topMatches} />

      <RivalriesSection
        topNemesisIds={career.topNemesisIds}
        topVictoryIds={career.topVictoryIds}
      />

      <CasualtiesSection
        received={career.casualtiesReceived}
        dealt={career.casualtiesDealt}
      />
    </div>
  );
}

function BackLink({
  slug,
  playerId,
}: {
  slug: string;
  playerId: string;
}): JSX.Element {
  return (
    <Link
      href={`/pro-league/teams/${slug}/players/${playerId}` as never}
      className="text-sm text-slate-500 hover:text-slate-300"
    >
      ← retour fiche joueur
    </Link>
  );
}

function CareerCountersBlock({
  career,
}: {
  career: CareerSnapshot;
}): JSX.Element {
  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5"
      data-testid="career-counters"
    >
      <Counter label="Matchs" value={career.matchesPlayed} />
      <Counter label="SPP total" value={career.sppTotal} accent />
      <Counter label="TD" value={career.tdTotal} />
      <Counter label="Casualties" value={career.casTotal} />
      <Counter
        label="Streak"
        value={
          career.streakKind === "none"
            ? "—"
            : `${career.streakLength} ${career.streakKind}${career.streakLength > 1 ? "s" : ""}`
        }
        streakKind={career.streakKind}
      />
    </section>
  );
}

function Counter({
  label,
  value,
  accent,
  streakKind,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  streakKind?: "win" | "loss" | "draw" | "none";
}): JSX.Element {
  const color =
    streakKind === "win"
      ? "text-emerald-400"
      : streakKind === "loss"
        ? "text-rose-400"
        : accent
          ? "text-amber-300"
          : "text-slate-200";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function SppTimelineChart({
  history,
}: {
  history: PlayerMatchHistoryEntry[];
}): JSX.Element {
  // history est ordonne newest first ; on inverse pour avoir le temps
  // qui progresse de gauche a droite.
  const points = useMemo(() => {
    const ordered = [...history].reverse();
    let cumul = 0;
    return ordered.map((m, idx) => {
      cumul += m.spp.totalSpp;
      return { x: idx, y: cumul, matchId: m.matchId };
    });
  }, [history]);

  if (points.length === 0) return <></>;

  const W = 600;
  const H = 120;
  const MARGIN = 16;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const maxX = Math.max(points.length - 1, 1);
  const xScale = (x: number) => MARGIN + (x / maxX) * (W - 2 * MARGIN);
  const yScale = (y: number) => H - MARGIN - (y / maxY) * (H - 2 * MARGIN);

  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`,
    )
    .join(" ");

  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
      data-testid="spp-timeline-chart"
    >
      <h2 className="mb-3 text-sm font-medium uppercase text-slate-400">
        SPP cumule (20 derniers matchs)
      </h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full"
        preserveAspectRatio="none"
      >
        <path d={path} fill="none" stroke="#fbbf24" strokeWidth="2" />
        {points.map((p) => (
          <circle
            key={p.matchId}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={2}
            fill="#fbbf24"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>Plus ancien</span>
        <span>SPP final : {points[points.length - 1].y}</span>
        <span>Plus recent</span>
      </div>
    </section>
  );
}

function TopMatchesSection({
  topMatches,
}: {
  topMatches: TopMatchEntry[];
}): JSX.Element {
  if (topMatches.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Top 5 matches
        </h2>
        <p className="text-sm text-slate-500">
          Pas encore assez de matchs.
        </p>
      </section>
    );
  }
  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
      data-testid="top-matches-section"
    >
      <h2 className="mb-3 text-sm font-medium uppercase text-slate-400">
        Top 5 matches
      </h2>
      <ol className="space-y-1">
        {topMatches.map((m, idx) => (
          <li
            key={m.matchId}
            className="flex items-center justify-between rounded border border-slate-800 px-2 py-1"
            data-testid={`top-match-${m.matchId}`}
          >
            <span className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-amber-300">
                #{idx + 1}
              </span>
              <Link
                href={`/pro-league/matches/${m.matchId}` as never}
                className="text-slate-200 hover:text-amber-300"
              >
                Match {m.matchId.slice(0, 8)}…
              </Link>
            </span>
            <span className="font-mono text-sm text-emerald-400">
              {m.sppTotal} SPP
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RivalriesSection({
  topNemesisIds,
  topVictoryIds,
}: {
  topNemesisIds: string[];
  topVictoryIds: string[];
}): JSX.Element {
  return (
    <section
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="rivalries-section"
    >
      <RivalryColumn
        title="Top 3 nemesis (loss vs)"
        emptyMsg="Aucune defaite enregistree"
        ids={topNemesisIds}
        kind="nemesis"
      />
      <RivalryColumn
        title="Top 3 souffre-douleur (win vs)"
        emptyMsg="Aucune victoire enregistree"
        ids={topVictoryIds}
        kind="victory"
      />
    </section>
  );
}

function RivalryColumn({
  title,
  emptyMsg,
  ids,
  kind,
}: {
  title: string;
  emptyMsg: string;
  ids: string[];
  kind: "nemesis" | "victory";
}): JSX.Element {
  const colorClass =
    kind === "nemesis" ? "text-rose-400" : "text-emerald-400";
  return (
    <div
      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
      data-testid={`rivalry-${kind}`}
    >
      <h3 className="mb-2 text-sm font-medium uppercase text-slate-400">
        {title}
      </h3>
      {ids.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMsg}</p>
      ) : (
        <ol className="space-y-1">
          {ids.map((teamId, idx) => (
            <li
              key={teamId}
              className="flex items-center gap-2 text-sm text-slate-200"
              data-testid={`rivalry-${kind}-${teamId}`}
            >
              <span className="font-mono text-xs text-slate-500">
                #{idx + 1}
              </span>
              <span className={`font-mono ${colorClass}`}>{teamId}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CasualtiesSection({
  received,
  dealt,
}: {
  received: number;
  dealt: number;
}): JSX.Element {
  return (
    <section
      className="grid grid-cols-2 gap-3"
      data-testid="casualties-section"
    >
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-3">
        <div className="text-xs uppercase text-rose-400">
          Casualties subies
        </div>
        <div
          className="mt-1 font-mono text-2xl text-rose-200"
          data-testid="casualties-received"
        >
          {received}
        </div>
      </div>
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 p-3">
        <div className="text-xs uppercase text-emerald-400">
          Casualties infligees
        </div>
        <div
          className="mt-1 font-mono text-2xl text-emerald-200"
          data-testid="casualties-dealt"
        >
          {dealt}
        </div>
      </div>
    </section>
  );
}
