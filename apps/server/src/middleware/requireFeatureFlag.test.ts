import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { requireFeatureFlag } from "./requireFeatureFlag";
import { JWT_SECRET } from "../config";

vi.mock("../services/featureFlags", () => ({
  isEnabled: vi.fn(),
}));

import { isEnabled } from "../services/featureFlags";

const mockIsEnabled = isEnabled as unknown as ReturnType<typeof vi.fn>;

function buildRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("requireFeatureFlag middleware", () => {
  const savedEnv = process.env.FEATURE_FLAGS_FORCE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FEATURE_FLAGS_FORCE_ENABLED;
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.FEATURE_FLAGS_FORCE_ENABLED;
    } else {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = savedEnv;
    }
  });

  it("calls next() when flag is enabled", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const mw = requireFeatureFlag("my_flag");
    const next = vi.fn();
    const res = buildRes();
    await mw({ headers: {} } as any, res as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when flag is disabled", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw({ headers: {} } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "feature_flag_disabled",
        flag: "online_play",
      }),
    );
  });

  it("extracts userId + roles from JWT and forwards them to isEnabled", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const token = jwt.sign(
      { sub: "user-1", roles: ["user", "admin"] },
      JWT_SECRET,
    );
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw(
      { headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(mockIsEnabled).toHaveBeenCalledWith("online_play", "user-1", {
      roles: ["user", "admin"],
    });
  });

  it("evaluates without user context when token is absent", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw({ headers: {} } as any, res as any, next);
    expect(mockIsEnabled).toHaveBeenCalledWith("online_play", undefined, {
      roles: [],
    });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("evaluates without user context when token is invalid (authUser rejects later)", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw(
      { headers: { authorization: "Bearer invalid-token" } } as any,
      res as any,
      next,
    );
    expect(mockIsEnabled).toHaveBeenCalledWith("online_play", undefined, {
      roles: [],
    });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("reuses req.user when already populated by authUser", async () => {
    mockIsEnabled.mockResolvedValue(true);
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw(
      {
        headers: {},
        user: { id: "user-9", roles: ["admin"] },
      } as any,
      res as any,
      next,
    );
    expect(mockIsEnabled).toHaveBeenCalledWith("online_play", "user-9", {
      roles: ["admin"],
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 500 when isEnabled throws", async () => {
    mockIsEnabled.mockRejectedValue(new Error("boom"));
    const mw = requireFeatureFlag("online_play");
    const next = vi.fn();
    const res = buildRes();
    await mw({ headers: {} } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
