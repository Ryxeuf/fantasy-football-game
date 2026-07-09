import { describe, it, expect } from 'vitest';
import {
  STAR_PLAYERS,
  getStarPlayerBySlug,
  getAvailableStarPlayers,
  TEAM_REGIONAL_RULES,
  STAR_PLAYERS_BY_RULESET,
  TEAM_REGIONAL_RULES_BY_RULESET,
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
        
        // Crumbleberry (inclus avec Grak) et Drull (inclus avec Dribl)
        // sont gratuits : le coût de la paire est porté par le partenaire.
        if (slug === 'crumbleberry' || slug === 'drull') {
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

    it('devrait avoir des coûts cohérents avec les règles (entre 50,000 et 340,000 po)', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        // Crumbleberry (inclus avec Grak) et Drull (inclus avec Dribl)
        // sont gratuits : le coût de la paire est porté par le partenaire.
        if (starPlayer.slug === 'crumbleberry' || starPlayer.slug === 'drull') {
          expect(starPlayer.cost).toBe(0);
        } else {
          // Les moins chers sont Bomber & Cindy à 50k
          expect(starPlayer.cost).toBeGreaterThanOrEqual(50000);
          expect(starPlayer.cost).toBeLessThanOrEqual(340000);
        }
      });
    });

    it('devrait avoir des caractéristiques valides', () => {
      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        // MA entre 1 et 9 (Deeproot a 2, le plus lent)
        expect(starPlayer.ma).toBeGreaterThanOrEqual(1);
        expect(starPlayer.ma).toBeLessThanOrEqual(9);

        // ST entre 1 et 7 (Akhorne a 1, Deeproot a 7)
        expect(starPlayer.st).toBeGreaterThanOrEqual(1);
        expect(starPlayer.st).toBeLessThanOrEqual(7);

        // AG entre 1 et 6 (valeurs cibles)
        expect(starPlayer.ag).toBeGreaterThanOrEqual(1);
        expect(starPlayer.ag).toBeLessThanOrEqual(6);

        // PA entre 1 et 6 ou null
        if (starPlayer.pa !== null) {
          expect(starPlayer.pa).toBeGreaterThanOrEqual(1);
          expect(starPlayer.pa).toBeLessThanOrEqual(6);
        }

        // AV entre 6 et 11 (Akhorne a 6, Maple Highgrove a 11)
        expect(starPlayer.av).toBeGreaterThanOrEqual(6);
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

    it('Dribl et Drull - devraient être recrutés ensemble (A16, PDF 2025)', () => {
      const dribl = getStarPlayerBySlug('dribl');
      const drull = getStarPlayerBySlug('drull');

      expect(dribl).toBeDefined();
      expect(drull).toBeDefined();

      // 230 000 po pour la paire : coût porté par Dribl, Drull gratuit
      expect(dribl?.cost).toBe(230000);
      expect(drull?.cost).toBe(0);

      // Skinks de la Lustrian Superleague
      expect(dribl?.hirableBy).toEqual(['lustrian_superleague']);
      expect(drull?.hirableBy).toEqual(['lustrian_superleague']);

      // Les deux devraient avoir des règles spéciales mentionnant l'autre
      expect(dribl?.specialRule).toContain('Drull');
      expect(drull?.specialRule).toContain('Dribl');
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

      // Morg 'n' Thorg devrait être disponible (pour tous)
      const morg = availablePlayers.find(sp => sp.slug === 'morg_n_thorg');
      expect(morg).toBeDefined();
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

        // Grak (« Any Team » sur le PDF 2025) devrait être dans chaque liste
        const grak = availablePlayers.find(sp => sp.slug === 'grak');
        expect(grak).toBeDefined();

        // Morg 'n' Thorg (disponible pour tous) devrait être dans chaque liste
        const morg = availablePlayers.find(sp => sp.slug === 'morg_n_thorg');
        expect(morg).toBeDefined();
      });
    });

    describe('A9 — déduplication par slug (pas de doublons)', () => {
      it('ne devrait jamais retourner deux fois le même slug pour une équipe à plusieurs règles régionales', () => {
        // Goblin a deux règles régionales (badlands_brawl + underworld_challenge)
        // et plusieurs star players sont éligibles par les DEUX règles
        // (ex. Nobbla, Fungus). On vérifie qu'aucun slug n'apparaît deux fois.
        const teams = ['goblin', 'dwarf', 'ogre', 'chaos_dwarf', 'norse', 'skaven'];
        teams.forEach((team) => {
          const available = getAvailableStarPlayers(team, TEAM_REGIONAL_RULES[team]);
          const slugs = available.map((sp) => sp.slug);
          const uniqueSlugs = new Set(slugs);
          expect(slugs.length).toBe(uniqueSlugs.size);
        });
      });

      it('Goblin : un star éligible par deux règles (Nobbla) apparaît exactement une fois', () => {
        const available = getAvailableStarPlayers('goblin', TEAM_REGIONAL_RULES['goblin']);
        // Nobbla est hirableBy: ["underworld_challenge", "badlands_brawl"] —
        // les deux règles régionales du Goblin matchent.
        const nobblaOccurrences = available.filter((sp) => sp.slug === 'nobbla_blackwart');
        expect(nobblaOccurrences.length).toBe(1);
      });

      it('dédup même si la liste de règles passée contient des doublons ou recoupe "all"', () => {
        // Règles passées explicitement avec un doublon volontaire : la sortie
        // ne doit toujours pas dédoubler les slugs.
        const available = getAvailableStarPlayers('goblin', [
          'badlands_brawl',
          'underworld_challenge',
          'badlands_brawl',
        ]);
        const slugs = available.map((sp) => sp.slug);
        expect(slugs.length).toBe(new Set(slugs).size);

        // Un star "all" (Morg) éligible inconditionnellement reste unique.
        const morg = available.filter((sp) => sp.slug === 'morg_n_thorg');
        expect(morg.length).toBe(1);
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

  describe('A16 — « Plays for » S3 alignés sur le PDF officiel « Star Players! » 2025', () => {
    const S3 = 'season_3' as const;
    const s3Available = (team: string) =>
      getAvailableStarPlayers(team, [], S3).map((sp) => sp.slug);

    it('les stars « Favoured of Nurgle » ne sont plus proposées à tout le monde', () => {
      const human = s3Available('human');
      for (const slug of ['bilerot_vomitflesh', 'guffle_pussmaw', 'withergrasp_doubledrool']) {
        expect(human, `human ne doit pas proposer ${slug}`).not.toContain(slug);
      }
      const nurgle = s3Available('nurgle');
      for (const slug of ['bilerot_vomitflesh', 'guffle_pussmaw', 'withergrasp_doubledrool']) {
        expect(nurgle, `nurgle doit proposer ${slug}`).toContain(slug);
      }
    });

    it('les stars « Favoured of Khorne » sont réservées à Khorne (et Nordiques)', () => {
      for (const slug of ['max_spleenripper', 'scyla_anfingrimm']) {
        expect(s3Available('khorne')).toContain(slug);
        expect(s3Available('norse')).toContain(slug);
        expect(s3Available('human')).not.toContain(slug);
        expect(s3Available('nurgle')).not.toContain(slug);
      }
    });

    it('Zzharg et H\'thark relèvent de « Favoured of Hashut » (Nains du Chaos)', () => {
      const chaosDwarf = s3Available('chaos_dwarf');
      expect(chaosDwarf).toContain('zzharg_madeye');
      expect(chaosDwarf).toContain('hthark_the_unstoppable');
      // Zzharg n'est plus proposé aux équipes Badlands génériques
      expect(s3Available('orc')).not.toContain('zzharg_madeye');
      expect(s3Available('goblin')).not.toContain('zzharg_madeye');
      // H'thark reste accessible via Badlands Brawl
      expect(s3Available('orc')).toContain('hthark_the_unstoppable');
    });

    it('Grashnak joue pour « Chaos Clash », plus pour tout le monde', () => {
      expect(s3Available('human')).not.toContain('grashnak_blackhoof');
      for (const team of ['chaos_chosen', 'chaos_renegade', 'nurgle', 'khorne', 'chaos_dwarf']) {
        expect(s3Available(team), `${team} doit proposer grashnak`).toContain('grashnak_blackhoof');
      }
    });

    it('la Woodland League (Elfes Sylvains, Halflings, Gnomes) récupère ses stars', () => {
      const woodlandStars = ['deeproot_strongbranch', 'maple_highgrove', 'rowana_forestfoot', 'swiftvine_glimmershard', 'willow_rosebark'];
      for (const team of ['wood_elf', 'halfling', 'gnome']) {
        const available = s3Available(team);
        for (const slug of woodlandStars) {
          expect(available, `${team} doit proposer ${slug}`).toContain(slug);
        }
      }
      // Deeproot n'est plus Old World Classic ; Rowana n'est plus « all »
      expect(s3Available('human')).not.toContain('deeproot_strongbranch');
      expect(s3Available('human')).not.toContain('rowana_forestfoot');
      // Jordell : Elven Kingdoms League OU Woodland League
      expect(s3Available('wood_elf')).toContain('jordell_freshbreeze');
      expect(s3Available('dark_elf')).toContain('jordell_freshbreeze');
    });

    it('les stars naines couvrent la Worlds Edge Superleague et Grombrindal la Thimble Cup', () => {
      const dwarf = s3Available('dwarf');
      for (const slug of ['barik_farblast', 'grombrindal', 'skorg_snowpelt', 'thorsson_stoutmead', 'mighty_zug', 'skrull_halfheight']) {
        expect(dwarf, `dwarf doit proposer ${slug}`).toContain(slug);
      }
      // Grombrindal : Halfling Thimble Cup + OWC + WES — plus Lustrian
      expect(s3Available('halfling')).toContain('grombrindal');
      expect(s3Available('lizardmen')).not.toContain('grombrindal');
      // Zug : OWC + WES — plus Lustrian
      expect(s3Available('lizardmen')).not.toContain('mighty_zug');
    });

    it('Helmut Wulf est Old World Classic (plus « all ») et Hakflem strictement Underworld', () => {
      expect(s3Available('human')).toContain('helmut_wulf');
      expect(s3Available('skaven')).not.toContain('helmut_wulf');
      // L'ancien override S3 (+Sylvanian) est contredit par le PDF 2025
      expect(s3Available('skaven')).toContain('hakflem_skuttlespike');
      expect(s3Available('vampire')).not.toContain('hakflem_skuttlespike');
      // Skrull dessert Sylvanian ET Worlds Edge
      expect(s3Available('vampire')).toContain('skrull_halfheight');
    });

    it('Dribl & Drull existent et sont proposés aux équipes lustriennes', () => {
      const lizardmen = s3Available('lizardmen');
      expect(lizardmen).toContain('dribl');
      expect(lizardmen).toContain('drull');
      expect(s3Available('human')).not.toContain('dribl');
    });

    it('les Bretonniens (roster S3) ont des règles régionales et voient les stars OWC', () => {
      expect(TEAM_REGIONAL_RULES_BY_RULESET.season_3['bretonnian']).toEqual(['old_world_classic']);
      expect(s3Available('bretonnian')).toContain('helmut_wulf');
    });

    it('non-régression : la base season_2 (BB2020) reste inchangée', () => {
      const s2 = STAR_PLAYERS_BY_RULESET.season_2;
      expect(s2['deeproot_strongbranch'].hirableBy).toEqual(['old_world_classic']);
      expect(s2['helmut_wulf'].hirableBy).toEqual(['all']);
      expect(s2['zzharg_madeye'].hirableBy).toEqual(['badlands_brawl']);
      expect(s2['grashnak_blackhoof'].hirableBy).toEqual(['all']);
      expect(TEAM_REGIONAL_RULES_BY_RULESET.season_2['nurgle']).toEqual(['favoured_of']);
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

    it('aucun star player ne devrait avoir la règle spéciale fallback (I.6)', () => {
      const fallbackPattern = /^Consultez le Livre de Règles Blood Bowl/;
      const playersWithFallback: string[] = [];

      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        if (starPlayer.specialRule && fallbackPattern.test(starPlayer.specialRule)) {
          playersWithFallback.push(starPlayer.slug);
        }
      });

      expect(playersWithFallback).toEqual([]);
    });

    it('chaque règle spéciale devrait être unique ou partagée par un duo', () => {
      const ruleCounts = new Map<string, string[]>();

      Object.values(STAR_PLAYERS).forEach(starPlayer => {
        if (!starPlayer.specialRule) return;
        const existing = ruleCounts.get(starPlayer.specialRule) ?? [];
        existing.push(starPlayer.slug);
        ruleCounts.set(starPlayer.specialRule, existing);
      });

      // Les duos (Grak/Crumbleberry, Swift Twins) peuvent partager une mention
      // mais sinon chaque règle devrait être unique
      for (const [rule, slugs] of ruleCounts.entries()) {
        if (slugs.length > 1) {
          // Only known duos should share rules
          const isDuo = slugs.every(s =>
            ['grak', 'crumbleberry', 'lucien_swift', 'valen_swift'].includes(s)
          );
          expect(isDuo).toBe(true);
        }
      }
    });
  });

  describe('Validation des imageUrl', () => {
    it('les imageUrl ne devraient contenir que des caractères ASCII', () => {
      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        if (starPlayer.imageUrl) {
          // eslint-disable-next-line no-control-regex
          const isAscii = /^[\x00-\x7F]*$/.test(starPlayer.imageUrl);
          expect(isAscii).toBe(true);
        }
      });
    });

    it('Morg n Thorg imageUrl ne devrait pas contenir de guillemets Unicode', () => {
      const morg = getStarPlayerBySlug('morg_n_thorg');
      expect(morg).toBeDefined();
      expect(morg?.imageUrl).toBeDefined();
      // Vérifier absence de LEFT/RIGHT SINGLE QUOTATION MARK (U+2018/U+2019)
      expect(morg?.imageUrl).not.toMatch(/[\u2018\u2019]/);
      // Vérifier que l'apostrophe ASCII est utilisée
      expect(morg?.imageUrl).toContain("'");
    });

    it('aucun star player ne devrait utiliser Fungus-the-Loon.webp comme placeholder sauf Fungus lui-même', () => {
      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        if (slug !== 'fungus_the_loon' && starPlayer.imageUrl) {
          expect(starPlayer.imageUrl).not.toContain('Fungus-the-Loon');
        }
      });
    });

    it('les star players avec images disponibles devraient avoir la bonne imageUrl', () => {
      const expectedImages: Record<string, string> = {
        'akhorne_the_squirrel': '/data/Star-Players_files/akhorne-the-squirrel-1024x922.webp',
        'the_black_gobbo': '/data/Star-Players_files/The-Black-Gobbo.webp',
        'grombrindal': '/data/Star-Players_files/Grombrindal-the-White-Dwarf.webp',
      };

      Object.entries(expectedImages).forEach(([slug, expectedUrl]) => {
        const starPlayer = getStarPlayerBySlug(slug);
        expect(starPlayer).toBeDefined();
        expect(starPlayer?.imageUrl).toBe(expectedUrl);
      });
    });

    it('tous les star players devraient avoir une imageUrl définie', () => {
      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        expect(starPlayer.imageUrl).toBeDefined();
        expect(typeof starPlayer.imageUrl).toBe('string');
        expect(starPlayer.imageUrl!.length).toBeGreaterThan(0);
      });
    });

    it('toutes les imageUrl devraient commencer par /data/Star-Players_files/', () => {
      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        expect(starPlayer.imageUrl).toMatch(/^\/data\/Star-Players_files\//);
      });
    });

    it('toutes les imageUrl devraient avoir une extension valide (.webp ou .svg)', () => {
      Object.entries(STAR_PLAYERS).forEach(([slug, starPlayer]) => {
        expect(starPlayer.imageUrl).toMatch(/\.(webp|svg)$/);
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

  describe('Season 3 star player differentiation (I.7)', () => {
    describe('S3 star players are separate from S2', () => {
      it('devrait avoir des maps distinctes pour S2 et S3', () => {
        const s2Map = STAR_PLAYERS_BY_RULESET.season_2;
        const s3Map = STAR_PLAYERS_BY_RULESET.season_3;

        expect(s2Map).toBeDefined();
        expect(s3Map).toBeDefined();
        expect(s2Map).not.toBe(s3Map);
      });

      it('les mutations S3 ne devraient pas affecter S2', () => {
        const s2Hakflem = STAR_PLAYERS_BY_RULESET.season_2['hakflem_skuttlespike'];
        const s3Hakflem = STAR_PLAYERS_BY_RULESET.season_3['hakflem_skuttlespike'];

        expect(s2Hakflem).toBeDefined();
        expect(s3Hakflem).toBeDefined();
        expect(s2Hakflem).not.toBe(s3Hakflem);

        // Verify they're separate objects
        expect(s2Hakflem.hirableBy).not.toBe(s3Hakflem.hirableBy);
      });

      it('S3 devrait avoir tous les star players de base de S2', () => {
        const s2Slugs = Object.keys(STAR_PLAYERS_BY_RULESET.season_2);
        const s3Slugs = Object.keys(STAR_PLAYERS_BY_RULESET.season_3);

        // All S2 star players should exist in S3
        for (const slug of s2Slugs) {
          expect(s3Slugs).toContain(slug);
        }
      });
    });

    describe('S3-specific star player changes', () => {
      it('Hakflem Skuttlespike est strictement Underworld Challenge en S3 (A16, PDF 2025)', () => {
        // L'ancien override S3 (+sylvanian_spotlight) était contredit par le
        // PDF officiel « Star Players! » 2025 : Plays for = Underworld Challenge.
        const s3Hakflem = getStarPlayerBySlug('hakflem_skuttlespike', 'season_3');
        expect(s3Hakflem).toBeDefined();
        expect(s3Hakflem?.hirableBy).toEqual(['underworld_challenge']);
      });

      it('Hakflem Skuttlespike S2 ne devrait PAS avoir sylvanian_spotlight', () => {
        const s2Hakflem = getStarPlayerBySlug('hakflem_skuttlespike', 'season_2');
        expect(s2Hakflem).toBeDefined();
        expect(s2Hakflem?.hirableBy).toContain('underworld_challenge');
        expect(s2Hakflem?.hirableBy).not.toContain('sylvanian_spotlight');
      });

      it('S3 devrait avoir au moins une différence avec S2', () => {
        const s2Map = STAR_PLAYERS_BY_RULESET.season_2;
        const s3Map = STAR_PLAYERS_BY_RULESET.season_3;

        let hasDifference = false;
        for (const slug of Object.keys(s2Map)) {
          const s2Player = s2Map[slug];
          const s3Player = s3Map[slug];
          if (!s3Player) continue;

          if (
            s2Player.cost !== s3Player.cost ||
            s2Player.skills !== s3Player.skills ||
            JSON.stringify(s2Player.hirableBy) !== JSON.stringify(s3Player.hirableBy)
          ) {
            hasDifference = true;
            break;
          }
        }

        expect(hasDifference).toBe(true);
      });
    });

    describe('S3 regional rules', () => {
      it('slann devrait avoir lustrian_superleague dans les règles régionales S3', () => {
        const s3Rules = TEAM_REGIONAL_RULES_BY_RULESET.season_3;
        expect(s3Rules['slann']).toBeDefined();
        expect(s3Rules['slann']).toContain('lustrian_superleague');
      });

      it('slann devrait pouvoir recruter des star players lustrian_superleague en S3', () => {
        const availablePlayers = getAvailableStarPlayers('slann', [], 'season_3');

        // Should include "all" players plus lustrian_superleague players
        const lustrians = availablePlayers.filter(
          sp => sp.hirableBy.includes('lustrian_superleague')
        );
        expect(lustrians.length).toBeGreaterThan(0);

        // Check specific lustrian star players
        const anqi = availablePlayers.find(sp => sp.slug === 'anqi_panqi');
        expect(anqi).toBeDefined();

        const boa = availablePlayers.find(sp => sp.slug === 'boa_konssstriktr');
        expect(boa).toBeDefined();
      });

      it('les équipes undead S3 ne devraient PAS avoir accès à Hakflem (A16, PDF 2025)', () => {
        const availablePlayers = getAvailableStarPlayers('undead', [], 'season_3');
        const hakflem = availablePlayers.find(sp => sp.slug === 'hakflem_skuttlespike');
        expect(hakflem).toBeUndefined();
      });

      it('les équipes undead S2 ne devraient PAS avoir accès à Hakflem', () => {
        const availablePlayers = getAvailableStarPlayers('undead', [], 'season_2');
        const hakflem = availablePlayers.find(sp => sp.slug === 'hakflem_skuttlespike');
        expect(hakflem).toBeUndefined();
      });
    });

    describe('getStarPlayerBySlug avec ruleset', () => {
      it('devrait retourner le star player S3 quand ruleset=season_3', () => {
        const s3Glart = getStarPlayerBySlug('glart_smashrip', 'season_3');
        expect(s3Glart).toBeDefined();
        expect(s3Glart?.displayName).toBe('Glart Smashrip');
      });

      it('devrait retourner le star player S2 quand ruleset=season_2', () => {
        const s2Glart = getStarPlayerBySlug('glart_smashrip', 'season_2');
        expect(s2Glart).toBeDefined();
        expect(s2Glart?.displayName).toBe('Glart Smashrip');
      });
    });
  });
});

