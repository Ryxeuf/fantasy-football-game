import { describe, it, expect } from 'vitest';
import {
  PRIORITY_TEAM_ROSTERS,
  getStarPlayersHirableByPriorityTeams,
} from './priority-teams';
import type { StarPlayerDefinition } from './star-players';

/**
 * P2.9 — Images + descriptions FR/EN des star players hirables par les 5 equipes prioritaires.
 *
 * Garantit que chaque star player atteignable par une equipe MVP expose :
 *   - `imageUrl` non vide (illustration pour la page detail + metadonnees OpenGraph),
 *   - `specialRule` (francais) non vide,
 *   - `specialRuleEn` (anglais) non vide.
 *
 * Ces invariants bloquent toute regression de contenu et servent de socle a P2.10.
 */
function uniquePriorityStarPlayers(
  ruleset: 'season_2' | 'season_3',
): StarPlayerDefinition[] {
  const map = getStarPlayersHirableByPriorityTeams(ruleset);
  const seen = new Map<string, StarPlayerDefinition>();
  for (const team of PRIORITY_TEAM_ROSTERS) {
    for (const sp of map[team]) {
      if (!seen.has(sp.slug)) {
        seen.set(sp.slug, sp);
      }
    }
  }
  return [...seen.values()];
}

describe('P2.9 — Images + descriptions FR/EN pour les star players MVP', () => {
  const season2Stars = uniquePriorityStarPlayers('season_2');
  const season3Stars = uniquePriorityStarPlayers('season_3');

  it('retourne un ensemble non vide de star players pour les 5 equipes prioritaires', () => {
    expect(season2Stars.length).toBeGreaterThanOrEqual(30);
    expect(season3Stars.length).toBeGreaterThanOrEqual(30);
  });

  it.each(['season_2', 'season_3'] as const)(
    'chaque star player MVP (%s) expose une imageUrl non vide',
    (ruleset) => {
      const stars = uniquePriorityStarPlayers(ruleset);
      for (const sp of stars) {
        expect(sp.imageUrl, `${sp.slug} devrait avoir une image`).toBeTruthy();
        expect(sp.imageUrl?.trim().length ?? 0).toBeGreaterThan(0);
      }
    },
  );

  it.each(['season_2', 'season_3'] as const)(
    'chaque star player MVP (%s) expose une specialRule francaise non vide',
    (ruleset) => {
      const stars = uniquePriorityStarPlayers(ruleset);
      for (const sp of stars) {
        expect(sp.specialRule, `${sp.slug} devrait avoir une regle FR`).toBeTruthy();
        expect(sp.specialRule?.trim().length ?? 0).toBeGreaterThan(20);
      }
    },
  );

  it.each(['season_2', 'season_3'] as const)(
    'chaque star player MVP (%s) expose une specialRuleEn anglaise non vide',
    (ruleset) => {
      const stars = uniquePriorityStarPlayers(ruleset);
      for (const sp of stars) {
        expect(sp.specialRuleEn, `${sp.slug} devrait avoir une regle EN`).toBeTruthy();
        expect(sp.specialRuleEn?.trim().length ?? 0).toBeGreaterThan(20);
      }
    },
  );

  it('les regles FR et EN sont distinctes (pas de copie brute du francais)', () => {
    for (const sp of season2Stars) {
      if (sp.specialRule && sp.specialRuleEn) {
        expect(
          sp.specialRuleEn,
          `${sp.slug} ne devrait pas reutiliser la chaine FR comme EN`,
        ).not.toBe(sp.specialRule);
      }
    }
  });

  it('aucune regle EN ne doit contenir de caracteres francais typiques (é, è, à, ç) non escapes', () => {
    const frenchOnly = /[àâäçéèêëîïôöùûüÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ]/;
    for (const sp of season2Stars) {
      if (sp.specialRuleEn) {
        expect(
          frenchOnly.test(sp.specialRuleEn),
          `${sp.slug} a une regle EN qui semble contenir du francais`,
        ).toBe(false);
      }
    }
  });
});
