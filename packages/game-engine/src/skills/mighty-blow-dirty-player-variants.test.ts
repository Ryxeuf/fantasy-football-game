import { describe, it, expect } from 'vitest';
import { setup, type GameState, type Player } from '../index';
import { collectModifiers, getSkillEffect } from './skill-registry';

/**
 * O.1 batch 3h — Variantes Mighty Blow (+1 / +2) et Dirty Player (+2).
 *
 * Les rosters BB3 utilisent les slugs `mighty-blow-1`, `mighty-blow-2` et
 * `dirty-player-2`, mais seul `dirty-player-1` (et l'ancien `mighty-blow`
 * sans suffixe) etait enregistre. Resultat : les Big Guys, le Deathroller
 * et Morg n Thorg n'avaient AUCUN bonus d'armure / blessure en jeu.
 *
 * Ce batch enregistre les 3 slugs manquants pour que les rosters existants
 * appliquent enfin le bonus correct.
 */

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

describe('Skill registry: mighty-blow-1', () => {
  it('est enregistre', () => {
    expect(getSkillEffect('mighty-blow-1')).toBeDefined();
  });

  it('declare un trigger on-armor', () => {
    const effect = getSkillEffect('mighty-blow-1')!;
    expect(effect.triggers).toContain('on-armor');
  });

  it('applique +1 armorModifier sur on-armor pour un joueur ayant le skill', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['mighty-blow-1'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-armor', { state: s });
    expect(mods.armorModifier).toBe(1);
  });

  it('n\'applique aucun bonus pour un joueur sans le skill', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: [] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-armor', { state: s });
    expect(mods.armorModifier ?? 0).toBe(0);
  });
});

describe('Skill registry: mighty-blow-2', () => {
  it('est enregistre', () => {
    expect(getSkillEffect('mighty-blow-2')).toBeDefined();
  });

  it('declare un trigger on-armor', () => {
    const effect = getSkillEffect('mighty-blow-2')!;
    expect(effect.triggers).toContain('on-armor');
  });

  it('applique +2 armorModifier sur on-armor pour un joueur ayant le skill', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['mighty-blow-2'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-armor', { state: s });
    expect(mods.armorModifier).toBe(2);
  });

  it('n\'est pas declenche par mighty-blow-1', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['mighty-blow-1'] });
    const player = s.players.find(p => p.id === 'A2')!;
    // mighty-blow-2 ne doit pas s'activer pour ce joueur (slug different).
    expect(getSkillEffect('mighty-blow-2')!.canApply({ player, state: s })).toBe(false);
  });
});

describe('Skill registry: dirty-player-2', () => {
  it('est enregistre', () => {
    expect(getSkillEffect('dirty-player-2')).toBeDefined();
  });

  it('declare un trigger on-foul', () => {
    const effect = getSkillEffect('dirty-player-2')!;
    expect(effect.triggers).toContain('on-foul');
  });

  it('applique +2 armorModifier sur on-foul pour un joueur ayant le skill', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['dirty-player-2'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-foul', { state: s });
    expect(mods.armorModifier).toBe(2);
  });

  it('n\'est pas declenche par dirty-player-1', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['dirty-player-1'] });
    const player = s.players.find(p => p.id === 'A2')!;
    // dirty-player-2 ne doit pas s'activer pour ce joueur (slug different).
    expect(getSkillEffect('dirty-player-2')!.canApply({ player, state: s })).toBe(false);
  });
});

describe('Skill stacking : un joueur n\'a jamais qu\'une seule variante', () => {
  it('un joueur avec uniquement mighty-blow-1 obtient +1 (pas +3)', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['mighty-blow-1'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-armor', { state: s });
    expect(mods.armorModifier).toBe(1);
  });

  it('un joueur avec uniquement mighty-blow-2 obtient +2', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['mighty-blow-2'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-armor', { state: s });
    expect(mods.armorModifier).toBe(2);
  });

  it('un joueur avec uniquement dirty-player-2 obtient +2 sur foul', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { skills: ['dirty-player-2'] });
    const player = s.players.find(p => p.id === 'A2')!;
    const mods = collectModifiers(player, 'on-foul', { state: s });
    expect(mods.armorModifier).toBe(2);
  });
});
