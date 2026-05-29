import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyLeague: { findUnique: vi.fn() },
    nflWeek: { findUnique: vi.fn() },
    nflFantasyEntry: { findMany: vi.fn() },
    nflFantasyMatchup: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    nflFantasyLineup: { findMany: vi.fn(), update: vi.fn() },
    nflFantasyLineupStarter: { update: vi.fn() },
    nflGame: { findMany: vi.fn() },
    nflGameStat: { findMany: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
    nflFantasyPlayerCareer: { upsert: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  applyCaptainMultiplier,
  computeStandings,
  determineWinner,
  generateMatchups,
  getLeagueStandings,
  listMatchupsForWeek,
  NflFantasyScoringError,
  pairEntriesForWeek,
  settleNflFantasyWeek,
} from "./nfl-fantasy-scoring";

beforeEach(() => {
  vi.resetAllMocks();
  // Default no-op : la plupart des tests settle n'ont pas de carrieres
  // a fusionner. Les tests qui en ont une override ce mock.
  vi.mocked(prisma.nflFantasyPlayerCareer.findMany).mockResolvedValue(
    [] as never,
  );
});

// ────────────────────────────────────────────────────────────────────
// pairEntriesForWeek
// ────────────────────────────────────────────────────────────────────

describe("pairEntriesForWeek", () => {
  it("4 entries / W1 : (A,D) (B,C)", () => {
    const out = pairEntriesForWeek(["A", "B", "C", "D"], 1);
    expect(out).toEqual([
      { homeEntryId: "A", awayEntryId: "D" },
      { homeEntryId: "B", awayEntryId: "C" },
    ]);
  });

  it("4 entries / W2 : rotation differente", () => {
    const w1 = pairEntriesForWeek(["A", "B", "C", "D"], 1);
    const w2 = pairEntriesForWeek(["A", "B", "C", "D"], 2);
    const w3 = pairEntriesForWeek(["A", "B", "C", "D"], 3);

    // Aucune des 3 weeks ne doit avoir le meme set de paires que les autres
    const sig = (ps: { homeEntryId: string; awayEntryId: string }[]) =>
      ps
        .map((p) => [p.homeEntryId, p.awayEntryId].sort().join("-"))
        .sort()
        .join(",");

    expect(sig(w1)).not.toBe(sig(w2));
    expect(sig(w2)).not.toBe(sig(w3));
    expect(sig(w1)).not.toBe(sig(w3));
  });

  it("10 entries genere 5 paires distinctes", () => {
    const entries = Array.from({ length: 10 }, (_, i) => `E${i}`);
    const out = pairEntriesForWeek(entries, 1);
    expect(out).toHaveLength(5);

    const allIds = new Set<string>();
    for (const p of out) {
      expect(allIds.has(p.homeEntryId)).toBe(false);
      expect(allIds.has(p.awayEntryId)).toBe(false);
      allIds.add(p.homeEntryId);
      allIds.add(p.awayEntryId);
    }
    expect(allIds.size).toBe(10);
  });

  it("10 entries : 9 weeks distinctes avant repetition", () => {
    const entries = Array.from({ length: 10 }, (_, i) => `E${i}`);
    const sig = (ps: { homeEntryId: string; awayEntryId: string }[]) =>
      ps
        .map((p) => [p.homeEntryId, p.awayEntryId].sort().join("-"))
        .sort()
        .join(",");
    const sigs = new Set<string>();
    for (let w = 1; w <= 9; w++) {
      sigs.add(sig(pairEntriesForWeek(entries, w)));
    }
    expect(sigs.size).toBe(9);
  });

  it("retourne vide pour <2 entries", () => {
    expect(pairEntriesForWeek([], 1)).toEqual([]);
    expect(pairEntriesForWeek(["A"], 1)).toEqual([]);
  });

  it("throw ODD_ENTRIES si nombre impair", () => {
    expect(() => pairEntriesForWeek(["A", "B", "C"], 1)).toThrow(
      /Nombre d'entries impair/,
    );
  });

  it("deterministe (meme input -> meme output)", () => {
    const a = pairEntriesForWeek(["A", "B", "C", "D"], 5);
    const b = pairEntriesForWeek(["A", "B", "C", "D"], 5);
    expect(a).toEqual(b);
  });
});

// ────────────────────────────────────────────────────────────────────
// applyCaptainMultiplier
// ────────────────────────────────────────────────────────────────────

describe("applyCaptainMultiplier", () => {
  it("captain : ×1.5 (Q3)", () => {
    expect(
      applyCaptainMultiplier({
        rawSpp: 10,
        isCaptain: true,
        isViceCaptain: false,
      }),
    ).toBe(15);
  });

  it("vice : ×1.2 (Q3)", () => {
    expect(
      applyCaptainMultiplier({
        rawSpp: 10,
        isCaptain: false,
        isViceCaptain: true,
      }),
    ).toBe(12);
  });

  it("normal : raw inchange", () => {
    expect(
      applyCaptainMultiplier({
        rawSpp: 10,
        isCaptain: false,
        isViceCaptain: false,
      }),
    ).toBe(10);
  });

  it("captain prime sur vice si les deux flags", () => {
    expect(
      applyCaptainMultiplier({
        rawSpp: 10,
        isCaptain: true,
        isViceCaptain: true,
      }),
    ).toBe(15);
  });

  it("trunc vers 0 (pas d'arrondi)", () => {
    expect(
      applyCaptainMultiplier({
        rawSpp: 7,
        isCaptain: true,
        isViceCaptain: false,
      }),
    ).toBe(10); // 7 * 1.5 = 10.5 -> trunc 10
    expect(
      applyCaptainMultiplier({
        rawSpp: 7,
        isCaptain: false,
        isViceCaptain: true,
      }),
    ).toBe(8); // 7 * 1.2 = 8.4 -> 8
  });

  it("rawSpp=0 : reste 0", () => {
    expect(
      applyCaptainMultiplier({ rawSpp: 0, isCaptain: true, isViceCaptain: false }),
    ).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// determineWinner
// ────────────────────────────────────────────────────────────────────

describe("determineWinner", () => {
  it("home > away -> home", () => {
    expect(
      determineWinner({
        homeEntryId: "H",
        awayEntryId: "A",
        homeScore: 30,
        awayScore: 20,
      }),
    ).toBe("H");
  });

  it("home < away -> away", () => {
    expect(
      determineWinner({
        homeEntryId: "H",
        awayEntryId: "A",
        homeScore: 10,
        awayScore: 20,
      }),
    ).toBe("A");
  });

  it("tie -> null", () => {
    expect(
      determineWinner({
        homeEntryId: "H",
        awayEntryId: "A",
        homeScore: 15,
        awayScore: 15,
      }),
    ).toBeNull();
  });

  it("scores null -> null", () => {
    expect(
      determineWinner({
        homeEntryId: "H",
        awayEntryId: "A",
        homeScore: null,
        awayScore: null,
      }),
    ).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// generateMatchups
// ────────────────────────────────────────────────────────────────────

describe("generateMatchups", () => {
  it("cree N/2 matchups si none existing", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      entries: [
        { id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" },
      ],
    } as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      weekNumber: 10,
    } as never);
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflFantasyMatchup.createMany).mockResolvedValue({ count: 2 } as never);

    const result = await generateMatchups({ leagueId: "lg1", weekId: "2025:W10" });

    expect(result.matchupsCreated).toBe(2);
    expect(result.matchupsExisting).toBe(0);
    expect(result.weekNumber).toBe(10);
  });

  it("idempotent : skip si matchups deja existants", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      entries: [{ id: "e1" }, { id: "e2" }],
    } as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      weekNumber: 10,
    } as never);
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1" },
    ] as never);

    const result = await generateMatchups({ leagueId: "lg1", weekId: "2025:W10" });

    expect(result.matchupsCreated).toBe(0);
    expect(result.matchupsExisting).toBe(1);
    expect(prisma.nflFantasyMatchup.createMany).not.toHaveBeenCalled();
  });

  it("LEAGUE_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue(null);

    await expect(
      generateMatchups({ leagueId: "missing", weekId: "2025:W10" }),
    ).rejects.toThrow(/League missing introuvable/);
  });

  it("WEEK_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      entries: [],
    } as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(null);

    await expect(
      generateMatchups({ leagueId: "lg1", weekId: "missing" }),
    ).rejects.toThrow(/NflWeek missing introuvable/);
  });
});

