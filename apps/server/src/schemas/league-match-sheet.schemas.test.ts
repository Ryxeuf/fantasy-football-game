/**
 * A67/A68 — validation de `addEventSchema` : une Séquelle (stat_loss)
 * sans `meta.stat` valide était acceptée puis silencieusement droppée
 * à l'application sur le roster. Le schéma la refuse désormais.
 */

import { describe, it, expect } from "vitest";
import { addEventSchema, preMatchSchema } from "./league-match-sheet.schemas";

describe("A67/A68 — addEventSchema stat_loss", () => {
  const base = {
    kind: "casualty" as const,
    team: "home" as const,
    actorPlayerId: "h1",
    targetPlayerId: "a1",
  };

  it("refuse stat_loss sans meta.stat", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "stat_loss",
    });
    expect(res.success).toBe(false);
  });

  it("refuse stat_loss avec meta.stat invalide", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "stat_loss",
      meta: { stat: "xx" },
    });
    expect(res.success).toBe(false);
  });

  it("accepte stat_loss avec meta.stat parmi ma/st/ag/pa/av", () => {
    for (const stat of ["ma", "st", "ag", "pa", "av"]) {
      const res = addEventSchema.safeParse({
        ...base,
        injurySeverity: "stat_loss",
        meta: { stat },
      });
      expect(res.success).toBe(true);
    }
  });

  it("accepte les autres gravités sans meta", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "mng",
    });
    expect(res.success).toBe(true);
  });
});

describe("Prières à Nuffle — preMatchSchema.prayers*", () => {
  it("accepte une liste de jets de D16 valides (avec ou sans prayerId)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [
        { roll: 3, prayerId: "stiletto" },
        { roll: 16 },
      ],
      prayersAway: [],
    });
    expect(res.success).toBe(true);
  });

  it("refuse un jet hors 1-16", () => {
    for (const roll of [0, 17]) {
      const res = preMatchSchema.safeParse({ prayersHome: [{ roll }] });
      expect(res.success).toBe(false);
    }
  });

  it("refuse plus de 3 prières par équipe (coup de pouce 0-3)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [{ roll: 1 }, { roll: 2 }, { roll: 3 }, { roll: 4 }],
    });
    expect(res.success).toBe(false);
  });

  it("refuse un doublon de jet (relancé à la table)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [{ roll: 5 }, { roll: 5 }],
    });
    expect(res.success).toBe(false);
  });

  it("tolère null / absent (rétro-compat)", () => {
    expect(preMatchSchema.safeParse({ prayersHome: null }).success).toBe(true);
    expect(preMatchSchema.safeParse({ weather: "Pluie" }).success).toBe(true);
  });
});

describe("Toss — preMatchSchema.tossWinner/tossChoice", () => {
  it("accepte un vainqueur et un choix valides", () => {
    const res = preMatchSchema.safeParse({
      tossWinner: "home",
      tossChoice: "receive",
    });
    expect(res.success).toBe(true);
  });

  it("refuse un côté ou un choix hors enum", () => {
    expect(preMatchSchema.safeParse({ tossWinner: "middle" }).success).toBe(
      false,
    );
    expect(preMatchSchema.safeParse({ tossChoice: "flip" }).success).toBe(
      false,
    );
  });

  it("tolère null / absent (rétro-compat)", () => {
    expect(
      preMatchSchema.safeParse({ tossWinner: null, tossChoice: null }).success,
    ).toBe(true);
  });
});
