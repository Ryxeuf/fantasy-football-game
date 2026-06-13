import { describe, it, expect } from "vitest";
import { buildRosterShareOgContent } from "./og-image-content";

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
});
