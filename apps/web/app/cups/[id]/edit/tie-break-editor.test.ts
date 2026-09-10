import { describe, it, expect } from "vitest";
import { moveRule, toggleRule } from "./tie-break-editor";

describe("toggleRule", () => {
  it("ajoute un critère en queue", () => {
    expect(toggleRule(["points"], "cas_for")).toEqual(["points", "cas_for"]);
  });

  it("retire un critère déjà présent", () => {
    expect(toggleRule(["points", "cas_for"], "points")).toEqual(["cas_for"]);
  });

  it("ne mute pas la liste d'entrée", () => {
    const rules = ["points"];
    toggleRule(rules, "cas_for");
    expect(rules).toEqual(["points"]);
  });
});

describe("moveRule", () => {
  const RULES = ["points", "td_diff", "cas_for"];

  it("monte et descend un critère", () => {
    expect(moveRule(RULES, "td_diff", -1)).toEqual([
      "td_diff",
      "points",
      "cas_for",
    ]);
    expect(moveRule(RULES, "td_diff", 1)).toEqual([
      "points",
      "cas_for",
      "td_diff",
    ]);
  });

  it("ne fait rien aux bornes (pas de bouclage)", () => {
    expect(moveRule(RULES, "points", -1)).toEqual(RULES);
    expect(moveRule(RULES, "cas_for", 1)).toEqual(RULES);
  });

  it("ignore un critère absent", () => {
    expect(moveRule(RULES, "inconnu", 1)).toEqual(RULES);
  });

  it("ne mute pas la liste d'entrée", () => {
    const rules = [...RULES];
    moveRule(rules, "points", 1);
    expect(rules).toEqual(RULES);
  });
});
