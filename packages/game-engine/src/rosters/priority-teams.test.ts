import { describe, it, expect } from 'vitest';
import {
  PRIORITY_TEAM_ROSTERS,
  getStarPlayersHirableByPriorityTeams,
  type PriorityTeamRoster,
} from './priority-teams';
import { TEAM_ROSTERS_BY_RULESET, DEFAULT_RULESET } from './positions';

/**
 * P2.7 — Lister les star players hirables par les 5 equipes prioritaires.
 *
 * Ces tests figent la liste des star players disponibles pour chaque equipe
 * du MVP (Skaven, Gnomes, Hommes-Lezards, Nains, Noblesse Imperiale) afin que
 * les taches de contenu aval (P2.8, P2.9, P2.10) puissent s'appuyer dessus.
 */
describe('P2.7 — Star players hirables par equipe prioritaire', () => {
  describe('PRIORITY_TEAM_ROSTERS', () => {
    it('contient exactement les 5 equipes du MVP', () => {
      expect(PRIORITY_TEAM_ROSTERS).toHaveLength(5);
      expect(PRIORITY_TEAM_ROSTERS).toEqual([
        'skaven',
        'gnome',
        'lizardmen',
        'dwarf',
        'imperial_nobility',
      ]);
    });

    it('chaque slug correspond a un roster existant dans le ruleset par defaut', () => {
      const rosters = TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
      for (const slug of PRIORITY_TEAM_ROSTERS) {
        expect(rosters[slug]).toBeDefined();
      }
    });
  });

  describe('getStarPlayersHirableByPriorityTeams (season_2)', () => {
    const map = getStarPlayersHirableByPriorityTeams('season_2');

    it('retourne une entree pour chacune des 5 equipes', () => {
      const keys = Object.keys(map).sort();
      expect(keys).toEqual([...PRIORITY_TEAM_ROSTERS].sort());
    });

    it('chaque equipe a au moins les star players universels ("all")', () => {
      const universalSlugs = [
        'helmut_wulf',
        'morg_n_thorg',
        'grashnak_blackhoof',
        'lord_borak',
      ];
      for (const roster of PRIORITY_TEAM_ROSTERS) {
        const slugs = map[roster].map((sp) => sp.slug);
        for (const universal of universalSlugs) {
          expect(slugs, `${roster} devrait hirer ${universal}`).toContain(
            universal,
          );
        }
      }
    });

    it('Skaven hire les stars Underworld Challenge', () => {
      const slugs = map.skaven.map((sp) => sp.slug);
      expect(slugs).toContain('hakflem_skuttlespike');
      expect(slugs).toContain('glart_smashrip');
      expect(slugs).toContain('skitter_stab_stab');
      expect(slugs).toContain('varag_ghoul_chewer');
      // Ne doit PAS hirer les stars Elven Kingdoms League exclusives
      expect(slugs).not.toContain('eldril_sidewinder');
      expect(slugs).not.toContain('roxanna_darknail');
    });

    it('Hommes-Lezards hire les stars Lustrian Superleague', () => {
      const slugs = map.lizardmen.map((sp) => sp.slug);
      expect(slugs).toContain('anqi_panqi');
      expect(slugs).toContain('boa_konssstriktr');
      expect(slugs).toContain('mighty_zug');
      expect(slugs).toContain('zolcath_the_zoat');
      expect(slugs).not.toContain('hakflem_skuttlespike');
    });

    it('Nains hirent les stars Old World Classic', () => {
      const slugs = map.dwarf.map((sp) => sp.slug);
      expect(slugs).toContain('grim_ironjaw');
      expect(slugs).toContain('grombrindal');
      expect(slugs).toContain('barik_farblast');
      expect(slugs).toContain('deeproot_strongbranch');
      expect(slugs).not.toContain('hakflem_skuttlespike');
    });

    it('Noblesse Imperiale hire les stars Old World Classic', () => {
      const slugs = map.imperial_nobility.map((sp) => sp.slug);
      expect(slugs).toContain('griff_oberwald');
      expect(slugs).toContain('grim_ironjaw');
      expect(slugs).toContain('mighty_zug');
      expect(slugs).not.toContain('anqi_panqi');
    });

    it('Gnomes ont acces au moins aux star players "all"', () => {
      const slugs = map.gnome.map((sp) => sp.slug);
      expect(slugs.length).toBeGreaterThan(0);
      expect(slugs).toContain('helmut_wulf');
      expect(slugs).toContain('morg_n_thorg');
    });

    it('chaque liste est immuable — un nouvel appel retourne une nouvelle reference', () => {
      const first = getStarPlayersHirableByPriorityTeams('season_2');
      const second = getStarPlayersHirableByPriorityTeams('season_2');
      expect(first).not.toBe(second);
      expect(first.skaven).not.toBe(second.skaven);
    });
  });

  describe('getStarPlayersHirableByPriorityTeams (season_3)', () => {
    it('inclut la nouvelle eligibilite de Hakflem en Sylvanian Spotlight (S3)', () => {
      const s3Map = getStarPlayersHirableByPriorityTeams('season_3');
      const skavenSlugs = s3Map.skaven.map((sp) => sp.slug);
      // Hakflem reste disponible aux Skavens via underworld_challenge
      expect(skavenSlugs).toContain('hakflem_skuttlespike');
    });

    it('fonctionne avec le ruleset par defaut quand omis', () => {
      const defaultMap = getStarPlayersHirableByPriorityTeams();
      const s2Map = getStarPlayersHirableByPriorityTeams('season_2');
      expect(Object.keys(defaultMap)).toEqual(Object.keys(s2Map));
    });
  });

  describe('Invariants structurels', () => {
    it('aucun star player hirable ne doit apparaitre en doublon dans une meme equipe', () => {
      const map = getStarPlayersHirableByPriorityTeams('season_2');
      for (const roster of PRIORITY_TEAM_ROSTERS) {
        const slugs = map[roster].map((sp) => sp.slug);
        const unique = new Set(slugs);
        expect(unique.size).toBe(slugs.length);
      }
    });

    it('chaque star player retourne expose bien un flag hirableBy non vide', () => {
      const map = getStarPlayersHirableByPriorityTeams('season_2');
      for (const roster of PRIORITY_TEAM_ROSTERS) {
        for (const sp of map[roster]) {
          expect(sp.hirableBy.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
