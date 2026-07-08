/**
 * FR4 — non-régression : les options "extérieur" excluent l'équipe à domicile
 * pour éviter une équipe qui se rencontre elle-même lors de la saisie manuelle.
 */
import { describe, it, expect } from "vitest";
import { awayOptions } from "./ManualScheduleEditor";

describe("awayOptions", () => {
  const participants = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("exclut l'équipe à domicile", () => {
    expect(awayOptions(participants, "b").map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("renvoie tout si aucune équipe à domicile sélectionnée", () => {
    expect(awayOptions(participants, "").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

// A54 — saison à poules : pas de match inter-poules en saisie manuelle.
describe("awayOptions (poules, A54)", () => {
  const pooled = [
    { id: "a", poolId: "pool1" },
    { id: "b", poolId: "pool1" },
    { id: "c", poolId: "pool2" },
    { id: "d", poolId: null },
  ];

  it("restreint l'extérieur à la poule de l'équipe à domicile", () => {
    expect(awayOptions(pooled, "a").map((p) => p.id)).toEqual(["b"]);
    expect(awayOptions(pooled, "c").map((p) => p.id)).toEqual([]);
    // Sans poule (null) : seules les autres équipes sans poule.
    expect(awayOptions(pooled, "d").map((p) => p.id)).toEqual([]);
  });
});
