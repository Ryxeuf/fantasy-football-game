import { describe, it, expect } from "vitest";
import {
  clampSelection,
  partitionCloneInducements,
  selectionCostK,
  toBuildRequest,
  withQuantity,
  type BuildInducementOption,
} from "./build-inducements";

const OPTIONS: BuildInducementOption[] = [
  { slug: "team_mascot", name: "Mascotte", cost: 25_000, maxQuantity: 1, description: "" },
  { slug: "bloodweiser_kegs", name: "Fûts", cost: 50_000, maxQuantity: 2, description: "" },
  { slug: "bribe", name: "Pots-de-vin", cost: 100_000, maxQuantity: 3, description: "" },
];

describe("clampSelection", () => {
  it("retire les slugs inconnus et borne au plafond", () => {
    expect(
      clampSelection({ team_mascot: 3, weather_mage: 1, bribe: 2 }, OPTIONS),
    ).toEqual({ team_mascot: 1, bribe: 2 });
  });

  it("une quantité nulle ou négative disparaît", () => {
    expect(clampSelection({ bribe: 0, team_mascot: -1 }, OPTIONS)).toEqual({});
  });

  it("changement de roster : la sélection se borne au nouveau catalogue", () => {
    const nouveau = OPTIONS.filter((o) => o.slug !== "bribe");
    expect(clampSelection({ bribe: 2, team_mascot: 1 }, nouveau)).toEqual({
      team_mascot: 1,
    });
  });

  it("plafond abaissé (Arme Secrète) : la quantité suit", () => {
    const capped = OPTIONS.map((o) =>
      o.slug === "bribe" ? { ...o, maxQuantity: 2 } : o,
    );
    expect(clampSelection({ bribe: 3 }, capped)).toEqual({ bribe: 2 });
  });
});

describe("withQuantity / selectionCostK / toBuildRequest", () => {
  it("totalise en kpo au prix servi", () => {
    let sel = withQuantity({}, "team_mascot", 1, OPTIONS);
    sel = withQuantity(sel, "bloodweiser_kegs", 2, OPTIONS);
    expect(selectionCostK(sel, OPTIONS)).toBe(125);
  });

  it("ne dépasse jamais le plafond", () => {
    expect(withQuantity({}, "bloodweiser_kegs", 5, OPTIONS)).toEqual({
      bloodweiser_kegs: 2,
    });
  });

  it("la requête ne porte aucun prix", () => {
    expect(toBuildRequest({ bribe: 2, team_mascot: 1 })).toEqual([
      { slug: "bribe", quantity: 2 },
      { slug: "team_mascot", quantity: 1 },
    ]);
  });
});

describe("partitionCloneInducements", () => {
  it("reprend ce que la coupe autorise, écarte le reste", () => {
    const out = partitionCloneInducements(
      [
        { slug: "team_mascot", name: "Mascotte", quantity: 1 },
        { slug: "weather_mage", name: "Mage Météo", quantity: 1 },
      ],
      OPTIONS,
    );
    expect(out.retained).toEqual({ team_mascot: 1 });
    expect(out.discarded).toEqual([
      { slug: "weather_mage", name: "Mage Météo", quantity: 1 },
    ]);
  });

  it("borne au plafond de la coupe", () => {
    const out = partitionCloneInducements(
      [{ slug: "bribe", quantity: 6 }],
      OPTIONS,
    );
    expect(out.retained).toEqual({ bribe: 3 });
  });
});
