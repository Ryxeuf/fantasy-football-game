/**
 * Tests pour les builders de contenu Open Graph image (Q.14 — Sprint 23).
 *
 * Le builder est pur : il prend les donnees fonctionnelles (roster,
 * star player, count) et produit la structure { title, subtitle,
 * badges[], accent } consommee par le template visuel React rendu via
 * Next.js ImageResponse / satori.
 *
 * Tester le builder sans satori/wasm permet d itterer rapidement sur
 * le contenu de l image OG sans devoir generer un PNG a chaque fois.
 */
import { describe, it, expect } from "vitest";
import {
  buildTeamOgContent,
  buildStarPlayerOgContent,
  buildSkillsOgContent,
  buildProLeagueMatchOgContent,
  buildProLeagueGazetteOgContent,
  type TeamOgInput,
  type StarPlayerOgInput,
} from "./og-image-content";

describe("buildTeamOgContent", () => {
  const baseRoster: TeamOgInput = {
    name: "Skaven",
    tier: "II",
    budget: 1150000,
    positionCount: 6,
    ruleset: "season_3",
  };

  it("expose title = nom du roster", () => {
    expect(buildTeamOgContent(baseRoster).title).toBe("Skaven");
  });

  it("expose un subtitle court", () => {
    expect(buildTeamOgContent(baseRoster).subtitle).toBeTruthy();
  });

  it("emet 4 badges : Tier, Budget, Positions, Saison", () => {
    const badges = buildTeamOgContent(baseRoster).badges;
    expect(badges.length).toBe(4);
    const labels = badges.map((b) => b.toLowerCase());
    expect(labels.some((l) => l.includes("tier"))).toBe(true);
    expect(labels.some((l) => l.includes("budget") || l.includes("po"))).toBe(true);
    expect(labels.some((l) => l.includes("position"))).toBe(true);
    expect(labels.some((l) => l.includes("saison") || l.includes("season"))).toBe(true);
  });

  it("formate le budget avec separateurs (lisibilite)", () => {
    const badges = buildTeamOgContent({ ...baseRoster, budget: 1150000 }).badges;
    // Normalise les espaces (incluant NBSP / fines) pour le matching.
    const flat = badges.join(" ").replace(/[\s  ]+/g, " ");
    expect(flat.includes("1 150") || flat.includes("1,150") || flat.includes("1150")).toBe(true);
  });

  it("expose accent = bordeaux pour les teams", () => {
    expect(buildTeamOgContent(baseRoster).accent).toBe("team");
  });

  it("est deterministe", () => {
    expect(buildTeamOgContent(baseRoster)).toEqual(buildTeamOgContent(baseRoster));
  });

  it("clamp positionCount negatif a 0", () => {
    const badges = buildTeamOgContent({ ...baseRoster, positionCount: -3 }).badges;
    expect(badges.find((b) => b.toLowerCase().includes("position"))).toContain("0");
  });

  it("supporte un tier absent (fallback)", () => {
    const out = buildTeamOgContent({ ...baseRoster, tier: undefined });
    const flat = out.badges.join(" ");
    expect(flat).toBeTruthy();
  });
});

describe("buildStarPlayerOgContent", () => {
  const baseStar: StarPlayerOgInput = {
    displayName: "Morg 'n' Thorg",
    cost: 430000,
    ma: 6,
    st: 7,
    ag: 3,
    pa: 4,
    av: 11,
    isMegaStar: true,
  };

  it("expose title = displayName", () => {
    expect(buildStarPlayerOgContent(baseStar).title).toBe("Morg 'n' Thorg");
  });

  it("prefixe MEGA STAR dans le subtitle quand isMegaStar=true", () => {
    expect(buildStarPlayerOgContent(baseStar).subtitle.toUpperCase()).toContain("MEGA STAR");
  });

  it("ne prefixe PAS MEGA STAR quand isMegaStar absent / false", () => {
    const out = buildStarPlayerOgContent({ ...baseStar, isMegaStar: false });
    expect(out.subtitle.toUpperCase().includes("MEGA STAR")).toBe(false);
  });

  it("emet des badges pour MA, ST, AG+, AV+, Cost", () => {
    const badges = buildStarPlayerOgContent(baseStar).badges;
    const flat = badges.join(" ");
    expect(flat).toContain("MA");
    expect(flat).toContain("ST");
    expect(flat).toContain("AG");
    expect(flat).toContain("AV");
    expect(flat).toMatch(/Cost|po|gp/i);
  });

  it("inclut PA quand pa != null", () => {
    const flat = buildStarPlayerOgContent(baseStar).badges.join(" ");
    expect(flat).toContain("PA");
  });

  it("omet PA quand pa = null", () => {
    const flat = buildStarPlayerOgContent({ ...baseStar, pa: null }).badges.join(" ");
    expect(flat.includes("PA")).toBe(false);
  });

  it("expose accent = star pour les star players", () => {
    expect(buildStarPlayerOgContent(baseStar).accent).toBe("star");
  });

  it("est deterministe", () => {
    expect(buildStarPlayerOgContent(baseStar)).toEqual(
      buildStarPlayerOgContent(baseStar),
    );
  });
});

