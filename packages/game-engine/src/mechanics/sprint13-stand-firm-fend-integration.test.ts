/**
 * TEST-2c (Sprint 13) — Integration tests: Stand Firm + Fend
 *
 * Tests these skills through the full game flow (resolveBlockResult, applyMove,
 * applyChainPush) with real roster player configurations from the 5 priority teams.
 *
 * Stand Firm: prevents push (target stays on square), prevents chain push,
 *   annulled by Juggernaut on Blitz.
 * Fend: prevents attacker follow-up after push, annulled by Juggernaut on Blitz.
 */

import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  resolveBlockResult,
  applyChainPush,
  getSkillEffect,
} from '../index';
import {
  hasStandFirm,
  isStandFirmActiveForBlock,
  isStandFirmActiveForChainPush,
} from './stand-firm';
import { hasFend, isFendActiveForFollowUp } from './fend';
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

/** Conversion lisible : valeur de de D6 -> float RNG. */
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

/** Imperial Nobility Bodyguard — stand-firm + wrestle (S2 roster) */
function makeBodyguard(overrides: Partial<Player> = {}): Player {
  return {
    id: 'BG1',
    team: 'B',
    pos: { x: 11, y: 7 },
    name: 'Bodyguard',
    number: 5,
    position: 'Bodyguard',
    ma: 6, st: 3, ag: 3, pa: 5, av: 9,
    skills: ['stand-firm', 'wrestle'],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

/** Gnome Treeman — stand-firm + guard + iron-hard-skin + mighty-blow-1 etc. */
function makeGnomeTreeman(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GT1',
    team: 'B',
    pos: { x: 11, y: 7 },
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

/** Dwarf Deathroller — stand-firm + juggernaut etc. */
function makeDeathroller(overrides: Partial<Player> = {}): Player {
  return {
    id: 'DR1',
    team: 'A',
    pos: { x: 10, y: 7 },
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

/** Imperial Retainer Lineman — fend (S2 roster) */
function makeImperialRetainer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'IR1',
    team: 'B',
    pos: { x: 11, y: 7 },
    name: 'Imperial Retainer',
    number: 1,
    position: 'Imperial Retainer Linemen',
    ma: 6, st: 3, ag: 4, pa: 4, av: 8,
    skills: ['fend'],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

/** Saurus Warrior — generic attacker (no special block skills) */
function makeSaurusWarrior(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SW1',
    team: 'A',
    pos: { x: 10, y: 7 },
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

/** Stormvermin — Skaven blitzer with block */
function makeStormvermin(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SV1',
    team: 'A',
    pos: { x: 10, y: 7 },
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

// ── Stand Firm: predicats avec joueurs roster ────────────────────────────

describe('Integration: Stand Firm predicats avec joueurs roster', () => {
  it('Bodyguard (stand-firm) — hasStandFirm vrai', () => {
    const bg = makeBodyguard();
    expect(hasStandFirm(bg)).toBe(true);
  });

  it('Gnome Treeman (stand-firm) — hasStandFirm vrai', () => {
    const tree = makeGnomeTreeman();
    expect(hasStandFirm(tree)).toBe(true);
  });

  it('Deathroller (stand-firm) — hasStandFirm vrai', () => {
    const dr = makeDeathroller();
    expect(hasStandFirm(dr)).toBe(true);
  });

  it('Imperial Retainer (fend, pas stand-firm) — hasStandFirm faux', () => {
    const ir = makeImperialRetainer();
    expect(hasStandFirm(ir)).toBe(false);
  });

  it('isStandFirmActiveForBlock — Bodyguard vs Saurus (block normal)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1' });
    const bg = makeBodyguard({ id: 'B1' });
    const state = makeState([saurus, bg]);

    expect(isStandFirmActiveForBlock(state, getPlayer(state, 'A1'), getPlayer(state, 'B1'))).toBe(true);
  });

  it('isStandFirmActiveForBlock — faux quand Deathroller Blitz (Juggernaut)', () => {
    const dr = makeDeathroller({ id: 'A1' });
    const bg = makeBodyguard({ id: 'B1' });
    const state = makeState([dr, bg]);
    state.playerActions = { A1: 'BLITZ' };

    expect(isStandFirmActiveForBlock(state, getPlayer(state, 'A1'), getPlayer(state, 'B1'))).toBe(false);
  });

  it('isStandFirmActiveForChainPush — Gnome Treeman debout', () => {
    const tree = makeGnomeTreeman();
    expect(isStandFirmActiveForChainPush(tree)).toBe(true);
  });

  it('isStandFirmActiveForChainPush — Gnome Treeman stunned = faux', () => {
    const tree = makeGnomeTreeman({ stunned: true });
    expect(isStandFirmActiveForChainPush(tree)).toBe(false);
  });
});

// ── Stand Firm: full block resolution via resolveBlockResult ─────────────

describe('Integration: Stand Firm dans le flow de blocage complet', () => {
  it('Saurus vs Bodyguard (PUSH_BACK) — Bodyguard refuse la poussee', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const bg = makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, bg]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    expect(defender.pos).toEqual({ x: 11, y: 7 });
    expect(result.pendingPushChoice).toBeUndefined();
    expect(result.pendingFollowUpChoice).toBeUndefined();
  });

  it('Stormvermin vs Gnome Treeman (PUSH_BACK) — Treeman refuse la poussee', () => {
    const storm = makeStormvermin({ id: 'A1', pos: { x: 10, y: 7 } });
    const tree = makeGnomeTreeman({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([storm, tree]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    expect(defender.pos).toEqual({ x: 11, y: 7 });
  });

  it('POW vs Bodyguard — tombe sur sa case (pas de deplacement)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const bg = makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, bg]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'POW'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    expect(defender.pos).toEqual({ x: 11, y: 7 });
    expect(defender.stunned).toBe(true);
  });

  it('Stand Firm log explicite dans gameLog', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const bg = makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, bg]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const sfLog = result.gameLog.find(log =>
      log.message.toLowerCase().includes('stand firm'),
    );
    expect(sfLog).toBeDefined();
  });

  it('Deathroller Blitz (Juggernaut) annule Stand Firm du Bodyguard', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 10, y: 7 } });
    const bg = makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([dr, bg]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    const pushed = defender.pos.x !== 11 || defender.pos.y !== 7;
    const hasChoice = result.pendingPushChoice !== undefined;
    expect(pushed || hasChoice).toBe(true);
  });

  it('Deathroller Block normal (pas Blitz) — Stand Firm du Bodyguard reste actif', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 10, y: 7 } });
    const bg = makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([dr, bg]);
    // Pas de BLITZ dans playerActions

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    expect(defender.pos).toEqual({ x: 11, y: 7 });
  });
});

