import { describe, it, expect } from 'vitest';
import {
  calculatePettyCash,
  validateInducementSelection,
  getInducementCost,
  getInducementDefinition,
  getInducementMaxQuantity,
  applyInducementEffects,
  processInducementsWithSelection,
  INDUCEMENT_CATALOGUE,
  type InducementContext,
  type InducementSelection,
  type PettyCashInput,
  type PurchasedInducement,
} from './inducements';
import { setupPreMatchWithTeams } from './game-state';
import { startPreMatchSequence, calculateFanFactor, determineWeather, addJourneymen } from './pre-match-sequence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<InducementContext> = {}): InducementContext {
  return {
    teamId: 'A',
    regionalRules: [],
    hasApothecary: true,
    rosterSlug: 'human',
    ...overrides,
  };
}

function makeState() {
  let state = setupPreMatchWithTeams(
    Array.from({ length: 11 }, (_, i) => ({
      id: `A${i + 1}`,
      name: `Joueur A${i + 1}`,
      number: i + 1,
      position: 'Lineman',
      ma: 6, st: 3, ag: 3, pa: 4, av: 8,
      skills: '',
    })),
    Array.from({ length: 11 }, (_, i) => ({
      id: `B${i + 1}`,
      name: `Joueur B${i + 1}`,
      number: i + 1,
      position: 'Lineman',
      ma: 6, st: 3, ag: 3, pa: 4, av: 8,
      skills: '',
    })),
    'Orcs de Fer',
    'Elfes Sombres',
  );
  // Advance to inducements phase
  state = startPreMatchSequence(state);
  state = calculateFanFactor(state, () => 0.5, 1, 1);
  state = determineWeather(state, () => 0.5);
  state = addJourneymen(state, 11, 11);
  return state;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

describe('Inducement Catalogue', () => {
  it('A53 — contient la liste officielle S2025 (p.142)', () => {
    const slugs = INDUCEMENT_CATALOGUE.map((d) => d.slug);
    expect(slugs).toEqual([
      'prayers_to_nuffle',
      'part_time_assistant_coaches',
      'temp_agency_cheerleaders',
      'team_mascot',
      'weather_mage',
      'bloodweiser_kegs',
      'bribe',
      'extra_team_training',
      'mortuary_assistant',
      'plague_doctor',
      'riotous_rookies',
      'wandering_apothecary',
      'halfling_master_chef',
      'biased_referee',
      'infamous_coaching_staff',
      'mercenary_players',
      'wizard',
      'star_player',
    ]);
    // igor (BB2020) est retiré du catalogue S3.
    expect(slugs).not.toContain('igor');
  });

  it('A53 — coûts et quantités du livre (p.142)', () => {
    const bySlug = new Map(INDUCEMENT_CATALOGUE.map((d) => [d.slug, d]));
    expect(bySlug.get('prayers_to_nuffle')).toMatchObject({ baseCost: 10_000, maxQuantity: 3 });
    expect(bySlug.get('part_time_assistant_coaches')).toMatchObject({ baseCost: 20_000, maxQuantity: 5 });
    expect(bySlug.get('temp_agency_cheerleaders')).toMatchObject({ baseCost: 5_000, maxQuantity: 5 });
    expect(bySlug.get('team_mascot')).toMatchObject({ baseCost: 25_000, maxQuantity: 1 });
    expect(bySlug.get('weather_mage')).toMatchObject({ baseCost: 25_000, maxQuantity: 1 });
    expect(bySlug.get('bloodweiser_kegs')).toMatchObject({ baseCost: 50_000, maxQuantity: 2 });
    expect(bySlug.get('extra_team_training')).toMatchObject({ baseCost: 100_000, maxQuantity: 8 });
    expect(bySlug.get('mortuary_assistant')).toMatchObject({ baseCost: 100_000, maxQuantity: 1 });
    expect(bySlug.get('plague_doctor')).toMatchObject({ baseCost: 100_000, maxQuantity: 1 });
    expect(bySlug.get('riotous_rookies')).toMatchObject({ baseCost: 150_000, maxQuantity: 1 });
    expect(bySlug.get('wandering_apothecary')).toMatchObject({ baseCost: 100_000, maxQuantity: 2 });
    expect(bySlug.get('halfling_master_chef')).toMatchObject({ baseCost: 300_000, maxQuantity: 1 });
    expect(bySlug.get('biased_referee')).toMatchObject({ baseCost: 120_000, maxQuantity: 1 });
    expect(bySlug.get('infamous_coaching_staff')).toMatchObject({ baseCost: 100_000, maxQuantity: 1 });
    expect(bySlug.get('mercenary_players')).toMatchObject({ maxQuantity: 3, variableCost: true });
    expect(bySlug.get('wizard')).toMatchObject({ baseCost: 150_000, maxQuantity: 1 });
    expect(bySlug.get('star_player')).toMatchObject({ maxQuantity: 2 });
  });

  it('devrait retrouver un inducement par slug', () => {
    const bribe = getInducementDefinition('bribe');
    expect(bribe).toBeDefined();
    expect(bribe!.baseCost).toBe(100_000);
    expect(bribe!.maxQuantity).toBe(3);
  });

  it('devrait retourner undefined pour un slug inconnu', () => {
    const result = getInducementDefinition('fake_inducement' as any);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Petty Cash
// ---------------------------------------------------------------------------

describe('Règle: Petty Cash', () => {
  it('devrait donner le petty cash à l\'équipe avec la CTV inférieure', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 50_000,
      treasuryTeamB: 30_000,
    });

    expect(result.teamA.pettyCash).toBe(200_000); // CTV inférieure -> reçoit la diff
    expect(result.teamB.pettyCash).toBe(0);
    expect(result.teamA.maxBudget).toBe(250_000); // 200k petty + 50k treasury
    expect(result.teamB.maxBudget).toBe(30_000);  // 0 petty + 30k treasury
  });

  it('devrait donner 0 petty cash si les CTV sont égales', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_000_000,
      treasuryTeamA: 100_000,
      treasuryTeamB: 50_000,
    });

    expect(result.teamA.pettyCash).toBe(0);
    expect(result.teamB.pettyCash).toBe(0);
    expect(result.teamA.maxBudget).toBe(100_000);
    expect(result.teamB.maxBudget).toBe(50_000);
  });

  it('devrait donner le petty cash à l\'équipe B si sa CTV est inférieure', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_500_000,
      ctvTeamB: 1_000_000,
      treasuryTeamA: 0,
      treasuryTeamB: 0,
    });

    expect(result.teamA.pettyCash).toBe(0);
    expect(result.teamB.pettyCash).toBe(500_000);
  });

  it('A55 — le bonus underdog vient de la trésorerie, plafonné par sa disponibilité', () => {
    // Exemple du log QA : 20k de trésorerie -> seulement +20k possibles
    // au-delà de la différence de VEA.
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 20_000,
      treasuryTeamB: 0,
      underdogBonus: 50_000,
    });
    // A (CTV plus bas) : cagnotte gratuite = diff (200k), PAS de bonus
    // gratuit ; budget = 200k + min(50k, 20k de trésorerie).
    expect(result.teamA.pettyCash).toBe(200_000);
    expect(result.teamA.maxBudget).toBe(220_000);
    expect(result.teamB.pettyCash).toBe(0);
  });

  it('A55 — trésorerie underdog abondante : extra plafonné à 50k', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 300_000,
      treasuryTeamB: 0,
      underdogBonus: 50_000,
    });
    expect(result.teamA.maxBudget).toBe(250_000); // 200k diff + 50k max
  });

  it('A55 — la dépense de la plus forte équipe augmente la cagnotte de l\'underdog', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 20_000,
      treasuryTeamB: 100_000,
      underdogBonus: 50_000,
      spentTeamB: 80_000,
    });
    // A : diff 200k + dépense adverse 80k + min(50k, 20k) = 300k.
    expect(result.teamA.pettyCash).toBe(280_000);
    expect(result.teamA.maxBudget).toBe(300_000);
    // B (favori) : dépense librement sa trésorerie.
    expect(result.teamB.maxBudget).toBe(100_000);
  });

  it('FR14 — aucun bonus underdog en cas d\'égalité de CTV', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_000_000,
      treasuryTeamA: 0,
      treasuryTeamB: 0,
      underdogBonus: 50_000,
    });
    expect(result.teamA.pettyCash).toBe(0);
    expect(result.teamB.pettyCash).toBe(0);
  });

  it('A55 — sans underdogBonus (jeu en ligne), trésorerie libre inchangée', () => {
    const result = calculatePettyCash({
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 300_000,
      treasuryTeamB: 30_000,
    });
    expect(result.teamA.maxBudget).toBe(500_000); // 200k diff + treasury libre
    expect(result.teamB.maxBudget).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// Coût des inducements
// ---------------------------------------------------------------------------

describe('Règle: Coût des inducements', () => {
  it('devrait retourner le coût de base sans discount', () => {
    const ctx = makeCtx();
    expect(getInducementCost('bribe', ctx)).toBe(100_000);
    expect(getInducementCost('wizard', ctx)).toBe(150_000);
    expect(getInducementCost('extra_team_training', ctx)).toBe(100_000);
  });

  it('A53 — Pots-de-vin à 50k et 0-6 avec Chantage et Corruption', () => {
    const ctx = makeCtx({
      rosterSlug: 'goblin',
      specialRules: ['chantage_et_corruption'],
    });
    expect(getInducementCost('bribe', ctx)).toBe(50_000);
    expect(getInducementMaxQuantity('bribe', ctx)).toBe(6);
    // Sans la règle : 100k, 0-3.
    const noRule = makeCtx();
    expect(getInducementCost('bribe', noRule)).toBe(100_000);
    expect(getInducementMaxQuantity('bribe', noRule)).toBe(3);
  });

  it('A53 — Arbitre Partial à 80k avec Chantage et Corruption', () => {
    const ctx = makeCtx({ specialRules: ['chantage_et_corruption'] });
    expect(getInducementCost('biased_referee', ctx)).toBe(80_000);
    expect(getInducementCost('biased_referee', makeCtx())).toBe(120_000);
  });

  it('A53 — Chef Cuistot à 100k pour les équipes de Halflings', () => {
    const ctx = makeCtx({ rosterSlug: 'halfling' });
    expect(getInducementCost('halfling_master_chef', ctx)).toBe(100_000);
    expect(getInducementCost('halfling_master_chef', makeCtx())).toBe(300_000);
  });

  it('A53 — restrictions par règle spéciale (Assistant Funéraire, Médecin de la Peste, Débutants Déchaînés)', () => {
    const mortuary = getInducementDefinition('mortuary_assistant')!;
    expect(mortuary.canPurchase!(makeCtx())).toBe(false);
    expect(
      mortuary.canPurchase!(
        makeCtx({ specialRules: ['maitres_de_la_non_vie'] }),
      ),
    ).toBe(true);

    const plague = getInducementDefinition('plague_doctor')!;
    expect(plague.canPurchase!(makeCtx())).toBe(false);
    expect(
      plague.canPurchase!(
        makeCtx({ rosterSlug: 'nurgle', specialRules: ['favori_de'] }),
      ),
    ).toBe(true);

    const rookies = getInducementDefinition('riotous_rookies')!;
    expect(rookies.canPurchase!(makeCtx())).toBe(false);
    expect(
      rookies.canPurchase!(
        makeCtx({ specialRules: ['trois_quarts_a_vil_prix'] }),
      ),
    ).toBe(true);
  });

  it('devrait retourner 0 pour un star player inconnu', () => {
    const ctx = makeCtx();
    expect(getInducementCost('star_player', ctx, 'nonexistent_slug')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Règle: Validation des inducements', () => {
  it('devrait valider une sélection vide', () => {
    const result = validateInducementSelection(
      { items: [] },
      makeCtx(),
      500_000,
    );
    expect(result.valid).toBe(true);
    expect(result.totalCost).toBe(0);
    expect(result.purchasedItems).toHaveLength(0);
  });

  it('devrait valider une sélection simple dans le budget', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'extra_team_training', quantity: 2 }] },
      makeCtx(),
      300_000,
    );
    expect(result.valid).toBe(true);
    expect(result.totalCost).toBe(200_000);
    expect(result.purchasedItems).toHaveLength(1);
    expect(result.purchasedItems[0].quantity).toBe(2);
  });

  it('devrait rejeter si le budget est dépassé', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'wizard', quantity: 1 }] },
      makeCtx(),
      100_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('Budget insuffisant'));
  });

  it('devrait rejeter si la quantité maximum est dépassée', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'extra_team_training', quantity: 9 }] },
      makeCtx(),
      1_000_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('maximum 8'));
  });

  it('A53 — accepte 6 Pots-de-vin avec Chantage et Corruption', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'bribe', quantity: 6 }] },
      makeCtx({ specialRules: ['chantage_et_corruption'] }),
      1_000_000,
    );
    expect(result.valid).toBe(true);
    expect(result.totalCost).toBe(300_000); // 6 × 50k
  });

  it('devrait rejeter le Wandering Apothecary si l\'équipe n\'a pas d\'apothicaire', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'wandering_apothecary', quantity: 1 }] },
      makeCtx({ hasApothecary: false }),
      500_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('pas disponible'));
  });

  it('A53 — Igor (BB2020) n\'est plus achetable en S3', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'igor', quantity: 1 }] },
      makeCtx({ hasApothecary: false }),
      500_000,
    );
    expect(result.valid).toBe(false);
  });

  it('devrait valider plusieurs inducements combinés', () => {
    const result = validateInducementSelection(
      {
        items: [
          { slug: 'extra_team_training', quantity: 2 },
          { slug: 'bloodweiser_kegs', quantity: 1 },
          { slug: 'bribe', quantity: 1 },
        ],
      },
      makeCtx(),
      500_000,
    );
    expect(result.valid).toBe(true);
    // 2*100k + 1*50k + 1*100k = 350k
    expect(result.totalCost).toBe(350_000);
    expect(result.purchasedItems).toHaveLength(3);
  });

  it('devrait rejeter un slug d\'inducement inconnu', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'fake' as any, quantity: 1 }] },
      makeCtx(),
      500_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('inconnu'));
  });

  it('devrait rejeter une quantité <= 0', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'bribe', quantity: 0 }] },
      makeCtx(),
      500_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('invalide'));
  });
});

