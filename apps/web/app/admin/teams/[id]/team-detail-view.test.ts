/**
 * Tests des helpers purs de la fiche admin d'équipe.
 */

import { describe, it, expect } from "vitest";

import {
  buildOwnerTeamNavigation,
  countPlayersByStatus,
  formatGold,
  playerStatusOf,
  rulesetLabel,
  sortPlayersByNumber,
  type AdminOwnerTeam,
  type AdminTeamPlayer,
} from "./team-detail-view";

function player(overrides: Partial<AdminTeamPlayer> = {}): AdminTeamPlayer {
  return {
    id: "p1",
    name: "Juninhorc",
    position: "black_orc_orque_noir",
    number: 2,
    ma: 4,
    st: 4,
    ag: 4,
    pa: 5,
    av: 10,
    skills: "brawler,grab",
    ...overrides,
  };
}

function ownerTeam(overrides: Partial<AdminOwnerTeam> = {}): AdminOwnerTeam {
  return {
    id: "t1",
    name: "Team 1",
    roster: "black_orc",
    ruleset: "season_3",
    teamValue: 1_000_000,
    currentValue: 1_000_000,
    createdAt: "2026-08-26T23:36:50.000Z",
    deletedAt: null,
    playerCount: 12,
    ...overrides,
  };
}

describe("formatGold", () => {
  it("formate en milliers de po avec séparateur de milliers", () => {
    // Le séparateur de `toLocaleString("fr-FR")` dépend de l'ICU du runtime
    // (espace fine insécable ou insécable) : on n'assert que le groupage.
    expect(formatGold(1_000_000)).toMatch(/^1\s000k po$/u);
    expect(formatGold(505_000)).toBe("505k po");
    expect(formatGold(0)).toBe("0k po");
  });

  it("rend un tiret pour une valeur absente", () => {
    expect(formatGold(null)).toBe("—");
    expect(formatGold(undefined)).toBe("—");
    expect(formatGold(Number.NaN)).toBe("—");
  });
});

describe("playerStatusOf", () => {
  it("dérive le statut de dead/firedAt, la mort primant", () => {
    expect(playerStatusOf(player())).toBe("active");
    expect(playerStatusOf(player({ firedAt: "2026-08-01T00:00:00Z" }))).toBe(
      "fired",
    );
    expect(playerStatusOf(player({ dead: true }))).toBe("dead");
    expect(
      playerStatusOf(player({ dead: true, firedAt: "2026-08-01T00:00:00Z" })),
    ).toBe("dead");
  });
});

describe("countPlayersByStatus", () => {
  it("compte actifs, morts et licenciés séparément", () => {
    const counts = countPlayersByStatus([
      player({ id: "a" }),
      player({ id: "b" }),
      player({ id: "c", dead: true }),
      player({ id: "d", firedAt: "2026-08-01T00:00:00Z" }),
    ]);
    expect(counts).toEqual({ active: 2, dead: 1, fired: 1 });
  });
});

describe("sortPlayersByNumber", () => {
  it("trie par numéro sans muter la source", () => {
    const source = [
      player({ id: "a", number: 3 }),
      player({ id: "b", number: 1 }),
      player({ id: "c", number: 2 }),
    ];
    const sorted = sortPlayersByNumber(source);
    expect(sorted.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(source.map((p) => p.number)).toEqual([3, 1, 2]);
  });
});

describe("buildOwnerTeamNavigation", () => {
  const teams = [
    ownerTeam({ id: "t1" }),
    ownerTeam({ id: "t2" }),
    ownerTeam({ id: "t3" }),
  ];

  it("situe l'équipe courante et expose ses voisines", () => {
    const nav = buildOwnerTeamNavigation(teams, "t2");
    expect(nav.position).toBe(2);
    expect(nav.total).toBe(3);
    expect(nav.previous?.id).toBe("t1");
    expect(nav.next?.id).toBe("t3");
  });

  it("n'invente pas de voisin aux extrémités", () => {
    expect(buildOwnerTeamNavigation(teams, "t1").previous).toBeNull();
    expect(buildOwnerTeamNavigation(teams, "t3").next).toBeNull();
  });

  it("préserve l'ordre serveur (plus récent d'abord)", () => {
    const nav = buildOwnerTeamNavigation(teams, "t1");
    expect(nav.teams.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("dégrade sans voisin quand l'équipe courante est absente", () => {
    const nav = buildOwnerTeamNavigation(teams, "inconnu");
    expect(nav.position).toBe(0);
    expect(nav.total).toBe(3);
    expect(nav.previous).toBeNull();
    expect(nav.next).toBeNull();
  });

  it("tolère une liste absente (chargement en cours)", () => {
    const nav = buildOwnerTeamNavigation(null, "t1");
    expect(nav.teams).toEqual([]);
    expect(nav.total).toBe(0);
  });
});

describe("rulesetLabel", () => {
  it("traduit les rulesets connus, sinon renvoie la valeur brute", () => {
    expect(rulesetLabel("season_3")).toBe("Saison 3");
    expect(rulesetLabel("season_2")).toBe("Saison 2");
    expect(rulesetLabel("season_9")).toBe("season_9");
    expect(rulesetLabel(null)).toBe("—");
  });
});
