/**
 * Full driver — wire MatchEvent emission (Lot 3.A.2.b).
 *
 * `applyMove` retourne uniquement le nouveau `GameState` ; pour
 * produire un timeline broadcaster-ready (TURN_START, BLOCK, PASS,
 * TD, CASUALTY, KO, TURNOVER, HALFTIME, END), on calcule un **diff
 * d'état** entre `prev` et `next` puis on émet les events
 * correspondants.
 *
 * Convention temporelle
 * ---------------------
 * Chaque action consomme `MS_PER_ACTION` (1s par défaut) sur la
 * timeline. Les events groupés (le coup + ses side-effects comme
 * une casualty post-block) partagent le même `displayAtMs` pour
 * que le narrator les regroupe naturellement.
 *
 * Couvre
 * ------
 * - Move-specific : BLOCK / BLITZ → BLOCK ; PASS / HANDOFF → PASS ;
 *   DODGE → DODGE ; FOUL → BLOCK kind='foul'.
 * - Diff side-effects : TD (score change), CASUALTY (player→casualty),
 *   KO (player→knocked_out), TURNOVER (isTurnover false→true),
 *   HALFTIME (gamePhase→halftime), END (gamePhase→ended), TURN_START
 *   (turn/half advance).
 *
 * Hors scope
 * ----------
 * - MOVE events atomiques : un MOVE Move avance d'1 case ; le hybrid
 *   driver émet des MOVE events bulk (agrégation par tour, lots
 *   #4-657). Le full driver ne les émet pas pour l'instant ; le
 *   timeline reste lisible avec les BLOCK / PASS / TD seuls.
 * - PLAYER_ACTIVATION : pourrait être ajouté en Lot 3.A.2.c quand
 *   les rosters réels rendront les playerId narratifs.
 */

import type { GameState, Move, TeamId } from '@bb/game-engine';
import type { MatchEvent } from '@bb/shared-types';

import { ENGINE_VER } from '../types';

/** Timestamp incrémenté à chaque action appliquée. */
export const MS_PER_ACTION = 1_000;

/**
 * Map TeamId interne (A/B) vers la convention sim-engine (home/away).
 * Le frontend consomme home/away et ignore A/B.
 */
function sideOf(team: TeamId): 'home' | 'away' {
  return team === 'A' ? 'home' : 'away';
}

interface DiffContext {
  /** Wall-clock offset auquel cette transition est observée. */
  readonly displayAtMs: number;
  /** Coup appliqué qui a produit `next` à partir de `prev`. */
  readonly move: Move;
}