// ────────────────────────────────────────────────────────────────────
// settleNflFantasyWeek
// ────────────────────────────────────────────────────────────────────

describe("settleNflFantasyWeek", () => {
  it("settle : sum finalSpp -> matchup scores + winnerId", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      {
        id: "m1",
        homeEntryId: "eHome",
        awayEntryId: "eAway",
        settledAt: null,
      },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([
      { id: "g1" },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH1", playerId: "p1", isCaptain: true, isViceCaptain: false, lineupId: "lHome" },
          { id: "sH2", playerId: "p2", isCaptain: false, isViceCaptain: true, lineupId: "lHome" },
          { id: "sH3", playerId: "p3", isCaptain: false, isViceCaptain: false, lineupId: "lHome" },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA1", playerId: "p4", isCaptain: true, isViceCaptain: false, lineupId: "lAway" },
          { id: "sA2", playerId: "p5", isCaptain: false, isViceCaptain: false, lineupId: "lAway" },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      { playerId: "p1", computedSpp: 10, sppBreakdown: { x: 1 } },
      { playerId: "p2", computedSpp: 10, sppBreakdown: null },
      { playerId: "p3", computedSpp: 5, sppBreakdown: null },
      // p4 absent -> rawSpp 0
      { playerId: "p5", computedSpp: 4, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflFantasyPlayerCareer.findMany).mockResolvedValue(
      [] as never,
    );
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    const result = await settleNflFantasyWeek({
      leagueId: "lg1",
      weekId: "2025:W10",
    });

    expect(result.matchupsSettled).toBe(1);
    expect(result.startersScored).toBe(5);

    // Inspecter le call a prisma.nflFantasyMatchup.update
    const matchupCalls = vi.mocked(prisma.nflFantasyMatchup.update).mock.calls;
    expect(matchupCalls).toHaveLength(1);
    const updateData = matchupCalls[0]![0].data as {
      homeScore: number;
      awayScore: number;
      winnerId: string;
    };

    // home : p1 captain (10*1.5=15) + p2 vice (10*1.2=12) + p3 (5) = 32
    expect(updateData.homeScore).toBe(32);
    // away : p4 captain (0*1.5=0) + p5 (4) = 4
    expect(updateData.awayScore).toBe(4);
    expect(updateData.winnerId).toBe("eHome");
  });

  it("merge bbSkills (seed) + skillsUnlocked (carriere) lors du scoring", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      {
        id: "m1",
        homeEntryId: "eHome",
        awayEntryId: "eAway",
        settledAt: null,
      },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([
      { id: "g1" },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          {
            id: "sH1",
            playerId: "p1",
            isCaptain: false,
            isViceCaptain: false,
            lineupId: "lHome",
          },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          {
            id: "sA1",
            playerId: "p1", // meme playerId que home, autre entry -> autre career
            isCaptain: false,
            isViceCaptain: false,
            lineupId: "lAway",
          },
        ],
      },
    ] as never);
    // 1 passing TD => +3 SPP brut; skill "pass" donne +1 SPP bonus.
    const passTdEvent = [
      { type: "TD", count: 1, spp: 3, reason: "1 passing TD" },
    ];
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      {
        playerId: "p1",
        computedSpp: 3,
        sppBreakdown: { events: passTdEvent, totalSpp: 3, mvpEligible: true },
      },
    ] as never);
    // bbSkills de seed : vide pour p1
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", bbSkills: "[]" },
    ] as never);
    // Carriere : eHome a deblocque "pass" sur p1, eAway non.
    vi.mocked(prisma.nflFantasyPlayerCareer.findMany).mockResolvedValue([
      { entryId: "eHome", playerId: "p1", skillsUnlocked: ["pass"] },
    ] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    // Le starter update doit refleter le bonus pour eHome (rawSpp=4)
    // et pas pour eAway (rawSpp=3).
    const starterUpdates = vi
      .mocked(prisma.nflFantasyLineupStarter.update)
      .mock.calls.map((c) => c[0]);
    const homeUpdate = starterUpdates.find(
      (u) => (u as { where: { id: string } }).where.id === "sH1",
    ) as { data: { rawSpp: number; finalSpp: number } } | undefined;
    const awayUpdate = starterUpdates.find(
      (u) => (u as { where: { id: string } }).where.id === "sA1",
    ) as { data: { rawSpp: number; finalSpp: number } } | undefined;
    expect(homeUpdate?.data.rawSpp).toBe(4); // 3 (TD) + 1 (pass bonus)
    expect(homeUpdate?.data.finalSpp).toBe(4); // pas C/V
    expect(awayUpdate?.data.rawSpp).toBe(3); // 3 (TD) seul, pas de skill
    expect(awayUpdate?.data.finalSpp).toBe(3);
  });

  it("idempotent : skip matchups deja settles", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(5);

    const result = await settleNflFantasyWeek({
      leagueId: "lg1",
      weekId: "2025:W10",
    });

    expect(result.matchupsSettled).toBe(0);
    expect(result.matchupsSkipped).toBe(5);
  });

  it("tie : winnerId null", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      {
        id: "m1",
        homeEntryId: "eHome",
        awayEntryId: "eAway",
        settledAt: null,
      },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH", playerId: "p1", isCaptain: false, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA", playerId: "p2", isCaptain: false, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      { playerId: "p1", computedSpp: 10, sppBreakdown: null },
      { playerId: "p2", computedSpp: 10, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const calls = vi.mocked(prisma.nflFantasyMatchup.update).mock.calls;
    const updateData = calls[0]![0].data as { winnerId: string | null };
    expect(updateData.winnerId).toBeNull();
  });

  it("starter sans stat (bye) : rawSpp = 0", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1", homeEntryId: "eHome", awayEntryId: "eAway", settledAt: null },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH", playerId: "pBye", isCaptain: false, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA", playerId: "p2", isCaptain: false, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      { playerId: "p2", computedSpp: 8, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const starterCalls = vi.mocked(prisma.nflFantasyLineupStarter.update).mock.calls;
    const byeCall = starterCalls.find((c) => c[0].where.id === "sH");
    expect(byeCall).toBeDefined();
    const data = byeCall![0].data as { rawSpp: number; finalSpp: number };
    expect(data.rawSpp).toBe(0);
    expect(data.finalSpp).toBe(0);
  });

  it("applique les bonus skills BB au rawSpp (avant captain multiplier)", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1", homeEntryId: "eHome", awayEntryId: "eAway", settledAt: null },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH", playerId: "pQB", isCaptain: false, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA", playerId: "pX", isCaptain: false, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      {
        playerId: "pQB",
        computedSpp: 10,
        sppBreakdown: {
          events: [
            { type: "TD", count: 2, spp: 6, reason: "2 passing TD" },
            { type: "CP", count: 4, spp: 4, reason: "4 CP (passing yards 300/75)" },
          ],
        },
      },
      { playerId: "pX", computedSpp: 5, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "pQB", bbSkills: ["pass", "safe-pair-of-hands"] },
      { id: "pX", bbSkills: [] },
    ] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const starterCalls = vi.mocked(prisma.nflFantasyLineupStarter.update).mock.calls;
    const qbCall = starterCalls.find((c) => c[0].where.id === "sH");
    expect(qbCall).toBeDefined();
    const data = qbCall![0].data as {
      rawSpp: number;
      finalSpp: number;
      sppBreakdown: { skillBonuses?: ReadonlyArray<{ skill: string; spp: number }> };
    };
    // computed 10 + bonus pass (+2 pour 2 TD passing) = 12
    expect(data.rawSpp).toBe(12);
    expect(data.finalSpp).toBe(12);
    expect(data.sppBreakdown.skillBonuses).toHaveLength(1);
    expect(data.sppBreakdown.skillBonuses?.[0]?.skill).toBe("pass");
    expect(data.sppBreakdown.skillBonuses?.[0]?.spp).toBe(2);
  });

  it("incrémente la carrière des joueurs scorés (sans bye)", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1", homeEntryId: "eHome", awayEntryId: "eAway", settledAt: null },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH1", playerId: "p1", isCaptain: false, isViceCaptain: false },
          { id: "sH2", playerId: "pBye", isCaptain: false, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA1", playerId: "p2", isCaptain: true, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      { playerId: "p1", computedSpp: 7, sppBreakdown: null },
      // pBye absent
      { playerId: "p2", computedSpp: 4, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const upserts = vi.mocked(prisma.nflFantasyPlayerCareer.upsert).mock.calls;
    // 2 upserts : p1 (eHome, +7) et p2 (eAway, +4). pBye skip car rawSpp=0.
    expect(upserts).toHaveLength(2);
    const byPlayer = new Map(
      upserts.map((c) => {
        const arg = c[0] as {
          create: { entryId: string; playerId: string; sppCareer: number };
          update: { sppCareer: { increment: number } };
        };
        return [arg.create.playerId, arg];
      }),
    );
    expect(byPlayer.get("p1")?.create.entryId).toBe("eHome");
    expect(byPlayer.get("p1")?.create.sppCareer).toBe(7);
    expect(byPlayer.get("p1")?.update.sppCareer.increment).toBe(7);
    expect(byPlayer.get("p2")?.create.entryId).toBe("eAway");
    expect(byPlayer.get("p2")?.create.sppCareer).toBe(4);
    expect(byPlayer.get("pBye")).toBeUndefined();
  });

  it("la carrière utilise rawSpp (pas finalSpp), donc captain n'inflige pas l'XP", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1", homeEntryId: "eHome", awayEntryId: "eAway", settledAt: null },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH", playerId: "pCap", isCaptain: true, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA", playerId: "pX", isCaptain: false, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      { playerId: "pCap", computedSpp: 10, sppBreakdown: null },
      { playerId: "pX", computedSpp: 0, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const upserts = vi.mocked(prisma.nflFantasyPlayerCareer.upsert).mock.calls;
    const capCall = upserts.find((c) => {
      const arg = c[0] as { create: { playerId: string } };
      return arg.create.playerId === "pCap";
    });
    const arg = capCall![0] as { create: { sppCareer: number } };
    expect(arg.create.sppCareer).toBe(10); // rawSpp = 10, pas 15 (finalSpp)
  });

  it("bonus skills + multiplier captain : bonus inclus dans la base multipliée", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      { id: "m1", homeEntryId: "eHome", awayEntryId: "eAway", settledAt: null },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.count).mockResolvedValue(1);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([{ id: "g1" }] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        id: "lHome",
        entryId: "eHome",
        starters: [
          { id: "sH", playerId: "pQB", isCaptain: true, isViceCaptain: false },
        ],
      },
      {
        id: "lAway",
        entryId: "eAway",
        starters: [
          { id: "sA", playerId: "pX", isCaptain: false, isViceCaptain: false },
        ],
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([
      {
        playerId: "pQB",
        computedSpp: 10,
        sppBreakdown: {
          events: [{ type: "TD", count: 2, spp: 6, reason: "2 passing TD" }],
        },
      },
      { playerId: "pX", computedSpp: 0, sppBreakdown: null },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "pQB", bbSkills: ["pass"] },
    ] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await settleNflFantasyWeek({ leagueId: "lg1", weekId: "2025:W10" });

    const starterCalls = vi.mocked(prisma.nflFantasyLineupStarter.update).mock.calls;
    const qbCall = starterCalls.find((c) => c[0].where.id === "sH");
    const data = qbCall![0].data as { rawSpp: number; finalSpp: number };
    // raw = 10 + 2 bonus = 12 ; final = 12 * 1.5 = 18
    expect(data.rawSpp).toBe(12);
    expect(data.finalSpp).toBe(18);
  });
});