// ---------------------------------------------------------------------------
// Application des effets
// ---------------------------------------------------------------------------

describe('Règle: Effets des inducements', () => {
  it('devrait ajouter des rerolls pour Extra Team Training', () => {
    const state = makeState();
    const baseRerolls = state.teamRerolls.teamA;

    const newState = applyInducementEffects(state, 'A', [
      { slug: 'extra_team_training', displayName: 'Extra Team Training', cost: 100_000, quantity: 2 },
    ]);

    expect(newState.teamRerolls.teamA).toBe(baseRerolls + 2);
    expect(newState.teamRerolls.teamB).toBe(state.teamRerolls.teamB); // unchanged
  });

  it('devrait activer l\'apothicaire avec Wandering Apothecary', () => {
    const state = makeState();

    const newState = applyInducementEffects(state, 'B', [
      { slug: 'wandering_apothecary', displayName: 'Wandering Apothecary', cost: 100_000, quantity: 1 },
    ]);

    expect(newState.apothecaryAvailable.teamB).toBe(1);
  });

  it('Wandering Apothecary cumule avec un apothecary natif (BB2020)', () => {
    // BUG fix : avant, apothecaryAvailable etait boolean. Achat d'un
    // Wandering Apothecary sur une equipe deja apothecary etait un
    // silent no-op. Maintenant, le compteur cumule (1 natif + 1 = 2).
    const state = makeState();
    const stateWithNative = {
      ...state,
      apothecaryAvailable: { teamA: 1, teamB: 0 },
    };

    const newState = applyInducementEffects(stateWithNative, 'A', [
      { slug: 'wandering_apothecary', displayName: 'Wandering Apothecary', cost: 100_000, quantity: 1 },
    ]);

    expect(newState.apothecaryAvailable.teamA).toBe(2);
  });

  it('devrait activer l\'apothicaire avec Igor pour une équipe sans apothicaire', () => {
    const state = makeState();
    // Simulate team without apothecary
    const stateNoApo = {
      ...state,
      apothecaryAvailable: { teamA: 0, teamB: 0 },
    };

    const newState = applyInducementEffects(stateNoApo, 'A', [
      { slug: 'igor', displayName: 'Igor', cost: 100_000, quantity: 1 },
    ]);

    expect(newState.apothecaryAvailable.teamA).toBe(1);
  });

  it('ne devrait pas modifier l\'état pour les inducements in-match (bribe, wizard, etc.)', () => {
    const state = makeState();

    const newState = applyInducementEffects(state, 'A', [
      { slug: 'bloodweiser_kegs', displayName: 'Bloodweiser Kegs', cost: 50_000, quantity: 2 },
      { slug: 'bribe', displayName: 'Bribe', cost: 100_000, quantity: 1 },
      { slug: 'wizard', displayName: 'Wizard', cost: 150_000, quantity: 1 },
    ]);

    // These don't modify pre-match state, they store data for in-match use
    expect(newState.teamRerolls).toEqual(state.teamRerolls);
    expect(newState.apothecaryAvailable).toEqual(state.apothecaryAvailable);
  });
});

