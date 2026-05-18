/**
 * Tests pour `weightsFromProfile` (Lot 3.A.0.a).
 *
 * Vérifie que la conversion `TacticalProfile → Partial<EvalWeights>`
 * produit des modulations cohérentes avec le profil tactique.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_TACTICAL_PROFILE } from './tactical-profile';
import { weightsFromProfile } from './ai-weights';

describe('weightsFromProfile — Lot 3.A.0.a', () => {
  it('un profil neutre (tout à 50) retourne des poids ≈ baseline', () => {
    const w = weightsFromProfile(DEFAULT_TACTICAL_PROFILE);
    expect(w.PLAYER_CASUALTY_PENALTY).toBe(150);
    expect(w.BALL_PROGRESS_PER_STEP).toBe(15);
    expect(w.CARRIER_IN_ENDZONE_BONUS).toBe(250);
    expect(w.POSSESSION).toBe(300);
    expect(w.CARRIER_PROTECTION_ALLY).toBe(20);
  });

  it('un profil bash (Orcs) baisse PLAYER_CASUALTY_PENALTY et CARRIER_TACKLEZONE_PENALTY', () => {
    const w = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      bashIndex: 95,
    });
    expect(w.PLAYER_CASUALTY_PENALTY).toBeLessThan(150);
    expect(w.CARRIER_TACKLEZONE_PENALTY).toBeLessThan(35);
  });

  it('un profil pace (Wood Elves) augmente BALL_PROGRESS_PER_STEP et CARRIER_IN_ENDZONE_BONUS', () => {
    const w = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      pace: 90,
    });
    expect(w.BALL_PROGRESS_PER_STEP).toBeGreaterThan(15);
    expect(w.CARRIER_IN_ENDZONE_BONUS).toBeGreaterThan(250);
  });

  it('un profil stalling (Dwarves) baisse END_TURN_PENALTY et augmente POSITIONING_PER_STEP', () => {
    const w = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      stallTendency: 90,
    });
    expect(w.END_TURN_PENALTY).toBeLessThan(1);
    expect(w.POSITIONING_PER_STEP).toBeGreaterThan(2);
  });

  it('un profil patience élevé augmente CARRIER_PROTECTION_ALLY', () => {
    const w = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      patience: 100,
    });
    expect(w.CARRIER_PROTECTION_ALLY).toBeGreaterThan(20);
  });

  it('un profil breakaway (Wood Elves / Skaven) augmente POSSESSION', () => {
    const w = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      breakawayInstinct: 95,
    });
    expect(w.POSSESSION).toBeGreaterThan(300);
  });

  it('clampe les multiplicateurs entre 0.4× et 1.6× (pas de poids absurdes)', () => {
    // Profil aux extrêmes : on vérifie qu'aucun poids ne saute en
    // négatif ou n'explose ×3.
    const extreme = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      bashIndex: 100,
      pace: 100,
      stallTendency: 100,
      patience: 100,
      breakawayInstinct: 100,
    });
    for (const [, value] of Object.entries(extreme)) {
      expect(value).toBeGreaterThanOrEqual(0);
      // Borne haute basée sur les baselines × MAX_FACTOR (1.6).
      expect(value).toBeLessThanOrEqual(500);
    }
  });

  it('même output sur des appels successifs (pure function)', () => {
    const a = weightsFromProfile(DEFAULT_TACTICAL_PROFILE);
    const b = weightsFromProfile(DEFAULT_TACTICAL_PROFILE);
    expect(a).toEqual(b);
  });

  it('audit round 4 — profil foul-happy (Goblin) augmente FOUL_*_VALUE et baisse FOUL_TURNOVER_RISK', () => {
    const foulHappy = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      foulFrequency: 100,
    });
    const neutral = weightsFromProfile(DEFAULT_TACTICAL_PROFILE);
    expect(foulHappy.FOUL_CARRIER_VALUE).toBeGreaterThan(
      neutral.FOUL_CARRIER_VALUE ?? 90,
    );
    expect(foulHappy.FOUL_NON_CARRIER_VALUE).toBeGreaterThan(
      neutral.FOUL_NON_CARRIER_VALUE ?? 30,
    );
    expect(foulHappy.FOUL_TURNOVER_RISK).toBeLessThan(
      neutral.FOUL_TURNOVER_RISK ?? 40,
    );
  });

  it('audit round 4 — profil clean (foulFrequency=0) baisse FOUL_*_VALUE', () => {
    const clean = weightsFromProfile({
      ...DEFAULT_TACTICAL_PROFILE,
      foulFrequency: 0,
    });
    expect(clean.FOUL_CARRIER_VALUE).toBeLessThan(90);
    expect(clean.FOUL_NON_CARRIER_VALUE).toBeLessThan(30);
  });
});