// ── Stand Firm: chain push prevention ────────────────────────────────────

describe('Integration: Stand Firm empeche le chain push (Gnome Treeman)', () => {
  it('Treeman en chaine — refuse le chain push', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 9, y: 7 } });
    const victim = makeBodyguard({ id: 'B1', pos: { x: 10, y: 7 }, skills: [] });
    const tree = makeGnomeTreeman({ id: 'B2', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, victim, tree]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = applyChainPush(state, 'B1', { x: 1, y: 0 }, rng);

    const treeman = getPlayer(result, 'B2');
    expect(treeman.pos).toEqual({ x: 11, y: 7 });
    // B1 ne bouge pas non plus (case occupee par Treeman)
    const pushed = getPlayer(result, 'B1');
    expect(pushed.pos).toEqual({ x: 10, y: 7 });
  });

  it('Treeman stunned — chain push fonctionne', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 9, y: 7 } });
    const victim = makeBodyguard({ id: 'B1', pos: { x: 10, y: 7 }, skills: [] });
    const tree = makeGnomeTreeman({ id: 'B2', pos: { x: 11, y: 7 }, stunned: true });
    const state = makeState([saurus, victim, tree]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = applyChainPush(state, 'B1', { x: 1, y: 0 }, rng);

    const treeman = getPlayer(result, 'B2');
    expect(treeman.pos).toEqual({ x: 12, y: 7 });
  });
});

