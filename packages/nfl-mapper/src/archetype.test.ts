import { describe, it, expect } from 'vitest';
import {
  getArchetypeFromNflPosition,
  getArchetypeFromBbPosition,
  getBbPosition,
  NFL_POSITIONS,
  type CompositionArchetype as PlayerArchetype,
  type BbRace,
} from './index.js';

describe('getArchetypeFromNflPosition', () => {
  it('maps offensive skill positions to fine archetypes', () => {
    expect(getArchetypeFromNflPosition('QB')).toBe('passer');
    expect(getArchetypeFromNflPosition('RB')).toBe('rusher');
    expect(getArchetypeFromNflPosition('FB')).toBe('rusher');
    expect(getArchetypeFromNflPosition('WR')).toBe('receiver');
    expect(getArchetypeFromNflPosition('TE')).toBe('receiver');
  });

  it('maps O-line and kickers to lineman (filler)', () => {
    for (const p of ['OL', 'C', 'G', 'OT', 'K', 'P']) {
      expect(getArchetypeFromNflPosition(p)).toBe('lineman');
    }
  });

  it('maps DT/NT to bigGuy (consistent with BB Big Guy mapping)', () => {
    expect(getArchetypeFromNflPosition('DT')).toBe('bigGuy');
    expect(getArchetypeFromNflPosition('NT')).toBe('bigGuy');
  });

  it('splits defense into frontSeven vs secondary', () => {
    for (const p of ['DE', 'EDGE', 'LB', 'ILB', 'OLB', 'MLB']) {
      expect(getArchetypeFromNflPosition(p)).toBe('frontSeven');
    }
    for (const p of ['CB', 'DB', 'S', 'SAF', 'FS', 'SS', 'NB']) {
      expect(getArchetypeFromNflPosition(p)).toBe('secondary');
    }
  });

  it('is case-insensitive and trims', () => {
    expect(getArchetypeFromNflPosition('  qb ')).toBe('passer');
    expect(getArchetypeFromNflPosition('Wr')).toBe('receiver');
  });

  it('falls back to lineman for unknown positions (never a premium slot)', () => {
    expect(getArchetypeFromNflPosition('LS')).toBe('lineman');
    expect(getArchetypeFromNflPosition('')).toBe('lineman');
  });

  it('classifies every canonical NFL position (exhaustive, no fallback leak)', () => {
    // Aucun poste NFL canonique ne doit tomber sur le fallback "lineman"
    // par accident, sauf ceux explicitement lineman (OL/C/G/OT/K/P).
    const linemanPositions = new Set(['OL', 'C', 'G', 'OT', 'K', 'P']);
    for (const p of NFL_POSITIONS) {
      const a = getArchetypeFromNflPosition(p);
      if (!linemanPositions.has(p)) {
        expect(a).not.toBe('lineman');
      }
    }
  });
});

describe('getArchetypeFromBbPosition (fallback)', () => {
  it('maps unambiguous BB positions', () => {
    expect(getArchetypeFromBbPosition('Thrower')).toBe('passer');
    expect(getArchetypeFromBbPosition('Catcher')).toBe('receiver');
    expect(getArchetypeFromBbPosition('Ghoul')).toBe('receiver');
    expect(getArchetypeFromBbPosition('Lineman')).toBe('lineman');
    expect(getArchetypeFromBbPosition('Blocker')).toBe('lineman');
    expect(getArchetypeFromBbPosition('RatOgre')).toBe('bigGuy');
    expect(getArchetypeFromBbPosition('Treeman')).toBe('bigGuy');
  });

  it('routes ambiguous specialists to frontSeven by default', () => {
    expect(getArchetypeFromBbPosition('Blitzer')).toBe('frontSeven');
    expect(getArchetypeFromBbPosition('Wardancer')).toBe('frontSeven');
    expect(getArchetypeFromBbPosition('Berserker')).toBe('frontSeven');
  });
});

describe('archetype is race-agnostic via NFL position', () => {
  it('same NFL position yields same archetype across races (despite BB name divergence)', () => {
    const races: BbRace[] = ['Human', 'Orc', 'WoodElf', 'Norse', 'Skaven'];
    // WR maps to Catcher/Blitzer/GutterRunner/... selon la race, mais
    // l'archetype derive du poste NFL doit rester 'receiver' partout.
    for (const race of races) {
      const bb = getBbPosition('WR', race);
      // sanity: la race produit bien des noms BB differents
      expect(typeof bb).toBe('string');
      const arch: PlayerArchetype = getArchetypeFromNflPosition('WR');
      expect(arch).toBe('receiver');
    }
  });
});
