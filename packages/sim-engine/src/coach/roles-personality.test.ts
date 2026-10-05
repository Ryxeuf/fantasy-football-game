import { describe, expect, it } from 'vitest';

import { makePlayer } from './test-helpers';

import { hashString, personalityFor, traitFactor } from './personality';
import { carrierAptitude, deriveRole, isBigGuy } from './roles';

describe('rôles (lot 3)', () => {
  it('dérive le rôle du poste et des compétences', () => {
    expect(deriveRole(makePlayer({ position: 'Lanceur Orque', skills: ['pass', 'sure-hands'] }))).toBe('thrower');
    expect(deriveRole(makePlayer({ position: 'Receveur Elfe Sylvain', skills: ['catch', 'dodge'] }))).toBe('catcher');
    expect(deriveRole(makePlayer({ position: 'Blitzer Orque', skills: ['block'] }))).toBe('blitzer');
    expect(deriveRole(makePlayer({ position: 'Orque Noir', st: 4 }))).toBe('blocker');
    expect(deriveRole(makePlayer({ position: 'Troll', st: 5, skills: ['loner-4', 'really-stupid'] }))).toBe('bigguy');
    expect(deriveRole(makePlayer({ position: 'Trois-quart Orque' }))).toBe('lineman');
    // Un Trois-quart qui apprend Blocage devient bloqueur sans réglage.
    expect(deriveRole(makePlayer({ position: 'Trois-quart Orque', skills: ['block'], ma: 5 }))).toBe('blocker');
    expect(deriveRole(makePlayer({ position: 'Gobelin', skills: ['sneaky-git'] }))).toBe('fouler');
    expect(isBigGuy(makePlayer({ st: 5 }))).toBe(true);
  });

  it("l'aptitude de porteur préfère les mains sûres et refuse les Sans Ballon", () => {
    const thrower = makePlayer({ position: 'Lanceur', ag: 3, skills: ['pass', 'sure-hands'] });
    const troll = makePlayer({ position: 'Troll', st: 5, ag: 5, skills: ['loner-4'] });
    expect(carrierAptitude(thrower)).toBeGreaterThan(carrierAptitude(troll));
    expect(carrierAptitude(makePlayer({ skills: ['no-hands'] }))).toBeLessThan(-500);
  });
});

describe('personnalité (lot 3)', () => {
  it('est déterministe et bornée', () => {
    const a = personalityFor('home-3');
    const b = personalityFor('home-3');
    expect(a).toEqual(b);
    for (const v of Object.values(a)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(personalityFor('home-4')).not.toEqual(a);
    expect(hashString('x')).toBe(hashString('x'));
  });

  it('traitFactor est centré sur 50', () => {
    expect(traitFactor(50, 0.3)).toBeCloseTo(1);
    expect(traitFactor(100, 0.3)).toBeCloseTo(1.3);
    expect(traitFactor(0, 0.3)).toBeCloseTo(0.7);
  });
});
