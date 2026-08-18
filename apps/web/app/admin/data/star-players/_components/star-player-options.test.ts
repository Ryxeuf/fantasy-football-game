/**
 * Catalogues et conversions des formulaires Star Player de l'admin.
 */
import { describe, it, expect } from "vitest";

import {
  HIRABLE_RULE_ALL,
  HIRABLE_RULE_OPTIONS,
  hirableSelectionFromApi,
  hirableSelectionToPayload,
  toggleValue,
} from "./star-player-options";

describe("HIRABLE_RULE_OPTIONS", () => {
  it("propose « toutes les équipes » en premier", () => {
    expect(HIRABLE_RULE_OPTIONS[0]?.slug).toBe(HIRABLE_RULE_ALL);
  });

  it("couvre les ligues régionales et les alignements « Favori de… »", () => {
    const slugs = HIRABLE_RULE_OPTIONS.map((o) => o.slug);
    for (const expected of [
      "old_world_classic",
      "lustrian_superleague",
      "elven_kingdoms_league",
      "underworld_challenge",
      "worlds_edge_superleague",
      "woodland_league",
      "chaos_clash",
      "favoured_of_khorne",
      "favoured_of_nurgle",
      "favoured_of_hashut",
    ]) {
      expect(slugs).toContain(expected);
    }
  });

  it("n'expose aucun doublon et libelle chaque option", () => {
    const slugs = HIRABLE_RULE_OPTIONS.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const opt of HIRABLE_RULE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe("hirableSelectionFromApi", () => {
  it("sépare les règles globales des rosters ciblés", () => {
    const selection = hirableSelectionFromApi([
      { rule: "all", roster: null },
      { rule: "old_world_classic", roster: null },
      {
        rule: "skaven",
        roster: { id: "roster-skaven", slug: "skaven", name: "Skavens" },
      },
    ]);
    expect(selection).toEqual({
      rules: ["all", "old_world_classic"],
      rosterIds: ["roster-skaven"],
    });
  });

  it("tolère une liste absente et dédoublonne", () => {
    expect(hirableSelectionFromApi(null)).toEqual({ rules: [], rosterIds: [] });
    expect(
      hirableSelectionFromApi([
        { rule: "all", roster: null },
        { rule: "all", roster: null },
      ]).rules,
    ).toEqual(["all"]);
  });
});

describe("hirableSelectionToPayload", () => {
  const rosters = [
    { id: "roster-skaven", slug: "skaven" },
    { id: "roster-orc", slug: "orc" },
  ];

  it("réémet le couple (règle, rosterId) pour un roster coché", () => {
    expect(
      hirableSelectionToPayload(
        { rules: ["all"], rosterIds: ["roster-skaven"] },
        rosters,
      ),
    ).toEqual(["all", { rule: "skaven", rosterId: "roster-skaven" }]);
  });

  it("ignore un roster absent du catalogue plutôt que d'envoyer un id nu", () => {
    expect(
      hirableSelectionToPayload({ rules: [], rosterIds: ["inconnu"] }, rosters),
    ).toEqual([]);
  });

  it("fait un aller-retour stable depuis l'API", () => {
    const api = [
      { rule: "old_world_classic", roster: null },
      {
        rule: "skaven",
        roster: { id: "roster-skaven", slug: "skaven", name: "Skavens" },
      },
    ];
    expect(
      hirableSelectionToPayload(hirableSelectionFromApi(api), rosters),
    ).toEqual([
      "old_world_classic",
      { rule: "skaven", rosterId: "roster-skaven" },
    ]);
  });
});

describe("toggleValue", () => {
  it("ajoute puis retire sans muter la liste d'origine", () => {
    const initial = ["block"];
    const added = toggleValue(initial, "dodge");
    expect(added).toEqual(["block", "dodge"]);
    expect(initial).toEqual(["block"]);
    expect(toggleValue(added, "block")).toEqual(["dodge"]);
  });
});
