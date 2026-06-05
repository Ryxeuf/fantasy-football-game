"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../../../lib/api-client";

// Lot J — Classements top-N joueurs d'une saison de ligue.
// Endpoint public : pas de gating auth ici.

interface PlayerStatRow {
  rank: number;
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  teamName: string;
  teamRoster: string;
  ownerId: string;
  ownerCoachName: string | null;
  value: number;
  secondary: { matchesPlayed: number; spp: number };
}

interface PlayerStatsCatalogue {
  seasonId: string;
  topN: number;
  scope: "career";
  topScorers: PlayerStatRow[];
  topBashers: PlayerStatRow[];
  topPassers: PlayerStatRow[];
  topInterceptors: PlayerStatRow[];
  topFutureStars: PlayerStatRow[];
  topMvps: PlayerStatRow[];
  topPunchingBags: PlayerStatRow[];
  categories: Array<{ key: keyof PlayerStatsCatalogue; label: string; description: string }>;
}

interface ByTeamResponse {
  seasonId: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    catalogue: PlayerStatsCatalogue;
  }>;
}

type Mode = "global" | "by-team";

export default function LeaderboardsPage() {
  const params = useParams<{ id: string; sid: string }>();
  const leagueId = params?.id ?? "";
  const seasonId = params?.sid ?? "";

  const [mode, setMode] = useState<Mode>("global");
  const [topN, setTopN] = useState(5);
  const [global, setGlobal] = useState<PlayerStatsCatalogue | null>(null);
  const [byTeam, setByTeam] = useState<ByTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!seasonId) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "global") {
        const data = await apiRequest<PlayerStatsCatalogue>(
          `/leagues/seasons/${seasonId}/leaderboards?topN=${topN}`,
        );
        setGlobal(data);
        setByTeam(null);
      } else {
        const data = await apiRequest<ByTeamResponse>(
          `/leagues/seasons/${seasonId}/leaderboards/by-team?topN=${topN}`,
        );
        setByTeam(data);
        setGlobal(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [seasonId, mode, topN]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Classements de la saison</h1>
      <p className="mb-4 text-sm text-slate-600">
        Stats agregees sur les compteurs carriere des joueurs des
        equipes inscrites. La version par-saison precise arrivera
        avec la feuille de match v2.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/leagues/${leagueId}`}
          className="text-sm text-blue-600 underline"
        >
          ← Retour a la ligue
        </Link>
        <span className="mx-2 text-slate-300">|</span>
        <label className="text-sm">
          Mode :{" "}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border px-2 py-1"
            data-testid="leaderboards-mode"
          >
            <option value="global">Toute la ligue</option>
            <option value="by-team">Par equipe</option>
          </select>
        </label>
        <label className="text-sm">
          Top{" "}
          <input
            type="number"
            min={1}
            max={50}
            value={topN}
            onChange={(e) =>
              setTopN(Math.max(1, Math.min(50, Number(e.target.value))))
            }
            className="w-16 rounded border px-2 py-1"
            data-testid="leaderboards-topn"
          />
        </label>
      </div>

      {loading && <p>Chargement...</p>}
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {mode === "global" && global && <GlobalView catalogue={global} />}
      {mode === "by-team" && byTeam && <ByTeamView data={byTeam} />}
    </main>
  );
}

function GlobalView({ catalogue }: { catalogue: PlayerStatsCatalogue }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
      data-testid="leaderboards-global"
    >
      {catalogue.categories.map((cat) => {
        const rows = (catalogue[cat.key] as unknown) as PlayerStatRow[];
        return (
          <LeaderboardCard
            key={cat.key}
            label={cat.label}
            description={cat.description}
            rows={Array.isArray(rows) ? rows : []}
          />
        );
      })}
    </div>
  );
}

function ByTeamView({ data }: { data: ByTeamResponse }) {
  return (
    <div className="space-y-6" data-testid="leaderboards-byteam">
      {data.teams.map((t) => (
        <section
          key={t.teamId}
          className="rounded border bg-white p-4 shadow-sm"
        >
          <h2 className="mb-2 font-semibold">{t.teamName}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {t.catalogue.categories.map((cat) => {
              const rows = (t.catalogue[cat.key] as unknown) as PlayerStatRow[];
              return (
                <LeaderboardCard
                  key={`${t.teamId}-${cat.key}`}
                  label={cat.label}
                  description={cat.description}
                  rows={Array.isArray(rows) ? rows : []}
                  compact
                />
              );
            })}
          </div>
        </section>
      ))}
      {data.teams.length === 0 && (
        <p className="text-slate-600">Aucune equipe inscrite.</p>
      )}
    </div>
  );
}

function LeaderboardCard({
  label,
  description,
  rows,
  compact,
}: {
  label: string;
  description: string;
  rows: PlayerStatRow[];
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={`rounded border bg-white p-3 ${compact ? "" : "shadow-sm"}`}
      >
        <h3 className="font-semibold">{label}</h3>
        <p className="text-xs text-slate-500">{description}</p>
        <p className="mt-2 text-sm text-slate-400">Pas de donnees</p>
      </div>
    );
  }
  return (
    <div
      className={`rounded border bg-white p-3 ${compact ? "" : "shadow-sm"}`}
      data-testid={`leaderboard-card-${label}`}
    >
      <h3 className="font-semibold">{label}</h3>
      <p className="text-xs text-slate-500">{description}</p>
      <ol className="mt-2 space-y-1">
        {rows.map((r) => (
          <li
            key={r.playerId}
            className="flex items-center justify-between text-sm"
          >
            <span>
              <span className="mr-2 font-mono text-slate-400">
                {r.rank}.
              </span>
              <strong>{r.playerName}</strong>{" "}
              <span className="text-xs text-slate-500">
                ({r.position} — {r.teamName})
              </span>
            </span>
            <span className="font-bold">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
