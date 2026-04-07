import { describe, it, expect } from 'vitest';
import {
  calculatePettyCash,
  validateInducementSelection,
  getInducementCost,
  getInducementDefinition,
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
  it('devrait contenir 9 types d\'inducements', () => {
    expect(INDUCEMENT_CATALOGUE).toHaveLength(9);
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

  it('devrait appliquer le discount Badlands Brawl pour les Bribes', () => {
    const ctx = makeCtx({ regionalRules: ['badlands_brawl'], rosterSlug: 'goblin' });
    expect(getInducementCost('bribe', ctx)).toBe(50_000);
  });

  it('devrait appliquer le discount Halfling Thimble Cup pour le Master Chef', () => {
    const ctx = makeCtx({ regionalRules: ['halfling_thimble_cup'], rosterSlug: 'halfling' });
    expect(getInducementCost('halfling_master_chef', ctx)).toBe(100_000);
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
      { items: [{ slug: 'extra_team_training', quantity: 5 }] },
      makeCtx(),
      1_000_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('maximum 4'));
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

  it('devrait rejeter Igor si l\'équipe a déjà un apothicaire', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'igor', quantity: 1 }] },
      makeCtx({ hasApothecary: true }),
      500_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('pas disponible'));
  });

  it('devrait accepter Igor si l\'équipe n\'a pas d\'apothicaire', () => {
    const result = validateInducementSelection(
      { items: [{ slug: 'igor', quantity: 1 }] },
      makeCtx({ hasApothecary: false }),
      500_000,
    );
    expect(result.valid).toBe(true);
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

    expect(newState.apothecaryAvailable.teamB).toBe(true);
  });

  it('devrait activer l\'apothicaire avec Igor pour une équipe sans apothicaire', () => {
    const state = makeState();
    // Simulate team without apothecary
    const stateNoApo = {
      ...state,
      apothecaryAvailable: { teamA: false, teamB: false },
    };

    const newState = applyInducementEffects(stateNoApo, 'A', [
      { slug: 'igor', displayName: 'Igor', cost: 100_000, quantity: 1 },
    ]);

    expect(newState.apothecaryAvailable.teamA).toBe(true);
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
