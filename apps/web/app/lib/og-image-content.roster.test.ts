import { describe, it, expect } from "vitest";
import {
  buildRosterShareOgContent,
  buildSiteOgContent,
} from "./og-image-content";
import { OG_SUBTITLE_MAX } from "./roster-share-text";

describe("buildRosterShareOgContent", () => {
  it("met le nom d'équipe en titre et les chiffres clés en badges", () => {
    const c = buildRosterShareOgContent({
      teamName: "Les Rats Véloces",
      raceName: "Skaven",
      teamValue: 1150000,
      playerCount: 13,
      starPlayerNames: ["Hakflem Skuttlespike"],
      ruleset: "season_3",
    });
    expect(c.title).toBe("Les Rats Véloces");
    expect(c.accent).toBe("team");
    expect(c.badges[0]).toBe("Skaven");
    expect(c.badges.some((b) => b.includes("1") && b.includes("150"))).toBe(true);
    expect(c.badges.some((b) => b.includes("13") && b.includes("joueurs"))).toBe(true);
    expect(c.badges).toContain("Saison 3");
  });

  it("met les Star Players dans le sous-titre (max 2)", () => {
    const c = buildRosterShareOgContent({
      teamName: "Equipe",
      raceName: "Orques",
      teamValue: 1000000,
      playerCount: 11,
      starPlayerNames: ["Varag Ghoul-Chewer", "Grashnak Blackhoof", "Ugroth Bolgrot"],
      ruleset: "season_3",
    });
    expect(c.subtitle).toContain("Varag Ghoul-Chewer");
    expect(c.subtitle).toContain("Grashnak Blackhoof");
    expect(c.subtitle).not.toContain("Ugroth");
  });

  it("retombe sur un sous-titre générique sans Star Player", () => {
    const c = buildRosterShareOgContent({
      teamName: "Equipe",
      raceName: "Nains",
      teamValue: 1000000,
      playerCount: 11,
      starPlayerNames: [],
      ruleset: "season_2",
    });
    expect(c.subtitle).toBe("Équipe Blood Bowl");
    expect(c.badges).toContain("Saison 2");
  });
  it("sert la description du coach en sous-titre, avant les Star Players", () => {
    const c = buildRosterShareOgContent({
      teamName: "Les Rats Véloces",
      raceName: "Skaven",
      teamValue: 1150000,
      playerCount: 13,
      starPlayerNames: ["Hakflem Skuttlespike"],
      ruleset: "season_3",
      description: "Une bande de rats qui court plus vite que son ombre.",
    });
    expect(c.subtitle).toBe(
      "Une bande de rats qui court plus vite que son ombre.",
    );
    expect(c.subtitle).not.toContain("Hakflem");
  });

  it("tronque une description trop longue pour la carte", () => {
    const c = buildRosterShareOgContent({
      teamName: "Equipe",
      raceName: "Skaven",
      teamValue: 1000000,
      playerCount: 11,
      starPlayerNames: [],
      ruleset: "season_3",
      description: "Fluff ".repeat(80),
    });
    expect(c.subtitle.length).toBeLessThanOrEqual(OG_SUBTITLE_MAX);
    expect(c.subtitle.endsWith("…")).toBe(true);
  });

  it("ignore une description blanche", () => {
    const c = buildRosterShareOgContent({
      teamName: "Equipe",
      raceName: "Nains",
      teamValue: 1000000,
      playerCount: 11,
      starPlayerNames: [],
      ruleset: "season_3",
      description: "   ",
    });
    expect(c.subtitle).toBe("Équipe Blood Bowl");
  });

  it("porte le logo quand il est fourni, et rien sinon", () => {
    const base = {
      teamName: "Equipe",
      raceName: "Skaven",
      teamValue: 1000000,
      playerCount: 11,
      starPlayerNames: [],
      ruleset: "season_3",
    };
    expect(
      buildRosterShareOgContent({
        ...base,
        logo: { kind: "image", src: "https://x/logo.png" },
      }).logo,
    ).toEqual({ kind: "image", src: "https://x/logo.png" });
    expect(buildRosterShareOgContent(base).logo).toBeUndefined();
  });
});

describe("buildSiteOgContent", () => {
  it("décrit le site et porte son logo quand il est fourni", () => {
    const c = buildSiteOgContent({ logoUrl: "data:image/png;base64,AAA" });
    expect(c.title).toBe("Nuffle Arena");
    expect(c.accent).toBe("brand");
    expect(c.logo).toEqual({ kind: "image", src: "data:image/png;base64,AAA" });
    expect(c.badges.length).toBeGreaterThan(0);
  });

  it("reste rendable sans logo (lecture disque en échec)", () => {
    expect(buildSiteOgContent().logo).toBeUndefined();
  });
});
