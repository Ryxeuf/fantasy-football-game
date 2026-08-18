import { describe, it, expect } from 'vitest';
import {
  STAR_PLAYER_KEYWORDS,
  STAR_PLAYER_LINEAGE_KEYWORDS,
  STAR_PLAYER_ROLE_KEYWORDS,
  getStarPlayerKeywords,
} from './star-player-keywords';
import { STAR_PLAYERS_BY_RULESET, STAR_PLAYERS } from './star-players';
import { translateKeywordsCsv } from './keyword-translations';
import { RULESETS } from './positions';

const LINEAGES = new Set<string>(STAR_PLAYER_LINEAGE_KEYWORDS);
const ROLES = new Set<string>(STAR_PLAYER_ROLE_KEYWORDS);

describe('STAR_PLAYER_KEYWORDS', () => {
  it('couvre tous les Star Players de tous les rulesets', () => {
    for (const ruleset of RULESETS) {
      const missing = Object.keys(STAR_PLAYERS_BY_RULESET[ruleset]).filter(
        slug => !STAR_PLAYER_KEYWORDS[slug]
      );
      expect(missing, `slugs sans mots-clés (${ruleset})`).toEqual([]);
    }
  });

  it('ne contient pas de slug orphelin (absent des Star Players)', () => {
    const known = new Set(Object.keys(STAR_PLAYERS_BY_RULESET.season_2));
    for (const slug of Object.keys(STAR_PLAYERS_BY_RULESET.season_3)) {
      known.add(slug);
    }
    const orphans = Object.keys(STAR_PLAYER_KEYWORDS).filter(slug => !known.has(slug));
    expect(orphans).toEqual([]);
  });

  it("n'utilise que le vocabulaire officiel : lignée(s) puis type de joueur", () => {
    for (const [slug, csv] of Object.entries(STAR_PLAYER_KEYWORDS)) {
      const tokens = csv.split(',').map(t => t.trim());
      expect(tokens.length, `${slug} : au moins lignée + type`).toBeGreaterThanOrEqual(2);
      // Aucun token vide ni doublon.
      expect(
        tokens.every(t => t.length > 0),
        `${slug} : token vide`
      ).toBe(true);
      expect(new Set(tokens).size, `${slug} : doublon`).toBe(tokens.length);

      const last = tokens[tokens.length - 1];
      // Le dernier token est toujours un type de joueur…
      expect(ROLES.has(last), `${slug} : type de joueur inconnu « ${last} »`).toBe(true);
      // …et tous les précédents sont des lignées, sauf le cas des « Gros Bras »
      // qui cumulent un type de gabarit et une spécialité (ex: Kreek).
      for (const token of tokens.slice(0, -1)) {
        expect(
          LINEAGES.has(token) || ROLES.has(token),
          `${slug} : mot-clé inconnu « ${token} »`
        ).toBe(true);
      }
      expect(LINEAGES.has(tokens[0]), `${slug} : lignée inconnue « ${tokens[0]} »`).toBe(true);
    }
  });

  it('formate le CSV comme les mots-clés de position (« A, B »)', () => {
    for (const [slug, csv] of Object.entries(STAR_PLAYER_KEYWORDS)) {
      expect(csv, `${slug}`).toBe(
        csv
          .split(',')
          .map(t => t.trim())
          .join(', ')
      );
    }
  });

  it('expose chaque mot-clé traduisible en anglais', () => {
    for (const [slug, csv] of Object.entries(STAR_PLAYER_KEYWORDS)) {
      const en = translateKeywordsCsv(csv, 'en');
      expect(en, `${slug}`).not.toBeNull();
      // Aucun token FR ne doit rester tel quel pour les lignées accentuées :
      // la traduction doit au minimum produire une chaîne non vide par token.
      expect((en as string).split(',').length).toBe(csv.split(',').length);
    }
    expect(translateKeywordsCsv('Humain, Blitzer', 'en')).toBe('Human, Blitzer');
    expect(translateKeywordsCsv('Zoat, Gros Bras', 'en')).toBe('Zoat, Big Guy');
    expect(translateKeywordsCsv('Humain, Blitzer', 'fr')).toBe('Humain, Blitzer');
  });

  it('getStarPlayerKeywords renvoie le CSV ou null', () => {
    expect(getStarPlayerKeywords('griff_oberwald')).toBe('Humain, Blitzer');
    expect(getStarPlayerKeywords('inconnu_xyz')).toBeNull();
  });
});

describe('StarPlayerDefinition.keywords', () => {
  it('est renseigné sur chaque star player, dans les deux rulesets', () => {
    for (const ruleset of RULESETS) {
      for (const [slug, player] of Object.entries(STAR_PLAYERS_BY_RULESET[ruleset])) {
        expect(player.keywords, `${ruleset}/${slug}`).toBe(STAR_PLAYER_KEYWORDS[slug]);
      }
    }
  });

  it("reste cohérent avec l'export par défaut STAR_PLAYERS", () => {
    expect(STAR_PLAYERS.morg_n_thorg.keywords).toBe('Ogre, Gros Bras');
    expect(STAR_PLAYERS.hakflem_skuttlespike.keywords).toBe('Skaven, Coureur');
  });
});
