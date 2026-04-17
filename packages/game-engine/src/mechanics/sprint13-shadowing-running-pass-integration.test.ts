/**
 * TEST-2e (Sprint 13) — Integration tests: Shadowing + Running Pass
 *
 * Tests ces skills avec les configurations exactes des rosters des 5 equipes
 * prioritaires.
 *
 * Shadowing (Lizardmen Chameleon Skink) : apres une esquive, le shadower
 *   adjacent a la case quittee tente un jet 2D6 + MA(shadower - dodger) >= 7
 *   pour suivre le fuyard. Une seule reussite par esquive (la premiere occupe
 *   la case liberee).
 *
 * Running Pass (Imperial Thrower) : apres une Quick Pass sans turnover, si le
 *   passeur a encore du PM et ne l'a pas deja utilise ce tour, il peut
 *   continuer a bouger. La variante `running-pass-2025` (S3) etend a Hand-Off.
 */

import { describe, it, expect } from 'vitest';
import {
  setup,
  hasShadowing,
  findShadowingCandidates,
  rollShadowing,
  tryApplyShadowing,
  resolveShadowingAfterDodge,
  hasRunningPass,
  hasRunningPassHandoffVariant,
  canApplyRunningPass,
  canApplyRunningPassToHandoff,
  hasUsedRunningPassThisTurn,
  markRunningPassUsed,
  canPlayerContinueMoving,
} from '../index';
import type { GameState, Player, RNG } from '../core/types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeSeededRng(d6rolls: number[]): RNG {
  let i = 0;
  return () => {
    const v = d6rolls[i++];
    if (v === undefined) {
      throw new Error('Ran out of seeded dice rolls');
    }
    return (v - 1) / 6 + 0.01 / 6;
  };
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

// ── Roster-accurate player factories ─────────────────────────────────────

/** Lizardmen Chameleon Skink (S2/S3) — dodge, on-the-ball, shadowing, stunty */
function makeChameleonSkink(overrides: Partial<Player> = {}): Player {
  return {
    id: 'CS1',
    team: 'B',
    pos: { x: 6, y: 5 },
    name: 'Chameleon Skink',
    number: 12,
    position: 'Chameleon Skink',
    ma: 7, st: 2, ag: 3, pa: 3, av: 8,
    skills: ['dodge', 'on-the-ball', 'shadowing', 'stunty'],
    pm: 7,
    state: 'active',
    ...overrides,
  };
}

/** Lizardmen Saurus Warrior — pas de shadowing, utilise comme controle */
function makeSaurus(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SW1',
    team: 'B',
    pos: { x: 6, y: 5 },
    name: 'Saurus Warrior',
    number: 1,
    position: 'Saurus',
    ma: 6, st: 4, ag: 4, pa: 6, av: 10,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

/** Skaven Gutter Runner — dodger generique (ma=9 pour tester MA diff) */
function makeGutterRunner(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GR1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Gutter Runner',
    number: 7,
    position: 'Gutter Runner',
    ma: 9, st: 2, ag: 3, pa: 4, av: 8,
    skills: ['dodge', 'stunty'],
    pm: 9,
    state: 'active',
    ...overrides,
  };
}

/** Imperial Nobility Thrower (S2) — pass + running-pass */
function makeImperialThrower(overrides: Partial<Player> = {}): Player {
  return {
    id: 'IT1',
    team: 'A',
    pos: { x: 10, y: 7 },
    name: 'Imperial Thrower',
    number: 3,
    position: 'Imperial Thrower',
    ma: 6, st: 3, ag: 3, pa: 3, av: 9,
    skills: ['pass', 'running-pass'],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

/** Imperial Nobility Bodyguard — pas de running-pass, utilise comme controle */
function makeImperialBodyguard(overrides: Partial<Player> = {}): Player {
  return {
    id: 'BG1',
    team: 'A',
    pos: { x: 10, y: 7 },
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

// ── Shadowing: predicats avec joueurs roster ─────────────────────────────

describe('Integration: Shadowing predicats avec joueurs roster', () => {
  it('Chameleon Skink (shadowing) — hasShadowing vrai', () => {
    expect(hasShadowing(makeChameleonSkink())).toBe(true);
  });

  it('Saurus (pas shadowing) — hasShadowing faux', () => {
    expect(hasShadowing(makeSaurus())).toBe(false);
  });

  it('findShadowingCandidates — retourne le Chameleon Skink adjacent', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 5, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, skink]);

    const candidates = findShadowingCandidates(state, dodger, { x: 5, y: 5 });
    expect(candidates.map(p => p.id)).toEqual(['B1']);
  });

  it('findShadowingCandidates — ignore un Saurus adjacent (pas le skill)', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 5, y: 5 } });
    const saurus = makeSaurus({ id: 'B1', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, saurus]);

    expect(findShadowingCandidates(state, dodger, { x: 5, y: 5 })).toEqual([]);
  });

  it('findShadowingCandidates — ignore un Chameleon Skink stunned', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 5, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 }, stunned: true });
    const state = makeState([dodger, skink]);

    expect(findShadowingCandidates(state, dodger, { x: 5, y: 5 })).toEqual([]);
  });
});

