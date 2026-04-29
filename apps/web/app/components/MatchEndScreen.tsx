"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../lib/api-client";
import PostMatchSPP from "./PostMatchSPP";

interface TeamStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
}

interface TeamResult {
  name: string;
  coach: string;
  eloRating: number;
  stats: TeamStats;
}

interface MatchResults {
  matchId: string;
  status: string;
  createdAt: string;
  endedAt: string | null;
  score: { teamA: number; teamB: number };
  winner: "A" | "B" | "draw";
  teams: { A: TeamResult; B: TeamResult };
  matchStats: Record<string, any>;
  matchResult: { winner?: string; spp: Record<string, number> };
  winnings: { teamA: number; teamB: number } | null;
  dedicatedFansChange: { teamA: number; teamB: number } | null;
  fanAttendance: number | null;
  players: Array<{
    id: string;
    team: "A" | "B";
    name: string;
    number: number;
    position: string;
  }>;
}

interface MatchEndScreenProps {
  matchId: string;
  myTeamSide: "A" | "B" | null;
  onClose?: () => void;
}

interface NewlyUnlockedAchievement {
  slug: string;
  nameFr: string;
  icon: string;
}

interface AchievementsApiResult {
  achievements?: Array<{
    slug: string;
    nameFr: string;
    icon: string;
    [k: string]: unknown;
  }>;
  newlyUnlocked?: string[];
}

function StatRow({ label, valueA, valueB }: { label: string; valueA: number; valueB: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="w-16 text-right font-semibold text-gray-800">{valueA}</span>
      <span className="flex-1 text-center text-sm text-gray-500">{label}</span>
      <span className="w-16 text-left font-semibold text-gray-800">{valueB}</span>
    </div>
  );
}

function FanChangeLabel({ change }: { change: number }) {
  if (change > 0) return <span className="text-green-600">+{change}</span>;
  if (change < 0) return <span className="text-red-600">{change}</span>;
  return <span className="text-gray-400">—</span>;
}

