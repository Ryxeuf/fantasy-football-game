/**
 * Sprint O — Lot O.B.1 : tests du flag
 * `REGISTRATION_REQUIRES_VALIDATION_FLAG` sur `POST /auth/register`.
 *
 * - Default (flag OFF) : auto-approve, retour token + refreshToken.
 * - Flag ON : compte cree avec valid=false, pas de token, message
 *   "pending validation".
 *
 * On teste le handler en isolation via supertest sur un mini express
 * app monte avec le router auth + mocks de prisma / featureFlags.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/featureFlags", async () => {
  const actual =
    await vi.importActual<typeof import("../services/featureFlags")>(
      "../services/featureFlags",
    );
  return {
    ...actual,
    isEnabled: vi.fn(),
  };
});

vi.mock("../services/kofi-claim", () => ({
  ensureKofiLinkCode: vi.fn(async () => {}),
  claimOrphanKofiTransactions: vi.fn(async () => {}),
}));

vi.mock("../services/auth-tokens", async () => {
  const actual =
    await vi.importActual<typeof import("../services/auth-tokens")>(
      "../services/auth-tokens",
    );
  return {
    ...actual,
    signAccessToken: vi.fn(() => "signed-access-token"),
    signRefreshToken: vi.fn(() => "signed-refresh-token"),
    verifyRefreshToken: vi.fn(() => ({
      jti: "jti-1",
      sub: "user-1",
      typ: "refresh",
      iat: 0,
      exp: 0,
    })),
  };
});

vi.mock("../services/prisma-refresh-token-store", () => ({
  PrismaRefreshTokenStore: class {
    async register() {
      return undefined;
    }
    async rotate() {
      return undefined;
    }
    async revoke() {
      return undefined;
    }
  },
}));

import express from "express";
import http from "http";
import authRouter from "./auth";
import { prisma } from "../prisma";
import { isEnabled } from "../services/featureFlags";

interface MockedPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedIsEnabled = vi.mocked(isEnabled);

interface RegisterResponse {
  user?: {
    id: string;
    email: string;
    valid: boolean;
  };
  token?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

async function postRegister(
  body: Record<string, unknown>,
): Promise<{ status: number; body: RegisterResponse }> {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const port = addr.port;
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/auth/register",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => (buf += chunk));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.write(data);
      req.end();
    });
  });
}

const REGISTER_PAYLOAD = {
  email: "newcoach@example.com",
  password: "Strong-Password-1!",
  coachName: "newCoach",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedPrisma.user.findUnique.mockResolvedValue(null);
  mockedPrisma.user.create.mockResolvedValue({
    id: "user-1",
    email: REGISTER_PAYLOAD.email,
    name: REGISTER_PAYLOAD.coachName,
    coachName: REGISTER_PAYLOAD.coachName,
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    role: "user",
    valid: true,
    createdAt: new Date("2026-05-11T00:00:00Z"),
  });
});

describe("POST /auth/register — Lot O.B.1 feature flag", () => {
  it("flag OFF (defaut) : auto-approve avec token + refreshToken", async () => {
    mockedIsEnabled.mockResolvedValueOnce(false);

    const res = await postRegister(REGISTER_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.valid).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.message).toBeUndefined();
    // Le user a ete cree avec valid: true.
    const createCall = mockedPrisma.user.create.mock.calls[0]![0];
    expect(createCall.data.valid).toBe(true);
  });

  it("flag ON : compte cree avec valid=false + message, pas de token", async () => {
    mockedIsEnabled.mockResolvedValueOnce(true);
    // Le mock create renvoie maintenant valid: false (cohere avec le flag).
    mockedPrisma.user.create.mockResolvedValueOnce({
      id: "user-2",
      email: REGISTER_PAYLOAD.email,
      name: REGISTER_PAYLOAD.coachName,
      coachName: REGISTER_PAYLOAD.coachName,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      role: "user",
      valid: false,
      createdAt: new Date("2026-05-11T00:00:00Z"),
    });

    const res = await postRegister(REGISTER_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.valid).toBe(false);
    expect(res.body.token).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.message).toBeDefined();
    expect(res.body.message).toContain("validation");
    // Le user a bien ete cree avec valid: false.
    const createCall = mockedPrisma.user.create.mock.calls[0]![0];
    expect(createCall.data.valid).toBe(false);
  });

  it("email deja utilise : 409 (independant du flag)", async () => {
    mockedIsEnabled.mockResolvedValueOnce(false);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-user",
      email: REGISTER_PAYLOAD.email,
    });

    const res = await postRegister(REGISTER_PAYLOAD);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Email");
    // Pas de creation user.
    expect(mockedPrisma.user.create).not.toHaveBeenCalled();
  });
});