// ── Shadowing: jet 2D6 + MA ──────────────────────────────────────────────

describe('Integration: Shadowing — jet 2D6 + MA (Chameleon Skink vs Gutter Runner)', () => {
  it('Skink (ma=7) vs Gutter Runner (ma=9) — 2D6=6+6 + (7-9) = 10 ≥ 7 (succes)', () => {
    const dodger = makeGutterRunner();
    const skink = makeChameleonSkink();
    const rng = makeSeededRng([6, 6]);

    const roll = rollShadowing(skink, dodger, rng);
    expect(roll.dice).toEqual([6, 6]);
    expect(roll.total).toBe(10);
    expect(roll.target).toBe(7);
    expect(roll.success).toBe(true);
  });

  it('Skink (ma=7) vs Gutter Runner (ma=9) — 2D6=3+3 + (7-9) = 4 < 7 (echec)', () => {
    const dodger = makeGutterRunner();
    const skink = makeChameleonSkink();
    const rng = makeSeededRng([3, 3]);

    const roll = rollShadowing(skink, dodger, rng);
    expect(roll.total).toBe(4);
    expect(roll.success).toBe(false);
  });

  it('Skink (ma=7) vs Saurus lent (ma=6) — 2D6=3+3 + (7-6) = 7 (succes)', () => {
    const slowDodger = makeSaurus({ team: 'A' });
    const skink = makeChameleonSkink();
    const rng = makeSeededRng([3, 3]);

    const roll = rollShadowing(skink, slowDodger, rng);
    expect(roll.total).toBe(7);
    expect(roll.success).toBe(true);
  });
});

// ── Shadowing: tryApplyShadowing (deplacement effectif) ──────────────────

describe('Integration: Shadowing — tryApplyShadowing deplace le Chameleon Skink', () => {
  it('Succes — Skink se deplace dans la case liberee', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 7, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, skink]);
    const rng = makeSeededRng([6, 6]);

    const attempt = tryApplyShadowing(state, dodger, skink, { x: 5, y: 5 }, rng);
    expect(attempt.applied).toBe(true);
    const updatedSkink = getPlayer(attempt.state, 'B1');
    expect(updatedSkink.pos).toEqual({ x: 5, y: 5 });
  });

  it('Echec — Skink reste sur place', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 7, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, skink]);
    const rng = makeSeededRng([1, 1]);

    const attempt = tryApplyShadowing(state, dodger, skink, { x: 5, y: 5 }, rng);
    expect(attempt.applied).toBe(false);
    const updatedSkink = getPlayer(attempt.state, 'B1');
    expect(updatedSkink.pos).toEqual({ x: 6, y: 5 });
  });

  it('Log explicite avec "Shadowing" ajoute', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 7, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 } });
    const state = makeState([dodger, skink]);
    const rng = makeSeededRng([4, 3]);

    const before = state.gameLog.length;
    const attempt = tryApplyShadowing(state, dodger, skink, { x: 5, y: 5 }, rng);
    expect(attempt.state.gameLog.length).toBe(before + 1);
    expect(attempt.state.gameLog.at(-1)!.message.toLowerCase()).toContain('shadowing');
  });
});

// ── Shadowing: resolveShadowingAfterDodge (full flow) ────────────────────

