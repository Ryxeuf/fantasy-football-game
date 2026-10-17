import { describe, it, expect } from "vitest";
import {
  buildCupRosterView,
  cupActorKey,
  cupTeamTallies,
  type CupRosterMatch,
} from "./cup-team-roster";
import type { CupPlayerActionLike } from "./cup-player-stats";
import type { RosterSnapshot } from "./cup-roster-snapshot";

function action(
  playerTeam: "A" | "B",
  playerId: string,
  actionType: string,
  extra: Partial<CupPlayerActionLike> = {},
): CupPlayerActionLike {
  return {
    actionType,
    playerTeam,
    playerId,
    playerName: extra.playerName ?? playerId,
    armorBroken: extra.armorBroken ?? false,
    opponentState: extra.opponentState ?? null,
    opponentId: extra.opponentId ?? null,
    opponentName: extra.opponentName ?? null,
  };
}

const MATCHES: CupRosterMatch[] = [
  {
    teamAId: "T1",
    teamBId: "T2",
    actions: [
      action("A", "p1", "td"),
      action("A", "p1", "td"),
      action("A", "p2", "blocage", { armorBroken: true, opponentState: "elimine" }),
      // Bloc sans sortie : ne compte pas comme élimination.
      action("A", "p2", "blocage", { armorBroken: true, opponentState: "ko" }),
      action("A", "p3", "aggression"),
      action("A", "star-home-morg_n_thorg", "td", { playerName: "Morg" }),
      // Geste de l'adversaire : jamais crédité à T1.
      action("B", "x1", "td"),
    ],
  },
  {
    teamAId: "T3",
    teamBId: "T1",
    actions: [
      action("B", "p1", "passe"),
      action("B", "p2", "interception"),
      action("B", "star-away-morg_n_thorg", "td", { playerName: "Morg" }),
    ],
  },
  // Rencontre d'autres équipes : ignorée.
  { teamAId: "T2", teamBId: "T3", actions: [action("A", "p1", "td")] },
];

describe("cupActorKey", () => {
  it("regroupe un Star Player d'un côté à l'autre", () => {
    expect(cupActorKey("star-home-morg_n_thorg")).toBe("star:morg_n_thorg");
    expect(cupActorKey("star-away-morg_n_thorg")).toBe("star:morg_n_thorg");
    expect(cupActorKey("p1")).toBe("p1");
  });
});

describe("cupTeamTallies", () => {
  const tallies = cupTeamTallies("T1", MATCHES);

  it("compte les rencontres de l'équipe, pas celles des autres", () => {
    expect(tallies.matchesPlayed).toBe(2);
  });

  it("crédite les gestes de l'équipe, à domicile comme à l'extérieur", () => {
    expect(tallies.byKey.get("p1")).toEqual({
      touchdowns: 2,
      casualties: 0,
      aggressions: 0,
      completions: 1,
      interceptions: 0,
    });
    expect(tallies.byKey.get("p2")).toMatchObject({ casualties: 1, interceptions: 1 });
    expect(tallies.byKey.get("p3")).toMatchObject({ aggressions: 1 });
    expect(tallies.byKey.get("star:morg_n_thorg")).toMatchObject({ touchdowns: 2 });
    expect(tallies.byKey.has("x1")).toBe(false);
  });
});

