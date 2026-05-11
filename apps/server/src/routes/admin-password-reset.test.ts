/**
 * Lot P.C.2 — Tests de l'endpoint admin POST /admin/users/:id/password-reset.
 *
 * - Genere un temp password, l'expose UNE FOIS dans la reponse.
 * - Update passwordHash bcrypt + mustChangePassword=true.
 * - Revoque toutes les sessions du user (refresh tokens).
 * - Audit log strict, JAMAIS de password en clair dans newValue.
 * - Refuse de reset son propre compte (400).
 * - 404 si user inexistant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

const revokeAllForUser = vi.fn(async () => {});

vi.mock("./auth", async () => ({
  getRefreshTokenStore: () => ({ revokeAllForUser }),
}));

import express from "express";
import http from "http";
import bcrypt from "bcryptjs";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

interface MockedPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function postReset(userId: string) {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  const server = http.createServer(app);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin/users/${userId}/password-reset`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer dummy",
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
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
});

describe("POST /admin/users/:id/password-reset (Lot P.C.2)", () => {
  it("genere un temp password, update passwordHash + mustChangePassword=true", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "lost@coach.com",
      coachName: "LostCoach",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await postReset("user-99");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "user-99",
      email: "lost@coach.com",
      coachName: "LostCoach",
    });
    expect(typeof res.body.tempPassword).toBe("string");
    expect(res.body.tempPassword.length).toBe(16);

    const updateCall = mockedPrisma.user.update.mock.calls[0]![0];
    expect(updateCall.where).toEqual({ id: "user-99" });
    expect(updateCall.data.mustChangePassword).toBe(true);
    // Le passwordHash est un vrai bcrypt — on verifie qu'il match le
    // tempPassword retourne (round-trip).
    const matches = await bcrypt.compare(
      res.body.tempPassword,
      updateCall.data.passwordHash,
    );
    expect(matches).toBe(true);
  });

  it("revoque toutes les sessions du user", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await postReset("user-99");

    expect(res.status).toBe(200);
    expect(revokeAllForUser).toHaveBeenCalledWith("user-99");
  });

  it("trace audit log sans logger le password en clair", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await postReset("user-99");

    expect(res.status).toBe(200);
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const auditCall = mockedAudit.mock.calls[0]![2];
    expect(auditCall.action).toBe("user.password.reset");
    expect(auditCall.entity).toBe("User");
    expect(auditCall.entityId).toBe("user-99");
    // Le payload audit ne doit JAMAIS contenir le password en clair
    // ni le hash. Verification stricte.
    const serialized = JSON.stringify(auditCall);
    expect(serialized).not.toContain(res.body.tempPassword);
    expect(serialized).not.toContain("passwordHash");
  });

  it("refuse 400 si admin tente de reset son propre compte", async () => {
    const res = await postReset("admin-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/change-password/i);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await postReset("ghost");
    expect(res.status).toBe(404);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("ne bloque pas l'operation si la revocation des tokens echoue", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});
    revokeAllForUser.mockRejectedValueOnce(new Error("DB down briefly"));

    const res = await postReset("user-99");

    // L'op reste un succes — le password est deja mis a jour ; les
    // tokens existants seront refuses au prochain refresh.
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeDefined();
    expect(mockedAudit).toHaveBeenCalled();
  });
});
