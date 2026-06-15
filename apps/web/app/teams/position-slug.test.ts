import { describe, it, expect } from "vitest";
import {
  stripRosterPrefix,
  resolvePosition,
  cleanDisplayName,
  parseSkillCsv,
  parseAccessCodes,
  prettifySlug,
} from "./position-slug";

describe("stripRosterPrefix", () => {
  it("retire le prefixe roster d'un slug de position", () => {
    expect(stripRosterPrefix("skaven_lineman", "skaven")).toBe("lineman");
    expect(
      stripRosterPrefix(
        "old_world_alliance_trois_quart_humain",
        "old_world_alliance",
      ),
    ).toBe("trois_quart_humain");
  });

  it("laisse le slug intact si le prefixe ne correspond pas", () => {
    expect(stripRosterPrefix("amazone_blitzer", "amazon")).toBe(
      "amazone_blitzer",
    );
  });
});

describe("resolvePosition", () => {
  const roster = {
    slug: "skaven",
    positions: [
      { slug: "skaven_lineman", displayName: "Lineman" },
      { slug: "skaven_gutter_runner", displayName: "Gutter Runner" },
    ],
  };

  it("resout par reconstruction du slug complet (cas nominal)", () => {
    expect(resolvePosition(roster, "lineman")?.slug).toBe("skaven_lineman");
    expect(resolvePosition(roster, "gutter_runner")?.slug).toBe(
      "skaven_gutter_runner",
    );
  });

  it("accepte un segment deja en slug complet (repli 1)", () => {
    expect(resolvePosition(roster, "skaven_lineman")?.slug).toBe(
      "skaven_lineman",
    );
  });

  it("se replie sur une correspondance par suffixe (repli 2)", () => {
    const atypique = {
      slug: "amazon",
      positions: [{ slug: "amazone_blitzer", displayName: "Blitzer" }],
    };
    expect(resolvePosition(atypique, "blitzer")?.slug).toBe("amazone_blitzer");
  });

  it("retourne null si aucune position ne correspond", () => {
    expect(resolvePosition(roster, "inconnu")).toBeNull();
    expect(resolvePosition(roster, "")).toBeNull();
  });
});

describe("cleanDisplayName", () => {
  it("retire le marqueur ` *` et signale le big guy", () => {
    expect(cleanDisplayName("Homme-arbre *")).toEqual({
      name: "Homme-arbre",
      isBigGuy: true,
    });
    expect(cleanDisplayName("Ogre *")).toEqual({
      name: "Ogre",
      isBigGuy: true,
    });
  });

  it("laisse un nom normal inchange", () => {
    expect(cleanDisplayName("Lineman")).toEqual({
      name: "Lineman",
      isBigGuy: false,
    });
    expect(cleanDisplayName("Trois-Quart Humain")).toEqual({
      name: "Trois-Quart Humain",
      isBigGuy: false,
    });
  });
});

describe("parseSkillCsv", () => {
  it("decoupe et nettoie une CSV de slugs", () => {
    expect(parseSkillCsv("dodge, animosity ,")).toEqual(["dodge", "animosity"]);
  });

  it("retourne une liste vide pour null/vide", () => {
    expect(parseSkillCsv(null)).toEqual([]);
    expect(parseSkillCsv("")).toEqual([]);
  });
});

describe("parseAccessCodes", () => {
  it("normalise F->S et ordonne G/A/S/P/M sans doublon", () => {
    expect(parseAccessCodes("G,S")).toEqual(["G", "S"]);
    expect(parseAccessCodes("F")).toEqual(["S"]);
    expect(parseAccessCodes("m,a,g")).toEqual(["G", "A", "M"]);
    expect(parseAccessCodes("G,G,A")).toEqual(["G", "A"]);
  });

  it("retourne une liste vide pour null/vide", () => {
    expect(parseAccessCodes(null)).toEqual([]);
    expect(parseAccessCodes("")).toEqual([]);
  });
});

describe("prettifySlug", () => {
  it("rend un slug lisible", () => {
    expect(prettifySlug("sure_hands")).toBe("Sure Hands");
    expect(prettifySlug("dodge")).toBe("Dodge");
  });
});
