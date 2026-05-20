/**
 * Helper de mapping des erreurs typees NflXxxError vers status HTTP +
 * payload JSON standard. Garde les routes Phase 2.G concises.
 *
 * Pur, testable en unit.
 */

import type { Response } from "express";

import { NflIngestError } from "../services/nfl-ingest";
import { NflFantasyLeagueError } from "../services/nfl-fantasy-league";
import { NflFantasyRosterError } from "../services/nfl-fantasy-roster";
import { NflFantasyLineupError } from "../services/nfl-fantasy-lineup";
import { NflFantasyScoringError } from "../services/nfl-fantasy-scoring";
import { NflFantasyMercatoError } from "../services/nfl-fantasy-mercato";
import { NflFantasyDraftError } from "../services/nfl-fantasy-draft";
import { NflFantasyAdminError } from "../services/nfl-fantasy-admin-explorer";

export interface MappedError {
  readonly status: number;
  readonly body: { error: string; code: string };
}

/**
 * Map un code d'erreur vers un status HTTP.
 *
 * Pur, deterministe.
 */
export function statusForCode(code: string): number {
  switch (code) {
    // 404 — ressource introuvable
    case "NOT_FOUND":
    case "SEASON_NOT_FOUND":
    case "WEEK_NOT_FOUND":
    case "ENTRY_NOT_FOUND":
    case "PLAYER_NOT_FOUND":
    case "REROLL_NOT_FOUND":
    case "LEAGUE_NOT_FOUND":
    case "INVALID_INVITE":
    case "TEAM_NOT_FOUND":
      return 404;

    // 403 — acces refuse
    case "NOT_OWNER":
    case "REROLL_NOT_OWNED":
      return 403;

    // 409 — etat conflictuel
    case "ALREADY_JOINED":
    case "FULL":
    case "INVALID_STATUS":
    case "OWNER_CANNOT_LEAVE":
    case "TEAM_NAME_TAKEN":
    case "PLAYER_ALREADY_ON_ROSTER":
    case "PLAYER_NOT_ON_ROSTER":
    case "REROLL_ALREADY_USED":
    case "INDUCEMENT_LIMIT_REACHED":
    case "LINEUP_LOCKED":
      return 409;

    // 422 — validation metier
    case "INVALID_NAME":
    case "INVALID_TEAM_NAME":
    case "INVALID_SIZE":
    case "INVALID_WEEK_NUMBER":
    case "INVALID_LINEUP_SIZE":
    case "INVALID_STARTERS":
    case "DUPLICATE_PLAYER":
    case "CAPTAIN_NOT_IN_STARTERS":
    case "VICE_NOT_IN_STARTERS":
    case "CAPTAIN_EQUALS_VICE":
    case "INVALID_TYPE":
    case "INVALID_SLOT":
    case "ODD_ENTRIES":
    case "NO_MATCHUPS":
    case "NO_ENTRIES":
    case "POOL_TOO_SMALL":
    case "INVALID_PLAYERS_PER_ENTRY":
    case "PLAYER_NO_TEAM":
    case "INVALID_BB_RACE":
      return 422;

    // 502 — dependance externe
    case "FETCH_FAILED":
    case "PARSE_FAILED":
      return 502;

    default:
      return 500;
  }
}

/**
 * Construit la reponse HTTP a partir d'une erreur typee. Si l'erreur
 * n'est pas reconnue, retourne null (caller doit relancer / catch
 * autrement).
 */
export function buildErrorResponse(err: unknown): MappedError | null {
  if (
    err instanceof NflIngestError ||
    err instanceof NflFantasyLeagueError ||
    err instanceof NflFantasyRosterError ||
    err instanceof NflFantasyLineupError ||
    err instanceof NflFantasyScoringError ||
    err instanceof NflFantasyMercatoError ||
    err instanceof NflFantasyDraftError ||
    err instanceof NflFantasyAdminError
  ) {
    return {
      status: statusForCode(err.code),
      body: { error: err.message, code: err.code },
    };
  }
  return null;
}

/**
 * Helper d'usage dans les handlers Express. Retourne true si l'erreur
 * a ete mappee et envoyee, false sinon (caller doit gerer en 500).
 */
export function sendNflError(res: Response, err: unknown): boolean {
  const mapped = buildErrorResponse(err);
  if (!mapped) return false;
  res.status(mapped.status).json(mapped.body);
  return true;
}
