import { describe, it, expect } from "vitest";
import { isFlagMissingFromCode, missingFromCodeNotice } from "./featureFlags";

describe("isFlagMissingFromCode", () => {
  it("est vrai seulement quand le serveur signale knownInCode: false", () => {
    expect(isFlagMissingFromCode({ knownInCode: false })).toBe(true);
    expect(isFlagMissingFromCode({ knownInCode: true })).toBe(false);
  });

  it("ne lit pas un champ absent (serveur antérieur) comme « absent du code »", () => {
    expect(isFlagMissingFromCode({})).toBe(false);
  });
});

describe("missingFromCodeNotice", () => {
  it("accorde au singulier", () => {
    expect(missingFromCodeNotice(["league"])).toBe(
      "Le flag league n'est plus utilisé par le code : il ne gate plus rien et peut être supprimé.",
    );
  });

  it("accorde au pluriel et liste les clés", () => {
    expect(missingFromCodeNotice(["league", "old_ui"])).toBe(
      "2 flags ne sont plus utilisés par le code (league, old_ui) : ils ne gatent plus rien et peuvent être supprimés.",
    );
  });
});
