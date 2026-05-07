import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    replay: { findUnique: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import {
  ReplayDumpError,
  getMatchReplayDump,
} from "./pro-league-replay";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);

beforeEach(() => {
  vi.clearAllMocks();
});

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  try {
    await p;
    throw new Error("expected throw");
  } catch (err) {
    expect(err).toBeInstanceOf(ReplayDumpError);
    expect((err as ReplayDumpError).code).toBe(code);
  }
}

describe("getMatchReplayDump — sprint 1.G.1", () => {
  it("throw MATCH_NOT_FOUND si le match est inconnu", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expectCode(getMatchReplayDump("missing"), "MATCH_NOT_FOUND");
  });

  it("throw MATCH_NOT_REPLAYABLE si status='scheduled'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "scheduled",
    });
    await expectCode(getMatchReplayDump("m1"), "MATCH_NOT_REPLAYABLE");
  });

  it("throw MATCH_NOT_REPLAYABLE si status='in_progress'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "in_progress",
    });
    await expectCode(getMatchReplayDump("m1"), "MATCH_NOT_REPLAYABLE");
  });

  it("throw MATCH_NOT_REPLAYABLE si status='failed'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "failed",
    });
    await expectCode(getMatchReplayDump("m1"), "MATCH_NOT_REPLAYABLE");
  });

  it("throw REPLAY_NOT_FOUND si le replay manque pour un match completed", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
    });
    mocked.replay.findUnique.mockResolvedValue(null);
    await expectCode(getMatchReplayDump("m1"), "REPLAY_NOT_FOUND");
  });

  it("renvoie le dump trie pour un match completed", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
    });
    mocked.replay.findUnique.mockResolvedValue({
      payload: Buffer.from([1, 2, 3]),
      durationMs: 600_000,
    });
    // Events deliberement desordonnes pour valider le sort.
    mockedDecompress.mockResolvedValue([
      { type: "TURN_START", displayAtMs: 30_000, engineVer: "0.13.0" },
      { type: "KICKOFF", displayAtMs: 0, engineVer: "0.13.0" },
      { type: "TD", displayAtMs: 120_000, engineVer: "0.13.0" },
    ] as never);

    const out = await getMatchReplayDump("m1");
    expect(out.matchId).toBe("m1");
    expect(out.status).toBe("completed");
    expect(out.durationMs).toBe(600_000);
    expect(out.eventCount).toBe(3);
    expect(out.events.map((e) => e.type)).toEqual([
      "KICKOFF",
      "TURN_START",
      "TD",
    ]);
  });

  it("eventCount = 0 pour un replay vide (cas degenere)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
    });
    mocked.replay.findUnique.mockResolvedValue({
      payload: Buffer.from([]),
      durationMs: 0,
    });
    mockedDecompress.mockResolvedValue([] as never);

    const out = await getMatchReplayDump("m1");
    expect(out.eventCount).toBe(0);
    expect(out.events).toEqual([]);
  });
});
