import { describe, it, expect } from "vitest";
import {
  parseProTeamMeta,
  applyBrandingMeta,
} from "./pro-team-branding";

describe("parseProTeamMeta", () => {
  it("retourne {} pour null/undefined", () => {
    expect(parseProTeamMeta(null)).toEqual({});
    expect(parseProTeamMeta(undefined)).toEqual({});
  });

  it("parse une string JSON sqlite mirror", () => {
    const raw = JSON.stringify({ motto: "We hit hard.", fanbase: 42 });
    expect(parseProTeamMeta(raw)).toEqual({
      motto: "We hit hard.",
      fanbase: 42,
    });
  });

  it("retourne {} pour string JSON invalide", () => {
    expect(parseProTeamMeta("{not json")).toEqual({});
  });

  it("retourne {} pour string JSON qui n'est pas un objet (array)", () => {
    expect(parseProTeamMeta("[1,2,3]")).toEqual({});
  });

  it("retourne l'objet natif PG tel quel", () => {
    const obj = { motto: "Block first", headline: "Smash hour" };
    expect(parseProTeamMeta(obj)).toEqual(obj);
  });

  it("retourne {} pour array natif (PG)", () => {
    expect(parseProTeamMeta([1, 2, 3])).toEqual({});
  });

  it("retourne {} pour primitives non-objet", () => {
    expect(parseProTeamMeta(42)).toEqual({});
    expect(parseProTeamMeta(true)).toEqual({});
  });
});

describe("applyBrandingMeta", () => {
  it("preserve les autres entrees meta non touchees", () => {
    const current = { fanbase: 5000, skills: ["block", "tackle"] };
    const result = applyBrandingMeta(current, { motto: "Hut hut" });
    expect(result).toEqual({
      fanbase: 5000,
      skills: ["block", "tackle"],
      motto: "Hut hut",
    });
  });

  it("met a jour motto et headline quand fournis", () => {
    const result = applyBrandingMeta(
      { motto: "old" },
      { motto: "new", headline: "Headline X" },
    );
    expect(result).toEqual({ motto: "new", headline: "Headline X" });
  });

  it("efface motto quand null explicite", () => {
    const result = applyBrandingMeta(
      { motto: "to delete", fanbase: 42 },
      { motto: null },
    );
    expect(result).toEqual({ fanbase: 42 });
    expect("motto" in result).toBe(false);
  });

  it("efface headline quand null explicite", () => {
    const result = applyBrandingMeta(
      { headline: "to delete" },
      { headline: null },
    );
    expect("headline" in result).toBe(false);
  });

  it("ignore les champs undefined ou non fournis", () => {
    const current = { motto: "kept", headline: "also kept" };
    expect(applyBrandingMeta(current, {})).toEqual(current);
    expect(applyBrandingMeta(current, { motto: undefined })).toEqual(current);
  });

  it("fonctionne avec meta=null en entree", () => {
    expect(applyBrandingMeta(null, { motto: "fresh" })).toEqual({
      motto: "fresh",
    });
  });

  it("fonctionne avec meta=string sqlite en entree", () => {
    const raw = JSON.stringify({ fanbase: 100 });
    const result = applyBrandingMeta(raw, { motto: "via string" });
    expect(result).toEqual({ fanbase: 100, motto: "via string" });
  });
});
