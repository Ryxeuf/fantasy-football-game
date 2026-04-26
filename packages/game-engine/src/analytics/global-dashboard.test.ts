import { describe, it, expect } from 'vitest';
import {
  buildGlobalDashboard,
  type GlobalMatchRecord,
} from './global-dashboard';

const baseRecord = (
  overrides: Partial<GlobalMatchRecord> = {},
): GlobalMatchRecord => ({
  matchId: 'm1',
  status: 'completed',
  finishedAt: new Date('2026-04-25T10:00:00Z'),
  scoreA: 2,
  scoreB: 1,
  rosterA: 'skaven',
  rosterB: 'dwarf',
  totalCasualties: 3,
  totalTurns: 16,
  ...overrides,
});

describe('Regle: global-dashboard (O.10 analytics global)', () => {
  it('retourne un dashboard vide pour zero match', () => {
    const dash = buildGlobalDashboard([]);
    expect(dash.totalMatches).toBe(0);
    expect(dash.completedMatches).toBe(0);
    expect(dash.inProgressMatches).toBe(0);
    expect(dash.totalTouchdowns).toBe(0);
    expect(dash.totalCasualties).toBe(0);
    expect(dash.averageTouchdownsPerMatch).toBe(0);
    expect(dash.averageCasualtiesPerMatch).toBe(0);
    expect(dash.averageTurnsPerMatch).toBe(0);
    expect(dash.rosterPopularity).toEqual([]);
    expect(dash.topRoster).toBeNull();
  });

  it('compte total / completed / in_progress', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', status: 'completed' }),
      baseRecord({ matchId: '2', status: 'completed' }),
      baseRecord({ matchId: '3', status: 'in_progress' }),
      baseRecord({ matchId: '4', status: 'cancelled' }),
    ]);
    expect(dash.totalMatches).toBe(4);
    expect(dash.completedMatches).toBe(2);
    expect(dash.inProgressMatches).toBe(1);
  });

  it('totalise touchdowns et casualties sur les matches termines uniquement', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', scoreA: 2, scoreB: 1, totalCasualties: 3 }),
      baseRecord({ matchId: '2', scoreA: 0, scoreB: 4, totalCasualties: 5 }),
      baseRecord({
        matchId: 'live',
        status: 'in_progress',
        scoreA: 9,
        scoreB: 9,
        totalCasualties: 99,
      }),
    ]);
    expect(dash.totalTouchdowns).toBe(7);
    expect(dash.totalCasualties).toBe(8);
  });

  it('calcule les moyennes par match termine', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', scoreA: 2, scoreB: 2, totalCasualties: 4, totalTurns: 16 }),
      baseRecord({ matchId: '2', scoreA: 0, scoreB: 0, totalCasualties: 0, totalTurns: 14 }),
    ]);
    expect(dash.averageTouchdownsPerMatch).toBe(2); // (4+0)/2
    expect(dash.averageCasualtiesPerMatch).toBe(2);
    expect(dash.averageTurnsPerMatch).toBe(15);
  });

  it('aggrège la popularite des rosters (les deux cotes comptent)', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', rosterA: 'skaven', rosterB: 'dwarf' }),
      baseRecord({ matchId: '2', rosterA: 'skaven', rosterB: 'orc' }),
      baseRecord({ matchId: '3', rosterA: 'dwarf', rosterB: 'orc' }),
    ]);
    const skaven = dash.rosterPopularity.find((r) => r.roster === 'skaven');
    const dwarf = dash.rosterPopularity.find((r) => r.roster === 'dwarf');
    const orc = dash.rosterPopularity.find((r) => r.roster === 'orc');
    expect(skaven?.pickCount).toBe(2);
    expect(dwarf?.pickCount).toBe(2);
    expect(orc?.pickCount).toBe(2);
  });

  it('calcule le winRate par roster (sur matches termines)', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', rosterA: 'skaven', rosterB: 'dwarf', scoreA: 3, scoreB: 1 }),
      baseRecord({ matchId: '2', rosterA: 'skaven', rosterB: 'orc', scoreA: 0, scoreB: 2 }),
      baseRecord({ matchId: '3', rosterA: 'dwarf', rosterB: 'orc', scoreA: 1, scoreB: 1 }),
    ]);
    const skaven = dash.rosterPopularity.find((r) => r.roster === 'skaven');
    expect(skaven?.winRate).toBe(0.5); // 1W/1L => 0.5
    const dwarf = dash.rosterPopularity.find((r) => r.roster === 'dwarf');
    expect(dwarf?.winRate).toBe(0.25); // 0W/1L/1D => (0+0.5)/2 = 0.25
  });

  it('topRoster est le roster avec le plus de picks', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', rosterA: 'skaven', rosterB: 'dwarf' }),
      baseRecord({ matchId: '2', rosterA: 'skaven', rosterB: 'skaven' }),
      baseRecord({ matchId: '3', rosterA: 'orc', rosterB: 'dwarf' }),
    ]);
    expect(dash.topRoster).toBe('skaven'); // 3 picks
  });

  it('topRoster est null si aucune roster connue', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ rosterA: undefined, rosterB: undefined }),
    ]);
    expect(dash.topRoster).toBeNull();
  });

  it('rosterPopularity est trie par pickCount desc, puis nom asc', () => {
    const dash = buildGlobalDashboard([
      baseRecord({ matchId: '1', rosterA: 'orc', rosterB: 'orc' }),
      baseRecord({ matchId: '2', rosterA: 'skaven', rosterB: 'skaven' }),
      baseRecord({ matchId: '3', rosterA: 'skaven', rosterB: 'dwarf' }),
      baseRecord({ matchId: '4', rosterA: 'dwarf', rosterB: 'dwarf' }),
    ]);
    expect(dash.rosterPopularity.map((r) => r.roster)).toEqual([
      'dwarf', // 3
      'skaven', // 3 -> tri alpha apres dwarf
      'orc', // 2
    ]);
  });

  it('reste deterministe : meme entree -> meme sortie', () => {
    const records = [baseRecord({ matchId: '1' }), baseRecord({ matchId: '2' })];
    expect(buildGlobalDashboard(records)).toEqual(buildGlobalDashboard(records));
  });
});
