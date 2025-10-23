import { describe, it, expect } from 'vitest';
import {
  STAR_PLAYERS,
  getStarPlayerBySlug,
  getAvailableStarPlayers,
  TEAM_REGIONAL_RULES,
  type StarPlayerDefinition,
} from './star-players';

describe('Star Players', () => {
  describe('STAR_PLAYERS definition', () => {
    it('devrait contenir tous les star players avec les propriétés requises', () => {
      const starPlayerCount = Object.keys(STAR_PLAYERS).length;
      expect(starPlayerCount).toBeGreaterThan(0);

      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        expect(starPlayer.slug).toBe(slug);
        expect(starPlayer.displayName).toBeTruthy();
        
        // Crumbleberry est gratuit car inclus avec Grak
        if (slug === 'crumbleberry') {
          expect(starPlayer.cost).toBe(0);
        } else {
          expect(starPlayer.cost).toBeGreaterThan(0);
        }
        
        expect(starPlayer.ma).toBeGreaterThan(0);
        expect(starPlayer.st).toBeGreaterThan(0);
        expect(starPlayer.ag).toBeGreaterThan(0);
        expect(starPlayer.av).toBeGreaterThan(0);
        expect(starPlayer.skills).toBeDefined();
        expect(starPlayer.hirableBy).toBeDefined();
        expect(Array.isArray(starPlayer.hirableBy)).toBe(true);
      });
    });

    it('devrait avoir des coûts cohérents avec les règles (entre 140,000 et 340,000 po)', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        // Crumbleberry est gratuit car inclus avec Grak
        if (starPlayer.slug === 'crumbleberry') {
          expect(starPlayer.cost).toBe(0);
        } else {
          expect(starPlayer.cost).toBeGreaterThanOrEqual(140000);
          expect(starPlayer.cost).toBeLessThanOrEqual(340000);
        }
      });
    });

    it('devrait avoir des caractéristiques valides', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        // MA entre 1 et 9 (Deeproot a 2, le plus lent)
        expect(starPlayer.ma).toBeGreaterThanOrEqual(1);
        expect(starPlayer.ma).toBeLessThanOrEqual(9);

        // ST entre 2 et 7 (Deeproot a 7, le plus fort)
        expect(starPlayer.st).toBeGreaterThanOrEqual(2);
        expect(starPlayer.st).toBeLessThanOrEqual(7);

        // AG entre 1 et 6 (valeurs cibles)
        expect(starPlayer.ag).toBeGreaterThanOrEqual(1);
        expect(starPlayer.ag).toBeLessThanOrEqual(6);

        // PA entre 1 et 6 ou null
        if (starPlayer.pa !== null) {
          expect(starPlayer.pa).toBeGreaterThanOrEqual(1);
          expect(starPlayer.pa).toBeLessThanOrEqual(6);
        }

        // AV entre 7 et 11
        expect(starPlayer.av).toBeGreaterThanOrEqual(7);
        expect(starPlayer.av).toBeLessThanOrEqual(11);
      });
    });
  });

  describe('getStarPlayerBySlug', () => {
    it('devrait retourner un star player existant', () => {
      const glart = getStarPlayerBySlug('glart_smashrip');
      expect(glart).toBeDefined();
      expect(glart?.displayName).toBe('Glart Smashrip');
      expect(glart?.cost).toBe(195000);
    });

    it('devrait retourner undefined pour un slug inexistant', () => {
      const unknown = getStarPlayerBySlug('unknown_player');
      expect(unknown).toBeUndefined();
    });
  });

  describe('Star Players spécifiques', () => {
    it('Glart Smashrip - devrait avoir les bonnes caractéristiques', () => {
      const glart = getStarPlayerBySlug('glart_smashrip');
      expect(glart).toBeDefined();
      expect(glart?.ma).toBe(9);
      expect(glart?.st).toBe(4);
      expect(glart?.ag).toBe(4);
      expect(glart?.pa).toBe(4);
      expect(glart?.av).toBe(9);
      expect(glart?.skills).toContain('loner-4');
      expect(glart?.cost).toBe(195000);
    });

    it('Morg n Thorg - devrait avoir les caractéristiques les plus élevées', () => {
      const morg = getStarPlayerBySlug('morg_n_thorg');
      expect(morg).toBeDefined();
      expect(morg?.st).toBe(6);
      expect(morg?.av).toBe(11);
      expect(morg?.skills).toContain('mighty-blow-2');
      expect(morg?.cost).toBe(340000);
    });

    it('Deeproot Strongbranch - devrait être le plus lent mais le plus fort', () => {
      const deeproot = getStarPlayerBySlug('deeproot_strongbranch');
      expect(deeproot).toBeDefined();
      expect(deeproot?.ma).toBe(2);
      expect(deeproot?.st).toBe(7);
      expect(deeproot?.skills).toContain('throw-team-mate');
    });

    it('Grak et Crumbleberry - devraient être recrutés ensemble', () => {
      const grak = getStarPlayerBySlug('grak');
      const crumbleberry = getStarPlayerBySlug('crumbleberry');
      
      expect(grak).toBeDefined();
      expect(crumbleberry).toBeDefined();
      
      // Crumbleberry est gratuit (inclus avec Grak)
      expect(grak?.cost).toBe(250000);
      expect(crumbleberry?.cost).toBe(0);
      
      // Les deux devraient avoir des règles spéciales mentionnant l'autre
      expect(grak?.specialRule).toContain('Crumbleberry');
      expect(crumbleberry?.specialRule).toContain('Grak');
    });

    it('Les Swift Twins - devraient être recrutés ensemble', () => {
      const lucien = getStarPlayerBySlug('lucien_swift');
      const valen = getStarPlayerBySlug('valen_swift');
      
      expect(lucien).toBeDefined();
      expect(valen).toBeDefined();
      
      // Coût identique
      expect(lucien?.cost).toBe(340000);
      expect(valen?.cost).toBe(340000);
      
      // Règles spéciales liées
      expect(lucien?.specialRule).toBeTruthy();
      expect(valen?.specialRule).toBeTruthy();
    });
  });

  describe('getAvailableStarPlayers', () => {
    it('devrait retourner les star players disponibles pour une équipe Skaven', () => {
      const skaven = 'skaven';
      const regionalRules = TEAM_REGIONAL_RULES[skaven];
      const availablePlayers = getAvailableStarPlayers(skaven, regionalRules);

      expect(availablePlayers.length).toBeGreaterThan(0);
      
      // Hakflem devrait être disponible (Underworld Challenge)
      const hakflem = availablePlayers.find(sp => sp.slug === 'hakflem_skuttlespike');
      expect(hakflem).toBeDefined();
      
      // Helmut Wulf devrait être disponible (pour tous)
      const helmut = availablePlayers.find(sp => sp.slug === 'helmut_wulf');
      expect(helmut).toBeDefined();
    });

    it('devrait retourner les star players disponibles pour une équipe Elfe Sylvain', () => {
      const woodElf = 'wood_elf';
      const regionalRules = TEAM_REGIONAL_RULES[woodElf];
      const availablePlayers = getAvailableStarPlayers(woodElf, regionalRules);

      expect(availablePlayers.length).toBeGreaterThan(0);
      
      // Eldril Sidewinder devrait être disponible (Elven Kingdoms League)
      const eldril = availablePlayers.find(sp => sp.slug === 'eldril_sidewinder');
      expect(eldril).toBeDefined();
      
      // Roxanna Darknail devrait être disponible (Elven Kingdoms League)
      const roxanna = availablePlayers.find(sp => sp.slug === 'roxanna_darknail');
      expect(roxanna).toBeDefined();
    });

    it('devrait retourner les star players disponibles pour une équipe Nain', () => {
      const dwarf = 'dwarf';
      const regionalRules = TEAM_REGIONAL_RULES[dwarf];
      const availablePlayers = getAvailableStarPlayers(dwarf, regionalRules);

      expect(availablePlayers.length).toBeGreaterThan(0);
      
      // Grombrindal devrait être disponible (Worlds Edge Superleague)
      const grombrindal = availablePlayers.find(sp => sp.slug === 'grombrindal');
      expect(grombrindal).toBeDefined();
    });

    it('devrait inclure les star players "all" pour toutes les équipes', () => {
      const teams = ['skaven', 'dwarf', 'wood_elf', 'orc'];
      
      teams.forEach(team => {
        const regionalRules = TEAM_REGIONAL_RULES[team];
        const availablePlayers = getAvailableStarPlayers(team, regionalRules);
        
        // Helmut Wulf (disponible pour tous) devrait être dans chaque liste
        const helmut = availablePlayers.find(sp => sp.slug === 'helmut_wulf');
        expect(helmut).toBeDefined();
        
        // Morg 'n' Thorg (disponible pour tous) devrait être dans chaque liste
        const morg = availablePlayers.find(sp => sp.slug === 'morg_n_thorg');
        expect(morg).toBeDefined();
      });
    });
  });

  describe('TEAM_REGIONAL_RULES', () => {
    it('devrait contenir des règles pour toutes les équipes implémentées', () => {
      const teams = [
        'skaven', 'lizardmen', 'wood_elf', 'dark_elf', 'dwarf',
        'goblin', 'undead', 'chaos_renegade', 'ogre', 'halfling',
        'underworld', 'chaos_chosen', 'imperial_nobility',
        'necromantic_horror', 'orc', 'nurgle', 'old_world_alliance',
        'elven_union', 'human', 'black_orc', 'snotling'
      ];

      teams.forEach(team => {
        const rules = TEAM_REGIONAL_RULES[team];
        expect(rules).toBeDefined();
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Compétences des Star Players', () => {
    it('tous les star players devraient avoir la compétence loner', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        expect(starPlayer.skills).toMatch(/loner-[2-4]/);
      });
    });

    it('devrait avoir des compétences séparées par des virgules', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        if (starPlayer.skills.length > 0) {
          // Les compétences devraient être en kebab-case et séparées par des virgules
          const skills = starPlayer.skills.split(',');
          skills.forEach(skill => {
            expect(skill).toMatch(/^[a-z-0-9]+$/);
          });
        }
      });
    });
  });

  describe('Règles spéciales', () => {
    it('chaque star player devrait avoir une règle spéciale', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        // Crumbleberry partage la règle spéciale avec Grak
        expect(starPlayer.specialRule).toBeDefined();
        expect(starPlayer.specialRule).toBeTruthy();
      });
    });
  });

  describe('Validation des coûts connus', () => {
    const knownCosts: Record<string, number> = {
      'glart_smashrip': 195000,
      'gloriel_summerbloom': 150000,
      'grak': 250000,
      'gretchen_wachter': 260000,
      'griff_oberwald': 280000,
      'mighty_zug': 220000,
      'morg_n_thorg': 340000,
      'roxanna_darknail': 270000,
      'rumbelow_sheepskin': 170000,
      'skrull_halfheight': 150000,
      'grim_ironjaw': 200000,
      'hakflem_skuttlespike': 180000,
      'helmut_wulf': 140000,
      'karla_von_kill': 210000,
      'lord_borak': 260000,
      'the_black_gobbo': 225000,
      'deeproot_strongbranch': 280000,
      'eldril_sidewinder': 230000,
      'lucien_swift': 340000,
      'valen_swift': 340000,
      'varag_ghoul_chewer': 280000,
      'grombrindal': 210000,
      'willow_rosebark': 150000,
      'zolcath_the_zoat': 230000,
    };

    it('devrait avoir les coûts corrects basés sur les images', () => {
      Object.entries(knownCosts).forEach(([slug, expectedCost]) => {
        const starPlayer = getStarPlayerBySlug(slug);
        expect(starPlayer).toBeDefined();
        expect(starPlayer?.cost).toBe(expectedCost);
      });
    });
  });
});

