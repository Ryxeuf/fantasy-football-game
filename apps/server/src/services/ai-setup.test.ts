/**
 * Tests for the server-side AI placement service.
 *
 * Covers the original "AI stuck in placement" bug: when the match transitions
 * into the `setup` phase with the AI as the current coach, the service must
 * auto-place the 11 AI players, validate the placement, and (if the second
 * team is also done) advance to `kickoff`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./game-broadcast", () => ({
  broadcastGameState: vi.fn(),
}));

import {
  setupPreMatchWithTeams,
  enterSetupPhase,
  validatePlayerPlacement,
  type ExtendedGameState,
  type TeamId,
} from "@bb/game-engine";
import { broadcastGameState } from "./game-broadcast";
import { runAISetupIfNeeded } from "./ai-setup";

function buildSetupState(
  currentCoach: TeamId,
  receivingTeam: TeamId = "A",
  preplaceHumanTeam: TeamId | null = null,
): ExtendedGameState {
  const teamA = Array.from({ length: 11 }, (_, i) => ({
    id: `A${i + 1}`,
    name: `A${i + 1}`,
    position: "Lineman",
    number: i + 1,
    ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: "",
  }));
  const teamB = Array.from({ length: 11 }, (_, i) => ({
    id: `B${i + 1}`,
    name: `B${i + 1}`,
    position: "Lineman",
    number: i + 1,
    ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: "",
  }));
  const base = setupPreMatchWithTeams(teamA, teamB, "Alpha", "Beta");
  const withCoinToss: ExtendedGameState = {
    ...base,
    preMatch: {
      ...base.preMatch,
      kickingTeam: receivingTeam === "A" ? "B" : "A",
      receivingTeam,
    },
  };
  // enterSetupPhase(state, receivingTeam) fait du parametre l'equipe receveuse
  // et l'installe comme coach courant. Pour atteindre un etat ou le coach
  // courant est l'equipe frappeuse (scenario "receveuse a fini de placer"), il
  // faut preplacer 11 joueurs pour la receveuse puis appeler
  // validatePlayerPlacement pour passer la main.
  let state = enterSetupPhase(withCoinToss, receivingTeam);
  if (preplaceHumanTeam) {
    const losX = preplaceHumanTeam === "A" ? 12 : 13;
    const backX = preplaceHumanTeam === "A" ? 6 : 18;
    const positions = [
      { x: losX, y: 6 }, { x: losX, y: 7 }, { x: losX, y: 8 },
      { x: backX, y: 0 }, { x: backX, y: 1 },
      { x: backX, y: 13 }, { x: backX, y: 14 },
      { x: backX, y: 4 }, { x: backX, y: 5 }, { x: backX, y: 9 }, { x: backX, y: 10 },
    ];
    const players = state.players.map((p) => ({ ...p }));
    let idx = 0;
    for (const p of players) {
      if (p.team === preplaceHumanTeam && idx < positions.length) {
        p.pos = positions[idx];
        idx += 1;
      }
    }
    state = { ...state, players };
    // Si la receveuse vient d'etre preplacee, on transitionne vers la
    // frappeuse pour respecter la semantique "11 joueurs places → au suivant".
    if (preplaceHumanTeam === receivingTeam) {
      state = validatePlayerPlacement(state);
    }
  }
  if (state.preMatch.currentCoach !== currentCoach) {
    throw new Error(
      `buildSetupState: expected currentCoach=${currentCoach} but state has ${state.preMatch.currentCoach}. ` +
        `Check receivingTeam/preplaceHumanTeam combination.`,
    );
  }
  return state;
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

describe("runAISetupIfNeeded", () => {
  it("returns not-ai-match when the match has no AI opponent", async () => {
    const db = makePrismaMock({
      match: { aiOpponent: false, aiTeamSide: null, aiUserId: null },
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-ai-match");
  });

  it("returns no-state when no game state turn exists", async () => {
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "B", aiUserId: "ai" },
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("no-state");
  });

  it("returns not-ai-turn when the AI is not the current coach", async () => {
    const state = buildSetupState("A", "A");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "B", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("not-ai-turn");
  });

  it("auto-places 11 AI players and advances to the human coach", async () => {
    const state = buildSetupState("B", "B");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "B", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(true);
    expect(report.reason).toBe("placed");
    const next = report.gameState!;
    const aiOnField = next.players.filter((p) => p.team === "B" && p.pos.x >= 0);
    expect(aiOnField).toHaveLength(11);
    expect(next.preMatch.phase).toBe("setup");
    expect(next.preMatch.currentCoach).toBe("A");
    expect(db.turn.create).toHaveBeenCalled();
    expect(broadcastGameState).toHaveBeenCalled();
  });

  it("advances straight to kickoff when AI places last", async () => {
    const state = buildSetupState("A", "B", "B");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(true);
    const next = report.gameState!;
    expect(["kickoff", "kickoff-sequence"]).toContain(next.preMatch.phase);
    expect(db.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "active" }) }),
    );
  });

  it("handles AI placing both as receivingTeam and kickingTeam if human is absent", async () => {
    const state = buildSetupState("A", "A");
    const db = makePrismaMock({
      match: { aiOpponent: true, aiTeamSide: "A", aiUserId: "ai" },
      turns: [{ payload: { gameState: state } }],
    });
    const report = await runAISetupIfNeeded("m1", db as any);
    expect(report.ran).toBe(true);
    expect(
      report.gameState!.preMatch.phase === "setup" ||
        report.gameState!.preMatch.phase.startsWith("kickoff"),
    ).toBe(true);
  });
});
