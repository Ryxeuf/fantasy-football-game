"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../lib/api-client";

interface CategoryStats {
  readonly passing: {
    completions: number;
    attempts: number;
    passingYards: number;
    passingTds: number;
    interceptions: number;
    sacks: number;
  };
  readonly rushing: {
    carries: number;
    rushingYards: number;
    rushingTds: number;
    rushingFumblesLost: number;
  };
  readonly receiving: {
    targets: number;
    receptions: number;
    receivingYards: number;
    receivingTds: number;
    receivingFumblesLost: number;
  };
  readonly defense: {
    tacklesSolo: number;
    tackleAssists: number;
    sacks: number;
    interceptions: number;
    fumblesForced: number;
    fumblesRecovered: number;
    defTds: number;
    passesDefended: number;
  };
}

interface SeasonAggregate {
  readonly seasonId: string;
  readonly gamesPlayed: number;
  readonly totalSpp: number;
}

interface StatRow {
  readonly gameId: string;
  readonly weekId: string;
  readonly weekNumber: number;
  readonly seasonId: string;
  readonly opponent: string;
  readonly isHome: boolean;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly gameStatus: string;
  readonly computedSpp: number | null;
}

interface PlayerDetail {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly teamCode: string | null;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
  readonly bio: {
    headshotUrl: string | null;
    heightInches: number | null;
    weightLbs: number | null;
    ageYears: number | null;
    college: string | null;
    yearsExp: number | null;
  };
  readonly team: {
    code: string;
    city: string;
    raceLabel: string;
    bbRace: string;
  } | null;
  readonly totalSpp: number;
  readonly gamesPlayed: number;
  readonly categoryStats: CategoryStats;
  readonly seasons: ReadonlyArray<SeasonAggregate>;
  readonly stats: ReadonlyArray<StatRow>;
}

function isPasser(pos: string): boolean {
  return pos === "Thrower" || pos === "QB";
}

function isReceiver(pos: string): boolean {
  return ["Catcher", "Runner", "WR", "TE", "RB"].includes(pos);
}

function isDefender(pos: string): boolean {
  return ["Blitzer"].includes(pos) || /^(DE|DT|LB|CB|S|DB)$/.test(pos);
}