// ---------------------------------------------------------------------------
// processInducementsWithSelection (intégration)
// ---------------------------------------------------------------------------

describe('Règle: processInducementsWithSelection', () => {
  it('devrait traiter les inducements et avancer à la phase prayers', () => {
    const state = makeState();
    expect(state.preMatch.phase).toBe('inducements');

    const pettyCashInput: PettyCashInput = {
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_200_000,
      treasuryTeamA: 50_000,
      treasuryTeamB: 0,
    };

    const { state: newState, validationA, validationB } = processInducementsWithSelection(
      state,
      pettyCashInput,
      { items: [{ slug: 'extra_team_training', quantity: 1 }] },
      { items: [] },
      makeCtx({ teamId: 'A' }),
      makeCtx({ teamId: 'B' }),
    );

    expect(validationA.valid).toBe(true);
    expect(validationB.valid).toBe(true);
    expect(newState.preMatch.phase).toBe('prayers');
    expect(newState.preMatch.inducements?.teamA.items).toHaveLength(1);
    expect(newState.preMatch.inducements?.teamA.pettyCash).toBe(200_000);
    expect(newState.preMatch.inducements?.teamB.pettyCash).toBe(0);
    // +1 reroll applied
    expect(newState.teamRerolls.teamA).toBe(state.teamRerolls.teamA + 1);
  });

  it('ne devrait pas avancer si la validation échoue', () => {
    const state = makeState();

    const pettyCashInput: PettyCashInput = {
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_000_000,
      treasuryTeamA: 0,
      treasuryTeamB: 0,
    };

    const { state: newState, validationA } = processInducementsWithSelection(
      state,
      pettyCashInput,
      { items: [{ slug: 'wizard', quantity: 1 }] }, // costs 150k but budget is 0
      { items: [] },
      makeCtx({ teamId: 'A' }),
      makeCtx({ teamId: 'B' }),
    );

    expect(validationA.valid).toBe(false);
    expect(newState.preMatch.phase).toBe('inducements'); // not advanced
  });

  it('ne devrait rien faire si la phase n\'est pas inducements', () => {
    const state = makeState();
    // Force wrong phase
    const wrongPhaseState = { ...state, preMatch: { ...state.preMatch, phase: 'fans' as const } };

    const { validationA } = processInducementsWithSelection(
      wrongPhaseState,
      { ctvTeamA: 0, ctvTeamB: 0, treasuryTeamA: 0, treasuryTeamB: 0 },
      { items: [] },
      { items: [] },
      makeCtx({ teamId: 'A' }),
      makeCtx({ teamId: 'B' }),
    );

    expect(validationA.valid).toBe(false);
    expect(validationA.errors).toContainEqual(expect.stringContaining('Phase incorrecte'));
  });

  it('devrait calculer correctement le treasury dépensé', () => {
    const state = makeState();

    const pettyCashInput: PettyCashInput = {
      ctvTeamA: 1_000_000,
      ctvTeamB: 1_100_000,
      treasuryTeamA: 50_000,
      treasuryTeamB: 0,
    };

    // Team A: petty cash = 100k, treasury = 50k, budget = 150k
    // Buys wizard (150k) → treasury spent = 150k - 100k petty = 50k
    const { state: newState, validationA } = processInducementsWithSelection(
      state,
      pettyCashInput,
      { items: [{ slug: 'wizard', quantity: 1 }] },
      { items: [] },
      makeCtx({ teamId: 'A' }),
      makeCtx({ teamId: 'B' }),
    );

    expect(validationA.valid).toBe(true);
    expect(newState.preMatch.inducements?.teamA.pettyCash).toBe(100_000);
    expect(newState.preMatch.inducements?.teamA.treasurySpent).toBe(50_000);
  });
});