export default function MatchEndScreen({ matchId, myTeamSide, onClose }: MatchEndScreenProps) {
  const [results, setResults] = useState<MatchResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<NewlyUnlockedAchievement[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
          setError("Non authentifié");
          setLoading(false);
          return;
        }
        const data = await apiRequest<MatchResults>(`/match/${matchId}/results`);
        setResults(data);
      } catch (e) {
        setError(
          e instanceof ApiClientError
            ? e.message || "Erreur lors du chargement des résultats"
            : "Erreur de connexion",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  // S26.2c — Fetch achievements after match ends to surface newly-unlocked
  // ones in a celebration panel with a CTA to /me/achievements.
  useEffect(() => {
    if (!results) return;
    let cancelled = false;
    (async () => {
      try {
        const ach = await apiRequest<AchievementsApiResult>("/achievements");
        if (cancelled) return;
        const slugs = ach.newlyUnlocked ?? [];
        if (slugs.length === 0) {
          setNewlyUnlocked([]);
          return;
        }
        const bySlug = new Map(
          (ach.achievements ?? []).map((a) => [a.slug, a] as const),
        );
        const items: NewlyUnlockedAchievement[] = [];
        for (const slug of slugs) {
          const def = bySlug.get(slug);
          if (def) items.push({ slug, nameFr: def.nameFr, icon: def.icon });
        }
        setNewlyUnlocked(items);
      } catch {
        // Silently ignore — the match-end screen must remain usable even
        // if the achievements endpoint fails or is unavailable.
        if (!cancelled) setNewlyUnlocked([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [results]);

  const handleReturnToLobby = () => {
    if (onClose) {
      onClose();
    } else {
      window.location.href = "/lobby";
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin h-8 w-8 border-3 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center max-w-md">
          <p className="text-red-600 font-semibold mb-4">Erreur : {error || "Résultats indisponibles"}</p>
          <button
            onClick={handleReturnToLobby}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Retour au lobby
          </button>
        </div>
      </div>
    );
  }

  const { score, winner, teams } = results;

  // Determine outcome message for this player
  let outcomeText: string;
  let outcomeColor: string;
  if (winner === "draw") {
    outcomeText = "Match Nul";
    outcomeColor = "text-yellow-500";
  } else if (myTeamSide === winner) {
    outcomeText = "Victoire !";
    outcomeColor = "text-green-500";
  } else if (myTeamSide && myTeamSide !== winner) {
    outcomeText = "Défaite";
    outcomeColor = "text-red-500";
  } else {
    // Spectator: show winner team name
    outcomeText = `${teams[winner].name} gagne !`;
    outcomeColor = "text-blue-500";
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header — outcome banner */}
        <div className={`py-6 text-center ${
          winner === "draw" ? "bg-yellow-50" : myTeamSide === winner ? "bg-green-50" : myTeamSide ? "bg-red-50" : "bg-blue-50"
        }`}>
          <h1 className={`text-3xl font-bold font-heading ${outcomeColor}`}>
            {outcomeText}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Match terminé</p>
        </div>

        {/* Score section */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{teams.A.name}</p>
              <p className="text-xs text-gray-400">{teams.A.coach}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-5xl font-bold ${winner === "A" ? "text-green-600" : "text-gray-700"}`}>
                {score.teamA}
              </span>
              <span className="text-2xl text-gray-300">—</span>
              <span className={`text-5xl font-bold ${winner === "B" ? "text-green-600" : "text-gray-700"}`}>
                {score.teamB}
              </span>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{teams.B.name}</p>
              <p className="text-xs text-gray-400">{teams.B.coach}</p>
            </div>
          </div>
        </div>

        {/* ELO section */}
        <div className="px-6 pb-4">
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <span className="text-xs text-gray-400 uppercase">ELO</span>
              <p className="text-lg font-bold text-gray-700">{teams.A.eloRating}</p>
            </div>
            <div className="text-center">
              <span className="text-xs text-gray-400 uppercase">ELO</span>
              <p className="text-lg font-bold text-gray-700">{teams.B.eloRating}</p>
            </div>
          </div>
        </div>

        {/* Team stats comparison */}
        <div className="px-6 pb-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Statistiques
            </h3>
            <StatRow label="Touchdowns" valueA={teams.A.stats.touchdowns} valueB={teams.B.stats.touchdowns} />
            <StatRow label="Sorties" valueA={teams.A.stats.casualties} valueB={teams.B.stats.casualties} />
            <StatRow label="Passes" valueA={teams.A.stats.completions} valueB={teams.B.stats.completions} />
            <StatRow label="Interceptions" valueA={teams.A.stats.interceptions} valueB={teams.B.stats.interceptions} />
          </div>
        </div>

        {/* Winnings & Fan Factor section */}
        {(results.winnings || results.dedicatedFansChange) && (
          <div className="px-6 pb-4">
            <div className="bg-amber-50 rounded-xl p-4">
              <h3 className="text-center text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
                Gains &amp; Fans
              </h3>
              {results.winnings && (
                <div className="flex items-center justify-between py-2 border-b border-amber-200">
                  <span className="w-24 text-right font-semibold text-gray-800">
                    {results.winnings.teamA.toLocaleString()} po
                  </span>
                  <span className="flex-1 text-center text-sm text-gray-500">Gains</span>
                  <span className="w-24 text-left font-semibold text-gray-800">
                    {results.winnings.teamB.toLocaleString()} po
                  </span>
                </div>
              )}
              {results.dedicatedFansChange && (
                <div className="flex items-center justify-between py-2">
                  <span className="w-24 text-right font-semibold">
                    <FanChangeLabel change={results.dedicatedFansChange.teamA} />
                  </span>
                  <span className="flex-1 text-center text-sm text-gray-500">Fans Dévoués</span>
                  <span className="w-24 text-left font-semibold">
                    <FanChangeLabel change={results.dedicatedFansChange.teamB} />
                  </span>
                </div>
              )}
              {results.fanAttendance != null && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  Affluence : {results.fanAttendance} fans
                </p>
              )}
            </div>
          </div>
        )}

        {/* SPP section — reuse existing component */}
        {results.matchStats && Object.keys(results.matchStats).length > 0 && results.players.length > 0 && (
          <div className="px-6 pb-4">
            <PostMatchSPP
              matchStats={results.matchStats}
              matchResult={results.matchResult as any}
              players={results.players}
              teamAName={teams.A.name}
              teamBName={teams.B.name}
            />
          </div>
        )}

        {/* S26.2c — Newly unlocked achievements panel */}
        {newlyUnlocked.length > 0 && (
          <div className="px-6 pb-4">
            <div
              data-testid="match-end-newly-unlocked"
              className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 p-4 shadow-md"
            >
              <h3 className="text-center text-sm font-bold text-amber-900 uppercase tracking-wide">
                <span aria-hidden>🎉 </span>
                {newlyUnlocked.length} nouveau
                {newlyUnlocked.length > 1 ? "x" : ""} succès débloqué
                {newlyUnlocked.length > 1 ? "s" : ""}
              </h3>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {newlyUnlocked.map((ach) => (
                  <li
                    key={ach.slug}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-amber-300 px-3 py-1 text-sm font-semibold text-amber-900"
                  >
                    <span aria-hidden>{ach.icon}</span>
                    <span>{ach.nameFr}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-center">
                <a
                  data-testid="match-end-newly-unlocked-cta"
                  href="/me/achievements"
                  className="inline-block px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
                >
                  Voir mes succès
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Return to lobby button */}
        <div className="px-6 pb-6 pt-2 text-center">
          <button
            onClick={handleReturnToLobby}
            className="px-8 py-3 bg-nuffle-gold text-nuffle-anthracite font-bold rounded-lg hover:bg-nuffle-gold/90 transition-colors shadow-md hover:shadow-lg"
          >
            Retour au lobby
          </button>
        </div>
      </div>
    </div>
  );
}
