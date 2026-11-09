import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from '../actions/actions';
import { checkBreakTackle, getBreakTackleModifier } from './break-tackle';
import type { GameState, Player } from '../core/types';

/**
 * Break Tackle — Esquive en Force (Blood Bowl 2025, Saison 3) :
 * - Once per (team) turn, when the player attempts to Dodge, they may apply to
 *   the Agility test:
 *     - +1 if their Strength characteristic is 3 or less,
 *     - +2 if their Strength characteristic is 4,
 *     - +3 if their Strength characteristic is 5 or more.
 * - The skill is only useful to turn a failed dodge into a success.
 * - A player can only use Break Tackle once per turn, regardless of how many
 *   Dodge actions they make; the use is given back at END_TURN.
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

  it('ne declenche pas si le joueur a deja utilise Break Tackle pendant ce tour', () => {
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

  it('applique +1 quand ST = 2 (palier « 3 ou moins »)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 2 });
    expect(getBreakTackleModifier(player)).toBe(1);
    // Dodge 3, target 5+ : +1 ne suffit pas => compétence gardée.
    expect(checkBreakTackle(makeState([player]), player, 3, 5, false).triggered).toBe(false);
  });

  it('applique +2 quand ST = 4', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4 });
    const state = makeState([player]);

    // Dodge 2, target 4+ : +2 donne 4 => succès (+1 n'aurait pas suffi).
    const result = checkBreakTackle(state, player, 2, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
    expect(result.newSuccess).toBe(true);
  });

  it('applique +3 quand ST = 5', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    // Dodge 2, target 5+ : +3 donne 5 => succès (+2 n'aurait pas suffi).
    const result = checkBreakTackle(state, player, 2, 5, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(3);
    expect(result.newSuccess).toBe(true);
  });

  it('applique +3 quand ST = 7 (Deathroller)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 3, 6, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(3);
    expect(result.newSuccess).toBe(true);
  });

  it('table des paliers : ST 1-3 ⇒ +1, ST 4 ⇒ +2, ST 5+ ⇒ +3', () => {
    const expected: Array<[number, number]> = [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
      [5, 3],
      [6, 3],
      [7, 3],
    ];
    for (const [st, modifier] of expected) {
      expect(getBreakTackleModifier(makePlayer({ st }))).toBe(modifier);
    }
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
    expect(result.modifier).toBe(3);
  });
});

describe('Regle: Break Tackle — une fois par TOUR', () => {
  it('un second dodge du meme tour ne peut plus en beneficier', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4 });
    const first = checkBreakTackle(makeState([player]), player, 2, 4, false);
    expect(first.triggered).toBe(true);

    const afterFirst = first.newState.players.find((p) => p.id === player.id)!;
    const second = checkBreakTackle(first.newState, afterFirst, 2, 4, false);
    expect(second.triggered).toBe(false);
  });

  it('END_TURN rend l\'usage : le tour suivant de l\'equipe peut l\'utiliser a nouveau', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4, breakTackleUsed: true });
    const base = makeState([player]);
    const state: GameState = { ...base, currentPlayer: 'A' };

    const afterEnd = applyMove(state, { type: 'END_TURN' }, () => 0.5);
    const reset = afterEnd.players.find((p) => p.id === player.id)!;
    expect(reset.breakTackleUsed).toBe(false);
    expect(checkBreakTackle(afterEnd, reset, 2, 4, false).triggered).toBe(true);
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
    // Le jet est juste ameliore du +1/+2/+3, pas plus
    const player = makePlayer({ skills: ['break-tackle'], st: 5 });
    const state = makeState([player]);

    const result = checkBreakTackle(state, player, 3, 4, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(3); // ST 5 => +3
    expect(result.newSuccess).toBe(true);
  });
});