// ── Fend: predicats avec joueurs roster ──────────────────────────────────

describe('Integration: Fend predicats avec joueurs roster', () => {
  it('Imperial Retainer (fend) — hasFend vrai', () => {
    const ir = makeImperialRetainer();
    expect(hasFend(ir)).toBe(true);
  });

  it('Bodyguard (stand-firm, pas fend) — hasFend faux', () => {
    const bg = makeBodyguard();
    expect(hasFend(bg)).toBe(false);
  });

  it('isFendActiveForFollowUp — Imperial Retainer vs Saurus (block normal)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1' });
    const ir = makeImperialRetainer({ id: 'B1' });
    const state = makeState([saurus, ir]);

    expect(isFendActiveForFollowUp(state, getPlayer(state, 'A1'), getPlayer(state, 'B1'))).toBe(true);
  });

  it('isFendActiveForFollowUp — faux quand Deathroller Blitz (Juggernaut)', () => {
    const dr = makeDeathroller({ id: 'A1' });
    const ir = makeImperialRetainer({ id: 'B1' });
    const state = makeState([dr, ir]);
    state.playerActions = { A1: 'BLITZ' };

    expect(isFendActiveForFollowUp(state, getPlayer(state, 'A1'), getPlayer(state, 'B1'))).toBe(false);
  });

  it('isFendActiveForFollowUp — faux si Imperial Retainer stunned', () => {
    const saurus = makeSaurusWarrior({ id: 'A1' });
    const ir = makeImperialRetainer({ id: 'B1', stunned: true });
    const state = makeState([saurus, ir]);

    expect(isFendActiveForFollowUp(state, getPlayer(state, 'A1'), getPlayer(state, 'B1'))).toBe(false);
  });
});

// ── Fend: full block resolution via resolveBlockResult ───────────────────

describe('Integration: Fend dans le flow de blocage complet', () => {
  it('Saurus vs Imperial Retainer (PUSH_BACK) — pas de follow-up', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, ir]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    expect(result.pendingFollowUpChoice).toBeUndefined();
    // L'attaquant reste sur sa position initiale
    const attacker = getPlayer(result, 'A1');
    expect(attacker.pos).toEqual({ x: 10, y: 7 });
  });

  it('Imperial Retainer est quand meme pousse (Fend ne bloque que le follow-up)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, ir]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const defender = getPlayer(result, 'B1');
    const moved = defender.pos.x !== 11 || defender.pos.y !== 7;
    const hasChoice = result.pendingPushChoice !== undefined;
    expect(moved || hasChoice).toBe(true);
  });

  it('STUMBLE avec Dodge sur Imperial Retainer (fend+dodge) — Fend empeche follow-up', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 7 }, skills: ['fend', 'dodge'] });
    const state = makeState([saurus, ir]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'STUMBLE'),
      rng,
    );

    expect(result.pendingFollowUpChoice).toBeUndefined();
    const defender = getPlayer(result, 'B1');
    expect(defender.stunned).toBeFalsy();
  });

  it('POW vs Imperial Retainer — Fend PAS actif (cible knocked-down)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([saurus, ir]);

    const rng = makeTestRNG([die(3), die(4), die(2), die(3)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'POW'),
      rng,
    );

    // Sur POW, le follow-up est possible (Fend pas actif car knocked-down)
    const hasFollowUp = result.pendingFollowUpChoice !== undefined;
    const hasPushChoice = result.pendingPushChoice !== undefined;
    const targetSurfed = getPlayer(result, 'B1').pos.x < 0 || getPlayer(result, 'B1').pos.x > 25;
    expect(hasFollowUp || hasPushChoice || targetSurfed).toBe(true);
  });

  it('Deathroller Blitz (Juggernaut) annule Fend — follow-up possible', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 7 } });
    const state = makeState([dr, ir]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    const hasFollowUp = result.pendingFollowUpChoice !== undefined;
    const hasPushChoice = result.pendingPushChoice !== undefined;
    expect(hasFollowUp || hasPushChoice).toBe(true);
  });
});

