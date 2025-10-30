/**
 * Tests pour l'export PDF des équipes
 */

import { describe, it, expect } from 'vitest';
import { getDisplayName, getPlayerCost } from '@bb/game-engine';

describe('PDF Export Utilities', () => {
  it('devrait formater correctement les noms de positions', () => {
    const positionName = getDisplayName('skaven_blitzer');
    expect(positionName).toBeTruthy();
    expect(typeof positionName).toBe('string');
  });

  it('devrait calculer correctement le coût des joueurs', () => {
    const cost = getPlayerCost('skaven_blitzer', 'skaven');
    expect(cost).toBeGreaterThan(0);
    expect(typeof cost).toBe('number');
  });

  it('devrait gérer les coûts de différentes positions', () => {
    const blitzerCost = getPlayerCost('skaven_blitzer', 'skaven');
    const linemanCost = getPlayerCost('skaven_lineman', 'skaven');
    
    // Un Blitzer devrait coûter plus cher qu'un Lineman
    expect(blitzerCost).toBeGreaterThan(linemanCost);
  });

  it('devrait gérer plusieurs types de rosters', () => {
    const skavenCost = getPlayerCost('skaven_lineman', 'skaven');
    const lizardmenCost = getPlayerCost('lizardmen_skink', 'lizardmen');
    
    expect(skavenCost).toBeGreaterThan(0);
    expect(lizardmenCost).toBeGreaterThan(0);
  });
});

describe('Team Data Structure', () => {
  it('devrait valider une structure d\'équipe correcte', () => {
    const mockTeam = {
      name: 'Équipe Test',
      roster: 'skaven',
      players: [
        {
          id: 1,
          number: 1,
          name: 'Joueur 1',
          position: 'skaven_blitzer',
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: 'block',
        },
      ],
      initialBudget: 1000000,
      teamValue: 90000,
      treasury: 0,
      rerolls: 3,
      cheerleaders: 0,
      assistants: 0,
      apothecary: true,
      dedicatedFans: 1,
    };

    expect(mockTeam.name).toBeTruthy();
    expect(mockTeam.roster).toBeTruthy();
    expect(Array.isArray(mockTeam.players)).toBe(true);
    expect(mockTeam.players.length).toBeGreaterThan(0);
    
    const player = mockTeam.players[0];
    expect(player.number).toBeGreaterThan(0);
    expect(player.name).toBeTruthy();
    expect(player.position).toBeTruthy();
    expect(player.ma).toBeGreaterThan(0);
    expect(player.st).toBeGreaterThan(0);
    expect(player.ag).toBeGreaterThan(0);
    expect(player.av).toBeGreaterThan(0);
  });

  it('devrait calculer correctement le coût total d\'une équipe', () => {
    const mockPlayers = [
      { position: 'skaven_blitzer', cost: 90000 },
      { position: 'skaven_blitzer', cost: 90000 },
      { position: 'skaven_gutter_runner', cost: 85000 },
      { position: 'skaven_gutter_runner', cost: 85000 },
      { position: 'skaven_lineman', cost: 50000 },
      { position: 'skaven_lineman', cost: 50000 },
    ];

    const roster = 'skaven';
    const totalCost = mockPlayers.reduce((sum, p) => {
      return sum + getPlayerCost(p.position, roster);
    }, 0);

    expect(totalCost).toBeGreaterThan(0);
    expect(totalCost).toBe(450000); // 2*90k + 2*85k + 2*50k
  });

  it('devrait calculer le roster total incluant les extras', () => {
    const playersCost = 450000;
    const rerolls = 3;
    const rerollCost = rerolls * 50000; // 150k
    const cheerleaders = 2;
    const cheerleadersCost = cheerleaders * 10000; // 20k
    const assistants = 1;
    const assistantsCost = assistants * 10000; // 10k
    const dedicatedFans = 1;
    const fansCost = dedicatedFans * 10000; // 10k
    const apothecary = true;
    const apothecaryCost = apothecary ? 50000 : 0; // 50k

    const rosterTotal = playersCost + rerollCost + cheerleadersCost + 
                       assistantsCost + fansCost + apothecaryCost;

    // 450k + 150k + 20k + 10k + 10k + 50k = 690k
    expect(rosterTotal).toBe(690000);
  });

  it('devrait gérer les compétences des joueurs', () => {
    const skillsString = 'block,dodge,sidestep';
    const skillsArray = skillsString.split(',').map(s => s.trim());
    
    expect(Array.isArray(skillsArray)).toBe(true);
    expect(skillsArray.length).toBe(3);
    expect(skillsArray).toContain('block');
    expect(skillsArray).toContain('dodge');
    expect(skillsArray).toContain('sidestep');
  });

  it('devrait gérer les compétences vides', () => {
    const skillsString = '';
    const skillsArray = skillsString.split(',').map(s => s.trim()).filter(Boolean);
    
    expect(Array.isArray(skillsArray)).toBe(true);
    expect(skillsArray.length).toBe(0);
  });
});

