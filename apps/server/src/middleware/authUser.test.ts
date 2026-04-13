import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// Mock config BEFORE importing authUser so JWT_SECRET is controlled
vi.mock("../config", () => ({ JWT_SECRET: "test-secret" }));

import { authUser, AuthenticatedRequest } from "./authUser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReq(authHeader?: string): Partial<AuthenticatedRequest> {
  return { headers: authHeader ? { authorization: authHeader } : {} };
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const VALID_SECRET = "test-secret";

function signToken(payload: object, secret = VALID_SECRET): string {
  return jwt.sign(payload, secret);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authUser middleware", () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  // -------------------------------------------------------------------------
  // 401 – missing / empty token
  // -------------------------------------------------------------------------

  describe("when no authorization header is present", () => {
    it("returns 401 with Non authentifié", () => {
      const req = createMockReq();
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Non authentifié" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("when authorization header has no token (Bearer with trailing space only)", () => {
    it("returns 401 with Non authentifié", () => {
      // "Bearer " splits into ["Bearer", ""] – empty string is falsy
      const req = createMockReq("Bearer ");
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Non authentifié" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("when the authorization header carries no Bearer prefix at all", () => {
    it("returns 401 because split yields a single element and token is undefined", () => {
      const req = createMockReq("notabearer");
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      // split(" ") on "notabearer" gives ["notabearer"] – index 1 is undefined → falsy
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Non authentifié" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 401 – invalid / expired token
  // -------------------------------------------------------------------------

  describe("when the token is signed with the wrong secret", () => {
    it("returns 401 with Token invalide", () => {
      const token = signToken({ sub: "user-1" }, "wrong-secret");
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Token invalide" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("when the token is a random garbage string", () => {
    it("returns 401 with Token invalide", () => {
      const req = createMockReq("Bearer this.is.garbage");
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Token invalide" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("when the token is expired", () => {
    it("returns 401 with Token invalide", () => {
      const token = jwt.sign({ sub: "user-1" }, VALID_SECRET, {
        expiresIn: -1,
      });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Token invalide" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path – valid token
  // -------------------------------------------------------------------------

  describe("when the token is valid", () => {
    it("calls next() and sets req.user with id", () => {
      const token = signToken({ sub: "user-42" });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user?.id).toBe("user-42");
    });

    it("sets roles to an empty array when the payload carries no role claim", () => {
      const token = signToken({ sub: "user-99" });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      const user = (req as AuthenticatedRequest).user!;
      expect(user.roles).toEqual([]);
      expect(user.role).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Role extraction
  // -------------------------------------------------------------------------

  describe("role extraction from payload", () => {
    it("extracts a single role string from the role claim", () => {
      const token = signToken({ sub: "user-1", role: "admin" });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      const user = (req as AuthenticatedRequest).user!;
      expect(user.roles).toEqual(["admin"]);
      expect(user.role).toBe("admin");
    });

    it("extracts an array of roles from the roles claim", () => {
      const token = signToken({ sub: "user-2", roles: ["user", "admin"] });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      const user = (req as AuthenticatedRequest).user!;
      expect(user.roles).toEqual(["user", "admin"]);
      expect(user.role).toBe("user");
    });

    it("prefers the roles array claim over the single role claim", () => {
      const token = signToken({
        sub: "user-3",
        roles: ["coach", "scout"],
        role: "ignored",
      });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      const user = (req as AuthenticatedRequest).user!;
      expect(user.roles).toEqual(["coach", "scout"]);
      expect(user.role).toBe("coach");
    });

    it("handles a JSON-encoded array string in the role claim via normalizeRoles", () => {
      const token = signToken({ sub: "user-4", role: '["manager","viewer"]' });
      const req = createMockReq(`Bearer ${token}`);
      const res = createMockRes();

      authUser(req as AuthenticatedRequest, res, mockNext);

      const user = (req as AuthenticatedRequest).user!;
      expect(user.roles).toEqual(["manager", "viewer"]);
      expect(user.role).toBe("manager");
    });
  });
});
