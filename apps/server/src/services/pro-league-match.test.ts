import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    replay: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  ProMatchNotFoundError,
  getProMatchDetail,
} from "./pro-league-match";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const MATCH_ID = "m_123";

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    seasonId: "s1",
    status: "completed",
    scheduledAt: new Date("2026-09-15T21:00:00Z"),
    simulatedAt: new Date("2026-09-14T21:00:00Z"),
    completedAt: new Date("2026-09-15T21:08:00Z"),
    engineVer: "0.13.0",
    scoreHome: 3,
    scoreAway: 1,
    outcome: "home",
    touchdownCount: 4,
    casualtyCount: 2,
    turnoverCount: 5,
    nuffleCount: 3,
    season: { year: 2026 },
    round: { roundNumber: 4 },
    homeTeam: {
      slug: "buf-snow-ogres",
      name: "Snow Ogres",
      city: "Buffalo",
      race: "Ogre",
      nflFlavor: "Buffalo brutality",
      primaryColor: "#00338D",
      secondaryColor: "#C60C30",
      baseTv: 1100,
    },
    awayTeam: {
      slug: "gb-cheese-halflings",
      name: "Cheese Halflings",
      city: "Green Bay",
      race: "Halfling",
      nflFlavor: "Cheese underdogs",
      primaryColor: "#203731",
      secondaryColor: "#FFB612",
      baseTv: 700,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.replay.findUnique.mockResolvedValue(null);
});

describe("getProMatchDetail — sprint 1.C.3", () => {
  it("404 si le match n'existe pas", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expect(getProMatchDetail("unknown")).rejects.toThrow(
      ProMatchNotFoundError,
    );
  });

  it("formate les meta + dates ISO + équipes", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    const out = await getProMatchDetail(MATCH_ID);
    expect(out.id).toBe(MATCH_ID);
    expect(out.seasonYear).toBe(2026);
    expect(out.roundNumber).toBe(4);
    expect(out.status).toBe("completed");
    expect(out.scheduledAt).toBe("2026-09-15T21:00:00.000Z");
    expect(out.simulatedAt).toBe("2026-09-14T21:00:00.000Z");
    expect(out.completedAt).toBe("2026-09-15T21:08:00.000Z");
    expect(out.engineVer).toBe("0.13.0");
    expect(out.homeTeam.slug).toBe("buf-snow-ogres");
    expect(out.awayTeam.slug).toBe("gb-cheese-halflings");
    expect(out.homeTeam.race).toBe("Ogre");
    expect(out.homeTeam.baseTv).toBe(1100);
    expect(out.scoreHome).toBe(3);
    expect(out.outcome).toBe("home");
    expect(out.casualtyCount).toBe(2);
  });

  it("renvoie replay=null si pas de Replay row", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.findUnique.mockResolvedValue(null);
    const out = await getProMatchDetail(MATCH_ID);
    expect(out.replay).toBeNull();
  });

  it("inclut highlights + durationMs si Replay disponible (array natif)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.findUnique.mockResolvedValue({
      durationMs: 480_000,
      highlights: [
        { type: "TD", atMs: 30_000, meta: { team: "home" } },
        { type: "CASUALTY", atMs: 60_000, meta: { causedBy: "block" } },
      ],
    });
    const out = await getProMatchDetail(MATCH_ID);
    expect(out.replay?.durationMs).toBe(480_000);
    expect(out.replay?.highlights).toHaveLength(2);
    expect(out.replay?.highlights[0].type).toBe("TD");
  });

  it("parse highlights depuis JSON string (sqlite mirror)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.findUnique.mockResolvedValue({
      durationMs: 100,
      highlights: '[{"type":"NUFFLE","atMs":5000,"meta":{"id":"x"}}]',
    });
    const out = await getProMatchDetail(MATCH_ID);
    expect(out.replay?.highlights).toHaveLength(1);
    expect(out.replay?.highlights[0].type).toBe("NUFFLE");
  });

  it("filtre les types de highlights inconnus", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.findUnique.mockResolvedValue({
      durationMs: 100,
      highlights: [
        { type: "TD", atMs: 0, meta: {} },
        { type: "BOGUS", atMs: 0, meta: {} },
        { type: "CASUALTY", atMs: 1000 },
      ],
    });
    const out = await getProMatchDetail(MATCH_ID);
    // Filtre BOGUS, garde TD + CASUALTY (avec meta défaut {}).
    expect(out.replay?.highlights).toHaveLength(2);
    expect(out.replay?.highlights[1].type).toBe("CASUALTY");
    expect(out.replay?.highlights[1].meta).toEqual({});
  });

  it("renvoie scores=null pour un match scheduled non encore simulé", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({
        status: "scheduled",
        simulatedAt: null,
        completedAt: null,
        engineVer: null,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        touchdownCount: null,
        casualtyCount: null,
        turnoverCount: null,
        nuffleCount: null,
      }),
    );
    const out = await getProMatchDetail(MATCH_ID);
    expect(out.status).toBe("scheduled");
    expect(out.simulatedAt).toBeNull();
    expect(out.scoreHome).toBeNull();
    expect(out.outcome).toBeNull();
    expect(out.replay).toBeNull();
  });
});
