/**
 * Tests pour les builders d'`OgImageContent` (Q.14 — Sprint 23).
 *
 * Chaque builder convertit une entite metier (roster, star player) en
 * une structure stable (`OgImageContent`) qui sera ensuite rendue par
 * `ImageResponse` Next.js. Tester la couche pure permet de garantir le
 * texte affiche sans avoir a executer satori/wasm.
 */

import { describe, it, expect } from "vitest";
import {
  buildTeamOgContent,
  buildStarPlayerOgContent,
  buildSkillsOgContent,
  type OgImageContent,
} from "./og-image-content";

describe("buildTeamOgContent", () => {
  const ROSTER = {
    name: "Skavens",
    tier: "I",
    budget: 1000,
    positions: [{ slug: "a" }, { slug: "b" }, { slug: "c" }],
  };

  it("retourne un titre = nom du roster", () => {
    const c = buildTeamOgContent(ROSTER);
    expect(c.title).toBe("Skavens");
  });

  it("expose tier et budget en badges", () => {
    const c = buildTeamOgContent(ROSTER);
    expect(c.badges).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Tier I"),
        expect.stringContaining("1000"),
      ]),
    );
  });

  it("inclut un badge avec le nombre de positions", () => {
    const c = buildTeamOgContent(ROSTER);
    expect(c.badges.some((b) => /3 positions/i.test(b))).toBe(true);
  });

  it("subtitle contient mention 'Roster Blood Bowl'", () => {
    const c = buildTeamOgContent(ROSTER);
    expect(c.subtitle).toMatch(/roster blood bowl/i);
  });

  it("category = 'team'", () => {
    expect(buildTeamOgContent(ROSTER).category).toBe("team");
  });

  it("supporte tier manquant", () => {
    const c = buildTeamOgContent({ ...ROSTER, tier: undefined as unknown as string });
    expect(c.badges.some((b) => /Tier/.test(b))).toBe(false);
  });
});

describe("buildStarPlayerOgContent", () => {
  const STAR = {
    displayName: "Morg 'n' Thorg",
    cost: 430,
    ma: 6,
    st: 6,
    ag: 4,
    pa: 5 as number | null,
    av: 10,
    isMegaStar: true,
  };

  it("title = displayName", () => {
    expect(buildStarPlayerOgContent(STAR).title).toBe("Morg 'n' Thorg");
  });

  it("badges contiennent stats principales (MA, ST, AV)", () => {
    const c = buildStarPlayerOgContent(STAR);
    expect(c.badges).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/MA\s*6/),
        expect.stringMatching(/ST\s*6/),
        expect.stringMatching(/AV\s*10/),
      ]),
    );
  });

  it("inclut le coût formaté en kpo", () => {
    const c = buildStarPlayerOgContent(STAR);
    expect(c.badges.some((b) => /430.*kpo/i.test(b))).toBe(true);
  });

  it("ajoute MEGA STAR quand isMegaStar=true", () => {
    const c = buildStarPlayerOgContent(STAR);
    expect(c.badges.some((b) => /mega star/i.test(b))).toBe(true);
  });

  it("omet MEGA STAR quand isMegaStar absent ou false", () => {
    const c = buildStarPlayerOgContent({ ...STAR, isMegaStar: false });
    expect(c.badges.some((b) => /mega star/i.test(b))).toBe(false);
  });

  it("subtitle mentionne 'Star Player Blood Bowl'", () => {
    const c = buildStarPlayerOgContent(STAR);
    expect(c.subtitle).toMatch(/star player blood bowl/i);
  });

  it("category = 'star-player'", () => {
    expect(buildStarPlayerOgContent(STAR).category).toBe("star-player");
  });

  it("affiche PA = '-' quand pa est null", () => {
    const c = buildStarPlayerOgContent({ ...STAR, pa: null });
    expect(c.badges.some((b) => /PA\s*-/.test(b))).toBe(true);
  });
});

describe("buildSkillsOgContent", () => {
  it("title evoque les Competences Blood Bowl", () => {
    const c = buildSkillsOgContent({ skillCount: 130 });
    expect(c.title).toMatch(/comp[ée]tences/i);
  });

  it("badges contiennent le nombre de skills", () => {
    const c = buildSkillsOgContent({ skillCount: 130 });
    expect(c.badges.some((b) => /130/.test(b))).toBe(true);
  });

  it("category = 'skills'", () => {
    const c = buildSkillsOgContent({ skillCount: 130 });
    expect(c.category).toBe("skills");
  });

  it("badges incluent les categories de skills", () => {
    const c = buildSkillsOgContent({ skillCount: 130 });
    expect(c.badges).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/General/i),
        expect.stringMatching(/Mutation/i),
        expect.stringMatching(/Trait/i),
      ]),
    );
  });
});

describe("OgImageContent shape", () => {
  it("title et subtitle sont des strings non vides pour tous les builders", () => {
    const all: OgImageContent[] = [
      buildTeamOgContent({ name: "X", tier: "I", budget: 1000, positions: [] }),
      buildStarPlayerOgContent({
        displayName: "Y",
        cost: 100,
        ma: 5,
        st: 5,
        ag: 3,
        pa: 3,
        av: 9,
      }),
      buildSkillsOgContent({ skillCount: 1 }),
    ];
    for (const c of all) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.subtitle.length).toBeGreaterThan(0);
      expect(Array.isArray(c.badges)).toBe(true);
    }
  });
});
