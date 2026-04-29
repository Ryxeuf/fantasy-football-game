/**
 * Tests pour `coachSlugFrom` (S26.3a).
 *
 * Verifie la derivation d'un slug URL-safe depuis un nom de coach :
 * accents normalises, casse uniforme, caracteres speciaux remplaces par
 * des tirets uniques, sans tirets en debut/fin.
 */

import { describe, it, expect } from "vitest";
import { coachSlugFrom } from "./coach-slug";

describe("coachSlugFrom", () => {
  it("returns a lowercased dashed slug for a simple name", () => {
    expect(coachSlugFrom("Coach Alpha")).toBe("coach-alpha");
  });

  it("strips accents (NFD)", () => {
    expect(coachSlugFrom("Émile")).toBe("emile");
    expect(coachSlugFrom("Crève-Cœur")).toBe("creve-coeur");
  });

  it("collapses special chars and runs of whitespace into a single dash", () => {
    expect(coachSlugFrom("foo___bar   baz!!??qux")).toBe("foo-bar-baz-qux");
  });

  it("trims leading and trailing dashes", () => {
    expect(coachSlugFrom("   --foo--   ")).toBe("foo");
  });

  it("preserves internal digits", () => {
    expect(coachSlugFrom("Coach 2024")).toBe("coach-2024");
  });

  it("returns an empty string for empty / whitespace / pure-symbol input", () => {
    expect(coachSlugFrom("")).toBe("");
    expect(coachSlugFrom("   ")).toBe("");
    expect(coachSlugFrom("!!!???")).toBe("");
  });

  it("is idempotent on already-slugified strings", () => {
    expect(coachSlugFrom("coach-alpha")).toBe("coach-alpha");
    expect(coachSlugFrom("foo-bar-2024")).toBe("foo-bar-2024");
  });

  it("normalises common ligatures (oe / ae)", () => {
    expect(coachSlugFrom("Cœur")).toBe("coeur");
    expect(coachSlugFrom("Lætitia")).toBe("laetitia");
  });
});
