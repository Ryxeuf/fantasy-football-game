/**
 * Helpers communs aux tests du game-engine.
 *
 * Audit 2026-05-19 quick win #5 — 45+ fichiers de tests reimplementaient
 * leur propre `makePlayer` / `baseState` (~100 LOC dupliquees). Ce
 * module centralise les factory functions pour les tests.
 *
 * Note : ces helpers ne sont **pas** exportes via index.ts du package
 * (`__tests__/` est volontairement hors du barrel) — ils sont
 * strictement destines aux fichiers `*.test.ts`. Importer via :
 *
 *     import { makePlayer, baseState } from '../__tests__/helpers';
 */

import { setup } from '../../core/game-state';
import type { GameState, Player, TeamId } from '../../core/types';

/**
 * Cree un joueur de test avec valeurs par defaut (Lineman ST3 AG3).
 * Override n'importe quel champ via le parametre.
 */
export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A' as TeamId,
    pos: { x: 5, y: 5 },
    name: 'Lineman',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

/**
 * Cree un GameState de test base sur `setup()` avec liste de joueurs
 * personnalisee et overrides arbitraires.
 */
export function baseState(
  players: Player[],
  overrides: Partial<GameState> = {}
): GameState {
  return { ...setup(), players, ...overrides };
}
