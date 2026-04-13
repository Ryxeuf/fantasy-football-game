import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma BEFORE importing adminOnly
vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { adminOnly } from "./adminOnly";
import type { AuthenticatedRequest } from "./authUser";
import type { Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createReqWithUser(userId?: string): Partial<AuthenticatedRequest> {
  if (!userId) return {} as Partial<AuthenticatedRequest>;
  return { user: { id: userId, roles: [], role: undefined } };
}

// Typed convenience handle for the prisma mock
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adminOnly middleware", () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 401 – no authenticated user on request
  // -------------------------------------------------------------------------

  describe("when no user is attached to the request", () => {
    it("returns 401 when req.user is absent", async () => {
      const req = createReqWithUser();
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Non authentifié" });
      expect(mockNext).not.toHaveBeenCalled();
      // Should not hit the DB
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("returns 401 when req.user.id is empty string", async () => {
      const req: Partial<AuthenticatedRequest> = {
        user: { id: "", roles: [] },
      };
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 403 – authenticated but not admin
  // -------------------------------------------------------------------------

  describe("when the user exists in the DB but has no admin role", () => {
    it("returns 403 when user has role=user", async () => {
      mockFindUnique.mockResolvedValueOnce({ role: "user", roles: null });

      const req = createReqWithUser("user-123");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Accès refusé : droits administrateur requis",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 403 when user has roles=[] (empty array)", async () => {
      mockFindUnique.mockResolvedValueOnce({ role: null, roles: [] });

      const req = createReqWithUser("user-456");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 403 when the user record is not found in the DB", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const req = createReqWithUser("unknown-user");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 403 when user roles array contains only non-admin roles", async () => {
      mockFindUnique.mockResolvedValueOnce({
        role: null,
        roles: ["user", "coach"],
      });

      const req = createReqWithUser("user-789");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 200 / next() – admin role confirmed
  // -------------------------------------------------------------------------

  describe("when the user has admin role in the DB", () => {
    it("calls next() when user has role=admin (single role string)", async () => {
      mockFindUnique.mockResolvedValueOnce({ role: "admin", roles: null });

      const req = createReqWithUser("admin-1");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(mockNext).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("calls next() when user has roles array containing admin", async () => {
      mockFindUnique.mockResolvedValueOnce({
        role: null,
        roles: ["user", "admin"],
      });

      const req = createReqWithUser("admin-2");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(mockNext).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("queries DB with the correct user id", async () => {
      mockFindUnique.mockResolvedValueOnce({ role: "admin", roles: null });

      const req = createReqWithUser("specific-admin-id");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "specific-admin-id" },
        select: { role: true, roles: true },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 500 – database error
  // -------------------------------------------------------------------------

  describe("when the database throws an error", () => {
    it("returns 500 with a generic server error message", async () => {
      mockFindUnique.mockRejectedValueOnce(new Error("DB connection lost"));

      const req = createReqWithUser("user-err");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Erreur serveur lors de la vérification des droits",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 500 and does not call next() on unexpected DB errors", async () => {
      mockFindUnique.mockRejectedValueOnce("string error");

      const req = createReqWithUser("user-err2");
      const res = createMockRes();

      await adminOnly(
        req as AuthenticatedRequest,
        res as Response,
        mockNext as NextFunction,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
