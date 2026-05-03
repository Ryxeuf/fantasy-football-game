/**
 * S26.6 — Tests des themes saisonniers de ligue.
 *
 * Definit le catalogue canonique des themes (Skaven Cup mars,
 * Nordic Challenge avril, Underworld Open mai) et les utilitaires
 * de selection / validation / formattage.
 */

import { describe, it, expect } from "vitest";
import {
  LEAGUE_THEMES,
  getLeagueThemeBySlug,
  getLeagueThemeForMonth,
  isLeagueThemeSlug,
  listLeagueThemes,
  formatLeagueThemeChampionLabel,
  type LeagueThemeSlug,
} from "./league-themes";

describe("league-themes catalogue", () => {
  it("expose au moins les 3 themes canoniques de la roadmap S26.6", () => {
    const slugs = LEAGUE_THEMES.map((t) => t.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(["skaven_cup", "nordic_challenge", "underworld_open"]),
    );
  });

  it("chaque theme a un slug, un titre, un mois (1-12) et une couleur de badge", () => {
    for (const theme of LEAGUE_THEMES) {
      expect(theme.slug).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(theme.title.trim().length).toBeGreaterThan(0);
      expect(theme.month).toBeGreaterThanOrEqual(1);
      expect(theme.month).toBeLessThanOrEqual(12);
      expect(theme.badgeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("aligne les mois canoniques : skaven=3, nordic=4, underworld=5", () => {
    expect(getLeagueThemeBySlug("skaven_cup")?.month).toBe(3);
    expect(getLeagueThemeBySlug("nordic_challenge")?.month).toBe(4);
    expect(getLeagueThemeBySlug("underworld_open")?.month).toBe(5);
  });

  it("aucun doublon de slug ni de mois", () => {
    const slugs = LEAGUE_THEMES.map((t) => t.slug);
    const months = LEAGUE_THEMES.map((t) => t.month);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(months).size).toBe(months.length);
  });
});

describe("getLeagueThemeBySlug", () => {
  it("retourne le theme quand le slug existe", () => {
    const theme = getLeagueThemeBySlug("skaven_cup");
    expect(theme?.slug).toBe("skaven_cup");
    expect(theme?.title.toLowerCase()).toContain("skaven");
  });

  it("retourne null pour un slug inconnu", () => {
    expect(getLeagueThemeBySlug("ghost_league")).toBeNull();
  });

  it("retourne null pour une chaine vide", () => {
    expect(getLeagueThemeBySlug("")).toBeNull();
  });
});

describe("isLeagueThemeSlug", () => {
  it("valide les slugs canoniques", () => {
    expect(isLeagueThemeSlug("skaven_cup")).toBe(true);
    expect(isLeagueThemeSlug("nordic_challenge")).toBe(true);
    expect(isLeagueThemeSlug("underworld_open")).toBe(true);
  });

  it("rejette un slug inconnu", () => {
    expect(isLeagueThemeSlug("ghost_league")).toBe(false);
  });

  it("rejette une chaine vide ou non-string", () => {
    expect(isLeagueThemeSlug("")).toBe(false);
    expect(isLeagueThemeSlug(null as unknown as string)).toBe(false);
    expect(isLeagueThemeSlug(undefined as unknown as string)).toBe(false);
  });
});

describe("getLeagueThemeForMonth", () => {
  it("retourne le theme correspondant au mois (1-12)", () => {
    expect(getLeagueThemeForMonth(3)?.slug).toBe("skaven_cup");
    expect(getLeagueThemeForMonth(4)?.slug).toBe("nordic_challenge");
    expect(getLeagueThemeForMonth(5)?.slug).toBe("underworld_open");
  });

  it("retourne null pour un mois sans theme programme", () => {
    expect(getLeagueThemeForMonth(1)).toBeNull();
    expect(getLeagueThemeForMonth(11)).toBeNull();
  });

  it("retourne null pour un mois invalide", () => {
    expect(getLeagueThemeForMonth(0)).toBeNull();
    expect(getLeagueThemeForMonth(13)).toBeNull();
    expect(getLeagueThemeForMonth(-3)).toBeNull();
    expect(getLeagueThemeForMonth(1.5)).toBeNull();
  });
});

describe("listLeagueThemes", () => {
  it("retourne tous les themes ordonnes par mois croissant", () => {
    const themes = listLeagueThemes();
    expect(themes.length).toBe(LEAGUE_THEMES.length);
    for (let i = 1; i < themes.length; i++) {
      expect(themes[i].month).toBeGreaterThan(themes[i - 1].month);
    }
  });

  it("ne renvoie pas la reference interne (immutabilite)", () => {
    const themes = listLeagueThemes();
    expect(themes).not.toBe(LEAGUE_THEMES);
  });
});

describe("formatLeagueThemeChampionLabel", () => {
  it("formatte le label badge 'Champion {theme} {year}'", () => {
    expect(formatLeagueThemeChampionLabel("skaven_cup", 2026)).toBe(
      "Champion Skaven Cup 2026",
    );
    expect(formatLeagueThemeChampionLabel("nordic_challenge", 2026)).toBe(
      "Champion Nordic Challenge 2026",
    );
  });

  it("retourne null pour un slug inconnu", () => {
    expect(
      formatLeagueThemeChampionLabel("ghost" as LeagueThemeSlug, 2026),
    ).toBeNull();
  });

  it("retourne null pour une annee invalide", () => {
    expect(formatLeagueThemeChampionLabel("skaven_cup", 0)).toBeNull();
    expect(formatLeagueThemeChampionLabel("skaven_cup", -1)).toBeNull();
    expect(formatLeagueThemeChampionLabel("skaven_cup", 2026.5)).toBeNull();
  });
});
