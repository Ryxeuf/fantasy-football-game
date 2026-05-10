/**
 * Tests pour `getPlayerMatchHistory` (Lot L).
 *
 * Strategie : on mocke `prisma`, `decompressEvents` et `attributeSpp`
 * (le service réutilise la logique pure de pro-roster-spp). On vérifie
 * la composition (loop matches → mine replay → filter rewards by
 * rosterId) sans recoder les regles SPP.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), findMany: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
    replay: { findUnique: vi.fn() },
  },
}));
vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
}));
vi.mock("./pro-roster-spp", () => ({
  attributeSpp: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import { attributeSpp } from "./pro-roster-spp";
import {
  PlayerHistoryNotFoundError,
  getPlayerMatchHistory,
} from "./pro-player-match-history";

interface MockedPrisma {
  proTeamRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);
const mockedAttribute = vi.mocked(attributeSpp);

beforeEach(() => {
  vi.clearAllMocks();
});

const FAKE_MATCH = {
  id: "m1",
  status: "completed",
  scheduledAt: new Date("2026-09-15T21:00:00Z"),
  homeTeamId: "team_buf",
  awayTeamId: "team_gb",
  scoreHome: 3,
  scoreAway: 1,
  outcome: "home",
  seed: 42,
  round: { roundNumber: 4 },
  homeTeam: {
    slug: "buf-snow-ogres",
    name: "Snow Ogres",
    city: "Buffalo",
    primaryColor: "#00338D",
  },
  awayTeam: {
    slug: "gb-cheese-halflings",
    name: "Cheese Halflings",
    city: "Green Bay",
    primaryColor: "#203731",
  },
};

describe("getPlayerMatchHistory — Lot L", () => {
  it("404 si le joueur n'existe pas", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce(null);
    await expect(getPlayerMatchHistory("missing")).rejects.toThrow(
      PlayerHistoryNotFoundError,
    );
  });

  it("retourne les rewards du joueur depuis attributeSpp", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([FAKE_MATCH]);
    mocked.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("compressed"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([{ id: "p_self" }]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([{ id: "p_other" }]);
    mockedAttribute.mockReturnValueOnce({
      rewards: [
        {
          rosterId: "p_self",
          side: "home",
          tdCount: 1,
          casCount: 0,
          compCount: 1,
          mvpCount: 0,
          totalSpp: 4,
        },
        {
          rosterId: "p_other",
          side: "away",
          tdCount: 0,
          casCount: 1,
          compCount: 0,
          mvpCount: 0,
          totalSpp: 2,
        },
      ],
    });

    const out = await getPlayerMatchHistory("p_self");
    expect(out).toHaveLength(1);
    expect(out[0]!.matchId).toBe("m1");
    expect(out[0]!.isHome).toBe(true);
    expect(out[0]!.opponent.slug).toBe("gb-cheese-halflings");
    expect(out[0]!.scoreHome).toBe(3);
    expect(out[0]!.spp).toEqual({
      tdCount: 1,
      casCount: 0,
      compCount: 1,
      mvpCount: 0,
      totalSpp: 4,
    });
  });

  it("retourne SPP delta=0 si pas de reward pour ce joueur", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([FAKE_MATCH]);
    mocked.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("compressed"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([{ id: "p_self" }]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([]);
    mockedAttribute.mockReturnValueOnce({
      rewards: [
        {
          rosterId: "p_other",
          side: "away",
          tdCount: 1,
          casCount: 0,
          compCount: 0,
          mvpCount: 0,
          totalSpp: 3,
        },
      ],
    });
    const out = await getPlayerMatchHistory("p_self");
    expect(out[0]!.spp).toEqual({
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      totalSpp: 0,
    });
  });

  it("isHome=false si la team du joueur est awayTeam", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_gb",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([FAKE_MATCH]);
    mocked.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("c"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([{ id: "p_self" }]);
    mockedAttribute.mockReturnValueOnce({ rewards: [] });

    const out = await getPlayerMatchHistory("p_self");
    expect(out[0]!.isHome).toBe(false);
    expect(out[0]!.opponent.slug).toBe("buf-snow-ogres");
  });

  it("SPP=0 si pas de replay (ex: match scheduled rejoué)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([FAKE_MATCH]);
    mocked.replay.findUnique.mockResolvedValueOnce(null);

    const out = await getPlayerMatchHistory("p_self");
    expect(out[0]!.spp.totalSpp).toBe(0);
    // attributeSpp NE doit PAS être appelé si pas de replay
    expect(mockedAttribute).not.toHaveBeenCalled();
  });

  it("clamp limit à MAX_LIMIT=20 et utilise default=5", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    await getPlayerMatchHistory("p_self", 100);
    expect(mocked.proLeagueMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );

    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    await getPlayerMatchHistory("p_self");
    expect(mocked.proLeagueMatch.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("dedupe le sort par scheduledAt desc + status filter", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    await getPlayerMatchHistory("p_self");
    const call = mocked.proLeagueMatch.findMany.mock.calls[0]![0];
    expect(call.orderBy).toEqual({ scheduledAt: "desc" });
    expect(call.where.status).toEqual({ in: ["completed", "ready"] });
    expect(call.where.OR).toEqual([
      { homeTeamId: "team_buf" },
      { awayTeamId: "team_buf" },
    ]);
  });

  it("inclut le joueur retired/dead dans les sets via fallback teamId", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team_buf",
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([FAKE_MATCH]);
    mocked.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("c"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    // Le joueur a été retired → absent des deux sets actifs
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([
      { id: "p_other_home" },
    ]);
    mocked.proTeamRoster.findMany.mockResolvedValueOnce([
      { id: "p_other_away" },
    ]);
    mockedAttribute.mockReturnValueOnce({ rewards: [] });

    await getPlayerMatchHistory("p_retired");
    // Le set home passé à attributeSpp doit contenir p_retired (fallback)
    const args = mockedAttribute.mock.calls[0]![0];
    expect(args.homeRosterIds.has("p_retired")).toBe(true);
  });
});
