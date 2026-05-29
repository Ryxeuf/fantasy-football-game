import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyMatchup: { findUnique: vi.fn() },
    nflFantasyEntry: { findMany: vi.fn() },
    nflFantasyLineup: { findMany: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
    nflTeam: { findMany: vi.fn() },
    nflWeek: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  computeCaptainBonus,
  computeOutcome,
  getMatchupDetail,
  MatchupDetailError,
  parseStarterBreakdown,
} from "./nfl-fantasy-matchup-detail";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

describe("computeCaptainBonus", () => {
  it("retourne 0 si ni captain ni vice", () => {
    expect(
      computeCaptainBonus({ rawSpp: 10, isCaptain: false, isViceCaptain: false }),
    ).toBe(0);
  });

  it("captain x1.5 = +50% (truncate)", () => {
    expect(
      computeCaptainBonus({ rawSpp: 10, isCaptain: true, isViceCaptain: false }),
    ).toBe(5);
    expect(
      computeCaptainBonus({ rawSpp: 7, isCaptain: true, isViceCaptain: false }),
    ).toBe(3); // trunc(10.5) - 7 = 10 - 7 = 3
  });

  it("vice x1.2 = +20% (truncate)", () => {
    expect(
      computeCaptainBonus({ rawSpp: 10, isCaptain: false, isViceCaptain: true }),
    ).toBe(2);
    expect(
      computeCaptainBonus({ rawSpp: 7, isCaptain: false, isViceCaptain: true }),
    ).toBe(1); // trunc(8.4) - 7 = 8 - 7 = 1
  });

  it("captain bat vice si les deux flags sont true (defensive)", () => {
    expect(
      computeCaptainBonus({ rawSpp: 10, isCaptain: true, isViceCaptain: true }),
    ).toBe(5);
  });

  it("rawSpp 0 → bonus 0 meme pour captain", () => {
    expect(
      computeCaptainBonus({ rawSpp: 0, isCaptain: true, isViceCaptain: false }),
    ).toBe(0);
  });
});

describe("computeOutcome", () => {
  it("pending si settledAt null", () => {
    expect(
      computeOutcome({
        settledAt: null,
        homeScore: null,
        awayScore: null,
        winnerEntryId: null,
        homeEntryId: "h",
        awayEntryId: "a",
      }),
    ).toBe("pending");
  });

  it("home-win si winnerEntryId === homeEntryId", () => {
    expect(
      computeOutcome({
        settledAt: new Date(),
        homeScore: 20,
        awayScore: 10,
        winnerEntryId: "h",
        homeEntryId: "h",
        awayEntryId: "a",
      }),
    ).toBe("home-win");
  });

  it("away-win si winnerEntryId === awayEntryId", () => {
    expect(
      computeOutcome({
        settledAt: new Date(),
        homeScore: 5,
        awayScore: 25,
        winnerEntryId: "a",
        homeEntryId: "h",
        awayEntryId: "a",
      }),
    ).toBe("away-win");
  });

  it("tie si settled mais winnerEntryId null", () => {
    expect(
      computeOutcome({
        settledAt: new Date(),
        homeScore: 15,
        awayScore: 15,
        winnerEntryId: null,
        homeEntryId: "h",
        awayEntryId: "a",
      }),
    ).toBe("tie");
  });
});

describe("parseStarterBreakdown", () => {
  it("payload null retourne arrays vides", () => {
    expect(parseStarterBreakdown(null)).toEqual({
      events: [],
      skillBonuses: [],
    });
  });

  it("payload PG natif object avec events + skillBonuses", () => {
    const raw = {
      events: [
        { type: "TD", count: 1, spp: 3, reason: "passing TD" },
        { type: "CP", count: 2, spp: 2, reason: "2 completions" },
      ],
      skillBonuses: [
        { skill: "pass", count: 1, spp: 1, reason: "passing TD" },
      ],
    };
    const out = parseStarterBreakdown(raw);
    expect(out.events).toHaveLength(2);
    expect(out.events[0].type).toBe("TD");
    expect(out.skillBonuses).toHaveLength(1);
    expect(out.skillBonuses[0].skill).toBe("pass");
  });

  it("payload sqlite string serialise", () => {
    const raw = JSON.stringify({
      events: [{ type: "TD", count: 1, spp: 3, reason: "rushing TD" }],
      skillBonuses: [],
    });
    const out = parseStarterBreakdown(raw);
    expect(out.events).toHaveLength(1);
    expect(out.events[0].reason).toBe("rushing TD");
    expect(out.skillBonuses).toEqual([]);
  });

  it("payload corrompu = arrays vides", () => {
    expect(parseStarterBreakdown("not-json")).toEqual({
      events: [],
      skillBonuses: [],
    });
  });

  it("ignore les skillBonuses mal formes", () => {
    const raw = {
      events: [],
      skillBonuses: [
        { skill: "pass" }, // manque count/spp/reason
        { skill: "catch", count: 1, spp: 1, reason: "TD" }, // OK
      ],
    };
    const out = parseStarterBreakdown(raw);
    expect(out.skillBonuses).toHaveLength(1);
    expect(out.skillBonuses[0].skill).toBe("catch");
  });
});

// ────────────────────────────────────────────────────────────────────
// getMatchupDetail (integration mock Prisma)
// ────────────────────────────────────────────────────────────────────

