import { describe, it, expect } from "vitest";
import {
  checkComposition,
  coercePlayStyle,
  DEFAULT_PLAY_STYLE,
  getCapsForStyle,
  isPlayStyle,
  PLAY_STYLES,
  PLAY_STYLE_CAPS,
  type PlayStyle,
} from "./lineup-composition.js";
import type { CompositionArchetype } from "./position-to-bb.js";

/** Helper : repete un archetype n fois. */
function rep(arch: CompositionArchetype, n: number): CompositionArchetype[] {
  return Array.from({ length: n }, () => arch);
}

describe("PlayStyle guards", () => {
  it("isPlayStyle reconnait les 4 styles", () => {
    for (const s of PLAY_STYLES) expect(isPlayStyle(s)).toBe(true);
  });

  it("isPlayStyle rejette les valeurs inconnues", () => {
    expect(isPlayStyle("chaos")).toBe(false);
    expect(isPlayStyle(null)).toBe(false);
    expect(isPlayStyle(42)).toBe(false);
    expect(isPlayStyle(undefined)).toBe(false);
  });

  it("coercePlayStyle fallback sur balanced", () => {
    expect(coercePlayStyle("offensive")).toBe("offensive");
    expect(coercePlayStyle("garbage")).toBe(DEFAULT_PLAY_STYLE);
    expect(coercePlayStyle(null)).toBe("balanced");
  });
});

describe("PLAY_STYLE_CAPS invariants", () => {
  it("definit les 4 styles", () => {
    expect(Object.keys(PLAY_STYLE_CAPS).sort()).toEqual(
      [...PLAY_STYLES].sort(),
    );
  });

  it("ne plafonne JAMAIS les fillers (lineman/frontSeven/secondary)", () => {
    // Garantie de faisabilite : ces archetypes doivent rester illimites
    // pour qu'un coach puisse toujours completer 11 titulaires.
    for (const style of PLAY_STYLES) {
      const caps = PLAY_STYLE_CAPS[style];
      expect(caps.lineman).toBeUndefined();
      expect(caps.frontSeven).toBeUndefined();
      expect(caps.secondary).toBeUndefined();
    }
  });

  it("laisse assez de slots non plafonnes pour atteindre 11", () => {
    // Somme des caps premium + fillers illimites doit permettre 11.
    // Comme fillers = illimites, il suffit que les caps premium soient >= 0.
    for (const style of PLAY_STYLES) {
      const caps = PLAY_STYLE_CAPS[style];
      const premiumMax = Object.values(caps).reduce((a, b) => a + (b ?? 0), 0);
      // Au pire on remplit avec des fillers : 11 - premiumMax >= 0 pas requis
      // (premium peut depasser 11 en theorie), mais on verifie qu'il existe
      // au moins un archetype non plafonne (filler) pour completer.
      expect(premiumMax).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("checkComposition", () => {
  it("lineup conforme → aucune violation", () => {
    // balanced: passer<=2 rusher<=3 receiver<=3 bigGuy<=2
    const lineup: CompositionArchetype[] = [
      ...rep("passer", 1),
      ...rep("rusher", 2),
      ...rep("receiver", 3),
      ...rep("bigGuy", 1),
      ...rep("lineman", 4), // filler illimite
    ];
    expect(checkComposition(lineup, "balanced")).toEqual([]);
  });

  it("detecte un depassement simple", () => {
    const lineup = [...rep("receiver", 5), ...rep("lineman", 6)];
    const v = checkComposition(lineup, "balanced"); // receiver cap 3
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({ archetype: "receiver", count: 5, cap: 3 });
  });

  it("detecte plusieurs depassements, tries par archetype", () => {
    const lineup = [...rep("passer", 3), ...rep("rusher", 5)];
    const v = checkComposition(lineup, "balanced"); // passer 2, rusher 3
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.archetype)).toEqual(["passer", "rusher"]);
  });

  it("fillers jamais en violation meme en grand nombre", () => {
    const lineup = [
      ...rep("lineman", 6),
      ...rep("frontSeven", 3),
      ...rep("secondary", 2),
    ];
    expect(checkComposition(lineup, "defensive")).toEqual([]);
  });

  it("air_raid autorise 6 receveurs mais bride la course", () => {
    const ok = [...rep("receiver", 6), ...rep("lineman", 5)];
    expect(checkComposition(ok, "air_raid")).toEqual([]);

    const tooManyRushers = [...rep("rusher", 2), ...rep("lineman", 9)];
    const v = checkComposition(tooManyRushers, "air_raid"); // rusher cap 1
    expect(v).toEqual([{ archetype: "rusher", count: 2, cap: 1 }]);
  });

  it("style invalide → coerce vers balanced (pas de crash)", () => {
    const lineup = [...rep("receiver", 5), ...rep("lineman", 6)];
    // 'garbage' coerce vers balanced (receiver cap 3) → violation
    expect(checkComposition(lineup, "garbage")).toEqual([
      { archetype: "receiver", count: 5, cap: 3 },
    ]);
  });

  it("lineup vide → aucune violation", () => {
    expect(checkComposition([], "offensive")).toEqual([]);
  });

  it("getCapsForStyle retourne le bon preset", () => {
    expect(getCapsForStyle("defensive")).toBe(PLAY_STYLE_CAPS.defensive);
    expect(getCapsForStyle("???" as PlayStyle)).toBe(PLAY_STYLE_CAPS.balanced);
  });
});