describe("buildSkillsOgContent", () => {
  it("expose title qui mentionne 'Competences' (FR)", () => {
    // Comparaison insensible aux accents (compétences vs competences).
    const normalized = buildSkillsOgContent({ skillCount: 130 })
      .title.toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    expect(normalized).toContain("competences");
  });

  it("expose un badge contenant le count", () => {
    const flat = buildSkillsOgContent({ skillCount: 132 }).badges.join(" ");
    expect(flat).toContain("132");
  });

  it("clamp skillCount negatif a 0", () => {
    const flat = buildSkillsOgContent({ skillCount: -5 }).badges.join(" ");
    expect(flat).toContain("0");
  });

  it("expose accent = skill", () => {
    expect(buildSkillsOgContent({ skillCount: 130 }).accent).toBe("skill");
  });

  it("emet plusieurs badges pour donner du contexte (count + categories)", () => {
    expect(buildSkillsOgContent({ skillCount: 130 }).badges.length).toBeGreaterThanOrEqual(2);
  });

  it("est deterministe", () => {
    expect(buildSkillsOgContent({ skillCount: 130 })).toEqual(
      buildSkillsOgContent({ skillCount: 130 }),
    );
  });
});

describe("buildProLeagueMatchOgContent — Lot O.D", () => {
  it("scheduled : title 'Home vs Away' sans score", () => {
    const out = buildProLeagueMatchOgContent({
      homeName: "Snow Ogres",
      awayName: "Cheese Halflings",
      scoreHome: null,
      scoreAway: null,
      roundNumber: 5,
      status: "scheduled",
    });
    expect(out.title).toContain("Snow Ogres");
    expect(out.title).toContain("vs");
    expect(out.title).toContain("Cheese Halflings");
    expect(out.title).not.toMatch(/\d+\s*[–-]\s*\d+/);
    expect(out.accent).toBe("match");
  });

  it("completed : title affiche le score", () => {
    const out = buildProLeagueMatchOgContent({
      homeName: "Snow Ogres",
      awayName: "Cheese Halflings",
      scoreHome: 3,
      scoreAway: 1,
      roundNumber: 5,
      status: "completed",
    });
    expect(out.title).toContain("3");
    expect(out.title).toContain("1");
    expect(out.title).toContain("Snow Ogres");
    expect(out.title).toContain("Cheese Halflings");
  });

  it("status in_progress : badge 'EN DIRECT'", () => {
    const out = buildProLeagueMatchOgContent({
      homeName: "A",
      awayName: "B",
      scoreHome: 2,
      scoreAway: 2,
      roundNumber: 3,
      status: "in_progress",
    });
    expect(out.badges).toContain("EN DIRECT");
  });

  it("inclut R<round> dans les badges", () => {
    const out = buildProLeagueMatchOgContent({
      homeName: "A",
      awayName: "B",
      scoreHome: null,
      scoreAway: null,
      roundNumber: 7,
      status: "scheduled",
    });
    expect(out.badges).toContain("R7");
  });

  it("homeMeta / awayMeta dans les badges si fournis", () => {
    const out = buildProLeagueMatchOgContent({
      homeName: "A",
      awayName: "B",
      homeMeta: "Buffalo · Ogre",
      awayMeta: "Green Bay · Halfling",
      scoreHome: null,
      scoreAway: null,
      roundNumber: 1,
      status: "scheduled",
    });
    expect(out.badges).toContain("Buffalo · Ogre");
    expect(out.badges).toContain("Green Bay · Halfling");
  });
});

describe("buildProLeagueGazetteOgContent — Lot O.D", () => {
  it("formate la date YYYY-MM-DD en DD/MM/YYYY dans les badges", () => {
    const out = buildProLeagueGazetteOgContent({
      date: "2026-09-15",
      headline: "Orcs ravagent la Pro League",
      articleCount: 5,
    });
    expect(out.badges).toContain("15/09/2026");
  });

  it("expose accent gazette + article count", () => {
    const out = buildProLeagueGazetteOgContent({
      date: "2026-09-15",
      headline: "Title",
      articleCount: 3,
      persona: "Cynic",
    });
    expect(out.accent).toBe("gazette");
    expect(out.badges).toContain("3 articles");
    expect(out.badges).toContain("Cynic");
  });

  it("fallback si date invalide : laisse la valeur brute", () => {
    const out = buildProLeagueGazetteOgContent({
      date: "not-a-date",
      headline: "Title",
      articleCount: 2,
    });
    expect(out.badges).toContain("not-a-date");
  });
});