describe('Integration: Shadowing — resolveShadowingAfterDodge avec roster', () => {
  it('Deux Chameleon Skinks adjacents — le premier qui reussit suit, l\'autre reste', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 7, y: 5 } });
    const skink1 = makeChameleonSkink({ id: 'B1', pos: { x: 6, y: 5 } });
    const skink2 = makeChameleonSkink({ id: 'B2', pos: { x: 6, y: 6 } });
    const state = makeState([dodger, skink1, skink2]);
    // skink1 : 6+6 + (7-9) = 10 → succes, stop.
    const rng = makeSeededRng([6, 6]);

    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    expect(getPlayer(next, 'B1').pos).toEqual({ x: 5, y: 5 });
    expect(getPlayer(next, 'B2').pos).toEqual({ x: 6, y: 6 });
  });

  it('Chameleon Skink non adjacent — resolveShadowingAfterDodge no-op', () => {
    const dodger = makeGutterRunner({ id: 'A1', pos: { x: 7, y: 5 } });
    const skink = makeChameleonSkink({ id: 'B1', pos: { x: 10, y: 10 } });
    const state = makeState([dodger, skink]);
    const rng: RNG = () => 0.5;

    const before = state.gameLog.length;
    const next = resolveShadowingAfterDodge(state, dodger, { x: 5, y: 5 }, rng);
    expect(next.gameLog.length).toBe(before);
    expect(getPlayer(next, 'B1').pos).toEqual({ x: 10, y: 10 });
  });
});

// ── Running Pass: predicats avec joueurs roster ──────────────────────────

describe('Integration: Running Pass predicats avec joueurs roster', () => {
  it('Imperial Thrower (running-pass) — hasRunningPass vrai', () => {
    expect(hasRunningPass(makeImperialThrower())).toBe(true);
  });

  it('Imperial Bodyguard (pas running-pass) — hasRunningPass faux', () => {
    expect(hasRunningPass(makeImperialBodyguard())).toBe(false);
  });

  it('Imperial Thrower S2 — hasRunningPassHandoffVariant faux (S2 uniquement)', () => {
    expect(hasRunningPassHandoffVariant(makeImperialThrower())).toBe(false);
  });

  it('Imperial Thrower avec running-pass-2025 — variante S3 active', () => {
    const it = makeImperialThrower({ skills: ['pass', 'running-pass-2025'] });
    expect(hasRunningPass(it)).toBe(true);
    expect(hasRunningPassHandoffVariant(it)).toBe(true);
  });
});

// ── Running Pass: canApplyRunningPass avec roster ────────────────────────

describe('Integration: Running Pass — canApplyRunningPass (Imperial Thrower)', () => {
  it('Quick Pass sans turnover, PM restant — autorise', () => {
    const thrower = makeImperialThrower({ pm: 4 });
    const state = makeState([thrower]);
    expect(canApplyRunningPass(state, thrower, 'quick', false)).toBe(true);
  });

  it('Short Pass — refuse (S2 uniquement Quick)', () => {
    const thrower = makeImperialThrower({ pm: 4 });
    const state = makeState([thrower]);
    expect(canApplyRunningPass(state, thrower, 'short', false)).toBe(false);
  });

  it('Quick Pass mais turnover — refuse', () => {
    const thrower = makeImperialThrower({ pm: 4 });
    const state = makeState([thrower]);
    expect(canApplyRunningPass(state, thrower, 'quick', true)).toBe(false);
  });

  it('Quick Pass sans PM restant — refuse', () => {
    const thrower = makeImperialThrower({ pm: 0 });
    const state = makeState([thrower]);
    expect(canApplyRunningPass(state, thrower, 'quick', false)).toBe(false);
  });

  it('Deja utilise ce tour — refuse la seconde fois', () => {
    const thrower = makeImperialThrower({ pm: 4 });
    let state = makeState([thrower]);
    state = markRunningPassUsed(state, thrower.id);

    expect(hasUsedRunningPassThisTurn(state, thrower.id)).toBe(true);
    expect(canApplyRunningPass(state, thrower, 'quick', false)).toBe(false);
  });

  it('Bodyguard (sans le skill) — refuse meme avec Quick Pass', () => {
    const bg = makeImperialBodyguard({ pm: 4 });
    const state = makeState([bg]);
    expect(canApplyRunningPass(state, bg, 'quick', false)).toBe(false);
  });
});