describe("getMatchupDetail", () => {
  it("throw MATCHUP_NOT_FOUND si matchup absent", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValue(
      null as never,
    );
    await expect(
      getMatchupDetail({ leagueId: "lg1", matchupId: "m1" }),
    ).rejects.toMatchObject({ code: "MATCHUP_NOT_FOUND" });
  });

  it("throw LEAGUE_MISMATCH si matchup d'une autre league", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValue({
      id: "m1",
      leagueId: "lg2",
      weekId: "2025:W10",
      homeEntryId: "e1",
      awayEntryId: "e2",
      homeScore: null,
      awayScore: null,
      winnerId: null,
      settledAt: null,
      gazetteTitle: null,
      gazetteBody: null,
      gazetteGeneratedAt: null,
    } as never);
    await expect(
      getMatchupDetail({ leagueId: "lg1", matchupId: "m1" }),
    ).rejects.toBeInstanceOf(MatchupDetailError);
  });

  it("matchup settled : assemble home + away avec starters tries par finalSpp desc", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValue({
      id: "m1",
      leagueId: "lg1",
      weekId: "2025:W10",
      homeEntryId: "e1",
      awayEntryId: "e2",
      homeScore: 18,
      awayScore: 12,
      winnerId: "e1",
      settledAt: new Date("2026-05-29T10:00:00Z"),
      gazetteTitle: null,
      gazetteBody: null,
      gazetteGeneratedAt: null,
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e1", teamName: "Home FC" },
      { id: "e2", teamName: "Away United" },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "l1",
        entryId: "e1",
        totalSpp: 18,
        starters: [
          {
            id: "s1",
            playerId: "p1",
            bbPosition: "Thrower",
            isCaptain: true,
            isViceCaptain: false,
            rawSpp: 8,
            finalSpp: 12,
            sppBreakdown: {
              events: [{ type: "TD", count: 1, spp: 3, reason: "passing TD" }],
              skillBonuses: [],
            },
          },
          {
            id: "s2",
            playerId: "p2",
            bbPosition: "Lineman",
            isCaptain: false,
            isViceCaptain: false,
            rawSpp: 6,
            finalSpp: 6,
            sppBreakdown: null,
          },
        ],
      },
      {
        id: "l2",
        entryId: "e2",
        totalSpp: 12,
        starters: [
          {
            id: "s3",
            playerId: "p3",
            bbPosition: "Blitzer",
            isCaptain: false,
            isViceCaptain: true,
            rawSpp: 10,
            finalSpp: 12,
            sppBreakdown: null,
          },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", pseudonym: "Mor'Vir", teamCode: "LAR", nflPosition: "QB" },
      { id: "p2", pseudonym: "Grim", teamCode: "LAR", nflPosition: "G" },
      { id: "p3", pseudonym: "Krak", teamCode: "MIA", nflPosition: "LB" },
    ] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValue([
      { code: "LAR", bbRace: "elf", raceLabel: "Elfes" },
      { code: "MIA", bbRace: "orc", raceLabel: "Orques" },
    ] as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      weekNumber: 10,
      isPlayoffs: false,
    } as never);

    const out = await getMatchupDetail({ leagueId: "lg1", matchupId: "m1" });

    expect(out.matchupId).toBe("m1");
    expect(out.weekNumber).toBe(10);
    expect(out.outcome).toBe("home-win");
    expect(out.margin).toBe(6);
    expect(out.winnerEntryId).toBe("e1");

    expect(out.home.teamName).toBe("Home FC");
    expect(out.home.starters).toHaveLength(2);
    // Tri : Mor'Vir finalSpp=12 avant Grim finalSpp=6
    expect(out.home.starters[0].playerId).toBe("p1");
    expect(out.home.starters[0].captainBonus).toBe(4); // 12 - 8
    expect(out.home.starters[0].raceLabel).toBe("Elfes");
    expect(out.home.starters[0].events).toHaveLength(1);
    expect(out.home.topScorerId).toBe("s1");

    expect(out.away.teamName).toBe("Away United");
    expect(out.away.starters[0].captainBonus).toBe(2); // vice 10 → 12
    expect(out.away.topScorerId).toBe("s3");
  });

  it("matchup pending : starters affiches sans SPP", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValue({
      id: "m1",
      leagueId: "lg1",
      weekId: "2025:W11",
      homeEntryId: "e1",
      awayEntryId: "e2",
      homeScore: null,
      awayScore: null,
      winnerId: null,
      settledAt: null,
      gazetteTitle: null,
      gazetteBody: null,
      gazetteGeneratedAt: null,
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e1", teamName: "A" },
      { id: "e2", teamName: "B" },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      weekNumber: 11,
      isPlayoffs: false,
    } as never);

    const out = await getMatchupDetail({ leagueId: "lg1", matchupId: "m1" });

    expect(out.outcome).toBe("pending");
    expect(out.margin).toBeNull();
    expect(out.settledAt).toBeNull();
    expect(out.home.totalSpp).toBe(0);
    expect(out.home.starters).toEqual([]);
  });

  it("expose la gazette si generee", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValue({
      id: "m1",
      leagueId: "lg1",
      weekId: "2025:W10",
      homeEntryId: "e1",
      awayEntryId: "e2",
      homeScore: 18,
      awayScore: 12,
      winnerId: "e1",
      settledAt: new Date(),
      gazetteTitle: "Glorieuse victoire",
      gazetteBody: "Lorem ipsum",
      gazetteGeneratedAt: new Date("2026-05-29T11:00:00Z"),
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e1", teamName: "A" },
      { id: "e2", teamName: "B" },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      weekNumber: 10,
      isPlayoffs: false,
    } as never);

    const out = await getMatchupDetail({ leagueId: "lg1", matchupId: "m1" });
    expect(out.gazette?.title).toBe("Glorieuse victoire");
    expect(out.gazette?.body).toBe("Lorem ipsum");
  });
});
