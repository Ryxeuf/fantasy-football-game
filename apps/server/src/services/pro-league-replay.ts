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

import { decompressEvents, decompressReplay } from "@bb/sim-engine";
import type { GameState, Move } from "@bb/game-engine";
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

export interface MatchFullReplayDump {
  readonly matchId: string;
  readonly status: string;
  readonly durationMs: number;
  readonly initialState: GameState;
  readonly moves: readonly Move[];
  /**
   * Lot 3.D.1 — états BB *après* chaque move appliqué. `states[i]`
   * correspond à `applyMove(states[i-1] ?? initialState, moves[i], rng)`
   * tel que produit par `runFullDriver`. Le client rejoue donc le
   * match step-by-step sans avoir à exposer le seed RNG.
   */
  readonly states: readonly GameState[];
  /**
   * Données d'équipe utiles au rendu visuel (couleurs primaires /
   * secondaires, slug pour les variantes Pixi). `null` côté si la
   * ProTeam a été retirée depuis (cas dégénéré).
   */
  readonly teams: {
    readonly home: TeamPaintInfo | null;
    readonly away: TeamPaintInfo | null;
  };
}

export interface TeamPaintInfo {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

/**
 * Lot 3.D.2 — dump du re-jeu visuel BB pour un match `completed`
 * simulé en `full` driver. Retourne `initialState + moves` que le
 * client peut rejouer step-by-step via `applyMove` pour rendre le
 * terrain Pixi (Lot 3.D.3 / 3.D.4).
 *
 * Le payload est plus gros qu'un dump événements seuls (le
 * GameState complet pèse quelques Ko + une Move list dense), mais
 * reste compact (~50-100 Ko après compression réseau).
 *
 * Erreurs :
 *  - `MATCH_NOT_FOUND` / `REPLAY_NOT_FOUND` : comme `getMatchReplayDump`.
 *  - `MATCH_NOT_REPLAYABLE` : status ≠ 'completed'.
 *  - `FULL_REPLAY_NOT_AVAILABLE` : replay produit par hybrid driver
 *    (synthèse archétype) ou par un full driver pré-Lot 3.D.1 — pas
 *    de `initialState/moves` dans le payload.
 */
export async function getMatchFullReplayDump(
  matchId: string,
): Promise<MatchFullReplayDump> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      homeTeam: {
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          race: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          race: true,
          primaryColor: true,
          secondaryColor: true,
        },
      },
    },
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
  const wrapper = await decompressReplay(replay.payload as Buffer);
  if (!wrapper.fullReplay) {
    throw new ReplayDumpError(
      "FULL_REPLAY_NOT_AVAILABLE",
      `Replay '${matchId}' produit sans données de re-jeu visuel (driver hybrid ou pré-Lot 3.D.1) — pas de full replay disponible`,
    );
  }
  return {
    matchId,
    status: match.status as string,
    durationMs: replay.durationMs,
    initialState: wrapper.fullReplay.initialState,
    moves: wrapper.fullReplay.moves,
    states: wrapper.fullReplay.states,
    teams: {
      home: match.homeTeam
        ? {
            id: match.homeTeam.id as string,
            slug: match.homeTeam.slug as string,
            name: match.homeTeam.name as string,
            city: (match.homeTeam.city as string | null) ?? null,
            race: match.homeTeam.race as string,
            primaryColor: (match.homeTeam.primaryColor as string | null) ?? null,
            secondaryColor:
              (match.homeTeam.secondaryColor as string | null) ?? null,
          }
        : null,
      away: match.awayTeam
        ? {
            id: match.awayTeam.id as string,
            slug: match.awayTeam.slug as string,
            name: match.awayTeam.name as string,
            city: (match.awayTeam.city as string | null) ?? null,
            race: match.awayTeam.race as string,
            primaryColor: (match.awayTeam.primaryColor as string | null) ?? null,
            secondaryColor:
              (match.awayTeam.secondaryColor as string | null) ?? null,
          }
        : null,
    },
  };
}
