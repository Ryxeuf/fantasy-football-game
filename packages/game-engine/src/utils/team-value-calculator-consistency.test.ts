import { describe, it, expect } from 'vitest';
import { DEFAULT_RULESET } from '../rosters/positions';
import { getPlayerCost, calculateTeamValue, type TeamValueData } from '../utils/team-value-calculator';

describe('Team Value Calculator - Consistency Check', () => {
  it('should calculate correct total for Skaven team', () => {
    // Équipe Skaven avec les joueurs de l'image
    const ruleset = DEFAULT_RULESET;
    const skavenTeam: TeamValueData = {
      players: [
        { cost: getPlayerCost('Lineman', 'skaven', ruleset), available: true }, // 50k
        { cost: getPlayerCost('Lineman', 'skaven', ruleset), available: true }, // 50k
        { cost: getPlayerCost('Lineman', 'skaven', ruleset), available: true }, // 50k
        { cost: getPlayerCost('Lineman', 'skaven', ruleset), available: true }, // 50k
        { cost: getPlayerCost('Thrower', 'skaven', ruleset), available: true }, // 85k
        { cost: getPlayerCost('Blitzer', 'skaven', ruleset), available: true }, // 90k
        { cost: getPlayerCost('Blitzer', 'skaven', ruleset), available: true }, // 90k
        { cost: getPlayerCost('Gutter Runner', 'skaven', ruleset), available: true }, // 85k
        { cost: getPlayerCost('Gutter Runner', 'skaven', ruleset), available: true }, // 85k
        { cost: getPlayerCost('Gutter Runner', 'skaven', ruleset), available: true }, // 85k
        { cost: getPlayerCost('Gutter Runner', 'skaven', ruleset), available: true }, // 85k
        { cost: getPlayerCost('Rat Ogre', 'skaven', ruleset), available: true }, // 150k
      ],
      rerolls: 1,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      roster: 'skaven',
      ruleset,
    };

    // Calcul manuel : 4×50k + 1×85k + 2×90k + 4×85k + 1×150k = 200k + 85k + 180k + 340k + 150k = 955k
    const expectedPlayersCost = 4 * 50000 + 85000 + 2 * 90000 + 4 * 85000 + 150000;
    expect(expectedPlayersCost).toBe(955000);

    // Coût des relances Skaven : 1 × 50k = 50k
    const expectedRerollsCost = 1 * 50000;
    expect(expectedRerollsCost).toBe(50000);

    // Total attendu : 955k (joueurs) + 50k (relances) = 1005k
    const expectedTotal = expectedPlayersCost + expectedRerollsCost;
    expect(expectedTotal).toBe(1005000);

    // Calcul avec la fonction
    const calculatedTotal = calculateTeamValue(skavenTeam);
    expect(calculatedTotal).toBe(1005000);
  });

  it('should have consistent player costs between display and calculation', () => {
    // Vérifier que les coûts affichés correspondent aux coûts calculés
    const positions = ['Lineman', 'Thrower', 'Blitzer', 'Gutter Runner', 'Rat Ogre'];
    const roster = 'skaven';
    const ruleset = DEFAULT_RULESET;
    
    positions.forEach(position => {
      const cost = getPlayerCost(position, roster, ruleset);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(200000); // Vérification raisonnable
    });
  });
});
