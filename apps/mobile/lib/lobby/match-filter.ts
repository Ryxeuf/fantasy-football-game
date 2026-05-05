/**
 * S27.3.4 — Helpers purs de filtre/comptage des matchs du lobby.
 *
 * Extraits de `apps/mobile/app/lobby.tsx` pour permettre :
 *  - les tests unitaires sans render React Native,
 *  - la reutilisation par les sous-composants `MatchList` / `FilterBar`.
 *
 * Les helpers sont 100% immutables : ils ne mutent jamais le tableau
 * d'entree (filter renvoie une nouvelle reference).
 */

export interface MatchTeamInfo {
  coachName: string;
  teamName: string;
  rosterName?: string;
}

export interface MatchSummary {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  isMyTurn: boolean;
  score: { teamA: number; teamB: number };
  myScore: number;
  opponentScore: number;
  half: number;
  turn: number;
  myTeam: MatchTeamInfo | null;
  opponent: MatchTeamInfo | null;
}

export type LobbyFilter = "all" | "my-turn" | "active" | "ended";

const ACTIVE_STATUSES = new Set(["active", "prematch", "prematch-setup"]);

export function filterMatches(
  matches: readonly MatchSummary[],
  filter: LobbyFilter,
): MatchSummary[] {
  if (filter === "my-turn") {
    return matches.filter((m) => m.isMyTurn && m.status === "active");
  }
  if (filter === "active") {
    return matches.filter((m) => ACTIVE_STATUSES.has(m.status));
  }
  if (filter === "ended") {
    return matches.filter((m) => m.status === "ended");
  }
  // 'all' ou filtre inconnu : copie defensive (ne pas exposer la reference).
  return matches.slice();
}

export function countMyTurn(matches: readonly MatchSummary[]): number {
  let count = 0;
  for (const m of matches) {
    if (m.isMyTurn && m.status === "active") count++;
  }
  return count;
}
