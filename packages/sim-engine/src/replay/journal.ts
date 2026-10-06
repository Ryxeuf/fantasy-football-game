/**
 * Lot 2 « journal d'actions rejouable » (change OpenSpec
 * `pro-league-replay-journal`).
 *
 * Un replay v1 stockait un `GameState` complet après CHAQUE coup, chacun
 * embarquant le `gameLog` cumulé : 1,3 à 2,2 Mo compressés par match, et
 * rien de rejouable sur un plateau (pas de dés par action). Le journal
 * stocke l'ÉTAT INITIAL (sans journal de log), la liste ordonnée des
 * COUPS et les DÉS consommés par chacun : ~14 Ko compressés (10 graines,
 * max 15,5 Ko), et `replayJournal` re-dérive tous les états bit à bit.
 *
 * Déterminisme : chaque coup `n` reçoit son PROPRE flux de dés
 * `makeRNG(`${seed}:move:${n}`)` (idem `drive:${n}` pour une remise en
 * jeu headless) — le résultat d'un coup ne dépend plus de ce que l'IA ou
 * les coups précédents ont tiré. Les dés sont AUSSI enregistrés (audit,
 * feuille de match papier lisible sans moteur).
 */

import { applyMove, makeRNG } from '@bb/game-engine';
import type { GameLogEntry, GameState, Move, RNG } from '@bb/game-engine';

import { executeHeadlessDrive } from '../driver/full-driver-halftime';
import type { TacticalProfile } from '../tactics/tactical-profile';

/** Version du format de journal (sérialisée dans le payload compressé). */
export const REPLAY_JOURNAL_VERSION = 2 as const;

/** Un jet de dés consommé par un coup, tel que journalisé par le moteur. */
export interface DiceRecord {
  readonly message: string;
  readonly playerId?: string;
  readonly team?: 'A' | 'B';
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ReplayJournalStep {
  /** Coup appliqué (END_TURN synthétique pour une remise en jeu). */
  readonly move: Move;
  /**
   * `true` : ce pas n'applique pas `move` mais une remise en jeu headless
   * (mi-temps, après un touchdown) avec le flux `drive:${n}`.
   */
  readonly drive?: true;
  /** Dés consommés par ce pas (entrées `dice` du journal du moteur). */
  readonly dice: readonly DiceRecord[];
}

export interface ReplayJournal {
  readonly v: typeof REPLAY_JOURNAL_VERSION;
  readonly seed: number;
  /** État après le coup d'envoi d'ouverture, `gameLog` vidé. */
  readonly initialState: GameState;
  readonly steps: readonly ReplayJournalStep[];
  /**
   * Lot 4 — profils tactiques des deux coachs AU MOMENT du match, figés
   * avec le journal : le profil vivant évolue ensuite, le replay doit
   * rester lisible tel qu'il a été joué.
   */
  readonly profiles?: {
    readonly home: TacticalProfile;
    readonly away: TacticalProfile;
  };
}

/** Flux de dés d'un pas du journal. */
export function journalStepRng(seed: number, kind: 'move' | 'drive', index: number): RNG {
  return makeRNG(`${seed}:${kind}:${index}`);
}

/** Flux de dés du pré-match (pile ou face, coup d'envoi d'ouverture). */
export function journalOpeningRng(seed: number, phase: 'toss' | 'kickoff'): RNG {
  return makeRNG(`${seed}:${phase}`);
}

/** Le même état sans son journal de log (le journal est reconstruit au rejeu). */
export function stripGameLog(state: GameState): GameState {
  return { ...state, gameLog: [] };
}

/**
 * Entrées de log AJOUTÉES par un coup : celles de `next.gameLog` absentes
 * de `prev.gameLog` (par référence — le moteur copie le tableau et
 * conserve les objets existants). Robuste à la troncature du log en fin
 * de tour.
 */
export function extractNewLogEntries(prev: GameState, next: GameState): readonly GameLogEntry[] {
  if (next.gameLog === prev.gameLog) return [];
  const known = new Set<GameLogEntry>(prev.gameLog);
  return next.gameLog.filter((entry) => !known.has(entry));
}

export function extractDiceRecords(prev: GameState, next: GameState): readonly DiceRecord[] {
  return extractNewLogEntries(prev, next)
    .filter((entry) => entry.type === 'dice')
    .map((entry) => ({
      message: entry.message,
      ...(entry.playerId ? { playerId: entry.playerId } : {}),
      ...(entry.team ? { team: entry.team } : {}),
      ...(entry.details ? { details: entry.details } : {}),
    }));
}

export interface ReplayedJournal {
  readonly states: readonly GameState[];
}

/**
 * Re-dérive les états d'un journal. `states[i]` est l'état après le pas
 * `i`. Pur et déterministe : même moteur + même journal ⇒ mêmes états,
 * `gameLog` compris (il est reconstruit par le moteur depuis l'état
 * initial vidé).
 */
export function replayJournal(journal: ReplayJournal): ReplayedJournal {
  const states: GameState[] = [];
  let state = journal.initialState;
  journal.steps.forEach((step, index) => {
    if (step.drive) {
      state = executeHeadlessDrive(state, journalStepRng(journal.seed, 'drive', index));
    } else {
      state = applyMove(state, step.move, journalStepRng(journal.seed, 'move', index));
    }
    states.push(state);
  });
  return { states };
}

/** Liste plate des coups du journal (compatibilité avec `fullReplay.moves`). */
export function journalMoves(journal: ReplayJournal): readonly Move[] {
  return journal.steps.map((s) => s.move);
}
