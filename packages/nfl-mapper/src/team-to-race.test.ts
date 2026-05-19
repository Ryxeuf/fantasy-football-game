import { describe, it, expect } from 'vitest';
import {
  getAllTeams,
  getTeamMeta,
  getTeamsByRace,
  tryGetTeamMeta,
} from './team-to-race.js';
import { BB_RACES, type NflTeamCode } from './types.js';

describe('getAllTeams', () => {
  it('retourne exactement 32 equipes', () => {
    expect(getAllTeams()).toHaveLength(32);
  });

  it('chaque equipe a un code, une ville, une race et un raceLabel non vides', () => {
    for (const team of getAllTeams()) {
      expect(team.code).toMatch(/^[A-Z]{2,3}$/);
      expect(team.city.length).toBeGreaterThan(0);
      expect(BB_RACES).toContain(team.race);
      expect(team.raceLabel.length).toBeGreaterThan(0);
      expect(team.palette.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('tous les codes sont uniques', () => {
    const codes = getAllTeams().map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('ordre stable a chaque appel (memoise)', () => {
    expect(getAllTeams()).toBe(getAllTeams());
  });
});

describe('getTeamsByRace', () => {
  it('attribue exactement 4 equipes a chacune des 8 races BB (Q5)', () => {
    for (const race of BB_RACES) {
      expect(getTeamsByRace(race)).toHaveLength(4);
    }
  });

  it('chaque equipe se trouve dans la liste de sa race', () => {
    for (const team of getAllTeams()) {
      const inRace = getTeamsByRace(team.race);
      expect(inRace).toContainEqual(team);
    }
  });

  it('Skaven contient exactement KC, MIA, HOU, ARI', () => {
    const codes = getTeamsByRace('Skaven').map((t) => t.code).sort();
    expect(codes).toEqual(['ARI', 'HOU', 'KC', 'MIA']);
  });

  it('WoodElf contient exactement CIN, JAX, LAR, WAS', () => {
    const codes = getTeamsByRace('WoodElf').map((t) => t.code).sort();
    expect(codes).toEqual(['CIN', 'JAX', 'LAR', 'WAS']);
  });

  it('Orc contient exactement BAL, PHI, PIT, SF', () => {
    const codes = getTeamsByRace('Orc').map((t) => t.code).sort();
    expect(codes).toEqual(['BAL', 'PHI', 'PIT', 'SF']);
  });

  it('Human contient exactement ATL, DAL, GB, SEA', () => {
    const codes = getTeamsByRace('Human').map((t) => t.code).sort();
    expect(codes).toEqual(['ATL', 'DAL', 'GB', 'SEA']);
  });

  it('Norse contient exactement BUF, CHI, DET, MIN', () => {
    const codes = getTeamsByRace('Norse').map((t) => t.code).sort();
    expect(codes).toEqual(['BUF', 'CHI', 'DET', 'MIN']);
  });

  it('Dwarf contient exactement CLE, IND, NE, NYG', () => {
    const codes = getTeamsByRace('Dwarf').map((t) => t.code).sort();
    expect(codes).toEqual(['CLE', 'IND', 'NE', 'NYG']);
  });

  it('Khorne contient exactement LAC, LV, NYJ, TB', () => {
    const codes = getTeamsByRace('Khorne').map((t) => t.code).sort();
    expect(codes).toEqual(['LAC', 'LV', 'NYJ', 'TB']);
  });

  it('Necromantic contient exactement CAR, DEN, NO, TEN', () => {
    const codes = getTeamsByRace('Necromantic').map((t) => t.code).sort();
    expect(codes).toEqual(['CAR', 'DEN', 'NO', 'TEN']);
  });
});

describe('getTeamMeta', () => {
  it('retourne les metadonnees attendues pour KC (Skaven flagship)', () => {
    const kc = getTeamMeta('KC');
    expect(kc.code).toBe('KC');
    expect(kc.city).toBe('Kansas City');
    expect(kc.race).toBe('Skaven');
    expect(kc.raceLabel).toBe('Kansas City Skaven');
  });

  it('retourne les metadonnees attendues pour BAL (Orc)', () => {
    const bal = getTeamMeta('BAL');
    expect(bal.race).toBe('Orc');
    expect(bal.raceLabel).toBe('Baltimore Orcs');
  });

  it('disambiguation NY : NYG en Dwarf, NYJ en Khorne', () => {
    expect(getTeamMeta('NYG').race).toBe('Dwarf');
    expect(getTeamMeta('NYJ').race).toBe('Khorne');
    expect(getTeamMeta('NYG').city).toContain('(G)');
    expect(getTeamMeta('NYJ').city).toContain('(J)');
  });

  it('disambiguation LA : LAR en WoodElf, LAC en Khorne', () => {
    expect(getTeamMeta('LAR').race).toBe('WoodElf');
    expect(getTeamMeta('LAC').race).toBe('Khorne');
  });

  it('throw avec un code inconnu', () => {
    expect(() => getTeamMeta('XXX' as NflTeamCode)).toThrow(/unknown team code/);
  });

  it('les 32 equipes sont accessibles par leur code', () => {
    for (const team of getAllTeams()) {
      const fetched = getTeamMeta(team.code);
      expect(fetched).toEqual(team);
    }
  });
});

describe('tryGetTeamMeta', () => {
  it('retourne undefined pour un code inconnu (variante safe)', () => {
    expect(tryGetTeamMeta('XXX')).toBeUndefined();
    expect(tryGetTeamMeta('')).toBeUndefined();
  });

  it('retourne la meme valeur que getTeamMeta pour un code valide', () => {
    expect(tryGetTeamMeta('KC')).toEqual(getTeamMeta('KC'));
  });

  it("supporte un code venu d'un payload externe (typage relâché)", () => {
    const raw: string = 'PHI';
    expect(tryGetTeamMeta(raw)?.race).toBe('Orc');
  });
});

describe('palette par race', () => {
  it('toutes les equipes d\'une race partagent la meme palette en V1', () => {
    for (const race of BB_RACES) {
      const teams = getTeamsByRace(race);
      const first = teams[0]?.palette;
      expect(first).toBeDefined();
      for (const t of teams.slice(1)) {
        expect(t.palette).toEqual(first);
      }
    }
  });
});
