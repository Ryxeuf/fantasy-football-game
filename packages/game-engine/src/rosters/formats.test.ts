import { describe, it, expect } from "vitest";
import type { PositionDefinition } from "./positions";
import {
  FORMATS,
  DEFAULT_FORMAT,
  getFormatConstraints,
  isGameFormat,
  isLineman,
  isBigGuy,
  countNonLinemen,
  getSelectablePositions,
  validateFormatSelection,
} from "./formats";

const pos = (over: Partial<PositionDefinition>): PositionDefinition => ({
  slug: "x_lineman",
  displayName: "Lineman",
  cost: 50,
  min: 0,
  max: 16,
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 8,
  skills: "",
  ...over,
});

const lineman = pos({ slug: "human_lineman", max: 16, skills: "" });
const blitzer = pos({ slug: "human_blitzer", displayName: "Blitzer", max: 4, cost: 90, skills: "block" });
const ogre = pos({
  slug: "human_ogre",
  displayName: "Ogre",
  max: 1,
  cost: 140,
  st: 5,
  skills: "loner-4,bone-head,mighty-blow-1,thick-skull,throw-team-mate",
});

describe("formats — config", () => {
  it("expose bb11 et sevens", () => {
    expect(FORMATS).toEqual(["bb11", "sevens"]);
    expect(DEFAULT_FORMAT).toBe("bb11");
    expect(isGameFormat("sevens")).toBe(true);
    expect(isGameFormat("bb13")).toBe(false);
  });

  it("bb11 = budget 1000k, 11-16 joueurs, pas de limite non-linemen", () => {
    const c = getFormatConstraints("bb11");
    expect(c.startingBudget).toBe(1000);
    expect(c.minPlayers).toBe(11);
    expect(c.maxPlayers).toBe(16);
    expect(c.maxNonLinemen).toBeNull();
    expect(c.rerollCostMultiplier).toBe(1);
  });

  it("sevens = budget 600k, 7-11 joueurs, 4 non-linemen, relances ×2", () => {
    const c = getFormatConstraints("sevens");
    expect(c.startingBudget).toBe(600);
    expect(c.minPlayers).toBe(7);
    expect(c.maxPlayers).toBe(11);
    expect(c.maxNonLinemen).toBe(4);
    expect(c.maxRerolls).toBe(6);
    expect(c.rerollCostMultiplier).toBe(2);
    expect(c.maxCheerleaders).toBe(6);
    expect(c.cheerleaderCost).toBe(20);
    expect(c.maxAssistants).toBe(3);
    expect(c.assistantCost).toBe(20);
    expect(c.dedicatedFanCost).toBe(20);
    expect(c.apothecaryAllowed).toBe(true);
    expect(c.apothecaryCost).toBe(80);
    expect(c.bigGuysAllowed).toBe(true);
    expect(c.starPlayersAllowed).toBe(false);
  });

  it("getFormatConstraints retombe sur bb11 si format inconnu", () => {
    // @ts-expect-error test de robustesse runtime
    expect(getFormatConstraints("xxx").startingBudget).toBe(1000);
  });
});

describe("formats — détection postes", () => {
  it("isLineman : max >= 12", () => {
    expect(isLineman(lineman)).toBe(true);
    expect(isLineman(pos({ max: 12 }))).toBe(true);
    expect(isLineman(blitzer)).toBe(false);
    expect(isLineman(ogre)).toBe(false);
  });

  it("isBigGuy : compétence Solitaire (loner)", () => {
    expect(isBigGuy(ogre)).toBe(true);
    expect(isBigGuy(lineman)).toBe(false);
    expect(isBigGuy(blitzer)).toBe(false);
  });

  it("countNonLinemen additionne les postes spécialisés", () => {
    const positions = [lineman, blitzer, ogre];
    const counts = { human_lineman: 5, human_blitzer: 2, human_ogre: 1 };
    expect(countNonLinemen(positions, counts)).toBe(3);
  });

  it("getSelectablePositions garde les Gros Bras quand autorisés (sevens)", () => {
    const positions = [lineman, blitzer, ogre];
    expect(getSelectablePositions(positions, "sevens")).toHaveLength(3);
    expect(getSelectablePositions(positions, "bb11")).toHaveLength(3);
  });
});

describe("formats — validateFormatSelection (sevens)", () => {
  const base = {
    format: "sevens" as const,
    positions: [lineman, blitzer, ogre],
    starPlayerCount: 0,
    rerolls: 0,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    dedicatedFans: 1,
  };

  it("accepte 7 joueurs avec ≤4 non-linemen", () => {
    const r = validateFormatSelection({
      ...base,
      counts: { human_lineman: 5, human_blitzer: 2 },
    });
    expect(r.valid).toBe(true);
  });

  it("refuse < 7 joueurs", () => {
    const r = validateFormatSelection({ ...base, counts: { human_lineman: 6 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("7");
  });

  it("refuse > 11 joueurs", () => {
    const r = validateFormatSelection({ ...base, counts: { human_lineman: 12 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("11");
  });

  it("refuse > 4 non-linemen", () => {
    const r = validateFormatSelection({
      ...base,
      counts: { human_lineman: 4, human_blitzer: 4, human_ogre: 1 },
    });
    expect(r.valid).toBe(false);
    expect(r.error?.toLowerCase()).toContain("non-linemen");
  });

  it("refuse les Star Players (interdits en sevens)", () => {
    const r = validateFormatSelection({
      ...base,
      counts: { human_lineman: 7 },
      starPlayerCount: 1,
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Star Players");
  });

  it("refuse > 6 relances", () => {
    const r = validateFormatSelection({
      ...base,
      counts: { human_lineman: 7 },
      rerolls: 7,
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("relances");
  });
});

describe("formats — validateFormatSelection (bb11 non-régression)", () => {
  it("accepte 11-16 joueurs, Star Players autorisés, pas de limite non-linemen", () => {
    const r = validateFormatSelection({
      format: "bb11",
      positions: [lineman, blitzer, ogre],
      counts: { human_lineman: 11, human_blitzer: 4, human_ogre: 1 },
      starPlayerCount: 0,
      rerolls: 8,
      cheerleaders: 0,
      assistants: 0,
      apothecary: true,
      dedicatedFans: 1,
    });
    expect(r.valid).toBe(true);
  });
});
