/**
 * Règlement de tournoi ↔ Star Players d'une équipe déjà créée. La décision
 * est pure : elle se teste sans base, sur les deux packs du registre.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../prisma', () => ({ prisma: {} }));

import { NAF_WORLD_CUP_2027, NAF_WORLD_CUP_2027_V3 } from '@bb/game-engine';
import {
  decidePackStarChange,
  packStarBlockReason,
  type PackStarChangeInput,
} from './tournament-star-player-rules';

const FUNGUS = { slug: 'fungus_the_loon', cost: 80_000 };
const SCRAPPA = { slug: 'scrappa_sorehead', cost: 130_000 };
const PRICEY = { slug: 'grashnak_blackhoof', cost: 240_000 };

/** Ogres V3.0 : 72 SPP, 2 cumuls, Star Players autorisés. */
function input(over: Partial<PackStarChangeInput> = {}): PackStarChangeInput {
  return {
    pack: NAF_WORLD_CUP_2027_V3,
    rosterSlug: 'ogre',
    regularPlayerCount: 11,
    currentStars: [],
    nextStars: [FUNGUS],
    startingPspPool: 72,
    poolSpent: 0,
    doubledPlayers: 0,
    ...over,
  };
}

describe('decidePackStarChange — recrutement', () => {
  it('accepte et prélève la taxe de la première tranche (18 SPP)', () => {
    expect(decidePackStarChange(input())).toEqual({ ok: true, nextPool: 54 });
  });

  it("ne prélève que l'ÉCART de taxe quand un Star Player est déjà là", () => {
    // 80 kpo (18) → 210 kpo (24) : 6 SPP de plus sur un pool déjà taxé.
    expect(
      decidePackStarChange(
        input({
          currentStars: [FUNGUS],
          nextStars: [FUNGUS, SCRAPPA],
          startingPspPool: 54,
        }),
      ),
    ).toEqual({ ok: true, nextPool: 48 });
  });

  it('passe à la dernière tranche au-delà de 300 kpo', () => {
    expect(
      decidePackStarChange(
        input({
          currentStars: [FUNGUS],
          nextStars: [FUNGUS, PRICEY],
          startingPspPool: 54,
        }),
      ),
    ).toEqual({ ok: true, nextPool: 40 });
  });

  it('refuse un roster sans droit aux Star Players (orc, colonne 52 SPP)', () => {
    const res = decidePackStarChange(input({ rosterSlug: 'orc', startingPspPool: 52 }));
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? '' : res.error).toMatch(/n'autorise pas les Star Players/);
  });

  it('refuse un Star Player banni', () => {
    const res = decidePackStarChange(
      input({ nextStars: [{ slug: 'morg_n_thorg', cost: 340_000 }] }),
    );
    expect(res.ok ? '' : res.error).toMatch(/morg_n_thorg/);
  });

  it("refuse sous l'effectif régulier minimum", () => {
    const res = decidePackStarChange(input({ regularPlayerCount: 10 }));
    expect(res.ok ? '' : res.error).toMatch(/11 joueurs réguliers/);
  });

  it('refuse quand les compétences déjà achetées ne laissent pas de quoi payer la taxe', () => {
    const res = decidePackStarChange(input({ poolSpent: 60 }));
    expect(res.ok ? '' : res.error).toMatch(/taxe Star Players/);
    // À la limite exacte, ça passe.
    expect(decidePackStarChange(input({ poolSpent: 54 }))).toEqual({
      ok: true,
      nextPool: 54,
    });
  });

  it('refuse quand le Star Player retirerait un cumul déjà utilisé (V3.0)', () => {
    const res = decidePackStarChange(input({ doubledPlayers: 2 }));
    expect(res.ok ? '' : res.error).toMatch(/Star Player recruté retire un cumul/);
    expect(decidePackStarChange(input({ doubledPlayers: 1 })).ok).toBe(true);
  });

  it('V2.1 : un Star Player ne retire aucun cumul', () => {
    expect(
      decidePackStarChange(
        input({
          pack: NAF_WORLD_CUP_2027,
          startingPspPool: 66,
          doubledPlayers: 2,
        }),
      ),
    ).toEqual({ ok: true, nextPool: 48 });
  });

  it("refuse un Star Player à Arme Secrète quand l'équipe a plus de 2 Pots-de-vin", () => {
    const secret = { ...FUNGUS, secretWeapon: true };
    const res = decidePackStarChange(
      input({ nextStars: [secret], inducements: new Map([['bribe', 3]]) }),
    );
    expect(res.ok ? '' : res.error).toMatch(/bribe/);
    expect(
      decidePackStarChange(
        input({ nextStars: [secret], inducements: new Map([['bribe', 2]]) }),
      ).ok,
    ).toBe(true);
    // Sans Arme Secrète, le plafond conditionnel ne joue pas.
    expect(
      decidePackStarChange(input({ inducements: new Map([['bribe', 3]]) })).ok,
    ).toBe(true);
  });

  it("ne contraint pas un roster que le règlement ne liste pas", () => {
    expect(
      decidePackStarChange(input({ rosterSlug: 'inconnu', startingPspPool: 30 })),
    ).toEqual({ ok: true, nextPool: 30 });
  });
});

describe('decidePackStarChange — renvoi', () => {
  it('rend la taxe entière au dernier Star Player renvoyé', () => {
    expect(
      decidePackStarChange(
        input({ currentStars: [FUNGUS], nextStars: [], startingPspPool: 54 }),
      ),
    ).toEqual({ ok: true, nextPool: 72 });
  });

  it("rend l'écart de tranche", () => {
    expect(
      decidePackStarChange(
        input({
          currentStars: [FUNGUS, SCRAPPA],
          nextStars: [FUNGUS],
          startingPspPool: 48,
        }),
      ),
    ).toEqual({ ok: true, nextPool: 54 });
  });

  it("n'est jamais refusé, même sur un roster sans droit ou un banni restant", () => {
    expect(
      decidePackStarChange(
        input({
          rosterSlug: 'orc',
          regularPlayerCount: 5,
          currentStars: [{ slug: 'morg_n_thorg', cost: 340_000 }, FUNGUS],
          nextStars: [{ slug: 'morg_n_thorg', cost: 340_000 }],
          startingPspPool: 20,
          poolSpent: 20,
        }),
      ).ok,
    ).toBe(true);
  });
});

describe('packStarBlockReason', () => {
  it('null sans règlement ou pour un Star Player permis', () => {
    expect(packStarBlockReason(null, 'ogre', 'morg_n_thorg')).toBeNull();
    expect(
      packStarBlockReason(NAF_WORLD_CUP_2027_V3, 'ogre', 'fungus_the_loon'),
    ).toBeNull();
  });

  it('nomme le bannissement et le roster fermé', () => {
    expect(
      packStarBlockReason(NAF_WORLD_CUP_2027_V3, 'ogre', 'glotl_stop'),
    ).toMatch(/interdit/);
    expect(
      packStarBlockReason(NAF_WORLD_CUP_2027_V3, 'orc', 'fungus_the_loon'),
    ).toMatch(/n'autorise pas/);
  });
});
