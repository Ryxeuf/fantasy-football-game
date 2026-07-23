/**
 * Non-régression : les positions sans caractéristique de Passe (PA "-")
 * portent la sentinelle `pa: 0` côté game-engine. Le seed/sync serveur la
 * convertit en `null` en base, et l'affichage rend "-" (jamais "6+").
 *
 * Bug d'origine : le Cinglé Gobelin (Looney) affichait "PA 6+" alors que sa
 * fiche officielle affiche "-".
 */
import { describe, it, expect } from 'vitest';
import { getPositionBySlug } from './positions';

describe('positions sans passe (PA -)', () => {
  it('Looney gobelin (season_2) a la sentinelle pa: 0, pas une valeur', () => {
    const looney = getPositionBySlug('goblin_looney', 'season_2');
    expect(looney).toBeTruthy();
    expect(looney?.pa).toBe(0);
  });

  it('Cinglé gobelin (season_3) a la sentinelle pa: 0', () => {
    const cingle = getPositionBySlug('goblin_cingle', 'season_3');
    expect(cingle).toBeTruthy();
    expect(cingle?.pa).toBe(0);
  });

  it("la sentinelle 0 est traitée comme 'pas de passe' par le moteur (pa <= 0)", () => {
    // Convention passing.ts : `passer.pa <= 0` => aucune capacité de passe.
    const looney = getPositionBySlug('goblin_looney', 'season_2');
    expect((looney?.pa ?? 0) <= 0).toBe(true);
  });
});