// ────────────────────────────────────────────────────────────────────
// listMatchupsForWeek
// ────────────────────────────────────────────────────────────────────

describe("listMatchupsForWeek", () => {
  it("filtre par leagueId + weekId, tri createdAt asc", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([] as never);

    await listMatchupsForWeek({ leagueId: "lg1", weekId: "2025:W10" });

    expect(prisma.nflFantasyMatchup.findMany).toHaveBeenCalledWith({
      where: { leagueId: "lg1", weekId: "2025:W10" },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("NflFantasyScoringError", () => {
  it("preserve code + name", () => {
    const err = new NflFantasyScoringError("ODD_ENTRIES", "boom");
    expect(err.code).toBe("ODD_ENTRIES");
    expect(err.name).toBe("NflFantasyScoringError");
  });
});

// ────────────────────────────────────────────────────────────────────
// computeStandings (helper pur)
// ────────────────────────────────────────────────────────────────────

describe("computeStandings", () => {
  const entries = [
    { id: "A", teamName: "Team A" },
    { id: "B", teamName: "Team B" },
    { id: "C", teamName: "Team C" },
    { id: "D", teamName: "Team D" },
  ];
  const ts = new Date("2025-11-11T12:00:00Z");

  it("0 matchup : tous a 0", () => {
    const rows = computeStandings({ entries, matchups: [] });
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.wins).toBe(0);
      expect(r.games).toBe(0);
      expect(r.differential).toBe(0);
    }
  });

  it("ignore les matchups non settles", () => {
    const rows = computeStandings({
      entries,
      matchups: [
        {
          homeEntryId: "A",
          awayEntryId: "B",
          homeScore: 100,
          awayScore: 80,
          winnerId: "A",
          settledAt: null, // <- ignore
        },
      ],
    });
    const a = rows.find((r) => r.entryId === "A");
    expect(a?.wins).toBe(0);
    expect(a?.pointsFor).toBe(0);
  });

  it("W/L/T + PF/PA + differential", () => {
    const rows = computeStandings({
      entries,
      matchups: [
        // A bat B 100-80
        {
          homeEntryId: "A",
          awayEntryId: "B",
          homeScore: 100,
          awayScore: 80,
          winnerId: "A",
          settledAt: ts,
        },
        // C tie D 50-50
        {
          homeEntryId: "C",
          awayEntryId: "D",
          homeScore: 50,
          awayScore: 50,
          winnerId: null,
          settledAt: ts,
        },
      ],
    });
    const a = rows.find((r) => r.entryId === "A")!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(0);
    expect(a.pointsFor).toBe(100);
    expect(a.pointsAgainst).toBe(80);
    expect(a.differential).toBe(20);
    expect(a.games).toBe(1);

    const b = rows.find((r) => r.entryId === "B")!;
    expect(b.losses).toBe(1);
    expect(b.differential).toBe(-20);

    const c = rows.find((r) => r.entryId === "C")!;
    expect(c.ties).toBe(1);
    expect(c.pointsFor).toBe(50);
    expect(c.differential).toBe(0);
  });

  it("tri : wins desc -> differential desc -> pointsFor desc", () => {
    const rows = computeStandings({
      entries,
      matchups: [
        // A: 1W, +30 diff (110-80)
        { homeEntryId: "A", awayEntryId: "B", homeScore: 110, awayScore: 80, winnerId: "A", settledAt: ts },
        // C: 1W, +10 diff (60-50)
        { homeEntryId: "C", awayEntryId: "D", homeScore: 60, awayScore: 50, winnerId: "C", settledAt: ts },
      ],
    });
    // Tri attendu : A (1W +30), C (1W +10), B (0W -30), D (0W -10)
    // Wait : 0W mais B -30, D -10. Tri pour 0W : differential desc -> D (-10) > B (-30)
    expect(rows.map((r) => r.entryId)).toEqual(["A", "C", "D", "B"]);
  });

  it("entry sans matchup reste dans le tableau", () => {
    const rows = computeStandings({
      entries: [{ id: "A", teamName: "A" }, { id: "B", teamName: "B" }, { id: "Z", teamName: "Zelfo" }],
      matchups: [
        { homeEntryId: "A", awayEntryId: "B", homeScore: 50, awayScore: 30, winnerId: "A", settledAt: ts },
      ],
    });
    expect(rows).toHaveLength(3);
    const z = rows.find((r) => r.entryId === "Z");
    expect(z?.games).toBe(0);
  });
});

describe("getLeagueStandings", () => {
  it("fetch entries + settled matchups + compute", async () => {
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "A", teamName: "Team A" },
      { id: "B", teamName: "Team B" },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValue([
      {
        homeEntryId: "A",
        awayEntryId: "B",
        homeScore: 100,
        awayScore: 60,
        winnerId: "A",
        settledAt: new Date(),
      },
    ] as never);

    const rows = await getLeagueStandings("lg1");
    expect(rows[0]?.entryId).toBe("A");
    expect(rows[0]?.wins).toBe(1);
    expect(rows[1]?.entryId).toBe("B");
    expect(rows[1]?.losses).toBe(1);

    expect(prisma.nflFantasyMatchup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueId: "lg1", settledAt: { not: null } },
      }),
    );
  });
});
