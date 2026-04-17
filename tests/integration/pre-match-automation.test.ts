import { describe, it, expect, vi } from "vitest";
import type { ExtendedGameState } from "@bb/game-engine";

// Mock game-engine functions to track calls and return predictable state transitions
const mockStartPreMatchSequence = vi.fn();
const mockCalculateFanFactor = vi.fn();
const mockDetermineWeather = vi.fn();
const mockAddJourneymen = vi.fn();
const mockMakeRNG = vi.fn();
const mockBroadcastGameState = vi.fn();

vi.mock("@bb/game-engine", () => ({
  startPreMatchSequence: (...args: any[]) => mockStartPreMatchSequence(...args),
  calculateFanFactor: (...args: any[]) => mockCalculateFanFactor(...args),
  determineWeather: (...args: any[]) => mockDetermineWeather(...args),
  addJourneymen: (...args: any[]) => mockAddJourneymen(...args),
  makeRNG: (...args: any[]) => mockMakeRNG(...args),
}));

vi.mock("../../apps/server/src/services/game-broadcast", () => ({
  broadcastGameState: (...args: any[]) => mockBroadcastGameState(...args),
}));

vi.mock("../../apps/server/src/prisma", () => ({
  prisma: {},
}));

import { runAutomatedPreMatchSequence } from "../../apps/server/src/services/pre-match-automation";

function makeBaseGameState(overrides: Partial<ExtendedGameState> = {}): ExtendedGameState {
  return {
    width: 26,
    height: 15,
    players: [],
    ball: undefined as any,
    currentPlayer: "A",
    turn: 0,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts: { teamA: { teamId: "A", zones: { reserves: { players: [] } } }, teamB: { teamId: "B", zones: { reserves: { players: [] } } } } as any,
    playerActions: {} as any,
    teamBlitzCount: {} as any,
    teamFoulCount: {} as any,
    half: 0,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: "Skaven", teamB: "Humans" },
    gameLog: [],
    preMatch: {
      phase: "idle",
      currentCoach: "A",
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "A",
      receivingTeam: "B",
    },
    matchStats: {} as any,
    ...overrides,
  } as ExtendedGameState;
}

function makePrismaMock(opts: {
  matchId?: string;
  turns?: any[];
  teamADedicatedFans?: number;
  teamBDedicatedFans?: number;
} = {}) {
  const turns: any[] = opts.turns || [];
  const prisma: any = {
    $transaction: vi
      .fn()
      .mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    match: {
      update: vi.fn().mockResolvedValue({}),
    },
    turn: {
      count: vi.fn().mockResolvedValue(turns.length),
      create: vi.fn().mockImplementation(async (args: any) => {
        turns.push(args.data);
        return args.data;
      }),
      findMany: vi.fn().mockImplementation(async () => [...turns]),
    },
    teamSelection: {
      findMany: vi.fn().mockResolvedValue([
        {
          userId: "u1",
          teamId: "t1",
          teamRef: { dedicatedFans: opts.teamADedicatedFans ?? 2 },
        },
        {
          userId: "u2",
          teamId: "t2",
          teamRef: { dedicatedFans: opts.teamBDedicatedFans ?? 3 },
        },
      ]),
    },
  };
  return prisma;
}

