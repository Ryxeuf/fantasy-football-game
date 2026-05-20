import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyMatchup: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("./anthropic-client", () => ({
  callClaude: vi.fn(),
}));

vi.mock("./nfl-fantasy-admin-explorer", () => ({
  getMatchupDetailForAdmin: vi.fn(),
}));

import { prisma } from "../prisma";
import { callClaude } from "./anthropic-client";
import { getMatchupDetailForAdmin } from "./nfl-fantasy-admin-explorer";
import {
  NflFantasyGazetteError,
  buildMatchupUserPrompt,
  generateMatchupGazette,
  parseGazetteLLMResponse,
} from "./nfl-fantasy-gazette";

beforeEach(() => {
  vi.resetAllMocks();
});

function settledDetail(over: Record<string, unknown> = {}): unknown {
  return {
    id: "M1",
    leagueId: "L1",
    leagueName: "Replay 2024",
    seasonId: "2024",
    weekId: "2024:W3",
    home: {
      entryId: "E-home",
      userId: "U1",
      teamName: "Home Team",
      bbRace: "Skaven",
      score: 120,
      lineupId: "LU-home",
      captainPlayerId: "P1",
      viceCaptainPlayerId: "P2",
      lineupLockedAt: null,
      lineupTotalSpp: 120,
      starters: [
        {
          playerId: "P1",
          playerPseudonym: "Star QB",
          teamCode: "KC",
          nflPosition: "QB",
          bbPosition: "Thrower",
          isCaptain: true,
          isViceCaptain: false,
          rawSpp: 40,
          finalSpp: 60,
          sppBreakdown: null,
        },
        {
          playerId: "P2",
          playerPseudonym: "Vice WR",
          teamCode: "KC",
          nflPosition: "WR",
          bbPosition: "Catcher",
          isCaptain: false,
          isViceCaptain: true,
          rawSpp: 30,
          finalSpp: 36,
          sppBreakdown: null,
        },
        {
          playerId: "P3",
          playerPseudonym: "RB Star",
          teamCode: "KC",
          nflPosition: "RB",
          bbPosition: "Blitzer",
          isCaptain: false,
          isViceCaptain: false,
          rawSpp: 24,
          finalSpp: 24,
          sppBreakdown: null,
        },
      ],
    },
    away: {
      entryId: "E-away",
      userId: "U2",
      teamName: "Away Squad",
      bbRace: "Dwarf",
      score: 90,
      lineupId: "LU-away",
      captainPlayerId: null,
      viceCaptainPlayerId: null,
      lineupLockedAt: null,
      lineupTotalSpp: 90,
      starters: [
        {
          playerId: "Q1",
          playerPseudonym: "Opp Capt",
          teamCode: "BUF",
          nflPosition: "QB",
          bbPosition: "Thrower",
          isCaptain: true,
          isViceCaptain: false,
          rawSpp: 30,
          finalSpp: 45,
          sppBreakdown: null,
        },
      ],
    },
    winnerEntryId: "E-home",
    winnerSide: "home",
    settledAt: "2024-09-22T22:00:00.000Z",
    createdAt: "2024-09-15T00:00:00.000Z",
    gazette: null,
    ...over,
  };
}

describe("parseGazetteLLMResponse", () => {
  it("parse une reponse JSON valide", () => {
    const out = parseGazetteLLMResponse('{"title":"Boom","body":"Nuffle smiles"}');
    expect(out).toEqual({ title: "Boom", body: "Nuffle smiles" });
  });

  it("tolere les fences markdown", () => {
    const out = parseGazetteLLMResponse(
      '```json\n{"title":"T","body":"B"}\n```',
    );
    expect(out.title).toBe("T");
  });

  it("throw LLM_INVALID_JSON sur JSON invalide", () => {
    expect(() => parseGazetteLLMResponse("not json")).toThrow(
      NflFantasyGazetteError,
    );
  });

  it("throw LLM_INVALID_SHAPE si title manque", () => {
    expect(() => parseGazetteLLMResponse('{"body":"x"}')).toThrow(
      /title required/,
    );
  });

  it("throw LLM_INVALID_SHAPE si body vide", () => {
    expect(() => parseGazetteLLMResponse('{"title":"x","body":""}')).toThrow(
      /body required/,
    );
  });

  it("tronque title a 200 chars", () => {
    const longTitle = "x".repeat(300);
    const out = parseGazetteLLMResponse(
      JSON.stringify({ title: longTitle, body: "b" }),
    );
    expect(out.title.length).toBe(200);
  });
});

