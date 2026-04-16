import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { checkBreakTackle } from './break-tackle';
import type { GameState, Player } from '../core/types';

/**
 * Break Tackle (BB3 Season 2/3 rules):
 * - Once per activation, after the player has performed a Dodge action (D6 agility test),
 *   they may modify the dice roll by:
 *     - +1 if their Strength characteristic is 4 or less,
 *     - +2 if their Strength characteristic is 5 or more.
 * - The skill is only useful to turn a failed dodge into a success.
 * - A player can only use Break Tackle once during their activation, regardless of how
 *   many Dodge actions they make.
 */

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Dodger',
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

function makeState(players: Player[]): GameState {
  const state = setup();
  return { ...state, players };
}

describe('Regle: Break Tackle — activation', () => {
  it('ne declenche pas si le joueur n\'a pas le skill', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);

    // Dodge raté : 2 sur D6, target 3+ (AG 3 donne 4+, mais modifiers +1 => target 3+)
    const result = checkBreakTackle(state, player, 2, 3, false);

    expect(result.triggered).toBe(false);
    expect(result.newState).toBe(state);
  });

  it('ne declenche pas si le dodge est deja reussi', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 4, 3, true);

    expect(result.triggered).toBe(false);
  });

  it('ne declenche pas si le bonus ne suffit pas a transformer l\'echec en reussite', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4 });
    const state = makeState([player]);

    // Dodge 1 raté, target 4+ : +1 donnerait 2 qui reste < 4, donc inutile
    const result = checkBreakTackle(state, player, 1, 4, false);

    expect(result.triggered).toBe(false);
  });

  it('ne declenche pas si le joueur a deja utilise Break Tackle pendant son activation', () => {
    const player = makePlayer({
      skills: ['break-tackle'],
      st: 4,
      breakTackleUsed: true,
    });
    const state = makeState([player]);

    // Sans le flag, le +1 transformerait un 2 en 3 (succès sur 3+)
    const result = checkBreakTackle(state, player, 2, 3, false);

    expect(result.triggered).toBe(false);
  });
});

describe('Regle: Break Tackle — modificateur selon la Force', () => {
  it('applique +1 quand ST = 3', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 3 });
    const state = makeState([player]);

    // Dodge 2, target 3+ : +1 donne 3 => succès
    const result = checkBreakTackle(state, player, 2, 3, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(1);
    expect(result.newSuccess).toBe(true);
  });

  it('applique +1 quand ST = 4', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 3, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(1);
    expect(result.newSuccess).toBe(true);
  });

  it('applique +2 quand ST = 5', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    // Dodge 2, target 4+ : +2 donne 4 => succès
    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
    expect(result.newSuccess).toBe(true);
  });

  it('applique +2 quand ST = 7 (Deathroller)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 3, 5, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
    expect(result.newSuccess).toBe(true);
  });
});

describe('Regle: Break Tackle — effets sur l\'etat du jeu', () => {
  it('marque le joueur comme ayant utilise Break Tackle (breakTackleUsed=true)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.triggered).toBe(true);
    const updatedPlayer = result.newState.players.find((p) => p.id === player.id);
    expect(updatedPlayer?.breakTackleUsed).toBe(true);
  });

  it('ajoute une entree au gameLog quand il se declenche', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    const logsBefore = state.gameLog.length;
    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.newState.gameLog.length).toBeGreaterThan(logsBefore);
    const lastLog = result.newState.gameLog[result.newState.gameLog.length - 1];
    expect(lastLog.type).toBe('dice');
    expect(lastLog.message).toMatch(/Break Tackle|Esquive en Force/i);
  });

  it('ne modifie pas le gameLog quand le skill ne s\'active pas', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.newState.gameLog.length).toBe(state.gameLog.length);
  });

  it('n\'affecte pas les autres joueurs de l\'etat', () => {
    const player1 = makePlayer({ id: 'p1', skills: ['break-tackle'], st: 5 });
    const player2 = makePlayer({ id: 'p2', team: 'B', pos: { x: 10, y: 10 } });
    const state = makeState([player1, player2]);

    const result = checkBreakTackle(state, player1, 2, 4, false);

    const updated2 = result.newState.players.find((p) => p.id === 'p2');
    expect(updated2).toEqual(player2);
    expect(updated2?.breakTackleUsed).toBeUndefined();
  });

  it('slug alternatif break_tackle est reconnu', () => {
    const player = makePlayer({ skills: ['break_tackle'], st: 5 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
  });
});

describe('Regle: Break Tackle — cas limites', () => {
  it('ne declenche pas si le bonus rend le dodge succes sur un 1 naturel (ne peut pas modifier un 1 BB3 si c\'est la regle)', () => {
    // BB3: un 1 naturel reste un echec meme apres modificateurs. Validation stricte.
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    // Dodge 1 (naturel 1 = echec automatique), target 2+ : +2 donnerait 3 mais 1 naturel = echec
    const result = checkBreakTackle(state, player, 1, 2, false);

    expect(result.triggered).toBe(false);
  });

  it('applique le +1 meme avec ST = 1 (Stunty)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 1 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 2, 3, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(1);
  });

  it('applique exactement le bonus necessaire sans sur-modifier', () => {
    // Le jet est juste ameliore du +1/+2, pas plus
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 3, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2); // ST 5 => +2
    expect(result.newSuccess).toBe(true);
  });
});
