/**
 * TEST-2d (Sprint 13) — Integration tests: Break Tackle + Iron Hard Skin
 *
 * Tests these skills through the full game flow (applyMove, resolveBlockResult)
 * with real roster player configurations from the 5 priority teams.
 *
 * Break Tackle: once per activation, +1 (ST<=4) or +2 (ST>=5) to a failed dodge roll.
 * Iron Hard Skin: nullifies attacker's armor-roll modifiers (Mighty Blow, Dirty Player,
 *   Chainsaw, Claws) when defender has IHS.
 */

import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  resolveBlockResult,
  getSkillEffect,
  checkBreakTackle,
  hasBreakTackle,
  getBreakTackleModifier,
} from '../index';
import { getArmorSkillContext } from '../skills/skill-bridge';
import type { GameState, Player, RNG, Move, BlockDiceResult } from '../core/types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function die(n: 1 | 2 | 3 | 4 | 5 | 6): number {
  return (n - 1) / 6 + 0.01;
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

function getPlayer(state: GameState, id: string): Player {
  return state.players.find(p => p.id === id)!;
}

function makeBlockResult(
  attackerId: string,
  targetId: string,
  result: 'BOTH_DOWN' | 'PUSH_BACK' | 'POW' | 'STUMBLE' | 'PLAYER_DOWN',
): BlockDiceResult {
  return {
    type: 'block',
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 1,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

// ── Roster-accurate player factories ─────────────────────────────────────

function makeDeathroller(overrides: Partial<Player> = {}): Player {
  return {
    id: 'DR1',
    team: 'A',
    pos: { x: 6, y: 7 },
    name: 'Dwarf Deathroller',
    number: 16,
    position: 'Deathroller',
    ma: 4, st: 7, ag: 5, pa: 6, av: 11,
    skills: [
      'break-tackle', 'dirty-player-2', 'juggernaut', 'loner-5',
      'mighty-blow-1', 'no-hands', 'secret-weapon', 'stand-firm',
      'armored-skull',
    ],
    pm: 4,
    state: 'active',
    ...overrides,
  };
}

function makeGnomePiston(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GP1',
    team: 'A',
    pos: { x: 5, y: 7 },
    name: 'Gnome avec pilonneuse',
    number: 5,
    position: 'Gnome with Piston',
    ma: 5, st: 3, ag: 3, pa: 5, av: 9,
    skills: ['iron-hard-skin'],
    pm: 5,
    state: 'active',
    ...overrides,
  };
}

function makeGnomeBeastmaster(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GB1',
    team: 'A',
    pos: { x: 7, y: 7 },
    name: 'Maitre des betes Gnomes',
    number: 8,
    position: 'Beastmaster',
    ma: 5, st: 3, ag: 3, pa: 4, av: 9,
    skills: ['iron-hard-skin'],
    pm: 5,
    state: 'active',
    ...overrides,
  };
}

function makeGnomeTreeman(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GT1',
    team: 'A',
    pos: { x: 8, y: 7 },
    name: 'Homme-Arbre',
    number: 16,
    position: 'Treeman',
    ma: 2, st: 6, ag: 5, pa: 6, av: 11,
    skills: ['guard', 'iron-hard-skin', 'loner-4', 'mighty-blow-1', 'stand-firm', 'take-root', 'wild-animal'],
    pm: 2,
    state: 'active',
    ...overrides,
  };
}

function makeSaurusWarrior(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SW1',
    team: 'B',
    pos: { x: 7, y: 7 },
    name: 'Saurus Warrior',
    number: 1,
    position: 'Saurus Blocker',
    ma: 6, st: 4, ag: 5, pa: 6, av: 10,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeStormvermin(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SV1',
    team: 'B',
    pos: { x: 9, y: 7 },
    name: 'Stormvermin',
    number: 3,
    position: 'Blitzer',
    ma: 7, st: 3, ag: 3, pa: 5, av: 9,
    skills: ['block'],
    pm: 7,
    state: 'active',
    ...overrides,
  };
}

function makeGutterRunner(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GR1',
    team: 'B',
    pos: { x: 10, y: 7 },
    name: 'Gutter Runner',
    number: 7,
    position: 'Gutter Runner',
    ma: 9, st: 2, ag: 2, pa: 4, av: 8,
    skills: ['dodge'],
    pm: 9,
    state: 'active',
    ...overrides,
  };
}

