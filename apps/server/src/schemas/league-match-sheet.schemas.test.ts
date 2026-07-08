/**
 * A67/A68 — validation de `addEventSchema` : une Séquelle (stat_loss)
 * sans `meta.stat` valide était acceptée puis silencieusement droppée
 * à l'application sur le roster. Le schéma la refuse désormais.
 */

import { describe, it, expect } from "vitest";
import { addEventSchema } from "./league-match-sheet.schemas";

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
