/**
 * Pro League replay dump service — sprint 1.G.1.
 *
 * Pour les matchs `completed`, expose la totalite des events d'un seul
 * coup (vs le SSE 1.B.2 qui dispatche au rythme `displayAtMs` real-time).
 * Le client `<MatchReplayPlayer>` (1.G.2) consomme cet endpoint pour
 * gerer play/pause/scrub/speed entierement cote browser, sans charger
 * le serveur pour chaque speed bump.
 *
 * Reponses possibles :
 *  - `404 MATCH_NOT_FOUND`  : id inconnu.
 *  - `409 MATCH_NOT_REPLAYABLE` : status != 'completed' (live -> SSE,
 *    scheduled -> rien a rejouer, failed -> replay invalide).
 *  - `404 REPLAY_NOT_FOUND` : match completed mais replay manquant
 *    (cas degenere, ne devrait pas arriver en prod).
 *  - `200` : `{ matchId, status, durationMs, eventCount, events }`.
 *
 * `events` est trie par `displayAtMs` ascending. Le payload reste petit
 * (typiquement 50-300 events par match, ~10-30 KB JSON).
 */

import { decompressEvents } from "@bb/sim-engine";
import type { MatchEvent } from "@bb/shared-types";

import { prisma } from "../prisma";

export class ReplayDumpError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ReplayDumpError";
  }
}

export interface MatchReplayDump {
  readonly matchId: string;
  readonly status: string;
  readonly durationMs: number;
  readonly eventCount: number;
  readonly events: readonly MatchEvent[];
}

/**
 * Dump complet d'un replay Pro League. Idempotent et sans effet de bord.
 */
export async function getMatchReplayDump(
  matchId: string,
): Promise<MatchReplayDump> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { id: true, status: true },
  });
  if (!match) {
    throw new ReplayDumpError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (match.status !== "completed") {
    throw new ReplayDumpError(
      "MATCH_NOT_REPLAYABLE",
      `ProLeagueMatch '${matchId}' status='${match.status}' n'est pas rejouable (attendu 'completed')`,
    );
  }
  const replay = await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true, durationMs: true },
  });
  if (!replay) {
    throw new ReplayDumpError(
      "REPLAY_NOT_FOUND",
      `Replay pour match '${matchId}' introuvable`,
    );
  }
  const events = await decompressEvents(replay.payload as Buffer);
  // Tri stable (defensive ; le sim-engine emet deja en ordre).
  const sorted = [...events].sort((a, b) => a.displayAtMs - b.displayAtMs);
  return {
    matchId,
    status: match.status as string,
    durationMs: replay.durationMs,
    eventCount: sorted.length,
    events: sorted,
  };
}