describe("runAutomatedPreMatchSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain: each function transitions the phase
    const rngFn = () => 0.5;
    mockMakeRNG.mockReturnValue(rngFn);

    mockStartPreMatchSequence.mockImplementation((state: ExtendedGameState) => ({
      ...state,
      preMatch: { ...state.preMatch, phase: "fans" },
    }));

    mockCalculateFanFactor.mockImplementation((state: ExtendedGameState) => ({
      ...state,
      preMatch: {
        ...state.preMatch,
        phase: "weather",
        fanFactor: {
          teamA: { d3: 2, dedicatedFans: 2, total: 4 },
          teamB: { d3: 1, dedicatedFans: 3, total: 4 },
        },
      },
    }));

    mockDetermineWeather.mockImplementation((state: ExtendedGameState) => ({
      ...state,
      preMatch: {
        ...state.preMatch,
        phase: "journeymen",
        weather: { total: 7, condition: "Beau temps", description: "Conditions parfaites" },
      },
    }));

    mockAddJourneymen.mockImplementation((state: ExtendedGameState) => ({
      ...state,
      preMatch: {
        ...state.preMatch,
        phase: "inducements",
        journeymen: {
          teamA: { count: 0, players: [] },
          teamB: { count: 0, players: [] },
        },
      },
    }));
  });

  it("progresses game state from idle to inducements phase", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    const result = await runAutomatedPreMatchSequence(
      prisma as any,
      "match-1",
      gameState,
      "test-seed",
    );

    expect(result.preMatch.phase).toBe("inducements");
  });

  it("calls all pre-match engine functions in order", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "test-seed");

    expect(mockStartPreMatchSequence).toHaveBeenCalledTimes(1);
    expect(mockCalculateFanFactor).toHaveBeenCalledTimes(1);
    expect(mockDetermineWeather).toHaveBeenCalledTimes(1);
    expect(mockAddJourneymen).toHaveBeenCalledTimes(1);
  });

  it("uses dedicatedFans from team selections", async () => {
    const prisma = makePrismaMock({ teamADedicatedFans: 5, teamBDedicatedFans: 1 });
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "test-seed");

    // calculateFanFactor should be called with dedicatedFans from DB
    expect(mockCalculateFanFactor).toHaveBeenCalledWith(
      expect.anything(), // state after startPreMatchSequence
      expect.any(Function), // rng
      5, // dedicatedFansA
      1, // dedicatedFansB
    );
  });

  it("creates RNG from match seed with prematch suffix", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "my-seed");

    expect(mockMakeRNG).toHaveBeenCalledWith("my-seed-prematch");
  });

  it("persists the resulting state as a turn entry", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "test-seed");

    expect(prisma.turn.create).toHaveBeenCalledWith({
      data: {
        matchId: "match-1",
        number: 1,
        payload: expect.objectContaining({
          type: "pre-match-sequence",
          gameState: expect.objectContaining({
            preMatch: expect.objectContaining({ phase: "inducements" }),
          }),
        }),
      },
    });
  });

  it("broadcasts the final state via WebSocket", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "test-seed");

    expect(mockBroadcastGameState).toHaveBeenCalledWith(
      "match-1",
      expect.objectContaining({
        preMatch: expect.objectContaining({ phase: "inducements" }),
      }),
      expect.objectContaining({ type: "pre-match-sequence" }),
      "server",
    );
  });

  it("returns the state unchanged if already past idle phase", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState({
      preMatch: {
        phase: "inducements",
        currentCoach: "A",
        legalSetupPositions: [],
        placedPlayers: [],
        kickingTeam: "A",
        receivingTeam: "B",
      } as any,
    });

    const result = await runAutomatedPreMatchSequence(
      prisma as any,
      "match-1",
      gameState,
      "test-seed",
    );

    expect(result.preMatch.phase).toBe("inducements");
    expect(mockStartPreMatchSequence).not.toHaveBeenCalled();
  });

  it("passes 11 as required player count to addJourneymen", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    await runAutomatedPreMatchSequence(prisma as any, "match-1", gameState, "test-seed");

    expect(mockAddJourneymen).toHaveBeenCalledWith(
      expect.anything(), // state after determineWeather
      11, // teamARequired
      11, // teamBRequired
    );
  });

  it("stores fan factor and weather data in the persisted state", async () => {
    const prisma = makePrismaMock();
    const gameState = makeBaseGameState();

    const result = await runAutomatedPreMatchSequence(
      prisma as any,
      "match-1",
      gameState,
      "test-seed",
    );

    expect(result.preMatch.fanFactor).toBeDefined();
    expect(result.preMatch.weather).toBeDefined();
    expect(result.preMatch.journeymen).toBeDefined();
  });
});
