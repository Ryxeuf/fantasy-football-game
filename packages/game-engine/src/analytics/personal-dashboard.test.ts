import { describe, it, expect } from 'vitest';
import {
  buildPersonalDashboard,
  type PersonalMatchRecord,
} from './personal-dashboard';

const baseRecord = (
  overrides: Partial<PersonalMatchRecord> = {},
): PersonalMatchRecord => ({
  matchId: 'm1',
  status: 'completed',
  finishedAt: new Date('2026-04-25T10:00:00Z'),
  myScore: 2,
  oppScore: 1,
  myRoster: 'skaven',
  oppRoster: 'dwarf',
  casualtiesInflicted: 2,
  casualtiesSuffered: 1,
  totalTurns: 16,
  ...overrides,
});

describe('Regle: personal-dashboard (O.10 analytics personnel)', () => {
  it('retourne un dashboard vide pour zero match', () => {
    const dash = buildPersonalDashboard([]);
    expect(dash.totalMatches).toBe(0);
    expect(dash.completedMatches).toBe(0);
    expect(dash.wins).toBe(0);
    expect(dash.losses).toBe(0);
    expect(dash.draws).toBe(0);
    expect(dash.winRate).toBe(0);
    expect(dash.recentForm).toEqual([]);
    expect(dash.rosterUsage).toEqual([]);
  });

  it('compte les matches totaux et termines separement', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: 'a', status: 'completed' }),
      baseRecord({ matchId: 'b', status: 'in_progress' }),
      baseRecord({ matchId: 'c', status: 'completed' }),
    ]);
    expect(dash.totalMatches).toBe(3);
    expect(dash.completedMatches).toBe(2);
  });

  it('compte wins/losses/draws sur les matches termines uniquement', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: 'w', myScore: 3, oppScore: 1 }),
      baseRecord({ matchId: 'l', myScore: 0, oppScore: 2 }),
      baseRecord({ matchId: 'd', myScore: 1, oppScore: 1 }),
      baseRecord({ matchId: 'live', status: 'in_progress', myScore: 9, oppScore: 0 }),
    ]);
    expect(dash.wins).toBe(1);
    expect(dash.losses).toBe(1);
    expect(dash.draws).toBe(1);
  });

  it('calcule winRate correctement (draws comptent 0.5)', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: 'w', myScore: 3, oppScore: 1 }),
      baseRecord({ matchId: 'd', myScore: 1, oppScore: 1 }),
      baseRecord({ matchId: 'l', myScore: 0, oppScore: 1 }),
      baseRecord({ matchId: 'l2', myScore: 0, oppScore: 1 }),
    ]);
    // (1 + 0.5) / 4 = 0.375
    expect(dash.winRate).toBeCloseTo(0.375, 4);
  });

  it('totalise touchdowns et casualties pour et contre', () => {
    const dash = buildPersonalDashboard([
      baseRecord({
        myScore: 2,
        oppScore: 1,
        casualtiesInflicted: 3,
        casualtiesSuffered: 2,
      }),
      baseRecord({
        matchId: 'm2',
        myScore: 1,
        oppScore: 3,
        casualtiesInflicted: 1,
        casualtiesSuffered: 4,
      }),
    ]);
    expect(dash.totalTouchdownsFor).toBe(3);
    expect(dash.totalTouchdownsAgainst).toBe(4);
    expect(dash.totalCasualtiesInflicted).toBe(4);
    expect(dash.totalCasualtiesSuffered).toBe(6);
  });

  it('calcule la moyenne de turns par match termine (zero matches -> 0)', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ totalTurns: 16 }),
      baseRecord({ matchId: 'm2', totalTurns: 14 }),
    ]);
    expect(dash.averageTurnsPerMatch).toBe(15);
    expect(buildPersonalDashboard([]).averageTurnsPerMatch).toBe(0);
  });

  it('exclut les matches en cours du calcul de moyenne de turns', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ totalTurns: 16 }),
      baseRecord({ matchId: 'live', status: 'in_progress', totalTurns: 0 }),
    ]);
    expect(dash.averageTurnsPerMatch).toBe(16);
  });

  it('aggrège l usage par roster avec son winRate dedie', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: '1', myRoster: 'skaven', myScore: 3, oppScore: 1 }),
      baseRecord({ matchId: '2', myRoster: 'skaven', myScore: 0, oppScore: 2 }),
      baseRecord({ matchId: '3', myRoster: 'dwarf', myScore: 2, oppScore: 1 }),
    ]);
    const skaven = dash.rosterUsage.find((r) => r.roster === 'skaven');
    const dwarf = dash.rosterUsage.find((r) => r.roster === 'dwarf');
    expect(skaven?.count).toBe(2);
    expect(skaven?.winRate).toBe(0.5);
    expect(dwarf?.count).toBe(1);
    expect(dwarf?.winRate).toBe(1);
  });

  it('ignore les rosters undefined dans rosterUsage', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: '1', myRoster: undefined }),
      baseRecord({ matchId: '2', myRoster: 'orc' }),
    ]);
    expect(dash.rosterUsage.length).toBe(1);
    expect(dash.rosterUsage[0].roster).toBe('orc');
  });

  it('trie rosterUsage par count desc puis nom', () => {
    const dash = buildPersonalDashboard([
      baseRecord({ matchId: '1', myRoster: 'orc' }),
      baseRecord({ matchId: '2', myRoster: 'skaven' }),
      baseRecord({ matchId: '3', myRoster: 'skaven' }),
      baseRecord({ matchId: '4', myRoster: 'dwarf' }),
      baseRecord({ matchId: '5', myRoster: 'dwarf' }),
    ]);
    expect(dash.rosterUsage.map((r) => r.roster)).toEqual([
      'dwarf',
      'skaven',
      'orc',
    ]);
  });

  it('expose recentForm : 5 derniers matches termines (du plus recent au plus ancien)', () => {
    const records: PersonalMatchRecord[] = [];
    // 7 matches, termines, dates croissantes
    for (let i = 0; i < 7; i++) {
      records.push(
        baseRecord({
          matchId: `m${i}`,
          finishedAt: new Date(`2026-04-${20 + i}T10:00:00Z`),
          myScore: i,
          oppScore: 0,
        }),
      );
    }
    const dash = buildPersonalDashboard(records);
    // Le plus recent est m6 (myScore=6 -> W), m5 (W), m4 (W), m3 (W), m2 (W)
    expect(dash.recentForm).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(dash.recentForm.length).toBe(5);
  });

  it('recentForm exclut les matches en cours', () => {
    const dash = buildPersonalDashboard([
      baseRecord({
        matchId: '1',
        myScore: 1,
        oppScore: 0,
        finishedAt: new Date('2026-04-21T10:00:00Z'),
      }),
      baseRecord({
        matchId: 'live',
        status: 'in_progress',
        finishedAt: null,
      }),
    ]);
    expect(dash.recentForm).toEqual(['W']);
  });

  it('reste deterministe : meme entree -> meme sortie', () => {
    const records = [baseRecord({ matchId: '1' }), baseRecord({ matchId: '2' })];
    expect(buildPersonalDashboard(records)).toEqual(buildPersonalDashboard(records));
  });
});