export default function NuffleCoachPlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const seasonId = searchParams.get("seasonId") ?? "";
  const playerId = params?.id;

  const [data, setData] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    async function load() {
      try {
        const qs = seasonId ? `?seasonId=${seasonId}` : "";
        const out = await apiRequest<PlayerDetail>(
          `/api/nfl-fantasy/players/${playerId}${qs}`,
        );
        if (!cancelled) setData(out);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [playerId, seasonId]);

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Joueur introuvable</h1>
        <Link
          href="/nfl-fantasy/players"
          className="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300"
        >
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-400">Chargement…</div>;
  }

  return (
    <div className="space-y-8" data-testid="nuffle-coach-player-detail">
      <Link
        href="/nfl-fantasy/players"
        className="text-sm text-slate-400 hover:text-white"
      >
        ← Catalogue joueurs
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {data.bio.headshotUrl ? (
          <Image
            src={data.bio.headshotUrl}
            alt={data.pseudonym}
            width={128}
            height={128}
            className="h-32 w-32 rounded-lg border border-slate-800 bg-slate-900/60 object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-4xl">
            🏈
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-100">
            {data.pseudonym}
            {data.jerseyNumber !== null && (
              <span className="ml-2 text-slate-500">#{data.jerseyNumber}</span>
            )}
          </h1>
          {data.realNameDisplay && (
            <p className="mt-1 text-sm text-slate-500">{data.realName}</p>
          )}
          <p className="mt-2 text-sm text-slate-300">
            {data.bbPosition} · NFL {data.nflPosition} ·{" "}
            <span
              className={
                data.status === "active"
                  ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300"
                  : "rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
              }
            >
              {data.status}
            </span>
          </p>
          {data.team && (
            <p className="mt-2 text-sm text-slate-400">
              {data.team.city} · {data.team.raceLabel} ({data.team.bbRace})
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-slate-500">Total SPP</dt>
              <dd className="text-lg font-semibold text-orange-300">
                {data.totalSpp.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Games</dt>
              <dd className="text-lg font-semibold">{data.gamesPlayed}</dd>
            </div>
            {data.bio.ageYears !== null && (
              <div>
                <dt className="text-xs uppercase text-slate-500">Âge</dt>
                <dd className="text-lg font-semibold">{data.bio.ageYears}</dd>
              </div>
            )}
            {data.bio.college && (
              <div>
                <dt className="text-xs uppercase text-slate-500">Université</dt>
                <dd className="text-sm">{data.bio.college}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <section data-testid="player-category-stats">
        <h2 className="text-xl font-semibold text-slate-100">
          Stats agrégées {seasonId ? `· Saison ${seasonId}` : "· Carrière"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isPasser(data.bbPosition) && (
            <StatCard title="Passing">
              <Row label="Cmp/Att" value={`${data.categoryStats.passing.completions}/${data.categoryStats.passing.attempts}`} />
              <Row label="Yards" value={data.categoryStats.passing.passingYards} />
              <Row label="TDs" value={data.categoryStats.passing.passingTds} />
              <Row label="INTs" value={data.categoryStats.passing.interceptions} />
            </StatCard>
          )}
          <StatCard title="Rushing">
            <Row label="Carries" value={data.categoryStats.rushing.carries} />
            <Row label="Yards" value={data.categoryStats.rushing.rushingYards} />
            <Row label="TDs" value={data.categoryStats.rushing.rushingTds} />
          </StatCard>
          {isReceiver(data.bbPosition) && (
            <StatCard title="Receiving">
              <Row label="Rec/Tgt" value={`${data.categoryStats.receiving.receptions}/${data.categoryStats.receiving.targets}`} />
              <Row label="Yards" value={data.categoryStats.receiving.receivingYards} />
              <Row label="TDs" value={data.categoryStats.receiving.receivingTds} />
            </StatCard>
          )}
          {isDefender(data.bbPosition) && (
            <StatCard title="Defense">
              <Row label="Tackles" value={data.categoryStats.defense.tacklesSolo + data.categoryStats.defense.tackleAssists} />
              <Row label="Sacks" value={data.categoryStats.defense.sacks} />
              <Row label="INTs" value={data.categoryStats.defense.interceptions} />
              <Row label="FF/FR" value={`${data.categoryStats.defense.fumblesForced}/${data.categoryStats.defense.fumblesRecovered}`} />
            </StatCard>
          )}
        </div>
      </section>

      {data.seasons.length > 0 && (
        <section data-testid="player-seasons">
          <h2 className="text-xl font-semibold text-slate-100">Par saison</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Saison</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">Total SPP</th>
                  <th className="px-3 py-2 text-right">SPP/game</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.seasons.map((s) => (
                  <tr key={s.seasonId} className="hover:bg-slate-900/70">
                    <td className="px-3 py-2 font-medium text-slate-100">
                      {s.seasonId}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {s.gamesPlayed}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-300">
                      {s.totalSpp.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {s.gamesPlayed > 0
                        ? (s.totalSpp / s.gamesPlayed).toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.stats.length > 0 && (
        <section data-testid="player-game-log">
          <h2 className="text-xl font-semibold text-slate-100">Game log</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Saison/Week</th>
                  <th className="px-3 py-2">Adversaire</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.stats.slice(0, 50).map((s) => (
                  <tr key={s.gameId} className="hover:bg-slate-900/70">
                    <td className="px-3 py-2 text-slate-300">
                      {s.seasonId}·W{s.weekNumber}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {s.isHome ? "vs " : "@ "}
                      {s.opponent}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {s.homeScore !== null && s.awayScore !== null
                        ? `${s.homeScore}-${s.awayScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-100">
                      {s.computedSpp !== null ? s.computedSpp.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="text-xs uppercase tracking-wide text-slate-400">{title}</h3>
      <dl className="mt-2 space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-100">{value}</dd>
    </div>
  );
}
