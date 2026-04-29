/**
 * Tests pour la route publique GET /coach/:slug (S26.3c).
 *
 * Handler unitaire : on mocke `getCoachPublicProfile` du service. La
 * route est public-cache friendly (pas d'authentification).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/coach-profile", () => ({
  getCoachPublicProfile: vi.fn(),
  getCoachShowcaseAchievements: vi.fn(),
}));

import type { Request, Response } from "express";
import {
  getCoachPublicProfile,
  getCoachShowcaseAchievements,
} from "../services/coach-profile";
import { handleGetCoachPublicProfile } from "./coach";

const mockedGetProfile = vi.mocked(getCoachPublicProfile);
const mockedGetShowcase = vi.mocked(getCoachShowcaseAchievements);

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
      },
    });
    expect(mockedGetProfile).toHaveBeenCalledWith("coach-alpha");
    expect(mockedGetShowcase).toHaveBeenCalledWith("u-1");
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

  it("does not call the showcase service when the profile is missing", async () => {
    mockedGetProfile.mockResolvedValue(null);

    const req = { params: { slug: "ghost-slug" } } as unknown as Request;
    const res = buildRes() as Response & { statusCode: number; body: unknown };
    await handleGetCoachPublicProfile(req, res);

    expect(res.statusCode).toBe(404);
    expect(mockedGetShowcase).not.toHaveBeenCalled();
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
