/**
 * Manipulation de la liste ordonnée des critères de départage (PUR),
 * partagée par les coupes et les ligues.
 */

import { describe, it, expect } from "vitest";
import { moveRule, toggleRule } from "./tie-break-order";

describe("toggleRule", () => {
  it("ajoute en queue un critère absent", () => {
    expect(toggleRule(["points"], "cas_for")).toEqual(["points", "cas_for"]);
  });

  it("retire un critère déjà présent", () => {
    expect(toggleRule(["points", "cas_for"], "points")).toEqual(["cas_for"]);
  });

  it("ne mute jamais l'entrée", () => {
    const input = ["points"];
    toggleRule(input, "cas_for");
    expect(input).toEqual(["points"]);
  });
});

describe("moveRule", () => {
  it("monte un critère d'un rang", () => {
    expect(moveRule(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });

  it("descend un critère d'un rang", () => {
    expect(moveRule(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("ne fait rien au-delà des bornes (pas de wrap-around)", () => {
    expect(moveRule(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveRule(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });

  it("ne fait rien pour un critère absent", () => {
    expect(moveRule(["a", "b"], "z", -1)).toEqual(["a", "b"]);
  });

  it("ne mute jamais l'entrée", () => {
    const input = ["a", "b"];
    moveRule(input, "b", -1);
    expect(input).toEqual(["a", "b"]);
  });
});
