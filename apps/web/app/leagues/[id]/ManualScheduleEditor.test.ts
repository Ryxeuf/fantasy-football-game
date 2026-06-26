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
