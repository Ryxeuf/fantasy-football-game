/**
 * Types partages par tous les modules de generation du PDF de recap de match.
 * Decouples du composant React: ces types sont les seuls inputs de generateMatchPdf.
 */

export type ActionType =
  | "passe"
  | "reception"
  | "td"
  | "blocage"
  | "blitz"
  | "transmission"
  | "aggression"
  | "sprint"
  | "esquive"
  | "apothicaire"
  | "interception";

export interface PdfAction {
  id: string;
  half: number;
  turn: number;
  actionType: ActionType;
  playerId: string;
  playerName: string;
  playerTeam: "A" | "B";
  opponentId: string | null;
  opponentName: string | null;
  diceResult: number | null;
  fumble: boolean;
  playerState: string | null;
  armorBroken: boolean;
  opponentState: string | null;
  passType: string | null;
  createdAt: string;
}

export interface PdfTeam {
  id: string;
  name: string;
  /** Roster slug — ex: "skaven", "human". Manquant => emblème neutre. */
  roster?: string | null;
}

export interface PdfFanFactor {
  d3: number;
  dedicatedFans: number;
  total: number;
}

export interface PdfWeather {
  total: number;
  condition: string;
  description: string;
}

export interface PdfMatchStatsEntry {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}

export interface PdfMatch {
  id: string;
  name: string | null;
  teamA: PdfTeam;
  teamB: PdfTeam;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  startedAt: string | null;
  completedAt: string | null;
  cup: { id: string; name: string } | null;
  gameState?: {
    preMatch?: {
      fanFactor?: { teamA: PdfFanFactor; teamB: PdfFanFactor };
      weatherType?: string;
      weather?: PdfWeather;
    };
    matchStats?: Record<string, PdfMatchStatsEntry>;
    matchResult?: { winner?: "A" | "B"; spp?: Record<string, number> };
    players?: Array<{
      id: string;
      team: "A" | "B";
      name: string;
      number: number;
      position: string;
    }>;
  };
}

/** Resultat agrege des actions, calcule en amont des sections. */
export interface TeamAggregateStats {
  touchdowns: number;
  completions: number;
  receptions: number;
  blitzes: number;
  blocks: number;
  fouls: number;
  sprints: number;
  dodges: number;
  interceptions: number;
  armorBreaks: number;
  casualties: number;
  kos: number;
  stuns: number;
  fumbles: number;
  totalActions: number;
}

export interface MvpInfo {
  playerId: string;
  playerName: string;
  team: "A" | "B";
  number: number | null;
  position: string | null;
  spp: number;
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
}

export interface MatchAggregates {
  teamA: TeamAggregateStats;
  teamB: TeamAggregateStats;
  mvp: MvpInfo | null;
  outcome: "A" | "B" | "DRAW";
}
