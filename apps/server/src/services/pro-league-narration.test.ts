import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    replay: { findUnique: vi.fn() },
    proTeamRoster: { findMany: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
  narrateMatch: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents, narrateMatch } from "@bb/sim-engine";
import {
  NarrationError,
  getMatchNarration,
} from "./pro-league-narration";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
  proTeamRoster: { findMany: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);
const mockedNarrate = vi.mocked(narrateMatch);

beforeEach(() => {
  vi.resetAllMocks();
});

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  try {
    await p;
    throw new Error("expected throw");
  } catch (err) {
    expect(err).toBeInstanceOf(NarrationError);
    expect((err as NarrationError).code).toBe(code);
  }
}

const matchSelect = {
  id: "m1",
  status: "completed",
  scoreHome: 2,
  scoreAway: 1,
  homeTeamId: "h",
  awayTeamId: "a",
  homeTeam: { name: "Gold Rush" },
  awayTeam: { name: "Iron Bears" },
};

describe("getMatchNarration — Lot 3.E.4", () => {
  it("throw MATCH_NOT_FOUND si match inconnu", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expectCode(getMatchNarration("missing"), "MATCH_NOT_FOUND");
  });

  it("throw MATCH_NOT_REPLAYABLE si status != completed", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      ...matchSelect,
      status: "ready",
    });
    await expectCode(getMatchNarration("m1"), "MATCH_NOT_REPLAYABLE");
  });

  it("throw REPLAY_NOT_FOUND si Replay manquant", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(matchSelect);
    mocked.replay.findUnique.mockResolvedValue(null);
    await expectCode(getMatchNarration("m1"), "REPLAY_NOT_FOUND");
  });

  it("appelle narrateMatch avec les rosters mappés + retourne le texte", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(matchSelect);
    mocked.replay.findUnique.mockResolvedValue({
      payload: Buffer.from([1, 2, 3]),
    });
    mocked.proTeamRoster.findMany
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "Vraskar",
          position: "Lineman",
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: ["block"],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "p2",
          name: "Krek",
          position: "Blitzer",
          ma: 7,
          st: 3,
          ag: 3,
          pa: 3,
          av: 9,
          skills: '["dodge"]',
        },
      ]);
    mockedDecompress.mockResolvedValue([
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.21.0",
      } as never,
    ]);
    mockedNarrate.mockReturnValue("=== narration text ===");

    const out = await getMatchNarration("m1");
    expect(out.matchId).toBe("m1");
    expect(out.narration).toBe("=== narration text ===");
    expect(out.engineVer).toBe("0.21.0");
    expect(out.rosterCount).toEqual({ home: 1, away: 1 });
    expect(out.eventCount).toBe(1);

    const [resultArg, optsArg] = mockedNarrate.mock.calls[0];
    expect(resultArg.events).toHaveLength(1);
    expect(resultArg.engineVer).toBe("0.21.0");
    expect(resultArg.summary.score).toEqual({ home: 2, away: 1 });
    expect(resultArg.result).toBe("home");
    expect(optsArg?.title).toBe("Gold Rush vs Iron Bears");
    expect(optsArg?.rosters?.home?.[0]).toMatchObject({
      id: "p1",
      name: "Vraskar",
      number: 1,
      position: "Lineman",
      skills: ["block"],
    });
    expect(optsArg?.rosters?.away?.[0]).toMatchObject({
      id: "p2",
      name: "Krek",
      number: 1,
      skills: ["dodge"],
    });
  });

  it("parse skills string JSON (sqlite mirror) ET array natif (PG)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(matchSelect);
    mocked.replay.findUnique.mockResolvedValue({ payload: Buffer.from([1]) });
    mocked.proTeamRoster.findMany
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "A",
          position: "Lineman",
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: '["block","tackle"]',
        },
      ])
      .mockResolvedValueOnce([]);
    mockedDecompress.mockResolvedValue([]);
    mockedNarrate.mockReturnValue("");

    await getMatchNarration("m1");
    const optsArg = mockedNarrate.mock.calls[0][1];
    expect(optsArg?.rosters?.home?.[0]?.skills).toEqual(["block", "tackle"]);
  });

  it("score draw → result='draw'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      ...matchSelect,
      scoreHome: 1,
      scoreAway: 1,
    });
    mocked.replay.findUnique.mockResolvedValue({ payload: Buffer.from([1]) });
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    mockedDecompress.mockResolvedValue([]);
    mockedNarrate.mockReturnValue("");

    await getMatchNarration("m1");
    const resultArg = mockedNarrate.mock.calls[0][0];
    expect(resultArg.result).toBe("draw");
  });
});