// ── Running Pass: variante S3 Hand-Off ───────────────────────────────────

describe('Integration: Running Pass — canApplyRunningPassToHandoff (S3 only)', () => {
  it('Imperial Thrower S2 — Hand-Off refuse (variante manquante)', () => {
    const thrower = makeImperialThrower({ pm: 4 });
    const state = makeState([thrower]);
    expect(canApplyRunningPassToHandoff(state, thrower, false)).toBe(false);
  });

  it('Imperial Thrower S3 (running-pass-2025) — Hand-Off autorise', () => {
    const thrower = makeImperialThrower({
      skills: ['pass', 'running-pass-2025'],
      pm: 4,
    });
    const state = makeState([thrower]);
    expect(canApplyRunningPassToHandoff(state, thrower, false)).toBe(true);
  });

  it('Imperial Thrower S3 apres turnover — Hand-Off refuse', () => {
    const thrower = makeImperialThrower({
      skills: ['pass', 'running-pass-2025'],
      pm: 4,
    });
    const state = makeState([thrower]);
    expect(canApplyRunningPassToHandoff(state, thrower, true)).toBe(false);
  });
});

// ── Running Pass: integration avec canPlayerContinueMoving ───────────────

describe('Integration: Running Pass — canPlayerContinueMoving apres passe', () => {
  it('Imperial Thrower apres PASS marquee running-pass — peut continuer', () => {
    const thrower = makeImperialThrower({ pm: 3 });
    let state = makeState([thrower]);
    state.playerActions = { [thrower.id]: 'PASS' };
    state = markRunningPassUsed(state, thrower.id);

    expect(canPlayerContinueMoving(state, thrower.id)).toBe(true);
  });

  it('Imperial Thrower apres HANDOFF avec running-pass marquee — peut continuer', () => {
    const thrower = makeImperialThrower({
      skills: ['pass', 'running-pass-2025'],
      pm: 3,
    });
    let state = makeState([thrower]);
    state.playerActions = { [thrower.id]: 'HANDOFF' };
    state = markRunningPassUsed(state, thrower.id);

    expect(canPlayerContinueMoving(state, thrower.id)).toBe(true);
  });

  it('Imperial Thrower apres PASS sans running-pass marquee — ne peut pas continuer', () => {
    const thrower = makeImperialThrower({ pm: 3 });
    const state = makeState([thrower]);
    state.playerActions = { [thrower.id]: 'PASS' };

    expect(canPlayerContinueMoving(state, thrower.id)).toBe(false);
  });

  it('Imperial Thrower stunned — ne peut pas continuer meme avec running-pass', () => {
    const thrower = makeImperialThrower({ pm: 3, stunned: true });
    let state = makeState([thrower]);
    state.playerActions = { [thrower.id]: 'PASS' };
    state = markRunningPassUsed(state, thrower.id);

    expect(canPlayerContinueMoving(state, thrower.id)).toBe(false);
  });
});

// ── Running Pass: immutabilite de markRunningPassUsed ────────────────────

describe('Integration: Running Pass — markRunningPassUsed (immutabilite)', () => {
  it('ne mute pas le state d\'entree', () => {
    const thrower = makeImperialThrower();
    const state = makeState([thrower]);
    const snapshot = state.usedRunningPassThisTurn;

    const next = markRunningPassUsed(state, thrower.id);
    expect(state.usedRunningPassThisTurn).toBe(snapshot);
    expect(next.usedRunningPassThisTurn).toContain(thrower.id);
    expect(next).not.toBe(state);
  });

  it('est idempotent — deux appels = meme resultat', () => {
    const thrower = makeImperialThrower();
    let state = makeState([thrower]);
    state = markRunningPassUsed(state, thrower.id);
    const firstList = state.usedRunningPassThisTurn;

    state = markRunningPassUsed(state, thrower.id);
    expect(state.usedRunningPassThisTurn).toEqual(firstList);
    expect((state.usedRunningPassThisTurn ?? []).filter(id => id === thrower.id)).toHaveLength(1);
  });
});
