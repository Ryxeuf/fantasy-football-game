/**
 * Tests pour la route publique GET /coach/:slug (S26.3c).
 *
 * Handler unitaire : on mocke `getCoachPublicProfile` du service. La
 * route est public-cache friendly (pas d'authentification).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/coach-profile", () => ({
  getCoachPublicProfile: vi.fn(),
  getCoachRecentTeams: vi.fn(),
  getCoachShowcaseAchievements: vi.fn(),
  listPublicCoachSlugs: vi.fn(),
  getCoachEloHistory: vi.fn(),
}));

import type { Request, Response } from "express";
import {
  getCoachEloHistory,
  getCoachPublicProfile,
  getCoachRecentTeams,
  getCoachShowcaseAchievements,
  listPublicCoachSlugs,
} from "../services/coach-profile";
import {
  handleGetCoachEloHistory,
  handleGetCoachPublicProfile,
  handleListPublicCoachSlugs,
} from "./coach";

const mockedGetProfile = vi.mocked(getCoachPublicProfile);
const mockedGetShowcase = vi.mocked(getCoachShowcaseAchievements);
const mockedGetRecentTeams = vi.mocked(getCoachRecentTeams);
const mockedListSlugs = vi.mocked(listPublicCoachSlugs);
const mockedGetEloHistory = vi.mocked(getCoachEloHistory);

function buildRes(): Response {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response;
}

describe("GET /coach/:slug — handleGetCoachPublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 + ApiResponse data when the coach exists", async () => {
    mockedGetProfile.mockResolvedValue({
      id: "u-1",
      slug: "coach-alpha",
      coachName: "Coach Alpha",
      eloRating: 1234,
      isSupporter: false,
      supporterTier: null,
      memberSince: "2025-12-01T00:00:00.000Z",
    });
    mockedGetShowcase.mockResolvedValue([]);
    mockedGetRecentTeams.mockResolvedValue([]);

    const req = { params: { slug: "coach-alpha" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: "u-1",
        slug: "coach-alpha",
        coachName: "Coach Alpha",
        eloRating: 1234,
        isSupporter: false,
        supporterTier: null,
        memberSince: "2025-12-01T00:00:00.000Z",
        achievements: [],
        recentTeams: [],
      },
    });
    expect(mockedGetProfile).toHaveBeenCalledWith("coach-alpha");
    expect(mockedGetShowcase).toHaveBeenCalledWith("u-1");
    expect(mockedGetRecentTeams).toHaveBeenCalledWith("u-1");
  });

  it("includes the showcase achievements in the response (S26.3f)", async () => {
    mockedGetProfile.mockResolvedValue({
      id: "u-1",
      slug: "coach-alpha",
      coachName: "Coach Alpha",
      eloRating: 1234,
      isSupporter: false,
      supporterTier: null,
      memberSince: "2025-12-01T00:00:00.000Z",
    });
    mockedGetShowcase.mockResolvedValue([
      {
        slug: "first-match",
        nameFr: "Premier pas",
        nameEn: "First step",
        icon: "🏆",
        category: "matches",
        unlockedAt: "2026-04-15T12:00:00.000Z",
      },
    ]);
    mockedGetRecentTeams.mockResolvedValue([]);

    const req = { params: { slug: "coach-alpha" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    const payload = res.body as {
      success: boolean;
      data: { achievements: Array<{ slug: string }> };
    };
    expect(payload.data.achievements.length).toBe(1);
    expect(payload.data.achievements[0].slug).toBe("first-match");
  });

  it("includes recent teams in the response (S26.3h)", async () => {
    mockedGetProfile.mockResolvedValue({
      id: "u-1",
      slug: "coach-alpha",
      coachName: "Coach Alpha",
      eloRating: 1234,
      isSupporter: false,
      supporterTier: null,
      memberSince: "2025-12-01T00:00:00.000Z",
    });
    mockedGetShowcase.mockResolvedValue([]);
    mockedGetRecentTeams.mockResolvedValue([
      {
        id: "t-1",
        name: "Skaven Stars",
        roster: "skaven",
        currentValue: 1500,
        createdAt: "2026-04-15T12:00:00.000Z",
      },
    ]);

    const req = { params: { slug: "coach-alpha" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    const payload = res.body as {
      success: boolean;
      data: { recentTeams: Array<{ id: string }> };
    };
    expect(payload.data.recentTeams.length).toBe(1);
    expect(payload.data.recentTeams[0].id).toBe("t-1");
  });

  it("does not call the showcase / recent-teams services when the profile is missing", async () => {
    mockedGetProfile.mockResolvedValue(null);

    const req = { params: { slug: "ghost-slug" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(404);
    expect(mockedGetShowcase).not.toHaveBeenCalled();
    expect(mockedGetRecentTeams).not.toHaveBeenCalled();
  });

  it("returns 404 when the slug does not match any coach", async () => {
    mockedGetProfile.mockResolvedValue(null);

    const req = { params: { slug: "ghost-slug" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: "Coach introuvable",
    });
  });

  it("returns 400 when the slug param is empty / missing", async () => {
    const req = { params: { slug: "" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false });
    expect(mockedGetProfile).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mockedGetProfile.mockRejectedValue(new Error("DB down"));

    const req = { params: { slug: "coach-alpha" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe("GET /coach — handleListPublicCoachSlugs (S26.3g)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 + ApiResponse with the slugs list", async () => {
    mockedListSlugs.mockResolvedValue(["coach-alpha", "emile"]);

    const req = {} as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleListPublicCoachSlugs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { slugs: ["coach-alpha", "emile"] },
    });
  });

  it("returns 200 with empty list when no public coach exists", async () => {
    mockedListSlugs.mockResolvedValue([]);

    const req = {} as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleListPublicCoachSlugs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { slugs: [] } });
  });

  it("returns 500 when the service throws", async () => {
    mockedListSlugs.mockRejectedValue(new Error("DB down"));

    const req = {} as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleListPublicCoachSlugs(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe("GET /coach/:slug/elo-history — handleGetCoachEloHistory (S26.3m)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildProfile(id = "u-1") {
    return {
      id,
      slug: "coach-alpha",
      coachName: "Coach Alpha",
      eloRating: 1234,
      isSupporter: false,
      supporterTier: null,
      memberSince: "2025-12-01T00:00:00.000Z",
    };
  }

  it("returns 200 + ApiResponse with snapshots when the coach exists", async () => {
    mockedGetProfile.mockResolvedValue(buildProfile());
    mockedGetEloHistory.mockResolvedValue([
      { rating: 1015, delta: 15, recordedAt: "2026-03-01T08:00:00.000Z" },
    ]);

    const req = {
      params: { slug: "coach-alpha" },
      query: {},
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        snapshots: [
          { rating: 1015, delta: 15, recordedAt: "2026-03-01T08:00:00.000Z" },
        ],
      },
    });
    expect(mockedGetEloHistory).toHaveBeenCalledWith("u-1", 90);
  });

  it("forwards a custom days query to the service", async () => {
    mockedGetProfile.mockResolvedValue(buildProfile());
    mockedGetEloHistory.mockResolvedValue([]);

    const req = {
      params: { slug: "coach-alpha" },
      query: { days: "30" },
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(mockedGetEloHistory).toHaveBeenCalledWith("u-1", 30);
  });

  it("ignores a non-numeric days query (falls back to 90)", async () => {
    mockedGetProfile.mockResolvedValue(buildProfile());
    mockedGetEloHistory.mockResolvedValue([]);

    const req = {
      params: { slug: "coach-alpha" },
      query: { days: "lol" },
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(mockedGetEloHistory).toHaveBeenCalledWith("u-1", 90);
  });

  it("returns 404 when the slug does not match any coach", async () => {
    mockedGetProfile.mockResolvedValue(null);

    const req = {
      params: { slug: "ghost" },
      query: {},
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false });
    expect(mockedGetEloHistory).not.toHaveBeenCalled();
  });

  it("returns 400 when the slug param is empty", async () => {
    const req = {
      params: { slug: " " },
      query: {},
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockedGetProfile).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mockedGetProfile.mockResolvedValue(buildProfile());
    mockedGetEloHistory.mockRejectedValue(new Error("DB down"));

    const req = {
      params: { slug: "coach-alpha" },
      query: {},
    } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachEloHistory(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});
