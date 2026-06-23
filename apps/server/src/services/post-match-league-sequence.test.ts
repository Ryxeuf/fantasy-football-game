/**
 * L2.B.2 — Tests du service `post-match-league-sequence.ts`.
 *
 * Couvre :
 *  - runPostMatchLeagueSequence : skip si match manquant / pas
 *    league / pas score / sequence deja existante. Cree la sequence
 *    avec les bons compteurs sinon.
 *  - Detection des pendingChoices : SPP suffisant -> eligible.
 *  - applyAdvancementChoice : valide le SPP, decremente, push
 *    advancement, ajoute skill, recalcule currentValue.
 *  - markSequenceCompletedIfDone : ferme la sequence si tous les
 *    choix sont resolus.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Audit round 5 : `applyAdvancementChoice` wrap maintenant les 2 updates
// (teamPlayer + team) + re-read final dans une seule $transaction. Simule
// en partageant les memes mocks.
vi.mock("../prisma", () => {
  const teamPlayer = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const team = { update: vi.fn(), findUnique: vi.fn() };
  return {
    prisma: {
      match: { findUnique: vi.fn() },
      teamPlayer,
      team,
      // Acces primaire/secondaire (C2). Par defaut findFirst -> undefined,
      // donc la validation est skippee (les tests existants restent verts).
      position: { findFirst: vi.fn() },
      skill: { findFirst: vi.fn() },
      leaguePostMatchSequence: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (cb: any) => cb({ teamPlayer, team })),
    },
  };
});

import { prisma } from "../prisma";
import {
  runPostMatchLeagueSequence,
  applyAdvancementChoice,
  markSequenceCompletedIfDone,
} from "./post-match-league-sequence";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  matchFind: prisma.match.findUnique as MockFn,
  playerFindMany: prisma.teamPlayer.findMany as MockFn,
  playerFind: prisma.teamPlayer.findUnique as MockFn,
  playerUpdate: prisma.teamPlayer.update as MockFn,
  teamUpdate: prisma.team.update as MockFn,
  teamFind: prisma.team.findUnique as MockFn,
  seqFind: prisma.leaguePostMatchSequence.findUnique as MockFn,
  seqCreate: prisma.leaguePostMatchSequence.create as MockFn,
  seqUpdate: prisma.leaguePostMatchSequence.update as MockFn,
  positionFind: prisma.position.findFirst as MockFn,
  skillFind: prisma.skill.findFirst as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function buildMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    leagueSeasonId: "season-1",
    leagueScoredAt: new Date("2026-05-04"),
    leaguePostMatchSequence: null,
    teamSelections: [{ teamId: "team-A" }, { teamId: "team-B" }],
    ...overrides,
  };
}

describe("runPostMatchLeagueSequence", () => {
  it("skips when match does not exist", async () => {
    mocked.matchFind.mockResolvedValue(null);
    const out = await runPostMatchLeagueSequence({ matchId: "missing" });
    expect(out).toEqual({ skipped: true, reason: "match-missing" });
    expect(mocked.seqCreate).not.toHaveBeenCalled();
  });

  it("skips when match is not attached to a league", async () => {
    mocked.matchFind.mockResolvedValue(
      buildMatch({ leagueSeasonId: null }),
    );
    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    expect(out).toEqual({ skipped: true, reason: "not-a-league-match" });
  });

  it("skips when the match has not been scored yet", async () => {
    mocked.matchFind.mockResolvedValue(
      buildMatch({ leagueScoredAt: null }),
    );
    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    expect(out).toEqual({ skipped: true, reason: "match-not-scored" });
  });

  it("returns already-exists when a sequence is already attached", async () => {
    mocked.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: { id: "seq-1", status: "completed" },
      }),
    );
    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    expect(out).toEqual({
      skipped: true,
      reason: "already-exists",
      sequenceId: "seq-1",
    });
  });

  it("creates a sequence with status='completed' when no player is eligible", async () => {
    mocked.matchFind.mockResolvedValue(buildMatch());
    // Both teams: 1 player each with SPP < 3 (cheapest random-primary cost).
    mocked.playerFindMany.mockResolvedValue([
      { id: "p1", name: "Skuld", spp: 2, advancements: "[]" },
    ]);
    mocked.seqCreate.mockResolvedValue({ id: "seq-new", status: "completed" });

    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    if (!("created" in out)) throw new Error("expected created");
    expect(out.status).toBe("completed");
    expect(out.pendingChoices).toHaveLength(0);

    const args = mocked.seqCreate.mock.calls[0][0];
    expect(args.data.status).toBe("completed");
    expect(args.data.advancementsResolved).toBe(true);
    expect(args.data.completedAt).toBeInstanceOf(Date);
  });

  it("creates a sequence with awaiting_choices when at least one player is eligible", async () => {
    mocked.matchFind.mockResolvedValue(buildMatch());
    mocked.playerFindMany.mockResolvedValue([
      { id: "p1", name: "Star", spp: 7, advancements: "[]" },
      { id: "p2", name: "Junior", spp: 2, advancements: "[]" },
    ]);
    mocked.seqCreate.mockResolvedValue({
      id: "seq-new",
      status: "awaiting_choices",
    });

    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    if (!("created" in out)) throw new Error("expected created");
    expect(out.status).toBe("awaiting_choices");
    // 2 teams * 1 eligible each = 2 pendingChoices.
    expect(out.pendingChoices).toHaveLength(2);
    expect(out.pendingChoices[0].playerName).toBe("Star");
    expect(out.pendingChoices[0].nextAdvancementCost).toBe(3);
  });

  it("persists the snapshot deltas when provided", async () => {
    mocked.matchFind.mockResolvedValue(buildMatch());
    mocked.playerFindMany.mockResolvedValue([]);
    mocked.seqCreate.mockResolvedValue({ id: "seq-new", status: "completed" });

    await runPostMatchLeagueSequence({
      matchId: "match-1",
      winningsSnapshot: { teamA: 50000, teamB: 30000 },
      fanFactorSnapshot: { teamA: 1, teamB: -1 },
    });

    const args = mocked.seqCreate.mock.calls[0][0];
    expect(args.data.treasuryDeltaA).toBe(50000);
    expect(args.data.treasuryDeltaB).toBe(30000);
    expect(args.data.fanFactorDeltaA).toBe(1);
    expect(args.data.fanFactorDeltaB).toBe(-1);
  });

  it("skips dead players when collecting pendingChoices", async () => {
    mocked.matchFind.mockResolvedValue(buildMatch());
    mocked.playerFindMany.mockImplementation(
      async (args: { where: { dead: boolean } }) => {
        // The service must filter dead=false explicitly.
        expect(args.where.dead).toBe(false);
        return [];
      },
    );
    mocked.seqCreate.mockResolvedValue({ id: "seq-new", status: "completed" });
    await runPostMatchLeagueSequence({ matchId: "match-1" });
    expect(mocked.playerFindMany).toHaveBeenCalled();
  });

  it("caps advancements at 6 (no further pending choice)", async () => {
    mocked.matchFind.mockResolvedValue(buildMatch());
    mocked.playerFindMany.mockResolvedValue([
      // Player with 6 advancements should not be eligible regardless of SPP.
      {
        id: "p1",
        name: "Veteran",
        spp: 999,
        advancements: JSON.stringify([
          { type: "primary" },
          { type: "primary" },
          { type: "primary" },
          { type: "primary" },
          { type: "primary" },
          { type: "primary" },
        ]),
      },
    ]);
    mocked.seqCreate.mockResolvedValue({ id: "seq-new", status: "completed" });

    const out = await runPostMatchLeagueSequence({ matchId: "match-1" });
    if (!("created" in out)) throw new Error("expected created");
    expect(out.pendingChoices).toHaveLength(0);
  });
});

describe("applyAdvancementChoice", () => {
  it("returns player-not-found when the player does not exist", async () => {
    mocked.playerFind.mockResolvedValue(null);
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "missing",
      type: "primary",
      skillSlug: "block",
    });
    expect(out).toEqual({ skipped: true, reason: "player-not-found" });
  });

  it("returns player-not-on-team when the player belongs to another team", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "other-team",
      spp: 100,
      skills: "",
      advancements: "[]",
      dead: false,
    });
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "block",
    });
    expect(out).toEqual({ skipped: true, reason: "player-not-on-team" });
  });

  it("returns player-dead when the player is marked dead", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 100,
      skills: "",
      advancements: "[]",
      dead: true,
    });
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "block",
    });
    expect(out).toEqual({ skipped: true, reason: "player-dead" });
  });

  it("returns max-advancements-reached when the player already has 6", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 100,
      skills: "block",
      advancements: JSON.stringify(
        Array.from({ length: 6 }).map(() => ({
          skillSlug: "x",
          type: "primary",
          isRandom: false,
          at: 0,
        })),
      ),
      dead: false,
    });
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "block",
    });
    expect(out).toEqual({
      skipped: true,
      reason: "max-advancements-reached",
    });
  });

  it("returns insufficient-spp when SPP < cost", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 4,
      skills: "",
      advancements: "[]",
      dead: false,
    });
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "block",
    });
    expect(out).toEqual({
      skipped: true,
      reason: "insufficient-spp",
      required: 6,
      available: 4,
    });
  });

  it("decrements SPP, appends advancement, adds skill, and bumps currentValue", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 10,
      skills: "block",
      advancements: "[]",
      dead: false,
    });
    mocked.playerUpdate.mockResolvedValue({});
    mocked.teamUpdate.mockResolvedValue({});
    mocked.teamFind.mockResolvedValue({ currentValue: 1020000 });

    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "dodge",
    });
    if (!("applied" in out)) throw new Error("expected applied");
    expect(out.applied).toBe(true);
    expect(out.newSpp).toBe(4); // 10 - 6
    expect(out.newAdvancementCount).toBe(1);
    expect(out.addedSkill).toBe("dodge");
    expect(out.currentValue).toBe(1020000);

    const updateArgs = mocked.playerUpdate.mock.calls[0][0];
    expect(updateArgs.data.spp).toEqual({ decrement: 6 });
    expect(updateArgs.data.skills).toBe("block,dodge");
    const advancements = JSON.parse(updateArgs.data.advancements);
    expect(advancements).toHaveLength(1);
    expect(advancements[0].skillSlug).toBe("dodge");
    expect(advancements[0].type).toBe("primary");
    expect(advancements[0].isRandom).toBe(false);

    const teamArgs = mocked.teamUpdate.mock.calls[0][0];
    expect(teamArgs.data.currentValue).toEqual({ increment: 20000 });
  });

  it("uses surcharge=10000 for random-primary type", async () => {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 5,
      skills: "",
      advancements: "[]",
      dead: false,
    });
    mocked.playerUpdate.mockResolvedValue({});
    mocked.teamUpdate.mockResolvedValue({});
    mocked.teamFind.mockResolvedValue({ currentValue: 1010000 });

    await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "random-primary",
      skillSlug: "block",
    });

    const teamArgs = mocked.teamUpdate.mock.calls[0][0];
    expect(teamArgs.data.currentValue).toEqual({ increment: 10000 });
  });

  // --- Validation acces primaire/secondaire (C2) ---

  function mockEligiblePlayer() {
    mocked.playerFind.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      spp: 20,
      skills: "",
      advancements: "[]",
      dead: false,
      position: "dwarf_blocker",
      team: { roster: "dwarf", ruleset: "season_3" },
    });
    mocked.playerUpdate.mockResolvedValue({});
    mocked.teamUpdate.mockResolvedValue({});
    mocked.teamFind.mockResolvedValue({ currentValue: 1000000 });
  }

  it("rejette une skill hors du pool (categorie non autorisee pour le type)", async () => {
    mockEligiblePlayer();
    // Position : primaire G,S ; secondaire A.
    mocked.positionFind.mockResolvedValue({
      primarySkills: "G,S",
      secondarySkills: "A",
    });
    // Skill choisie = Mutation (code M), demandee en primaire -> hors pool.
    mocked.skillFind.mockResolvedValue({ category: "Mutation" });

    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "claws",
    });
    expect(out).toEqual({ skipped: true, reason: "skill-not-in-pool" });
    expect(mocked.playerUpdate).not.toHaveBeenCalled();
  });

  it("accepte une skill dans le pool primaire", async () => {
    mockEligiblePlayer();
    mocked.positionFind.mockResolvedValue({
      primarySkills: "G,S",
      secondarySkills: "A",
    });
    // Skill = Strength (code S) en primaire -> autorisee.
    mocked.skillFind.mockResolvedValue({ category: "Strength" });

    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "mighty-blow",
    });
    if (!("applied" in out)) throw new Error("expected applied");
    expect(out.applied).toBe(true);
    expect(out.addedSkill).toBe("mighty-blow");
  });

  it("rejette une skill secondaire prise en primaire mais l'accepte en secondaire", async () => {
    mockEligiblePlayer();
    mocked.positionFind.mockResolvedValue({
      primarySkills: "G,S",
      secondarySkills: "A",
    });
    mocked.skillFind.mockResolvedValue({ category: "Agility" }); // code A

    const rejected = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "dodge",
    });
    expect(rejected).toEqual({ skipped: true, reason: "skill-not-in-pool" });

    const accepted = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "secondary",
      skillSlug: "dodge",
    });
    if (!("applied" in accepted)) throw new Error("expected applied");
    expect(accepted.applied).toBe(true);
  });

  it("skip la validation quand l'acces n'est pas renseigne (position null)", async () => {
    mockEligiblePlayer();
    mocked.positionFind.mockResolvedValue(null); // pas de donnees d'acces

    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "n-importe-quoi",
    });
    if (!("applied" in out)) throw new Error("expected applied");
    expect(out.applied).toBe(true);
    // skill.findFirst ne doit meme pas etre interroge si pas d'acces.
    expect(mocked.skillFind).not.toHaveBeenCalled();
  });

  it("skip la validation quand les deux colonnes d'acces sont null", async () => {
    mockEligiblePlayer();
    mocked.positionFind.mockResolvedValue({
      primarySkills: null,
      secondarySkills: null,
    });
    mocked.skillFind.mockResolvedValue({ category: "Mutation" });

    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "primary",
      skillSlug: "claws",
    });
    if (!("applied" in out)) throw new Error("expected applied (no-data)");
    expect(out.applied).toBe(true);
  });
});

describe("markSequenceCompletedIfDone", () => {
  it("returns missing when sequence does not exist", async () => {
    mocked.seqFind.mockResolvedValue(null);
    const out = await markSequenceCompletedIfDone("seq-x");
    expect(out).toEqual({ closed: false, status: "missing" });
  });

  it("is idempotent when sequence is already completed", async () => {
    mocked.seqFind.mockResolvedValue({
      id: "seq-1",
      status: "completed",
      pendingChoices: "[]",
    });
    const out = await markSequenceCompletedIfDone("seq-1");
    expect(out).toEqual({ closed: false, status: "completed" });
    expect(mocked.seqUpdate).not.toHaveBeenCalled();
  });

  it("closes the sequence when all pending players have a new advancement", async () => {
    mocked.seqFind.mockResolvedValue({
      id: "seq-1",
      status: "awaiting_choices",
      pendingChoices: JSON.stringify([
        {
          teamPlayerId: "p1",
          playerName: "Star",
          spp: 10,
          advancementsTaken: 0,
          nextAdvancementCost: 3,
        },
      ]),
    });
    mocked.playerFind.mockResolvedValue({
      advancements: JSON.stringify([
        { skillSlug: "dodge", type: "primary", isRandom: false, at: 1 },
      ]),
    });
    mocked.seqUpdate.mockResolvedValue({});

    const out = await markSequenceCompletedIfDone("seq-1");
    expect(out).toEqual({ closed: true, status: "completed" });
    expect(mocked.seqUpdate).toHaveBeenCalledWith({
      where: { id: "seq-1" },
      data: {
        status: "completed",
        advancementsResolved: true,
        completedAt: expect.any(Date),
      },
    });
  });

  it("keeps the sequence open when at least one choice is still pending", async () => {
    mocked.seqFind.mockResolvedValue({
      id: "seq-1",
      status: "awaiting_choices",
      pendingChoices: JSON.stringify([
        {
          teamPlayerId: "p1",
          playerName: "Star",
          spp: 10,
          advancementsTaken: 0,
          nextAdvancementCost: 3,
        },
      ]),
    });
    // Player still has 0 advancements -> still pending.
    mocked.playerFind.mockResolvedValue({ advancements: "[]" });

    const out = await markSequenceCompletedIfDone("seq-1");
    expect(out).toEqual({ closed: false, status: "awaiting_choices" });
    expect(mocked.seqUpdate).not.toHaveBeenCalled();
  });
});

describe("applyAdvancementChoice — characteristic (BB2025)", () => {
  function buildCharPlayer(overrides: Record<string, unknown> = {}) {
    return {
      id: "p1",
      teamId: "t1",
      spp: 20,
      skills: "",
      advancements: "[]",
      dead: false,
      position: "skaven_lineman",
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      team: { roster: "skaven", ruleset: "season_3" },
      ...overrides,
    };
  }

  it("applies a characteristic improvement allowed by the D8 roll", async () => {
    mocked.playerFind.mockResolvedValue(buildCharPlayer({ spp: 14 }));
    mocked.playerUpdate.mockResolvedValue({});
    mocked.teamUpdate.mockResolvedValue({});
    mocked.teamFind.mockResolvedValue({ currentValue: 1060000 });

    // D8=3 -> [av, ma, pa]; on choisit MA.
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "characteristic",
      stat: "ma",
      d8: 3,
    });
    if (!("applied" in out)) throw new Error("expected applied");
    expect(out.applied).toBe(true);
    expect(out.newSpp).toBe(0); // 14 - 14
    expect(out.addedStat).toBe("ma");
    expect(out.addedSkill).toBe("");

    const data = mocked.playerUpdate.mock.calls[0][0].data;
    expect(data.spp).toEqual({ decrement: 14 });
    expect(data.ma).toBe(7); // 6 -> 7
    expect(data.skills).toBeUndefined(); // pas de skill ajoutee
    const adv = JSON.parse(data.advancements);
    expect(adv[0]).toMatchObject({ type: "characteristic", stat: "ma", d8: 3 });
    // Surcout VE +1 MA = +20k.
    expect(mocked.teamUpdate.mock.calls[0][0].data.currentValue).toEqual({
      increment: 20000,
    });
  });

  it("rejects a stat not allowed by the D8 roll (ST only on a 8)", async () => {
    mocked.playerFind.mockResolvedValue(buildCharPlayer());
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "characteristic",
      stat: "st", // Force
      d8: 3, // 3 -> [av, ma, pa], pas de ST
    });
    expect(out).toEqual({ skipped: true, reason: "stat-roll-mismatch" });
    expect(mocked.playerUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the characteristic is already at its cap", async () => {
    mocked.playerFind.mockResolvedValue(buildCharPlayer({ st: 5 })); // ST max 5
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "characteristic",
      stat: "st",
      d8: 8, // 8 autorise ST, mais deja au max
    });
    expect(out).toEqual({ skipped: true, reason: "stat-not-improvable" });
    expect(mocked.playerUpdate).not.toHaveBeenCalled();
  });

  it("rejects when d8 is missing", async () => {
    mocked.playerFind.mockResolvedValue(buildCharPlayer());
    const out = await applyAdvancementChoice({
      teamId: "t1",
      playerId: "p1",
      type: "characteristic",
      stat: "ma",
    });
    expect(out).toEqual({ skipped: true, reason: "missing-d8" });
  });
});
