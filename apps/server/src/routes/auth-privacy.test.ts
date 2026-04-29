/**
 * Tests pour `handleUpdatePrivacy` (S26.3j).
 *
 * Handler unitaire : on mocke prisma.user.update. req/res faits a la
 * main, AuthenticatedRequest fourni avec un user.id.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { handleUpdatePrivacy } from "./auth-privacy";
import type { AuthenticatedRequest } from "../middleware/authUser";
import type { Response } from "express";

const mockPrisma = prisma as unknown as {
  user: {
    update: ReturnType<typeof vi.fn>;
  };
};

function buildRes(): Response & { statusCode: number; body: unknown } {
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
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("handleUpdatePrivacy (S26.3j)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates User.privateProfile and returns 200 + the new value", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "u-1",
      privateProfile: true,
    });

    const req = {
      user: { id: "u-1" },
      body: { privateProfile: true },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleUpdatePrivacy(req, res);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { privateProfile: true },
      select: { id: true, privateProfile: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { privateProfile: true },
    });
  });

  it("supports flipping back to public (privateProfile=false)", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "u-1",
      privateProfile: false,
    });

    const req = {
      user: { id: "u-1" },
      body: { privateProfile: false },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleUpdatePrivacy(req, res);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { privateProfile: false },
      select: { id: true, privateProfile: true },
    });
    expect(res.body).toEqual({
      success: true,
      data: { privateProfile: false },
    });
  });

  it("returns 500 when prisma throws", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB down"));

    const req = {
      user: { id: "u-1" },
      body: { privateProfile: true },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleUpdatePrivacy(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});