/** Construit l'événement Move-specific en fonction du type de coup. */
function buildMoveSpecificEvent(
  ctx: DiffContext,
  next: GameState
): MatchEvent | null {
  const { move, displayAtMs } = ctx;
  switch (move.type) {
    case 'BLOCK':
    case 'BLITZ': {
      const attackerId = move.playerId;
      const defenderId = move.targetId;
      // Resolution non triviale à inférer depuis le diff seul ; on
      // émet l'event avec ce qu'on a (ids), le narrator humanise.
      return {
        type: 'BLOCK',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          attackerId,
          defenderId,
          kind: move.type === 'BLITZ' ? 'blitz' : 'block',
        },
      };
    }
    case 'PASS':
    case 'HANDOFF': {
      const passerId = move.playerId;
      const receiverId = move.targetId;
      // success approximé : la balle est-elle chez le receiver après
      // application ? Si oui → caught.
      const receiver = next.players.find((p) => p.id === receiverId);
      const success = receiver?.hasBall === true;
      return {
        type: 'PASS',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          passerId,
          receiverId,
          range: move.type === 'HANDOFF' ? 'handoff' : 'short',
          success,
        },
      };
    }
    case 'DODGE': {
      const playerId = move.playerId;
      // success approximé : le joueur est-il toujours actif (debout) ?
      const player = next.players.find((p) => p.id === playerId);
      const success =
        player?.state === 'active' && (player as { stunned?: boolean }).stunned !== true;
      return {
        type: 'DODGE',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId,
          to: move.to,
          success,
        },
      };
    }
    case 'FOUL': {
      // Le narrator (`renderBlock`) gère `kind: 'foul'` en réutilisant
      // l'event BLOCK — on garde ce wrapping pour la compat.
      return {
        type: 'BLOCK',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          kind: 'foul',
          foulerId: move.playerId,
          victimId: move.targetId,
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Diff stricte sur les états avant / après un applyMove. Retourne
 * l'ensemble des MatchEvent à émettre, déjà ordonnés (event "primary"
 * du Move puis side-effects).
 */
export function diffStatesToEvents(
  prev: GameState,
  next: GameState,
  ctx: DiffContext
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const { displayAtMs } = ctx;

  // 1) Event Move-specific (BLOCK / PASS / DODGE / FOUL).
  const primary = buildMoveSpecificEvent(ctx, next);
  if (primary) events.push(primary);

  // 2) TD : score changé sur l'une des deux équipes.
  if (next.score.teamA > prev.score.teamA) {
    events.push({
      type: 'TD',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        team: 'home',
        half: next.half,
        scoreAfter: { home: next.score.teamA, away: next.score.teamB },
      },
    });
  }
  if (next.score.teamB > prev.score.teamB) {
    events.push({
      type: 'TD',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        team: 'away',
        half: next.half,
        scoreAfter: { home: next.score.teamA, away: next.score.teamB },
      },
    });
  }

  // 3) KO / CASUALTY : joueurs qui ont changé de state.
  const prevById = new Map(prev.players.map((p) => [p.id, p]));
  for (const p of next.players) {
    const old = prevById.get(p.id);
    if (!old) continue;
    if (p.state === 'casualty' && old.state !== 'casualty') {
      events.push({
        type: 'CASUALTY',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId: p.id,
          team: sideOf(p.team as TeamId),
        },
      });
    } else if (p.state === 'knocked_out' && old.state !== 'knocked_out') {
      events.push({
        type: 'KO',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId: p.id,
          team: sideOf(p.team as TeamId),
        },
      });
    }
  }

  // 4) TURNOVER : isTurnover passé à true.
  if (next.isTurnover && !prev.isTurnover) {
    events.push({
      type: 'TURNOVER',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        // On ne peut pas toujours inférer le cause exact ; le Move
        // type donne une approximation utile.
        cause: causeFromMove(ctx.move),
      },
    });
  }

  // 5) HALFTIME : gamePhase changé vers halftime.
  if (next.gamePhase === 'halftime' && prev.gamePhase !== 'halftime') {
    events.push({
      type: 'HALFTIME',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        score: { home: next.score.teamA, away: next.score.teamB },
      },
    });
  }

  // 6) END : gamePhase ended.
  if (next.gamePhase === 'ended' && prev.gamePhase !== 'ended') {
    events.push({
      type: 'END',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        score: { home: next.score.teamA, away: next.score.teamB },
        outcome:
          next.score.teamA > next.score.teamB
            ? 'home'
            : next.score.teamB > next.score.teamA
              ? 'away'
              : 'draw',
      },
    });
  }

  // 7) TURN_START : turn ou half avancé.
  if (
    next.gamePhase !== 'ended' &&
    (next.turn > prev.turn || next.half > prev.half)
  ) {
    events.push({
      type: 'TURN_START',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        half: next.half,
        turn: next.turn,
        drivingTeam: sideOf(next.currentPlayer as TeamId),
        score: { home: next.score.teamA, away: next.score.teamB },
        ballYardline: estimateBallYardline(next),
      },
    });
  }

  return events;
}

/**
 * Heuristique : transforme la position de la balle (cellule x) en
 * yardline 0..26 du modèle hybrid. La position du porteur est
 * privilégiée si la balle a un porteur.
 */
function estimateBallYardline(state: GameState): number {
  const carrier = state.players.find((p) => p.hasBall);
  const ballX = carrier?.pos.x ?? state.ball?.x ?? 0;
  // Le board fait 26 cells de large = yardline.
  return Math.max(0, Math.min(26, ballX));
}

/**
 * Inférence best-effort de la cause d'un turnover à partir du Move
 * qui l'a déclenché. La taxonomie matche celle du hybrid driver
 * pour que les consommateurs (narrator, gazette) restent uniformes.
 */
function causeFromMove(move: Move): string {
  switch (move.type) {
    case 'BLOCK':
    case 'BLITZ':
      return 'block_attacker_down';
    case 'PASS':
      return 'pass_failed';
    case 'HANDOFF':
      return 'handoff_failed';
    case 'DODGE':
      return 'dodge_failed';
    case 'MOVE':
    case 'LEAP':
      return 'gfi_failed';
    case 'FOUL':
      return 'foul_sent_off';
    default:
      return 'unknown';
  }
}
