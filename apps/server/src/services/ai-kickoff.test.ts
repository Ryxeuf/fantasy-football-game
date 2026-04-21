/**
 * Tests for the server-side AI kickoff automation service.
 *
 * Covers the "AI stuck in kickoff ball placement" bug: when the AI is the
 * kicking team during the `kickoff-sequence` → `place-ball` step, no client
 * submits on behalf of the AI, so the sequence never advances. The service
 * must place the ball in the receiving half and transition to
 * `kick-deviation`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./game-broadcast", () => ({
  broadcastGameState: vi.fn(),
}));

import {
  setupPreMatchWithTeams,
  startKickoffSequence,
  type ExtendedGameState,
  type TeamId,
} from "@bb/game-engine";
import { broadcastGameState } from "./game-broadcast";
import { runAIKickoffIfNeeded } from "./ai-kickoff";

function buildKickoffSequenceState(
  kickingTeam: TeamId,
): ExtendedGameState {
  const mkPlayers = (team: TeamId) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: `${team}${i + 1}`,
      name: `${team}${i + 1}`,
      position: "Lineman",
      number: i + 1,
      ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: "",
    }));

  const base = setupPreMatchWithTeams(mkPlayers("A"), mkPlayers("B"), "Alpha", "Beta");
  const receivingTeam: TeamId = kickingTeam === "A" ? "B" : "A";

  const atKickoff: ExtendedGameState = {
    ...base,
    preMatch: {
      ...base.preMatch,
      phase: "kickoff",
      kickingTeam,
      receivingTeam,
    },
  };

  return startKickoffSequence(atKickoff);
}

function makePrismaMock(opts: {
  match?: any;
  turns?: any[];
}) {
  const turns = opts.turns ?? [];
  return {
    match: {
      findUnique: vi.fn().mockResolvedValue(opts.match),
      update: vi.fn().mockResolvedValue(undefined),
    },
    turn: {
      findMany: vi.fn().mockImplementation(async () =>
        turns.map((t: any, i: number) => ({ number: i + 1, ...t })),
      ),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        turns.push({ payload: data.payload });
        return data;
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAIKickoffIfNeeded", () => {
  it("returns not-ai-match when the match has no AI opponent", async () => {
    const db = makePrismaMock({
      match: { aiOpponent: false, aiTeamSide: null, aiUserId: null },
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-ai-match");
  });

  it("returns no-state when no game state turn exists", async () => {
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("no-state");
  });

  it("returns not-kickoff-phase when the match is not in kickoff-sequence", async () => {
    const mkPlayers = (team: TeamId) =>
      Array.from({ length: 11 }, (_, i) => ({
        id: `${team}${i + 1}`,
        name: `${team}${i + 1}`,
        position: "Lineman",
        number: i + 1,
        ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: "",
      }));
    const state = setupPreMatchWithTeams(mkPlayers("A"), mkPlayers("B"), "Alpha", "Beta");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-kickoff-phase");
  });

  it("returns not-ai-kicking when the AI team is not the kicking team", async () => {
    // AI is B, kicking team is A → receiving team is B → AI receives, human kicks.
    const state = buildKickoffSequenceState("A");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "B", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-ai-kicking");
  });

  it("places the ball when the AI is the kicking team and advances to kick-deviation", async () => {
    const state = buildKickoffSequenceState("A");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(true);
    expect(report.reason).toBe("placed");
    const next = report.gameState!;
    expect(next.preMatch.phase).toBe("kickoff-sequence");
    expect(next.preMatch.kickoffStep).toBe("kick-deviation");
    // Ball must be in the receiving team's half (B → x in [13, 24]).
    expect(next.preMatch.ballPosition!.x).toBeGreaterThanOrEqual(13);
    expect(next.preMatch.ballPosition!.x).toBeLessThanOrEqual(24);
    expect(db.turn.create).toHaveBeenCalled();
    expect(broadcastGameState).toHaveBeenCalled();
  });

  it("places the ball when the AI (team B) is the kicking team → receiving A", async () => {
    const state = buildKickoffSequenceState("B");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "B", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(true);
    const next = report.gameState!;
    expect(next.preMatch.ballPosition!.x).toBeGreaterThanOrEqual(1);
    expect(next.preMatch.ballPosition!.x).toBeLessThanOrEqual(12);
  });

  it("is a no-op when the kickoff is already past the place-ball step", async () => {
    let state = buildKickoffSequenceState("A");
    state = {
      ...state,
      preMatch: { ...state.preMatch, kickoffStep: "kick-deviation" },
    };
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAIKickoffIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-place-ball-step");
  });
});