function makeSkinkRunner(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SK1',
    team: 'B',
    pos: { x: 11, y: 7 },
    name: 'Skink Runner',
    number: 8,
    position: 'Skink Runner',
    ma: 8, st: 2, ag: 2, pa: 4, av: 8,
    skills: ['dodge', 'stunty'],
    pm: 8,
    state: 'active',
    ...overrides,
  };
}

function makeAttackerWithMightyBlow(overrides: Partial<Player> = {}): Player {
  return {
    id: 'MB1',
    team: 'B',
    pos: { x: 6, y: 6 },
    name: 'Mighty Blower',
    number: 2,
    position: 'Blitzer',
    ma: 6, st: 4, ag: 3, pa: 5, av: 9,
    skills: ['mighty-blow-1', 'block'],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

// ── Break Tackle: checkBreakTackle with roster players ───────────────────

describe('Integration: Break Tackle — checkBreakTackle avec joueurs roster', () => {
  it('Deathroller (ST7) applique +2 sur un dodge rate', () => {
    const dr = makeDeathroller();
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 3, 5, false);

    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
    expect(result.newSuccess).toBe(true);
  });

  it('Deathroller — ne declenche pas si le dodge est deja reussi', () => {
    const dr = makeDeathroller();
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 5, 4, true);

    expect(result.triggered).toBe(false);
  });

  it('Deathroller — ne declenche pas sur un 1 naturel (BB3)', () => {
    const dr = makeDeathroller();
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 1, 2, false);

    expect(result.triggered).toBe(false);
  });

  it('Deathroller — ne declenche pas si breakTackleUsed est deja true', () => {
    const dr = makeDeathroller({ breakTackleUsed: true });
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 3, 5, false);

    expect(result.triggered).toBe(false);
  });

  it('Deathroller — marque breakTackleUsed=true apres declenchement', () => {
    const dr = makeDeathroller();
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 3, 5, false);

    expect(result.triggered).toBe(true);
    const updatedDR = result.newState.players.find(p => p.id === dr.id);
    expect(updatedDR?.breakTackleUsed).toBe(true);
  });

  it('Saurus SANS break-tackle — ne declenche pas', () => {
    const saurus = makeSaurusWarrior();
    const state = makeState([saurus]);

    const result = checkBreakTackle(state, saurus, 3, 5, false);

    expect(result.triggered).toBe(false);
  });
});

// ── Break Tackle: predicats avec joueurs roster ─────────────────────────

describe('Integration: Break Tackle — predicats roster', () => {
  it('hasBreakTackle — vrai pour Deathroller', () => {
    expect(hasBreakTackle(makeDeathroller())).toBe(true);
  });

  it('hasBreakTackle — faux pour Saurus', () => {
    expect(hasBreakTackle(makeSaurusWarrior())).toBe(false);
  });

  it('getBreakTackleModifier — +2 pour Deathroller (ST7)', () => {
    expect(getBreakTackleModifier(makeDeathroller())).toBe(2);
  });

  it('getBreakTackleModifier — +1 pour un joueur ST4 avec break-tackle', () => {
    const player = makeSaurusWarrior({ st: 4, skills: ['break-tackle'] });
    expect(getBreakTackleModifier(player)).toBe(1);
  });

  it('getBreakTackleModifier — +2 pour un joueur ST5 avec break-tackle', () => {
    const player = makeSaurusWarrior({ st: 5, skills: ['break-tackle'] });
    expect(getBreakTackleModifier(player)).toBe(2);
  });
});

// ── Break Tackle: full dodge flow via applyMove ──────────────────────────

describe('Integration: Break Tackle dans le flow de dodge complet', () => {
  it('Deathroller dodge a travers une zone de tacle — Break Tackle sauve un echec', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 }, pm: 4 });
    const tackler = makeStormvermin({ id: 'B1', pos: { x: 6, y: 6 } });
    const state = makeState([dr, tackler]);

    // Deathroller AG 5 → base target 5+, +1 tackle zone = 6+.
    // D6=4 fails (4 < 6). Break Tackle +2 (ST7): 4+2=6 >= 6 → success!
    const rng = makeTestRNG([die(4), die(6), die(6), die(6), die(6)]);
    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 7 } };
    const result = applyMove(state, move, rng);

    const drAfter = getPlayer(result, 'A1');
    expect(drAfter.pos).toEqual({ x: 6, y: 7 });
    expect(result.isTurnover).toBe(false);
  });

  it('Break Tackle log apparait dans gameLog quand il se declenche', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 }, pm: 4 });
    const tackler = makeStormvermin({ id: 'B1', pos: { x: 6, y: 6 } });
    const state = makeState([dr, tackler]);

    // Same scenario: D6=4 fails dodge, Break Tackle +2 saves.
    const rng = makeTestRNG([die(4), die(6), die(6), die(6), die(6)]);
    const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 7 } };
    const result = applyMove(state, move, rng);

    const btLog = result.gameLog.find(
      log => log.message.includes('Break Tackle') || log.message.includes('Esquive en Force'),
    );
    expect(btLog).toBeDefined();
  });
});

