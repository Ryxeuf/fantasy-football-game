import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams } from './game-state';
import {
  startPreMatchSequence,
  calculateFanFactor,
  determineWeather,
  addJourneymen,
} from './pre-match-sequence';
import type { JourneymanStats } from './pre-match-sequence';

function createStateAtJourneymenPhase(teamACount: number, teamBCount: number) {
  const teamA = Array.from({ length: teamACount }, (_, i) => ({
    name: `Joueur A${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: '',
  }));
  const teamB = Array.from({ length: teamBCount }, (_, i) => ({
    name: `Joueur B${i + 1}`,
    number: i + 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: '',
  }));
  let state = setupPreMatchWithTeams(teamA, teamB, 'Team A', 'Team B');
  state = startPreMatchSequence(state);
  state = calculateFanFactor(state, () => 0.5, 1, 1);
  state = determineWeather(state, () => 0.5);
  return state;
}

describe('addJourneymen with roster-specific stats', () => {
  it('uses custom stats for team A journeymen', () => {
    const state = createStateAtJourneymenPhase(9, 11);
    const skavenLinemanStats: JourneymanStats = {
      position: 'Skaven Clanrat',
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
    };

    const result = addJourneymen(state, 11, 11, skavenLinemanStats);

    expect(result.preMatch.journeymen?.teamA.count).toBe(2);
    const journeymenA = result.players.filter(p => p.id.startsWith('JA'));
    expect(journeymenA).toHaveLength(2);
    journeymenA.forEach(j => {
      expect(j.position).toBe('Skaven Clanrat');
      expect(j.ma).toBe(7);
      expect(j.pm).toBe(7); // pm should match ma
      expect(j.skills).toContain('Loner (4+)');
    });
  });

  it('uses custom stats for team B journeymen', () => {
    const state = createStateAtJourneymenPhase(11, 8);
    const lizardmenLinemanStats: JourneymanStats = {
      position: 'Skink',
      ma: 8,
      st: 2,
      ag: 3,
      pa: 4,
      av: 7,
    };

    const result = addJourneymen(state, 11, 11, undefined, lizardmenLinemanStats);

    expect(result.preMatch.journeymen?.teamB.count).toBe(3);
    const journeymenB = result.players.filter(p => p.id.startsWith('JB'));
    expect(journeymenB).toHaveLength(3);
    journeymenB.forEach(j => {
      expect(j.position).toBe('Skink');
      expect(j.ma).toBe(8);
      expect(j.st).toBe(2);
      expect(j.av).toBe(7);
      expect(j.pm).toBe(8);
    });
  });

  it('uses different stats for each team', () => {
    const state = createStateAtJourneymenPhase(10, 10);
    const teamAStats: JourneymanStats = {
      position: 'Orc Lineman',
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    };
    const teamBStats: JourneymanStats = {
      position: 'Elf Lineman',
      ma: 6,
      st: 3,
      ag: 2,
      pa: 4,
      av: 8,
    };

    const result = addJourneymen(state, 11, 11, teamAStats, teamBStats);

    const journeymanA = result.players.find(p => p.id === 'JA1');
    const journeymanB = result.players.find(p => p.id === 'JB1');

    expect(journeymanA?.position).toBe('Orc Lineman');
    expect(journeymanA?.ma).toBe(5);
    expect(journeymanA?.av).toBe(9);

    expect(journeymanB?.position).toBe('Elf Lineman');
    expect(journeymanB?.ag).toBe(2);
  });

  it('falls back to default stats when no custom stats provided', () => {
    const state = createStateAtJourneymenPhase(10, 11);

    const result = addJourneymen(state, 11, 11);

    const journeyman = result.players.find(p => p.id === 'JA1');
    expect(journeyman?.position).toBe('Lineman');
    expect(journeyman?.ma).toBe(6);
    expect(journeyman?.st).toBe(3);
    expect(journeyman?.ag).toBe(3);
    expect(journeyman?.pa).toBe(4);
    expect(journeyman?.av).toBe(8);
  });

  it('does not add journeymen when teams are full', () => {
    const state = createStateAtJourneymenPhase(11, 11);

    const result = addJourneymen(state, 11, 11);

    expect(result.preMatch.journeymen?.teamA.count).toBe(0);
    expect(result.preMatch.journeymen?.teamB.count).toBe(0);
    expect(result.players.filter(p => p.id.startsWith('J'))).toHaveLength(0);
  });
});
