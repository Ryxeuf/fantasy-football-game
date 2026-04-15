import { describe, it, expect } from 'vitest';
import {
  hasBreakTackle,
  getBreakTackleDodgeBonus,
  canApplyBreakTackle,
  hasUsedBreakTackleThisTurn,
  markBreakTackleUsed,
} from './break-tackle';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import type { Player, GameState } from '../core/types';
import { setup } from '../core/game-state';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  return state;
}

describe('Règle: Break Tackle - detection', () => {
  it('hasBreakTackle retourne true pour un joueur avec le skill', () => {
    const player = makePlayer({ skills: ['break-tackle'] });
    expect(hasBreakTackle(player)).toBe(true);
  });

  it('hasBreakTackle retourne true pour la variante underscore', () => {
    const player = makePlayer({ skills: ['break_tackle'] });
    expect(hasBreakTackle(player)).toBe(true);
  });

  it('hasBreakTackle retourne false sans le skill', () => {
    const player = makePlayer({ skills: [] });
    expect(hasBreakTackle(player)).toBe(false);
  });
});

describe('Règle: Break Tackle - bonus au jet d\'esquive', () => {
  it('retourne ST - AG quand ST > AG (Dwarf Deathroller : ST 7, AG 5)', () => {
    const deathroller = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    expect(getBreakTackleDodgeBonus(deathroller)).toBe(2);
  });

  it('retourne +1 quand ST = AG + 1 (Orc Blitzer : ST 4, AG 3)', () => {
    const blitzer = makePlayer({ skills: ['break-tackle'], st: 4, ag: 3 });
    expect(getBreakTackleDodgeBonus(blitzer)).toBe(1);
  });

  it('retourne 0 quand ST = AG', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 3, ag: 3 });
    expect(getBreakTackleDodgeBonus(player)).toBe(0);
  });

  it('retourne 0 quand ST < AG (ne pénalise jamais)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 2, ag: 3 });
    expect(getBreakTackleDodgeBonus(player)).toBe(0);
  });

  it('retourne 0 quand le joueur n\'a pas le skill', () => {
    const player = makePlayer({ skills: [], st: 7, ag: 5 });
    expect(getBreakTackleDodgeBonus(player)).toBe(0);
  });
});

describe('Règle: Break Tackle - tracking once-per-turn', () => {
  it('canApplyBreakTackle retourne true quand skill present, ST > AG, pas encore utilise', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    expect(canApplyBreakTackle(state, player)).toBe(true);
  });

  it('canApplyBreakTackle retourne false quand ST <= AG', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 3, ag: 3 });
    const state = makeState([player]);
    expect(canApplyBreakTackle(state, player)).toBe(false);
  });

  it('canApplyBreakTackle retourne false sans le skill', () => {
    const player = makePlayer({ skills: [], st: 7, ag: 5 });
    const state = makeState([player]);
    expect(canApplyBreakTackle(state, player)).toBe(false);
  });

  it('canApplyBreakTackle retourne false apres une utilisation ce tour', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    const usedState = markBreakTackleUsed(state, player.id);
    expect(canApplyBreakTackle(usedState, player)).toBe(false);
  });

  it('hasUsedBreakTackleThisTurn retourne false par defaut', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    expect(hasUsedBreakTackleThisTurn(state, player.id)).toBe(false);
  });

  it('hasUsedBreakTackleThisTurn retourne true apres markBreakTackleUsed', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    const usedState = markBreakTackleUsed(state, player.id);
    expect(hasUsedBreakTackleThisTurn(usedState, player.id)).toBe(true);
  });

  it('markBreakTackleUsed ne mute pas l\'etat source (immuabilite)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    markBreakTackleUsed(state, player.id);
    expect(state.usedBreakTackleThisTurn).toBeUndefined();
  });

  it('markBreakTackleUsed est idempotent pour un meme joueur', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([player]);
    const once = markBreakTackleUsed(state, player.id);
    const twice = markBreakTackleUsed(once, player.id);
    expect(twice.usedBreakTackleThisTurn).toEqual([player.id]);
  });

  it('markBreakTackleUsed accumule plusieurs joueurs differents', () => {
    const p1 = makePlayer({ id: 'p1', skills: ['break-tackle'], st: 7, ag: 5 });
    const p2 = makePlayer({ id: 'p2', skills: ['break-tackle'], st: 5, ag: 4 });
    const state = makeState([p1, p2]);
    const afterP1 = markBreakTackleUsed(state, p1.id);
    const afterP2 = markBreakTackleUsed(afterP1, p2.id);
    expect(afterP2.usedBreakTackleThisTurn).toEqual([p1.id, p2.id]);
  });
});

describe('Règle: Break Tackle - integration dans getDodgeSkillModifiers', () => {
  it('applique le bonus Break Tackle quand ST > AG et non utilise', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4, ag: 3 });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(1);
  });

  it('retourne 0 apres utilisation (once per turn)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 4, ag: 3 });
    const state = makeState([player]);
    const usedState = markBreakTackleUsed(state, player.id);
    const mod = getDodgeSkillModifiers(usedState, player, player.pos);
    expect(mod).toBe(0);
  });

  it('applique le bonus sur une Deathroller (ST 7, AG 5 => +2)', () => {
    const deathroller = makePlayer({ skills: ['break-tackle'], st: 7, ag: 5 });
    const state = makeState([deathroller]);
    const mod = getDodgeSkillModifiers(state, deathroller, deathroller.pos);
    expect(mod).toBe(2);
  });
});
