/**
 * Sprint O — Lot O.B.2 : tests des routes `GET /auth/verify-email` et
 * `POST /auth/resend-verification`.
 *
 * Mocks le client Prisma + le middleware authUser. Pas de SMTP, le link
 * dev est expose via `devLink` quand NODE_ENV !== "production".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (
    req: { user?: { id: string; role: string; roles: string[] } },
    _res: unknown,
    next: () => void,
  ): void => {
    req.user = { id: "u_auth", role: "user", roles: ["user"] };
    next();
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

import express from "express";
import http from "http";

import authRouter from "./auth";
import { prisma } from "../prisma";

interface MockedPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  emailVerificationToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;

interface ApiResponse {
  success?: boolean;
  email?: string;
  verifiedAt?: string;
  error?: string;
  code?: string;
  requested?: boolean;
  alreadyVerified?: boolean;
  devLink?: string | null;
}

function requestRoute(opts: {
  method: "GET" | "POST";
  path: string;
}): Promise<{ status: number; body: ApiResponse }> {
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
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: opts.path,
          method: opts.method,
          headers: { "Content-Type": "application/json" },
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
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.$transaction.mockImplementation(async (ops: unknown[]) =>
    Promise.all(ops as Promise<unknown>[]),
  );
});

describe("GET /auth/verify-email", () => {
  it("set emailVerifiedAt et renvoie 200 success=true sur token valide", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    });

    const res = await requestRoute({
      method: "GET",
      path: "/auth/verify-email?token=plain_xyz",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe("user@ex.com");
    expect(res.body.verifiedAt).toBeTruthy();
    expect(mocked.user.update).toHaveBeenCalledTimes(1);
  });

  it("renvoie 400 INVALID_TOKEN si query token absent", async () => {
    const res = await requestRoute({ method: "GET", path: "/auth/verify-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("renvoie 400 INVALID_TOKEN si le token n'existe pas en DB", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValueOnce(null);
    const res = await requestRoute({
      method: "GET",
      path: "/auth/verify-email?token=unknown",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("renvoie 410 TOKEN_EXPIRED si expiresAt depasse", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    });
    const res = await requestRoute({
      method: "GET",
      path: "/auth/verify-email?token=expired",
    });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it("renvoie 409 TOKEN_USED si le token a deja ete consomme (user pas verifie)", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    });
    const res = await requestRoute({
      method: "GET",
      path: "/auth/verify-email?token=used",
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("TOKEN_USED");
  });
});

describe("POST /auth/resend-verification", () => {
  it("renvoie 200 requested=true + devLink en non-prod si user pas verifie", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      mocked.user.findUnique.mockResolvedValueOnce({
        id: "u_auth",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      });
      mocked.emailVerificationToken.create.mockResolvedValueOnce({
        id: "tk_new",
      });
      const res = await requestRoute({
        method: "POST",
        path: "/auth/resend-verification",
      });
      expect(res.status).toBe(200);
      expect(res.body.requested).toBe(true);
      expect(res.body.alreadyVerified).toBe(false);
      expect(res.body.devLink).toMatch(/\/verify-email\?token=/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("renvoie 200 alreadyVerified=true sans creer de token si deja verifie", async () => {
    mocked.user.findUnique.mockResolvedValueOnce({
      id: "u_auth",
      email: "user@ex.com",
      deletedAt: null,
      emailVerifiedAt: new Date("2026-01-01"),
    });
    const res = await requestRoute({
      method: "POST",
      path: "/auth/resend-verification",
    });
    expect(res.status).toBe(200);
    expect(res.body.alreadyVerified).toBe(true);
    expect(mocked.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it("renvoie 404 USER_DELETED si user soft-deleted", async () => {
    mocked.user.findUnique.mockResolvedValueOnce({
      id: "u_auth",
      email: "user@ex.com",
      deletedAt: new Date(),
      emailVerifiedAt: null,
    });
    const res = await requestRoute({
      method: "POST",
      path: "/auth/resend-verification",
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("USER_DELETED");
  });
});