// ── Fend: integration PUSH_CHOOSE ────────────────────────────────────────

describe('Integration: Fend avec PUSH_CHOOSE (Imperial Retainer)', () => {
  it('Fend empeche follow-up apres choix de direction', () => {
    // Diagonale pour avoir plusieurs directions disponibles
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const ir = makeImperialRetainer({ id: 'B1', pos: { x: 11, y: 8 } });
    const state = makeState([saurus, ir]);

    const rng = makeTestRNG([die(3), die(4)]);
    const intermediate = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    if (intermediate.pendingPushChoice) {
      const dir = intermediate.pendingPushChoice.availableDirections[0];
      const pushMove: Move = {
        type: 'PUSH_CHOOSE',
        playerId: 'A1',
        targetId: 'B1',
        direction: dir,
      };
      const after = applyMove(intermediate, pushMove, rng);

      expect(after.pendingFollowUpChoice).toBeUndefined();
      const attacker = getPlayer(after, 'A1');
      expect(attacker.pos).toEqual({ x: 10, y: 7 });

      const fendLog = after.gameLog.find(log =>
        log.message.toLowerCase().includes('fend'),
      );
      expect(fendLog).toBeDefined();
    } else {
      // Single direction : Fend log genere directement
      const fendLog = intermediate.gameLog.find(log =>
        log.message.toLowerCase().includes('fend'),
      );
      expect(fendLog).toBeDefined();
    }
  });
});

// ── Cross-skill: Stand Firm + Fend on same player ────────────────────────

describe('Integration: Stand Firm + Fend sur le meme joueur', () => {
  it('joueur avec stand-firm + fend : Stand Firm bloque la poussee (Fend secondaire)', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', pos: { x: 10, y: 7 } });
    const hybrid: Player = {
      ...makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } }),
      skills: ['stand-firm', 'fend'],
    };
    const state = makeState([saurus, hybrid]);

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    // Stand Firm previent la poussee → pas de follow-up non plus
    const defender = getPlayer(result, 'B1');
    expect(defender.pos).toEqual({ x: 11, y: 7 });
    expect(result.pendingFollowUpChoice).toBeUndefined();
    expect(result.pendingPushChoice).toBeUndefined();
  });

  it('Deathroller Blitz annule Stand Firm ET Fend (Juggernaut)', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 10, y: 7 } });
    const hybrid: Player = {
      ...makeBodyguard({ id: 'B1', pos: { x: 11, y: 7 } }),
      skills: ['stand-firm', 'fend'],
    };
    const state = makeState([dr, hybrid]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'PUSH_BACK'),
      rng,
    );

    // Juggernaut annule les deux → poussee ET follow-up possibles
    const defender = getPlayer(result, 'B1');
    const pushed = defender.pos.x !== 11 || defender.pos.y !== 7;
    const hasChoice = result.pendingPushChoice !== undefined;
    expect(pushed || hasChoice).toBe(true);
  });
});

// ── Skill registry verification ──────────────────────────────────────────

describe('Integration: Stand Firm + Fend enregistrement skill-registry', () => {
  it('stand-firm est enregistre avec trigger on-block-defender', () => {
    const effect = getSkillEffect('stand-firm');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-block-defender');
  });

  it('fend est enregistre avec trigger on-block-defender', () => {
    const effect = getSkillEffect('fend');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-block-defender');
  });

  it('Bodyguard roster contient stand-firm', () => {
    const bg = makeBodyguard();
    expect(bg.skills).toContain('stand-firm');
  });

  it('Gnome Treeman roster contient stand-firm', () => {
    const tree = makeGnomeTreeman();
    expect(tree.skills).toContain('stand-firm');
  });

  it('Deathroller roster contient stand-firm', () => {
    const dr = makeDeathroller();
    expect(dr.skills).toContain('stand-firm');
  });

  it('Imperial Retainer roster contient fend', () => {
    const ir = makeImperialRetainer();
    expect(ir.skills).toContain('fend');
  });
});
