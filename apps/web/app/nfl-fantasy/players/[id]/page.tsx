"use client";

import Link from "next/link";
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
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Joueur introuvable</h1>
        <Link
          href="/nfl-fantasy/players"
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  return (
    <div className="space-y-8" data-testid="nuffle-coach-player-detail">
      <Link
        href="/nfl-fantasy/players"
        className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
      >
        ← Catalogue joueurs
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <PlayerAvatar
          bbPosition={data.bbPosition}
          jerseyNumber={data.jerseyNumber}
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-nuffle-anthracite">
            {data.pseudonym}
            {data.jerseyNumber !== null && (
              <span className="ml-2 text-nuffle-anthracite/60">#{data.jerseyNumber}</span>
            )}
          </h1>
          {data.realNameDisplay && (
            <p className="mt-1 text-sm text-nuffle-anthracite/60">{data.realName}</p>
          )}
          <p className="mt-2 text-sm text-nuffle-anthracite/80">
            {data.bbPosition} · NFL {data.nflPosition} ·{" "}
            <span
              className={
                data.status === "active"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                  : "rounded-full bg-nuffle-bronze/20 px-2 py-0.5 text-xs text-nuffle-anthracite/80"
              }
            >
              {data.status}
            </span>
          </p>
          {data.team && (
            <p className="mt-2 text-sm text-nuffle-anthracite/70">
              {data.team.city} · {data.team.raceLabel} ({data.team.bbRace})
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-nuffle-anthracite/60">Total SPP</dt>
              <dd className="text-lg font-semibold text-nuffle-gold">
                {data.totalSpp.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-nuffle-anthracite/60">Games</dt>
              <dd className="text-lg font-semibold">{data.gamesPlayed}</dd>
            </div>
            {data.bio.ageYears !== null && (
              <div>
                <dt className="text-xs uppercase text-nuffle-anthracite/60">Âge</dt>
                <dd className="text-lg font-semibold">{data.bio.ageYears}</dd>
              </div>
            )}
            {data.bio.college && (
              <div>
                <dt className="text-xs uppercase text-nuffle-anthracite/60">Université</dt>
                <dd className="text-sm">{data.bio.college}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <section data-testid="player-category-stats">
        <h2 className="text-xl font-semibold text-nuffle-anthracite">
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
          <h2 className="text-xl font-semibold text-nuffle-anthracite">Par saison</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-nuffle-bronze/20 bg-white">
            <table className="min-w-full divide-y divide-nuffle-bronze/20 text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
                <tr>
                  <th className="px-3 py-2">Saison</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">Total SPP</th>
                  <th className="px-3 py-2 text-right">SPP/game</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nuffle-bronze/20">
                {data.seasons.map((s) => (
                  <tr key={s.seasonId} className="hover:bg-nuffle-ivory/60">
                    <td className="px-3 py-2 font-medium text-nuffle-anthracite">
                      {s.seasonId}
                    </td>
                    <td className="px-3 py-2 text-right text-nuffle-anthracite/80">
                      {s.gamesPlayed}
                    </td>
                    <td className="px-3 py-2 text-right text-nuffle-gold">
                      {s.totalSpp.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-nuffle-anthracite/70">
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
          <h2 className="text-xl font-semibold text-nuffle-anthracite">Game log</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-nuffle-bronze/20 bg-white">
            <table className="min-w-full divide-y divide-nuffle-bronze/20 text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
                <tr>
                  <th className="px-3 py-2">Saison/Week</th>
                  <th className="px-3 py-2">Adversaire</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nuffle-bronze/20">
                {data.stats.slice(0, 50).map((s) => (
                  <tr key={s.gameId} className="hover:bg-nuffle-ivory/60">
                    <td className="px-3 py-2 text-nuffle-anthracite/80">
                      {s.seasonId}·W{s.weekNumber}
                    </td>
                    <td className="px-3 py-2 text-nuffle-anthracite/70">
                      {s.isHome ? "vs " : "@ "}
                      {s.opponent}
                    </td>
                    <td className="px-3 py-2 text-right text-nuffle-anthracite/70">
                      {s.homeScore !== null && s.awayScore !== null
                        ? `${s.homeScore}-${s.awayScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-nuffle-anthracite">
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
    <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-3">
      <h3 className="text-xs uppercase tracking-wide text-nuffle-anthracite/70">{title}</h3>
      <dl className="mt-2 space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-nuffle-anthracite/60">{label}</dt>
      <dd className="font-medium text-nuffle-anthracite">{value}</dd>
    </div>
  );
}

/**
 * Avatar fictif d'un joueur Nuffle. Volontairement abstrait : on
 * n'utilise PAS la headshot officielle NFL (droit a l'image / NIL).
 * Un emoji adapte au poste BB + le jersey number font office d'icone
 * d'identification.
 */
function PlayerAvatar({
  bbPosition,
  jerseyNumber,
}: {
  bbPosition: string;
  jerseyNumber: number | null;
}) {
  const emoji = avatarEmojiForPosition(bbPosition);
  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border-2 border-nuffle-bronze/30 bg-gradient-to-br from-nuffle-gold/10 via-white to-nuffle-ivory">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      {jerseyNumber !== null && (
        <span className="absolute bottom-1 right-2 font-mono text-sm font-bold text-nuffle-bronze">
          #{jerseyNumber}
        </span>
      )}
    </div>
  );
}

function avatarEmojiForPosition(bbPosition: string): string {
  switch (bbPosition) {
    case "Thrower":
      return "🎯";
    case "Catcher":
      return "🧤";
    case "Runner":
      return "💨";
    case "Blitzer":
      return "⚡";
    case "Big Guy":
      return "🪨";
    case "Lineman":
    default:
      return "🛡️";
  }
}
