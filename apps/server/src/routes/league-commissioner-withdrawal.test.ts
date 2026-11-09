/**
 * Route de retrait d'une équipe par le commissaire — vraie chaîne Express,
 * service mocké : 401, validation Zod du corps, acteur transmis, mapping
 * des erreurs typées (avec les rencontres bloquantes en `details`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../services/league-commissioner-withdrawal", () => {
  class CommissionerWithdrawalError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly engagedPairingIds?: readonly string[],
    ) {
      super(message);
      this.name = "CommissionerWithdrawalError";
    }
  }
  return {
    CommissionerWithdrawalError,
    withdrawParticipantByCommissioner: vi.fn(),
  };
});
vi.mock("../services/league", () => {
  class LeagueWithdrawError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { LeagueWithdrawError };
});

import router, { commissionerWithdrawalStatus } from "./league-commissioner-withdrawal";
import { JWT_SECRET } from "../config";
import {
  CommissionerWithdrawalError,
  withdrawParticipantByCommissioner,
} from "../services/league-commissioner-withdrawal";

const serviceMock = withdrawParticipantByCommissioner as unknown as ReturnType<
  typeof vi.fn
>;
const PATH = "/leagues/seasons/s1/participants/x/withdraw";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

async function post(
  options: { token?: string; json?: Record<string, unknown> } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/leagues", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = Buffer.from(
        options.json ? JSON.stringify(options.json) : "",
      );
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: PATH,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length.toString(),
            ...(options.token
              ? { Authorization: `Bearer ${options.token}` }
              : {}),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: buf ? (JSON.parse(buf) as Record<string, unknown>) : {},
            });
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.write(payload);
      req.end();
    });
  });
}

describe("commissionerWithdrawalStatus", () => {
  it.each([
    ["season_not_found", 404],
    ["participant_not_found", 404],
    ["forbidden", 403],
    ["pairing_engaged", 409],
    ["already_withdrawn", 409],
    ["season_completed", 409],
  ] as const)("%s ⇒ %d", (code, status) => {
    expect(commissionerWithdrawalStatus(code)).toBe(status);
  });
});

describe("POST /leagues/seasons/:seasonId/participants/:participantId/withdraw", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("401 sans jeton", async () => {
    const res = await post({ json: { remaining: "forfeit" } });
    expect(res.status).toBe(401);
  });

  it("400 sans choix du sort des rencontres", async () => {
    const res = await post({ token: tokenFor("u-com"), json: {} });
    expect(res.status).toBe(400);
    const bad = await post({
      token: tokenFor("u-com"),
      json: { remaining: "replay" },
    });
    expect(bad.status).toBe(400);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("transmet la demande et l'acteur", async () => {
    serviceMock.mockResolvedValue({ participantId: "x", forfeited: [] });
    const res = await post({
      token: tokenFor("u-com"),
      json: { remaining: "cancel" },
    });
    expect(res.status).toBe(200);
    expect(serviceMock).toHaveBeenCalledWith(
      { seasonId: "s1", participantId: "x", remaining: "cancel" },
      { userId: "u-com", isAdmin: false },
    );
  });

  it("409 avec les rencontres bloquantes", async () => {
    serviceMock.mockRejectedValue(
      new CommissionerWithdrawalError("pairing_engaged", "Feuille soumise", [
        "p1",
      ]),
    );
    const res = await post({
      token: tokenFor("u-com"),
      json: { remaining: "forfeit" },
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "pairing_engaged",
      details: { engagedPairingIds: ["p1"] },
    });
  });
});
