/** Fixtures des tests du coach : joueurs et états minimaux sur `setup()` du moteur. */

import { setup } from '@bb/game-engine';
import type { GameState, Player } from '@bb/game-engine';

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
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

export function baseState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return { ...setup(), players, currentPlayer: 'A', kickingTeam: 'B', halfKickingTeam: 'B', ball: undefined, ...overrides };
}
