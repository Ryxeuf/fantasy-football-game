import { describe, it, expect } from "vitest";
import { ROSTER_NAMES, getRosterName } from "./roster-names";
import { TEAM_ROSTERS_BY_RULESET } from "./positions";
import { ROSTER_COLORS } from "./team-colors";

// Verrou de cohérence : ROSTER_NAMES est un module léger maintenu à la
// main ; ce test garantit qu'il reste aligné sur les définitions
// complètes (tout nouveau roster doit y être ajouté).

describe("ROSTER_NAMES", () => {
  it("couvre tous les rosters de tous les rulesets avec le nom S3 (fallback S2)", () => {
    // Quelques libellés divergent entre S2 et S3 (casse, « Morts-Vivants »
    // vs « Morts ambulants ») : le nom d'affichage suit le ruleset courant
    // de la beta (season_3), avec repli S2 pour un slug S2-only.
    const slugs = new Set(
      Object.values(TEAM_ROSTERS_BY_RULESET).flatMap((r) => Object.keys(r)),
    );
    for (const slug of slugs) {
      const expected =
        TEAM_ROSTERS_BY_RULESET.season_3[slug]?.name ??
        TEAM_ROSTERS_BY_RULESET.season_2[slug]?.name;
      expect(
        ROSTER_NAMES[slug],
        `${slug} manquant ou divergent dans ROSTER_NAMES`,
      ).toBe(expected);
    }
  });

  it("ne contient pas de slug orphelin (roster supprimé)", () => {
    const known = new Set(
      Object.values(TEAM_ROSTERS_BY_RULESET).flatMap((r) => Object.keys(r)),
    );
    for (const slug of Object.keys(ROSTER_NAMES)) {
      expect(known.has(slug), `${slug} n'existe plus dans les rosters`).toBe(
        true,
      );
    }
  });

  it("chaque roster nommé a aussi une couleur (badge complet)", () => {
    for (const slug of Object.keys(ROSTER_NAMES)) {
      expect(
        ROSTER_COLORS[slug],
        `${slug} sans entrée dans ROSTER_COLORS`,
      ).toBeDefined();
    }
  });
});

describe("getRosterName", () => {
  it("résout un slug connu", () => {
    expect(getRosterName("tomb_kings")).toBe("Rois des tombes");
    expect(getRosterName("wood_elf")).toBe("Elfes sylvains");
  });

  it("retombe sur le slug si inconnu, chaîne vide si absent", () => {
    expect(getRosterName("mystery_team")).toBe("mystery_team");
    expect(getRosterName(null)).toBe("");
    expect(getRosterName(undefined)).toBe("");
  });
});
