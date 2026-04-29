/**
 * Tests pour la route publique GET /coach/:slug (S26.3c).
 *
 * Handler unitaire : on mocke `getCoachPublicProfile` du service. La
 * route est public-cache friendly (pas d'authentification).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/coach-profile", () => ({
  getCoachPublicProfile: vi.fn(),
}));

import type { Request, Response } from "express";
import { getCoachPublicProfile } from "../services/coach-profile";
import { handleGetCoachPublicProfile } from "./coach";

const mockedGetProfile = vi.mocked(getCoachPublicProfile);

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
      },
    });
    expect(mockedGetProfile).toHaveBeenCalledWith("coach-alpha");
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