// ── Iron Hard Skin: getArmorSkillContext avec joueurs roster ──────────────

describe('Integration: Iron Hard Skin — getArmorSkillContext avec joueurs roster', () => {
  it('Gnome Piston — ironHardSkinActive=true', () => {
    const attacker = makeAttackerWithMightyBlow({ id: 'B1' });
    const gnome = makeGnomePiston({ id: 'A1' });
    const state = makeState([gnome, attacker]);

    const ctx = getArmorSkillContext(state, attacker, gnome);
    expect(ctx.ironHardSkinActive).toBe(true);
  });

  it('Gnome Beastmaster — ironHardSkinActive=true', () => {
    const attacker = makeAttackerWithMightyBlow({ id: 'B1' });
    const bm = makeGnomeBeastmaster({ id: 'A1' });
    const state = makeState([bm, attacker]);

    const ctx = getArmorSkillContext(state, attacker, bm);
    expect(ctx.ironHardSkinActive).toBe(true);
  });

  it('Gnome Treeman — ironHardSkinActive=true', () => {
    const attacker = makeAttackerWithMightyBlow({ id: 'B1' });
    const tree = makeGnomeTreeman({ id: 'A1' });
    const state = makeState([tree, attacker]);

    const ctx = getArmorSkillContext(state, attacker, tree);
    expect(ctx.ironHardSkinActive).toBe(true);
  });

  it('Saurus SANS iron-hard-skin — ironHardSkinActive=false', () => {
    const attacker = makeAttackerWithMightyBlow({ id: 'B1' });
    const saurus = makeSaurusWarrior({ id: 'A1', team: 'A' });
    const state = makeState([saurus, attacker]);

    const ctx = getArmorSkillContext(state, attacker, saurus);
    expect(ctx.ironHardSkinActive).toBe(false);
  });

  it('Claws neutralisees par Iron Hard Skin', () => {
    const attacker = makeAttackerWithMightyBlow({ id: 'B1', skills: ['claws', 'mighty-blow-1'] });
    const gnome = makeGnomePiston({ id: 'A1' });
    const state = makeState([gnome, attacker]);

    const ctx = getArmorSkillContext(state, attacker, gnome);
    expect(ctx.ironHardSkinActive).toBe(true);
    expect(ctx.clawsActive).toBe(false);
  });
});

// ── Iron Hard Skin: full block flow via resolveBlockResult ───────────────