describe('Roster Display Names', () => {
  const ROSTER_DISPLAY_NAMES: Record<string, string> = {
    skaven: 'Skaven',
    lizardmen: 'Lizardmen',
    woodelf: 'Wood Elf',
    wood_elf: 'Wood Elf',
    darkelf: 'Dark Elf',
    dark_elf: 'Dark Elf',
    highelf: 'High Elf',
    high_elf: 'High Elf',
  };

  function getRosterDisplayName(slug: string): string {
    return ROSTER_DISPLAY_NAMES[slug] || slug;
  }

  it('devrait retourner le nom d\'affichage correct pour skaven', () => {
    expect(getRosterDisplayName('skaven')).toBe('Skaven');
  });

  it('devrait retourner le nom d\'affichage correct pour lizardmen', () => {
    expect(getRosterDisplayName('lizardmen')).toBe('Lizardmen');
  });

  it('devrait gérer les variantes de noms', () => {
    expect(getRosterDisplayName('woodelf')).toBe('Wood Elf');
    expect(getRosterDisplayName('wood_elf')).toBe('Wood Elf');
  });

  it('devrait retourner le slug si non trouvé', () => {
    expect(getRosterDisplayName('unknown_team')).toBe('unknown_team');
  });
});

describe('PDF Table Data Formatting', () => {
  it('devrait formater correctement les données d\'un joueur pour le tableau', () => {
    const player = {
      number: 1,
      name: 'Ratty McRatface',
      position: 'skaven_blitzer',
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: 'block,dodge',
    };

    const roster = 'skaven';
    const cost = getPlayerCost(player.position, roster);
    const skillsArray = player.skills.split(',').map(s => s.trim()).filter(Boolean);
    const skillsText = skillsArray.join(', ');

    const rowData = [
      player.number.toString(),
      player.name,
      getDisplayName(player.position),
      player.ma.toString(),
      player.st.toString(),
      `${player.ag}+`,
      player.pa ? `${player.pa}+` : '-',
      `${player.av}+`,
      skillsText,
      `${Math.round(cost / 1000)}`,
    ];

    expect(rowData[0]).toBe('1');
    expect(rowData[1]).toBe('Ratty McRatface');
    expect(rowData[2]).toBeTruthy();
    expect(rowData[3]).toBe('7');
    expect(rowData[4]).toBe('3');
    expect(rowData[5]).toBe('3+');
    expect(rowData[6]).toBe('4+');
    expect(rowData[7]).toBe('9+');
    expect(rowData[8]).toBe('block, dodge');
    expect(parseInt(rowData[9])).toBeGreaterThan(0);
  });

  it('devrait gérer un joueur sans PA', () => {
    const player = {
      number: 2,
      name: 'No Pass',
      position: 'skaven_lineman',
      ma: 7,
      st: 3,
      ag: 3,
      pa: null,
      av: 8,
      skills: '',
    };

    const paValue = player.pa ? `${player.pa}+` : '-';
    expect(paValue).toBe('-');
  });

  it('devrait trier les joueurs par numéro', () => {
    const players = [
      { number: 3, name: 'Third' },
      { number: 1, name: 'First' },
      { number: 2, name: 'Second' },
    ];

    const sorted = players.sort((a, b) => a.number - b.number);
    
    expect(sorted[0].number).toBe(1);
    expect(sorted[1].number).toBe(2);
    expect(sorted[2].number).toBe(3);
  });
});

