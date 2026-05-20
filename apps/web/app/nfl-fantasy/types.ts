/**
 * Types partages cote web pour le module NFL Fantasy.
 * Miroir des structures Prisma + payload API documentees dans
 * `docs/nfl-fantasy/16-routes.md`.
 */

export type LeagueStatus = "draft" | "in_progress" | "completed";
export type LeagueType = "public" | "private";
export type DraftMode = "snake" | "auction" | "free";

export interface NflFantasyLeague {
  id: string;
  name: string;
  ownerId: string;
  size: number;
  type: LeagueType;
  draftMode: DraftMode;
  status: LeagueStatus;
  seasonId: string;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NflFantasyEntry {
  id: string;
  leagueId: string;
  userId: string;
  teamName: string;
  bbRace: string | null;
  totalTV: number;
  joinedAt: string;
}

export interface LeagueWithEntries extends NflFantasyLeague {
  entries: NflFantasyEntry[];
}

/** Reponse `GET /api/nfl-fantasy/leagues`. */
export interface ListLeaguesResponse {
  leagues: NflFantasyLeague[];
}

/** Payload erreur typee renvoye par le mapper Phase 2.G. */
export interface NflErrorBody {
  error: string;
  code: string;
}

/** Matchup retourne par `GET /api/nfl-fantasy/leagues/:id/matchups`. */
export interface NflFantasyMatchup {
  id: string;
  leagueId: string;
  weekId: string;
  homeEntryId: string;
  awayEntryId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  settledAt: string | null;
  createdAt: string;
}

/** Ligne standings calculee a la volee (Phase A.2). */
export interface StandingsRow {
  entryId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  games: number;
}