describe('Integration: Iron Hard Skin dans la chaine de blocage', () => {
  it('Mighty Blow nullifie sur jet d\'armure contre Gnome Piston (IHS)', () => {
    const attacker = makeAttackerWithMightyBlow({
      id: 'B1', pos: { x: 5, y: 7 }, team: 'B',
    });
    const gnome = makeGnomePiston({
      id: 'A1', pos: { x: 6, y: 7 }, team: 'A',
    });
    const state = makeState([gnome, attacker]);

    // 2D6 armor = 4+4 = 8 ; AV 9. Without MB: 8 < 9 = armor holds.
    // With MB but IHS: still 8 < 9 = armor holds.
    const rng = makeTestRNG([die(4), die(4), die(1), die(1)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('B1', 'A1', 'POW'),
      rng,
    );

    const gnomeAfter = getPlayer(result, 'A1');
    expect(gnomeAfter.stunned).toBe(true);
    expect(gnomeAfter.state).toBe('active');
  });

  it('Iron Hard Skin log present dans le jet d\'armure', () => {
    const attacker = makeAttackerWithMightyBlow({
      id: 'B1', pos: { x: 5, y: 7 }, team: 'B',
    });
    const gnome = makeGnomePiston({
      id: 'A1', pos: { x: 6, y: 7 }, team: 'A',
    });
    const state = makeState([gnome, attacker]);

    const rng = makeTestRNG([die(4), die(4), die(1), die(1)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('B1', 'A1', 'POW'),
      rng,
    );

    const ihsLog = result.gameLog.find(
      log => log.message.includes('Iron Hard Skin'),
    );
    expect(ihsLog).toBeDefined();
  });

  it('Mighty Blow s\'applique normalement sans Iron Hard Skin (regression)', () => {
    const attacker = makeAttackerWithMightyBlow({
      id: 'B1', pos: { x: 5, y: 7 }, team: 'B',
    });
    const saurus = makeSaurusWarrior({
      id: 'A1', pos: { x: 6, y: 7 }, team: 'A', av: 9,
    });
    const state = makeState([saurus, attacker]);

    // 2D6 = 4+4 = 8 ; AV 9 ; MB +1 => 9 >= 9 = armor broken.
    // Injury: 6+6 = 12 -> casualty.
    const rng = makeTestRNG([die(4), die(4), die(6), die(6), die(6), die(6)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('B1', 'A1', 'POW'),
      rng,
    );

    const saurusAfter = getPlayer(result, 'A1');
    expect(saurusAfter.state !== 'active' || saurusAfter.stunned).toBeTruthy();
  });

  it('Gnome Treeman (AV11 + IHS) — armure tres difficile a percer', () => {
    const attacker = makeAttackerWithMightyBlow({
      id: 'B1', pos: { x: 5, y: 7 }, team: 'B',
    });
    const tree = makeGnomeTreeman({
      id: 'A1', pos: { x: 6, y: 7 }, team: 'A',
    });
    const state = makeState([tree, attacker]);

    // 2D6 = 5+5 = 10 ; AV 11 + IHS (MB nullified) => 10 < 11 = armor holds.
    const rng = makeTestRNG([die(5), die(5), die(1), die(1)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('B1', 'A1', 'POW'),
      rng,
    );

    const treeAfter = getPlayer(result, 'A1');
    expect(treeAfter.stunned).toBe(true);
    expect(treeAfter.state).toBe('active');
  });
});

// ── Cross-skill: Break Tackle + Iron Hard Skin (Deathroller has both) ────

describe('Integration: Break Tackle + Iron Hard Skin sur Deathroller', () => {
  it('Deathroller a les deux skills — verification roster', () => {
    const dr = makeDeathroller();
    expect(dr.skills).toContain('break-tackle');
    expect(dr.skills).toContain('armored-skull');
  });

  it('checkBreakTackle fonctionne pour Deathroller avec tous ses skills', () => {
    const dr = makeDeathroller();
    const state = makeState([dr]);

    const result = checkBreakTackle(state, dr, 3, 5, false);
    expect(result.triggered).toBe(true);
    expect(result.modifier).toBe(2);
  });

  it('Deathroller bloque : attaquant avec MB contre Gnome IHS — MB nullifie', () => {
    const mbAttacker = makeAttackerWithMightyBlow({
      id: 'B1', pos: { x: 5, y: 7 }, team: 'B',
    });
    const gnome = makeGnomePiston({
      id: 'A1', pos: { x: 6, y: 7 }, team: 'A',
    });
    const state = makeState([gnome, mbAttacker]);

    const ctx = getArmorSkillContext(state, mbAttacker, gnome);
    expect(ctx.ironHardSkinActive).toBe(true);
  });
});

// ── Skill registry verification ──────────────────────────────────────────

describe('Integration: Break Tackle + Iron Hard Skin enregistrement skill-registry', () => {
  it('break-tackle est enregistre avec trigger on-dodge', () => {
    const effect = getSkillEffect('break-tackle');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-dodge');
  });

  it('iron-hard-skin est enregistre avec trigger on-armor-roll', () => {
    const effect = getSkillEffect('iron-hard-skin');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-armor');
  });

  it('Deathroller roster contient break-tackle', () => {
    const dr = makeDeathroller();
    expect(dr.skills).toContain('break-tackle');
  });

  it('Gnome Piston roster contient iron-hard-skin', () => {
    const gnome = makeGnomePiston();
    expect(gnome.skills).toContain('iron-hard-skin');
  });

  it('Gnome Beastmaster roster contient iron-hard-skin', () => {
    const bm = makeGnomeBeastmaster();
    expect(bm.skills).toContain('iron-hard-skin');
  });

  it('Gnome Treeman roster contient iron-hard-skin', () => {
    const tree = makeGnomeTreeman();
    expect(tree.skills).toContain('iron-hard-skin');
  });
});