describe("buildMatchupUserPrompt", () => {
  it("inclut score + winner explicite", () => {
    const prompt = buildMatchupUserPrompt({
      seasonId: "2024",
      weekId: "2024:W3",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 100,
      awayScore: 80,
      winnerSide: "home",
      homeRace: "Skaven",
      awayRace: "Dwarf",
      homeTop: [],
      awayTop: [],
    });
    expect(prompt).toContain("H (home)");
    expect(prompt).toContain("100");
    expect(prompt).toContain("JSON strict");
  });

  it("dit EGALITE en cas de tie", () => {
    const prompt = buildMatchupUserPrompt({
      seasonId: "2024",
      weekId: "2024:W3",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 50,
      awayScore: 50,
      winnerSide: "tie",
      homeRace: null,
      awayRace: null,
      homeTop: [],
      awayTop: [],
    });
    expect(prompt).toContain("EGALITE");
  });
});

describe("generateMatchupGazette", () => {
  it("throw MATCHUP_NOT_FOUND si introuvable", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(null);
    await expect(generateMatchupGazette("X")).rejects.toMatchObject({
      code: "MATCHUP_NOT_FOUND",
    });
  });

  it("throw MATCHUP_NOT_SETTLED si pas settle", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(
      settledDetail({ settledAt: null }) as never,
    );
    await expect(generateMatchupGazette("M1")).rejects.toMatchObject({
      code: "MATCHUP_NOT_SETTLED",
    });
  });

  it("happy path : call LLM + parse + persist + return", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(
      settledDetail() as never,
    );
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      gazetteTitle: null,
      gazetteBody: null,
      gazetteGeneratedAt: null,
    } as never);
    vi.mocked(callClaude).mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Home Team etourdit Away Squad",
        body: "Nuffle a souri aux Skavens cette semaine. Star QB...",
      }),
      usage: { inputTokens: 500, outputTokens: 200 },
    });
    vi.mocked(prisma.nflFantasyMatchup.update).mockResolvedValueOnce(
      {} as never,
    );

    const out = await generateMatchupGazette("M1");

    expect(out.skipped).toBe(false);
    expect(out.title).toMatch(/Home Team/);
    expect(out.body).toMatch(/Nuffle/);
    expect(out.usage?.inputTokens).toBe(500);

    expect(prisma.nflFantasyMatchup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "M1" },
        data: expect.objectContaining({
          gazetteTitle: expect.any(String),
          gazetteBody: expect.any(String),
          gazetteGeneratedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("skip si gazette deja generee (idempotent)", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(
      settledDetail() as never,
    );
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      gazetteTitle: "Existing title",
      gazetteBody: "Existing body",
      gazetteGeneratedAt: new Date("2024-09-23T00:00:00Z"),
    } as never);

    const out = await generateMatchupGazette("M1");

    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("already_generated");
    expect(out.title).toBe("Existing title");
    expect(callClaude).not.toHaveBeenCalled();
    expect(prisma.nflFantasyMatchup.update).not.toHaveBeenCalled();
  });

  it("force=true regenere meme si deja present", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(
      settledDetail() as never,
    );
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      gazetteTitle: "Old title",
      gazetteBody: "Old body",
      gazetteGeneratedAt: new Date("2024-09-23T00:00:00Z"),
    } as never);
    vi.mocked(callClaude).mockResolvedValueOnce({
      text: JSON.stringify({ title: "New title", body: "New body" }),
    });
    vi.mocked(prisma.nflFantasyMatchup.update).mockResolvedValueOnce(
      {} as never,
    );

    const out = await generateMatchupGazette("M1", { force: true });
    expect(out.skipped).toBe(false);
    expect(out.title).toBe("New title");
    expect(callClaude).toHaveBeenCalledOnce();
  });

  it("propage NflFantasyGazetteError si LLM renvoie du JSON invalide", async () => {
    vi.mocked(getMatchupDetailForAdmin).mockResolvedValueOnce(
      settledDetail() as never,
    );
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      gazetteTitle: null,
      gazetteBody: null,
      gazetteGeneratedAt: null,
    } as never);
    vi.mocked(callClaude).mockResolvedValueOnce({ text: "not json" });

    await expect(generateMatchupGazette("M1")).rejects.toMatchObject({
      code: "LLM_INVALID_JSON",
    });
    expect(prisma.nflFantasyMatchup.update).not.toHaveBeenCalled();
  });
});
