import { describe, it, expect } from 'vitest';
import {
  advancementPspCost,
  poolSpentForPlayer,
  poolSpentForTeam,
  poolRemaining,
  parseAdvancements,
  type FallbackPspCost,
} from './build-psp-pool';

describe('advancementPspCost', () => {
  it('utilise le coût persisté quand il existe', () => {
    expect(advancementPspCost({ type: 'primary', pspCost: 3 }, 0)).toBe(3);
    // Un règlement de tournoi peut facturer autre chose que le barème
    // standard : c'est le coût persisté qui fait foi, pas le rang.
    expect(advancementPspCost({ type: 'secondary', pspCost: 18 }, 0)).toBe(18);
  });

  it('retombe sur le barème standard pour les enregistrements historiques', () => {
    expect(advancementPspCost({ type: 'primary' }, 0)).toBe(6);
    expect(advancementPspCost({ type: 'primary' }, 1)).toBe(8);
    expect(advancementPspCost({ type: 'secondary' }, 0)).toBe(10);
    expect(advancementPspCost({ type: 'random-primary' }, 0)).toBe(3);
    expect(advancementPspCost({ type: 'characteristic' }, 0)).toBe(14);
  });

  it('sature au 6e palier et ignore les types inconnus', () => {
    expect(advancementPspCost({ type: 'primary' }, 42)).toBe(30);
    expect(advancementPspCost({ type: 'random-secondary' }, 0)).toBe(0);
  });
});

describe('poolSpentForPlayer', () => {
  it('additionne les avancements financés par le pool', () => {
    expect(
      poolSpentForPlayer([
        { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        { type: 'primary', pspCost: 8, fundedBy: 'pool' },
      ]),
    ).toBe(14);
  });

  it('exclut les avancements payés sur les SPP du joueur', () => {
    expect(
      poolSpentForPlayer([
        { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        { type: 'primary', pspCost: 8, fundedBy: 'player' },
      ]),
    ).toBe(6);
  });

  it('compte un avancement historique (sans source) comme financé par le pool', () => {
    expect(poolSpentForPlayer([{ type: 'primary' }, { type: 'primary' }])).toBe(
      14,
    );
  });
});

describe('poolSpentForTeam / poolRemaining', () => {
  it('somme les joueurs et borne le reste à 0', () => {
    const spent = poolSpentForTeam([
      [{ type: 'primary', pspCost: 6, fundedBy: 'pool' }],
      [{ type: 'secondary', pspCost: 10, fundedBy: 'pool' }],
      [],
    ]);
    expect(spent).toBe(16);
    expect(poolRemaining(20, spent)).toBe(4);
    expect(poolRemaining(10, spent)).toBe(0);
  });
});

describe('parseAdvancements', () => {
  it('accepte la chaîne JSON (sqlite) et le tableau natif (PostgreSQL)', () => {
    const raw = [{ type: 'primary', pspCost: 6 }];
    expect(parseAdvancements(JSON.stringify(raw))).toEqual(raw);
    expect(parseAdvancements(raw)).toEqual(raw);
  });

  it('renvoie [] sur du JSON invalide, null ou une forme inattendue', () => {
    expect(parseAdvancements('pas du json')).toEqual([]);
    expect(parseAdvancements(null)).toEqual([]);
    expect(parseAdvancements(undefined)).toEqual([]);
    expect(parseAdvancements({ type: 'primary' })).toEqual([]);
  });

  it('filtre les entrées sans type', () => {
    expect(parseAdvancements([{ foo: 1 }, { type: 'primary' }])).toEqual([
      { type: 'primary' },
    ]);
  });
});

/**
 * Barème de repli injectable — rattrapage à la LECTURE des améliorations
 * écrites avant que `pspCost` ne soit persisté.
 *
 * `prisma/migrations/` est gitignoré (prod = `db push`) : ces lignes ne
 * peuvent pas être backfillées. Sous un règlement de tournoi, le barème
 * standard les sous-compte — cas prod Ogres NAF WC 2027 : 54 PSP affichés
 * pour 66 réellement dépensés, donc 12 PSP fantômes réputés disponibles.
 */
describe("poolSpentForTeam — barème de repli injectable", () => {
  /** Barème NAF WC 2027 : 6/8 primaire, 10/12 secondaire, +2 si Élite. */
  const NAF_ELITE = new Set(["guard", "block"]);
  const nafCost: FallbackPspCost = (adv, index) => {
    const base =
      index <= 0
        ? adv.type === "primary"
          ? 6
          : 10
        : adv.type === "primary"
          ? 8
          : 12;
    const slug = (adv as { skillSlug?: string }).skillSlug;
    return base + (slug && NAF_ELITE.has(slug) ? 2 : 0);
  };

  it("applique le barème standard par défaut", () => {
    const spent = poolSpentForTeam([
      [
        { type: "primary", skillSlug: "guard" },
        { type: "secondary", skillSlug: "block" },
      ],
    ]);

    // Barème standard indexé par rang : 6 puis 12.
    expect(spent).toBe(18);
  });

  it("applique le barème du règlement quand il est injecté", () => {
    const spent = poolSpentForTeam(
      [
        [
          { type: "primary", skillSlug: "guard" },
          { type: "secondary", skillSlug: "block" },
        ],
      ],
      nafCost,
    );

    // Garde primaire Élite = 6 + 2 ; Blocage secondaire Élite = 12 + 2.
    expect(spent).toBe(22);
  });

  it("reconstitue les 66 PSP de l'équipe Ogre remontée (54 avec le barème standard)", () => {
    // 1 Ogre à 2 compétences Élite (8 + 14), 4 Ogres Garde Élite (8),
    // 1 Bagarreur non Élite (6), 1 Joueur Déloyal non Élite (6).
    const team = [
      [
        { type: "primary", skillSlug: "guard" },
        { type: "secondary", skillSlug: "block" },
      ],
      ...Array.from({ length: 4 }, () => [
        { type: "primary", skillSlug: "guard" },
      ]),
      [{ type: "primary", skillSlug: "brawler" }],
      [{ type: "primary", skillSlug: "dirty-player" }],
    ];

    expect(poolSpentForTeam(team, nafCost)).toBe(66);
    // Le chiffre erroné qui s'affichait sur la fiche d'équipe.
    expect(poolSpentForTeam(team)).toBe(54);
  });

  it("préfère TOUJOURS le coût persisté au barème de repli", () => {
    const spent = poolSpentForTeam(
      [[{ type: "primary", skillSlug: "guard", pspCost: 8, fundedBy: "pool" }]],
      // Repli volontairement absurde : il ne doit jamais être consulté.
      () => 999,
    );

    expect(spent).toBe(8);
  });

  it("ignore les améliorations financées par les SPP du joueur", () => {
    const spent = poolSpentForTeam(
      [
        [
          { type: "primary", skillSlug: "guard", fundedBy: "player" },
          { type: "primary", skillSlug: "block", fundedBy: "pool" },
        ],
      ],
      nafCost,
    );

    // Seule la seconde compte, à son rang réel (index 1) : 8 + 2 d'Élite.
    expect(spent).toBe(10);
  });

  it("ne renvoie jamais un coût négatif depuis un repli fautif", () => {
    expect(
      poolSpentForTeam([[{ type: "primary" }]], () => -50),
    ).toBe(0);
  });
});