const SNAPSHOT: RosterSnapshot = {
  capturedAt: 1_790_000_000_000,
  roster: "human",
  ruleset: "season_3",
  format: "bb11",
  teamValue: 1_050_000,
  currentValue: 1_050_000,
  treasury: 0,
  initialBudget: 1150,
  startingPspPool: 0,
  rerolls: 3,
  cheerleaders: 1,
  assistants: 2,
  apothecary: true,
  dedicatedFans: 2,
  players: [
    {
      id: "p2",
      name: "Blitzer",
      position: "human_blitzer",
      number: 2,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      spp: 6,
      advancements: "[]",
    },
    {
      id: "p1",
      name: "Lanceur",
      position: "human_thrower",
      number: 1,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 2,
      av: 9,
      skills: "sure-hands,pass",
      spp: 0,
      advancements: "[]",
    },
    // Snapshot antérieur aux ids : repli sur le nom.
    {
      name: "p3",
      position: "human_lineman",
      number: 3,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
      spp: 0,
      advancements: "[]",
    },
  ],
  starPlayers: [{ starPlayerSlug: "morg_n_thorg", cost: 380_000 }],
  inducements: [{ slug: "bribe", name: "Pot-de-vin", quantity: 2, unitCost: 100_000 }],
};

const META = {
  raceName: "Humains",
  positionName: (slug: string) => ({ human_blitzer: "Blitzer" })[slug] ?? slug,
  playerValue: (position: string) => (position === "human_blitzer" ? 85_000 : 50_000),
  specialRules: [],
  regionalLeagues: [],
};

describe("buildCupRosterView", () => {
  const view = buildCupRosterView({
    cup: { id: "C1", name: "Coupe" },
    team: {
      id: "T1",
      name: "Les Griffons",
      roster: "human",
      ruleset: "season_3",
      coachName: "Sepp",
      logoUrl: null,
      regionalLeague: null,
    },
    snapshot: SNAPSHOT,
    source: "registration",
    tallies: cupTeamTallies("T1", MATCHES),
    meta: META,
  });

  it("sert le roster D'INSCRIPTION, trié par numéro, Star Players en fin", () => {
    expect(view.source).toBe("registration");
    expect(view.registeredAt).toBe(SNAPSHOT.capturedAt);
    expect(view.players.map((p) => p.name)).toEqual([
      "Lanceur",
      "Blitzer",
      "p3",
      "Morg 'n' Thorg",
    ]);
    const star = view.players[3];
    expect(star.note).toBe("Star Player");
    expect(star.number).toBeNull();
    expect(star.value).toBe(380_000);
    expect(star.totalTouchdowns).toBe(2);
  });

  it("porte les statistiques DE LA COUPE et la valeur de chaque joueur", () => {
    const blitzer = view.players.find((p) => p.id === "p2")!;
    expect(blitzer.positionName).toBe("Blitzer");
    expect(blitzer.value).toBe(85_000);
    expect(blitzer.totalCasualties).toBe(1);
    expect(blitzer.totalInterceptions).toBe(1);
    // Résurrection : chaque joueur inscrit joue chaque rencontre de l'équipe.
    expect(blitzer.matchesPlayed).toBe(2);
    // Snapshot sans id : statistiques retrouvées par le nom.
    expect(view.players.find((p) => p.name === "p3")!.aggressions).toBe(1);
  });

  it("reprend les valeurs, le staff et les coups de pouce figés à l'inscription", () => {
    expect(view.team).toMatchObject({
      raceName: "Humains",
      coachName: "Sepp",
      teamValue: 1_050_000,
      rerolls: 3,
      apothecary: true,
      cupMatchesPlayed: 2,
    });
    expect(view.inducements).toEqual([
      { name: "Pot-de-vin", quantity: 2, unitCost: 100_000 },
    ]);
  });

  it("n'annonce pas de date d'inscription en repli sur l'équipe en direct", () => {
    const live = buildCupRosterView({
      cup: { id: "C1", name: "Coupe" },
      team: {
        id: "T1",
        name: "Les Griffons",
        roster: "human",
        ruleset: "season_3",
        coachName: null,
        logoUrl: null,
        regionalLeague: null,
      },
      snapshot: SNAPSHOT,
      source: "live",
      tallies: cupTeamTallies("T1", []),
      meta: META,
    });
    expect(live.source).toBe("live");
    expect(live.registeredAt).toBeNull();
    expect(live.team.cupMatchesPlayed).toBe(0);
  });
});
