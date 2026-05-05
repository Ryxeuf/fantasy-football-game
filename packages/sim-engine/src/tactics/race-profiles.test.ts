import { describe, expect, it } from 'vitest';

import { parseTacticalProfile } from './tactical-profile';

import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  type ProTeamId,
  type ProTeamProfile,
} from './race-profiles';

describe('PRO_LEAGUE_TEAMS — sprint Pro League 0.B.3', () => {
  it('declares exactly 16 teams (sprint Mapping table)', () => {
    expect(PRO_LEAGUE_TEAMS).toHaveLength(16);
  });

  it('all 16 teams have unique slug ids', () => {
    const ids = PRO_LEAGUE_TEAMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(16);
  });

  it('every team profile passes the Zod schema', () => {
    for (const team of PRO_LEAGUE_TEAMS) {
      expect(() => parseTacticalProfile(team.tactics)).not.toThrow();
    }
  });

  it('identity tuning matches the sprint table — bash teams', () => {
    const orcs = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
    expect(orcs.tactics.bashIndex).toBeGreaterThanOrEqual(80);
    expect(orcs.tactics.passingFrequency).toBeLessThanOrEqual(40);

    const ogres = PRO_LEAGUE_TEAM_BY_ID['buf-snow-ogres'];
    expect(ogres.tactics.bashIndex).toBeGreaterThanOrEqual(90);
    expect(ogres.tactics.pace).toBeLessThanOrEqual(40);

    const dwarves = PRO_LEAGUE_TEAM_BY_ID['chi-iron-bears'];
    expect(dwarves.tactics.bashIndex).toBeGreaterThanOrEqual(80);
    expect(dwarves.tactics.cageAffinity).toBeGreaterThanOrEqual(70);
  });

  it('identity tuning matches the sprint table — passing / agility teams', () => {
    const woodElves = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];
    expect(woodElves.tactics.passingFrequency).toBeGreaterThanOrEqual(75);
    expect(woodElves.tactics.riskAppetite).toBeGreaterThanOrEqual(70);

    const darkElves = PRO_LEAGUE_TEAM_BY_ID['dal-vipers'];
    expect(darkElves.tactics.riskAppetite).toBeGreaterThanOrEqual(65);
    expect(darkElves.tactics.breakawayInstinct).toBeGreaterThanOrEqual(70);

    const skaven = PRO_LEAGUE_TEAM_BY_ID['sf-gold-rush'];
    expect(skaven.tactics.pace).toBeGreaterThanOrEqual(85);
    expect(skaven.tactics.breakawayInstinct).toBeGreaterThanOrEqual(80);
  });

  it('identity tuning — discipline / methodical (Lizardmen Patriots)', () => {
    const lizards = PRO_LEAGUE_TEAM_BY_ID['ne-cold-tacticians'];
    expect(lizards.tactics.patience).toBeGreaterThanOrEqual(75);
    expect(lizards.tactics.riskAppetite).toBeLessThanOrEqual(40);
  });

  it('identity tuning — outlaw / brutal teams have high foul frequency', () => {
    const outlaws = PRO_LEAGUE_TEAM_BY_ID['lv-outlaws'];
    expect(outlaws.tactics.foulFrequency).toBeGreaterThanOrEqual(65);
    expect(outlaws.tactics.bashIndex).toBeGreaterThanOrEqual(70);
  });

  it('identity tuning — slow grind teams (Undead, Tomb Kings)', () => {
    const undead = PRO_LEAGUE_TEAM_BY_ID['no-voodoo-saints'];
    expect(undead.tactics.pace).toBeLessThanOrEqual(45);
    const khemri = PRO_LEAGUE_TEAM_BY_ID['phx-tomb-cardinals'];
    expect(khemri.tactics.pace).toBeLessThanOrEqual(30);
    expect(khemri.tactics.patience).toBeGreaterThanOrEqual(80);
  });

  it('identity tuning — Halflings underdog : max risk, max GFI tolerance', () => {
    const halflings = PRO_LEAGUE_TEAM_BY_ID['gb-cheese-halflings'];
    expect(halflings.tactics.riskAppetite).toBeGreaterThanOrEqual(85);
    expect(halflings.tactics.gfiTolerance).toBeGreaterThanOrEqual(80);
  });

  it('identity tuning — Pro Elves are balanced (~60 across the board)', () => {
    const pro = PRO_LEAGUE_TEAM_BY_ID['phi-storm-eagles'];
    // No parameter strays beyond [40, 75] for a balanced roster.
    for (const value of Object.values(pro.tactics)) {
      expect(value).toBeGreaterThanOrEqual(35);
      expect(value).toBeLessThanOrEqual(80);
    }
  });

  it('every team has the required content fields (city, name, race, NFL-flavor)', () => {
    for (const team of PRO_LEAGUE_TEAMS) {
      expect(team.id).toMatch(/^[a-z]{2,4}-[a-z-]+$/);
      expect(team.city.length).toBeGreaterThan(0);
      expect(team.name.length).toBeGreaterThan(0);
      expect(team.race.length).toBeGreaterThan(0);
      expect(team.nflFlavor.length).toBeGreaterThan(0);
    }
  });

  it('PRO_TEAM_BY_ID is keyed by the team id (lookup helper)', () => {
    for (const team of PRO_LEAGUE_TEAMS) {
      const looked = PRO_LEAGUE_TEAM_BY_ID[team.id as ProTeamId];
      expect(looked).toBe(team);
    }
  });

  it('ProTeamProfile type matches the runtime data', () => {
    const team: ProTeamProfile = PRO_LEAGUE_TEAMS[0];
    expect(team.tactics.bashIndex).toBeTypeOf('number');
  });

  it('no two teams have an identical tactical fingerprint (variety)', () => {
    const fingerprints = PRO_LEAGUE_TEAMS.map((t) => JSON.stringify(t.tactics));
    expect(new Set(fingerprints).size).toBe(16);
  });
});
