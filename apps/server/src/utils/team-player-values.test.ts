/**
 * `computePlayerValuesFor` — valeur de CHAQUE joueur, servie à la colonne
 * « Coût » de la fiche d'équipe.
 *
 * Régression couverte : la fiche affichait le tarif de recrue du poste. Un
 * Bloqueur Ogre à 140k augmenté de deux compétences y restait à 140k, alors
 * qu'il pesait 230k dans la VE affichée juste au-dessus — d'où « les joueurs
 * ont été augmentés, pourquoi leur valeur ne change pas ? ».
 *
 * La valeur doit sortir de la MÊME résolution que la VE : coûts de poste en
 * base, surcoût Élite compris.
 */

import { describe, it, expect, vi } from "vitest";
import { computePlayerValuesFor, computeTeamValueBreakdownFor } from "./team-values";

/** Trois-quart Gnoblar (0-16, 15k) et Bloqueur Ogre (0-6, 140k). */
const OGRE_POSITIONS = [
  { slug: "ogre_trois_quart_gnoblar", cost: 15, max: 16 },
  { slug: "ogre_bloqueur", cost: 140, max: 6 },
];

const OGRE_TEAM = {
  roster: "ogre",
  ruleset: "season_3",
  format: "bb11",
  rerolls: 0,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
};

function player(
  id: string,
  position: string,
  advancements: unknown[] = [],
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    position,
    advancements: JSON.stringify(advancements),
    dead: false,
    firedAt: null,
    missNextMatch: false,
    ...overrides,
  };
}

/** Client Prisma étroit : positions en base + compétences Élite. */
function db(elite: string[] = [], specialRules: string | null = null) {
  return {
    skill: {
      findMany: vi.fn().mockResolvedValue(elite.map((slug) => ({ slug }))),
    },
    roster: {
      findUnique: vi.fn().mockResolvedValue({ id: "r-ogre", specialRules }),
    },
    rosterStaffConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    position: { findMany: vi.fn().mockResolvedValue(OGRE_POSITIONS) },
    advancementCost: { findMany: vi.fn().mockResolvedValue([]) },
    characteristicValue: { findMany: vi.fn().mockResolvedValue([]) },
    rulesetConfig: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown;
}

describe("computePlayerValuesFor", () => {
  it("ajoute les surcoûts d'avancement au coût d'embauche", async () => {
    const values = await computePlayerValuesFor(db(), OGRE_TEAM, [
      player("p1", "ogre_bloqueur", [
        { type: "primary", skillSlug: "guard" },
        { type: "secondary", skillSlug: "block" },
      ]),
      player("p2", "ogre_bloqueur"),
    ]);

    // Surcoûts de VE Saison 3 : primaire +20k, secondaire +40k.
    expect(values.p1.hireCost).toBe(140_000);
    expect(values.p1.advancementsCost).toBe(60_000);
    expect(values.p1.value).toBe(200_000);
    // Un joueur sans amélioration reste à son tarif d'embauche.
    expect(values.p2).toEqual({
      hireCost: 140_000,
      advancementsCost: 0,
      value: 140_000,
      lineman: false,
    });
  });

  it("compte le surcoût Élite comme la VE", async () => {
    const withElite = await computePlayerValuesFor(db(["guard"]), OGRE_TEAM, [
      player("p1", "ogre_bloqueur", [{ type: "primary", skillSlug: "guard" }]),
    ]);
    const withoutElite = await computePlayerValuesFor(db(), OGRE_TEAM, [
      player("p1", "ogre_bloqueur", [{ type: "primary", skillSlug: "guard" }]),
    ]);

    // Une primaire Élite vaut 30k au lieu de 20k.
    expect(withElite.p1.value).toBe(170_000);
    expect(withoutElite.p1.value).toBe(160_000);
  });

  it("reconnaît les Trois-quarts (base de « Trois-quarts à vil prix »)", async () => {
    const values = await computePlayerValuesFor(db(), OGRE_TEAM, [
      player("p1", "ogre_trois_quart_gnoblar"),
      player("p2", "ogre_bloqueur"),
    ]);

    expect(values.p1.lineman).toBe(true);
    expect(values.p2.lineman).toBe(false);
  });

  it("somme exactement la VE de l'équipe", async () => {
    const players = [
      player("p1", "ogre_bloqueur", [{ type: "primary", skillSlug: "guard" }]),
      player("p2", "ogre_bloqueur"),
      player("p3", "ogre_trois_quart_gnoblar", [
        { type: "primary", skillSlug: "dirty-player" },
      ]),
    ];
    const [values, breakdown] = await Promise.all([
      computePlayerValuesFor(db(["guard"]), OGRE_TEAM, players),
      computeTeamValueBreakdownFor(db(["guard"]), OGRE_TEAM, players),
    ]);

    const total = Object.values(values).reduce((s, v) => s + v.value, 0);
    expect(total).toBe(breakdown.playersCost);
    const hire = Object.values(values).reduce((s, v) => s + v.hireCost, 0);
    expect(hire).toBe(breakdown.playersHireCost);
  });

  it("exclut les joueurs morts et licenciés, comme la VE", async () => {
    const values = await computePlayerValuesFor(db(), OGRE_TEAM, [
      player("vivant", "ogre_bloqueur"),
      player("mort", "ogre_bloqueur", [], { dead: true }),
      player("licencie", "ogre_bloqueur", [], { firedAt: new Date() }),
    ]);

    expect(Object.keys(values)).toEqual(["vivant"]);
  });

  it("reste aligné sur la VE malgré des morts intercalés", async () => {
    // Garde-fou d'indexation : la valorisation travaille sur la liste
    // FILTRÉE, un décalage attribuerait la valeur du voisin.
    const players = [
      player("mort", "ogre_bloqueur", [], { dead: true }),
      player("gnoblar", "ogre_trois_quart_gnoblar"),
      player("ogre", "ogre_bloqueur"),
    ];
    const values = await computePlayerValuesFor(db(), OGRE_TEAM, players);

    expect(values.gnoblar.value).toBe(15_000);
    expect(values.ogre.value).toBe(140_000);
  });
});
