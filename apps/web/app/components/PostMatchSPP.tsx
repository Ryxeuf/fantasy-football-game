"use client";

import { useMemo } from "react";

/** SPP values per action (BB3 Season 2/3 rules) */
const SPP_VALUES = {
  touchdown: 3,
  casualty: 2,
  completion: 1,
  interception: 1,
  mvp: 4,
} as const;

interface PlayerMatchStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}

interface PlayerInfo {
  id: string;
  team: "A" | "B";
  name: string;
  number: number;
  position: string;
}

interface MatchResult {
  winner?: "A" | "B";
  spp: Record<string, number>;
}

interface PostMatchSPPProps {
  matchStats: Record<string, PlayerMatchStats>;
  matchResult: MatchResult;
  players: PlayerInfo[];
  teamAName: string;
  teamBName: string;
}

interface PlayerSPPRow {
  id: string;
  name: string;
  number: number;
  position: string;
  team: "A" | "B";
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  isMvp: boolean;
  totalSPP: number;
}

function calculatePlayerRows(
  players: PlayerInfo[],
  matchStats: Record<string, PlayerMatchStats>,
  matchResult: MatchResult,
): PlayerSPPRow[] {
  return players
    .map((player) => {
      const stats = matchStats[player.id];
      const touchdowns = stats?.touchdowns ?? 0;
      const casualties = stats?.casualties ?? 0;
      const completions = stats?.completions ?? 0;
      const interceptions = stats?.interceptions ?? 0;
      const isMvp = stats?.mvp ?? false;

      const totalSPP =
        touchdowns * SPP_VALUES.touchdown +
        casualties * SPP_VALUES.casualty +
        completions * SPP_VALUES.completion +
        interceptions * SPP_VALUES.interception +
        (isMvp ? SPP_VALUES.mvp : 0);

      return {
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.position,
        team: player.team,
        touchdowns,
        casualties,
        completions,
        interceptions,
        isMvp,
        totalSPP,
      };
    })
    .filter((row) => row.totalSPP > 0 || row.isMvp)
    .sort((a, b) => b.totalSPP - a.totalSPP);
}

function SPPBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      {value}x {label}
      <span className="text-gray-400">
        (+{value * SPP_VALUES[label.toLowerCase() as keyof typeof SPP_VALUES]})
      </span>
    </span>
  );
}

function TeamSPPTable({
  rows,
  teamName,
  teamId,
  colorClass,
}: {
  rows: PlayerSPPRow[];
  teamName: string;
  teamId: "A" | "B";
  colorClass: string;
}) {
  const teamRows = rows.filter((r) => r.team === teamId);
  const totalTeamSPP = teamRows.reduce((sum, r) => sum + r.totalSPP, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className={`px-4 py-3 ${colorClass} border-b`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-nuffle-anthracite">
            {teamName}
          </h3>
          <span className="text-sm font-semibold text-gray-600">
            {totalTeamSPP} SPP
          </span>
        </div>
      </div>

      {teamRows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          Aucun SPP gagn&eacute; ce match
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {teamRows.map((row) => (
            <div
              key={row.id}
              className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 ${
                row.isMvp ? "bg-yellow-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-mono text-gray-400 w-6 text-right flex-shrink-0">
                  #{row.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-nuffle-anthracite truncate">
                      {row.name}
                    </span>
                    {row.isMvp && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800 flex-shrink-0">
                        MVP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{row.position}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <SPPBadge value={row.touchdowns} label="Touchdown" />
                <SPPBadge value={row.casualties} label="Casualty" />
                <SPPBadge value={row.completions} label="Completion" />
                <SPPBadge value={row.interceptions} label="Interception" />
                {row.isMvp && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    MVP <span className="text-yellow-500">(+4)</span>
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-nuffle-gold/20 text-nuffle-anthracite">
                  {row.totalSPP} SPP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostMatchSPP({
  matchStats,
  matchResult,
  players,
  teamAName,
  teamBName,
}: PostMatchSPPProps) {
  const rows = useMemo(
    () => calculatePlayerRows(players, matchStats, matchResult),
    [players, matchStats, matchResult],
  );

  if (!matchStats || Object.keys(matchStats).length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-lg">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-nuffle-anthracite font-heading">
          Attribution des SPP
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Star Player Points gagn&eacute;s durant le match
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TeamSPPTable
          rows={rows}
          teamName={teamAName}
          teamId="A"
          colorClass="bg-blue-50"
        />
        <TeamSPPTable
          rows={rows}
          teamName={teamBName}
          teamId="B"
          colorClass="bg-red-50"
        />
      </div>

      {/* SPP Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          TD = {SPP_VALUES.touchdown} SPP | Casualty ={" "}
          {SPP_VALUES.casualty} SPP | Completion ={" "}
          {SPP_VALUES.completion} SPP | Interception ={" "}
          {SPP_VALUES.interception} SPP | MVP = {SPP_VALUES.mvp} SPP
        </p>
      </div>
    </div>
  );
}

// Export for testing
export { calculatePlayerRows, SPP_VALUES };
export type { PlayerSPPRow, PlayerMatchStats, PlayerInfo, MatchResult };
