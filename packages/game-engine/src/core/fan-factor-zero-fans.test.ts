import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams } from './game-state';
import { startPreMatchSequence, calculateFanFactor } from './pre-match-sequence';

/**
 * Hors ligue, aucun Fan Dévoué n'est offert : une équipe peut en avoir 0.
 * Le Facteur de Popularité vaut alors D3 + 0, sans repli sur 1.
 */
function team(prefix: string) {
  return Array.from({ length: 11 }, (_, i) => ({
    name: `Joueur ${prefix}${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: '',
  }));
}

describe('Facteur de Popularité — équipe sans Fan Dévoué', () => {
  it('D3 + 0 pour une équipe à 0 fan', () => {
    let state = setupPreMatchWithTeams(team('A'), team('B'), 'Team A', 'Team B');
    state = startPreMatchSequence(state);
    state = calculateFanFactor(state, () => 0.5, 0, 2, 2, 2);

    expect(state.preMatch.fanFactor?.teamA).toEqual({ d3: 2, dedicatedFans: 0, total: 2 });
    expect(state.preMatch.fanFactor?.teamB).toEqual({ d3: 2, dedicatedFans: 2, total: 4 });
  });
});
