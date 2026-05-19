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
  const { displayAtMs, move } = ctx;

  // 0a) Lot 3.A.3 — PLAYER_ACTIVATION : nouveau joueur actif. On compare
  // sur `prev` (avant applyMove) pour que l'event précède le coup que
  // ce joueur s'apprête à exécuter. Vu que `selectedPlayerId` peut
  // rester null entre deux activations (selection cleared post-action),
  // on déclenche sur la transition `null|other → newId`.
  const prevSelected = (prev as { selectedPlayerId?: string | null })
    .selectedPlayerId;
  const nextSelected = (next as { selectedPlayerId?: string | null })
    .selectedPlayerId;
  if (
    nextSelected &&
    nextSelected !== prevSelected &&
    move.type !== 'END_TURN'
  ) {
    const player = next.players.find((p) => p.id === nextSelected);
    if (player) {
      events.push({
        type: 'PLAYER_ACTIVATION',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId: nextSelected,
          team: sideOf(player.team as TeamId),
        },
      });
    }
  }

  // 0b) Lot 3.A.3 — BLITZ_DECLARED : émis avant le BLOCK qui résulte
  // d'un blitz. Distingue narrativement "Bob charge sur Carla et la
  // plaque" (blitz) vs "Bob plaque Carla sur place" (block).
  if (move.type === 'BLITZ') {
    events.push({
      type: 'BLITZ_DECLARED',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        attackerId: (move as { playerId?: string }).playerId,
        defenderId: (move as { targetId?: string }).targetId,
      },
    });
  }

  // 1) Event Move-specific (BLOCK / PASS / DODGE / FOUL).
  const primary = buildMoveSpecificEvent(ctx, next);
  if (primary) events.push(primary);

  // 2) TD : score changé sur l'une des deux équipes.
  // Lot 3.C.3 — `scorerId` = playerId du porteur de balle au moment
  // du TD. Cherche d'abord dans `prev` (le porteur juste avant
  // d'entrer en endzone) ; fallback sur `next` si le moteur ne reset
  // pas immediatement le `hasBall` post-TD ; null si aucun porteur
  // identifie (TD synthetique / state corrompu — le SPP service
  // tombera en no-op).
  function scorerFor(team: TeamId): string | undefined {
    const candidate =
      prev.players.find((p) => p.team === team && p.hasBall === true) ??
      next.players.find((p) => p.team === team && p.hasBall === true);
    return candidate?.id;
  }
  if (next.score.teamA > prev.score.teamA) {
    const scorerId = scorerFor('A');
    events.push({
      type: 'TD',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        team: 'home',
        half: next.half,
        scoreAfter: { home: next.score.teamA, away: next.score.teamB },
        ...(scorerId ? { scorerId } : {}),
      },
    });
  }
  if (next.score.teamB > prev.score.teamB) {
    const scorerId = scorerFor('B');
    events.push({
      type: 'TD',
      displayAtMs,
      engineVer: ENGINE_VER,
      meta: {
        team: 'away',
        half: next.half,
        scoreAfter: { home: next.score.teamA, away: next.score.teamB },
        ...(scorerId ? { scorerId } : {}),
      },
    });
  }

  // 3) KO / CASUALTY / KNOCKDOWN : joueurs qui ont changé de state.
  // Lot 3.A.3 — KNOCKDOWN couvre le cas active→stunned (defender down
  // sans armor break). Les deux autres transitions (→knocked_out,
  // →casualty) restent émises comme KO / CASUALTY ; on n'émet pas de
  // KNOCKDOWN supplémentaire pour ces cas (le KO/CAS porte déjà la
  // sémantique "tombé + sorti du jeu").
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
    } else if (p.state === 'stunned' && old.state === 'active') {
      events.push({
        type: 'KNOCKDOWN',
        displayAtMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId: p.id,
          team: sideOf(p.team as TeamId),
          // Best-effort attribution : si le coup est un BLOCK/BLITZ/FOUL
          // ciblant ce joueur, c'est très probablement le causedBy.
          ...((move.type === 'BLOCK' ||
            move.type === 'BLITZ' ||
            move.type === 'FOUL') &&
          (move as { targetId?: string }).targetId === p.id
            ? { causedBy: (move as { playerId?: string }).playerId }
            : {}),
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

  // 6b) DICE : nouvelles entrées `type: 'dice'` dans `state.gameLog`.
  // Le moteur enregistre chaque jet de dés (block, dodge, GFI, pickup,
  // armor, injury, KO recovery, etc.) avec son résultat. On diff les
  // entries pour émettre un DICE event par nouveau jet, ce qui permet
  // à la timeline replay d'afficher la transparence des dés sans
  // refeuilleter le gameLog brut côté client.
  const prevLogLen = prev.gameLog?.length ?? 0;
  const nextLog = next.gameLog ?? [];
  if (nextLog.length > prevLogLen) {
    for (let i = prevLogLen; i < nextLog.length; i += 1) {
      const entry = nextLog[i];
      if (entry?.type === 'dice') {
        events.push({
          type: 'DICE',
          displayAtMs,
          engineVer: ENGINE_VER,
          meta: {
            message: entry.message,
            playerId: entry.playerId,
            team: entry.team ? sideOf(entry.team as TeamId) : undefined,
            details: entry.details ?? {},
          },
        });
      }
    }
  }

  // 7) TURN_START : nouveau tour pour l'équipe active. En BB, un "turn"
  // compte un tour A + un tour B ; donc `state.turn` n'incrémente qu'un
  // END_TURN sur deux. Pour émettre un TURN_START à chaque demi-tour
  // (A puis B puis A...), on déclenche dès que `currentPlayer` change
  // (en plus de l'avance turn/half pour le tout premier tour de mi-temps).
  const turnAdvanced = next.turn > prev.turn || next.half > prev.half;
  const playerSwitched = next.currentPlayer !== prev.currentPlayer;
  if (
    next.gamePhase !== 'ended' &&
    next.gamePhase !== 'halftime' &&
    (turnAdvanced || playerSwitched)
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
 *
 * BUG fix audit round 5 (HIGH) : la convention hybrid est
 * `ballYardline ∈ [0..26]` ou **0 = own goal de l'equipe qui drive**
 * et **26 = endzone adverse**. Avant, le full driver retournait `ballX`
 * brut, ce qui est correct pour team A (driving vers x=26) mais
 * inverse pour team B (driving vers x=0 → un porteur a x=21 etait
 * yardline=21 alors qu'il devrait etre yardline=5). Tous les
 * consommateurs (Gazette narrator, hybrid vs full comparison, odds
 * calculator) lisaient des valeurs incorrectes pour les tours team B.
 * Fix : normaliser via `currentPlayer` (A → ballX, B → 26-ballX).
 */
function estimateBallYardline(state: GameState): number {
  const carrier = state.players.find((p) => p.hasBall);
  const ballX = carrier?.pos.x ?? state.ball?.x ?? 0;
  const drivingIsA = state.currentPlayer === 'A';
  const normalized = drivingIsA ? ballX : 26 - ballX;
  return Math.max(0, Math.min(26, normalized));
}

/**
 * Variante exportee de `estimateBallYardline` — utilisee par
 * `full-driver.ts` pour le TURN_START initial. Avant le fix, le
 * yardline initial etait hardcode a 4, ce qui est faux si le roster
 * place le ball carrier ailleurs (post-fix C3 ball idx variable).
 */
export function getInitialBallYardline(state: GameState): number {
  return estimateBallYardline(state);
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
      // BUG fix audit round 5 (HIGH) : avant, tout MOVE/LEAP turnover
      // etait tag `gfi_failed`. Or un MOVE peut turnover sur dodge
      // rate, GFI rate, ou Both Down/negative-trait trigger. Le tag
      // `movement_failed` est un fallback honnete ; les consommateurs
      // (Gazette narrator) ont desormais a distinguer eux-memes.
      return 'movement_failed';
    case 'FOUL':
      return 'foul_sent_off';
    default:
      return 'unknown';
  }
}
