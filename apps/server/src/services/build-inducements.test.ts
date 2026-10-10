import { describe, it, expect } from "vitest";
import { resolveBuildInducements } from "./build-inducements";

const CATALOGUE = [
  { slug: "team_mascot", name: "Mascotte", cost: 25_000, maxQuantity: 1 },
  { slug: "bloodweiser_kegs", name: "Fûts", cost: 50_000, maxQuantity: 2 },
  { slug: "bribe", name: "Pots-de-vin", cost: 50_000, maxQuantity: 6 },
];

describe("resolveBuildInducements", () => {
  it("rien demandé : rien à payer", () => {
    expect(resolveBuildInducements([], CATALOGUE)).toEqual({
      ok: true,
      lines: [],
      totalCost: 0,
    });
  });

  it("facture au prix du catalogue et somme les lignes", () => {
    const out = resolveBuildInducements(
      [
        { slug: "team_mascot", quantity: 1 },
        { slug: "bloodweiser_kegs", quantity: 2 },
      ],
      CATALOGUE,
    );
    expect(out).toEqual({
      ok: true,
      lines: [
        { slug: "team_mascot", name: "Mascotte", quantity: 1, unitCost: 25_000 },
        { slug: "bloodweiser_kegs", name: "Fûts", quantity: 2, unitCost: 50_000 },
      ],
      totalCost: 125_000,
    });
  });

  it("un prix envoyé par le client est ignoré", () => {
    const out = resolveBuildInducements(
      [{ slug: "team_mascot", quantity: 1, cost: 0 } as never],
      CATALOGUE,
    );
    expect(out.ok && out.totalCost).toBe(25_000);
  });

  it("refuse un coup de pouce hors catalogue effectif", () => {
    const out = resolveBuildInducements(
      [{ slug: "weather_mage", quantity: 1 }],
      CATALOGUE,
    );
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/weather_mage/);
  });

  it("refuse une quantité au-delà du plafond", () => {
    const out = resolveBuildInducements(
      [{ slug: "bloodweiser_kegs", quantity: 3 }],
      CATALOGUE,
    );
    expect(!out.ok && out.error).toMatch(/2 au plus/);
  });

  it("refuse une quantité nulle ou non entière", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(
        resolveBuildInducements([{ slug: "bribe", quantity }], CATALOGUE).ok,
      ).toBe(false);
    }
  });

  it("refuse un doublon", () => {
    const out = resolveBuildInducements(
      [
        { slug: "bribe", quantity: 1 },
        { slug: "bribe", quantity: 1 },
      ],
      CATALOGUE,
    );
    expect(!out.ok && out.error).toMatch(/deux fois/);
  });
});
