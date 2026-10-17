"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../lib/api-client";
import { dynamicRoute } from "../../../lib/typed-route";
import TeamLogo from "../../../components/TeamLogo";
import TeamRosterLink from "../../../leagues/[id]/TeamRosterLink";

// Statistiques d'une coupe, top N au choix : joueurs ou équipes — le
// pendant de la page de classements d'une saison de ligue, servi par
// `GET /cup/:id/leaderboards?topN=`. Chaque équipe mène à son roster.

interface PlayerRow {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamRoster: string;
  value: number;
}

interface TeamRow {
  rank: number;
  teamId: string;
  teamName: string;
  roster: string;
  logoUrl: string | null;
  matchesPlayed: number;
  value: number;
}

interface Category {
  key: string;
  label: string;
  description: string;
}

interface CupLeaderboardsResponse {
  cup: { id: string; name: string };
  topN: number;
  players: Record<string, PlayerRow[] | number>;
  playerCategories: Category[];
  teams: Record<string, TeamRow[]>;
  teamCategories: Category[];
}

type Mode = "players" | "teams";

const CUP_TOP_N_CHOICES = [5, 10, 20, 50] as const;

function RankChip({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
        rank === 1 ? "bg-nuffle-gold text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {rank}
    </span>
  );
}

function Card({
  testId,
  category,
  children,
  empty,
}: {
  testId: string;
  category: Category;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold leading-tight text-nuffle-anthracite">{category.label}</h3>
      <p className="text-xs text-gray-500">{category.description}</p>
      {empty ? (
        <p className="mt-3 text-sm italic text-gray-400">Pas encore de données.</p>
      ) : (
        <ol className="mt-3 space-y-1">{children}</ol>
      )}
    </div>
  );
}

export default function CupStatsPage() {
  const params = useParams();
  const cupId = typeof params.id === "string" ? params.id : "";
  const [mode, setMode] = useState<Mode>("players");
  const [topN, setTopN] = useState<number>(10);
  const [data, setData] = useState<CupLeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cupId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<CupLeaderboardsResponse>(`/cup/${cupId}/leaderboards?topN=${topN}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cupId, topN]);

  const teamLink = (teamId: string, name: string, suffix: string) => (
    <TeamRosterLink
      competition="cup"
      leagueId={cupId}
      teamId={teamId}
      canViewRoster
      testIdSuffix={suffix}
    >
      {name}
    </TeamRosterLink>
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <Link
          href={dynamicRoute(`/cups/${cupId}`)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          {data ? `← Retour à la coupe « ${data.cup.name} »` : "← Retour à la coupe"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          Statistiques de la coupe
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "players"
            ? "Les meilleurs joueurs de la coupe, catégorie par catégorie — agrégés depuis les feuilles de match validées."
            : "Les meilleures équipes de la coupe sur chaque total : touchdowns, défense, sorties, passes, agressions."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white text-sm shadow-sm"
          role="group"
          aria-label="Mode d'affichage"
        >
          {(
            [
              ["players", "Joueurs"],
              ["teams", "Équipes"],
            ] as Array<[Mode, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              data-testid={`cup-stats-mode-${value}`}
              aria-pressed={mode === value}
              className={`px-3.5 py-2 font-medium transition-colors ${
                mode === value ? "bg-nuffle-anthracite text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          Top
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            data-testid="cup-stats-topn"
            className="rounded-lg border border-gray-300 px-2 py-1.5 shadow-sm"
          >
            {CUP_TOP_N_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-gray-500">Chargement des statistiques…</p>}
      {error && (
        <p
          data-testid="cup-stats-error"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!loading && data && mode === "players" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="cup-stats-players">
          {data.playerCategories.map((cat) => {
            const raw = data.players[cat.key];
            const rows = Array.isArray(raw) ? raw : [];
            return (
              <Card key={cat.key} testId={`cup-stats-player-${cat.key}`} category={cat} empty={rows.length === 0}>
                {rows.map((r) => (
                  <li key={r.playerId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <RankChip rank={r.rank} />
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-nuffle-anthracite">{r.playerName}</span>
                        <span className="text-gray-500">
                          {" · "}
                          {teamLink(r.teamId, r.teamName, `stats-${cat.key}-${r.playerId}`)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {r.value}
                    </span>
                  </li>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && data && mode === "teams" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="cup-stats-teams">
          {data.teamCategories.map((cat) => {
            const rows = data.teams[cat.key] ?? [];
            return (
              <Card key={cat.key} testId={`cup-stats-team-${cat.key}`} category={cat} empty={rows.length === 0}>
                {rows.map((r) => (
                  <li key={r.teamId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <RankChip rank={r.rank} />
                      <TeamLogo slug={r.roster} logoUrl={r.logoUrl} size={22} className="shrink-0" />
                      <span className="min-w-0 truncate font-medium text-nuffle-anthracite">
                        {teamLink(r.teamId, r.teamName, `stats-team-${cat.key}-${r.teamId}`)}
                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                          {r.matchesPlayed} MJ
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {r.value}
                    </span>
                  </li>
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
