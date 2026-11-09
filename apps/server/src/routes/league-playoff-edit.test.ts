/**
 * Routes d'édition d'un bracket de play-offs généré — vraie chaîne Express
 * (`authUser` avec de vrais JWT), service mocké : on vérifie l'acteur
 * transmis et le mapping des erreurs typées.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../services/league-playoff-edit", () => {
  class PlayoffEditError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "PlayoffEditError";
    }
  }
  return {
    PlayoffEditError,
    resetPlayoffBracket: vi.fn(),
    replacePlayoffParticipant: vi.fn(),
  };
});

import router, { playoffEditErrorStatus } from "./league-playoff-edit";
import { JWT_SECRET } from "../config";
import {
  PlayoffEditError,
  replacePlayoffParticipant,
  resetPlayoffBracket,
} from "../services/league-playoff-edit";

type MockFn = ReturnType<typeof vi.fn>;
const resetMock = resetPlayoffBracket as unknown as MockFn;
const replaceMock = replacePlayoffParticipant as unknown as MockFn;

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

async function call(
  method: "GET" | "POST" | "PATCH",
  routePath: string,
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
          path: routePath,
          method,
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
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? (JSON.parse(buf) as Record<string, unknown>) : {},
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
      req.write(payload);
      req.end();
    });
  });
}

describe("playoffEditErrorStatus", () => {
  it.each([
    ["season_not_found", 404],
    ["forbidden", 403],
    ["bracket_engaged", 409],
    ["no_bracket", 409],
    ["season_completed", 409],
    ["pairing_not_found", 404],
    ["participant_not_found", 404],
    ["participant_already_in_bracket", 409],
  ] as const)("%s ⇒ %d", (code, status) => {
    expect(playoffEditErrorStatus(code)).toBe(status);
  });
});

describe("POST /leagues/seasons/:seasonId/playoff-bracket/reset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("401 sans jeton", async () => {
    const res = await call("POST", "/leagues/seasons/s1/playoff-bracket/reset");
    expect(res.status).toBe(401);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("transmet l'acteur (admin compris) et sert le résultat", async () => {
    resetMock.mockResolvedValue({ seasonId: "s1", roundsDeleted: 3 });
    const res = await call(
      "POST",
      "/leagues/seasons/s1/playoff-bracket/reset",
      { token: tokenFor("u-admin", ["user", "admin"]) },
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ seasonId: "s1", roundsDeleted: 3 });
    expect(resetMock).toHaveBeenCalledWith("s1", {
      userId: "u-admin",
      isAdmin: true,
    });
  });

  it("sert le code d'un refus typé", async () => {
    resetMock.mockRejectedValue(
      new PlayoffEditError("bracket_engaged", "Rencontre engagée"),
    );
    const res = await call(
      "POST",
      "/leagues/seasons/s1/playoff-bracket/reset",
      { token: tokenFor("u-com") },
    );
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      error: "Rencontre engagée",
      code: "bracket_engaged",
    });
  });
});

describe("PATCH /leagues/pairings/:pairingId/playoff-participant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("400 sur un corps invalide (côté inconnu)", async () => {
    const res = await call(
      "PATCH",
      "/leagues/pairings/p1/playoff-participant",
      { token: tokenFor("u-com"), json: { side: "middle", participantId: "d" } },
    );
    expect(res.status).toBe(400);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("transmet la demande validée", async () => {
    replaceMock.mockResolvedValue({ pairingId: "p1" });
    const res = await call(
      "PATCH",
      "/leagues/pairings/p1/playoff-participant",
      { token: tokenFor("u-com"), json: { side: "away", participantId: "d" } },
    );
    expect(res.status).toBe(200);
    expect(replaceMock).toHaveBeenCalledWith(
      { pairingId: "p1", side: "away", participantId: "d" },
      { userId: "u-com", isAdmin: false },
    );
  });

  it("404 avec code quand le remplaçant est introuvable", async () => {
    replaceMock.mockRejectedValue(
      new PlayoffEditError("participant_not_found", "Équipe introuvable"),
    );
    const res = await call(
      "PATCH",
      "/leagues/pairings/p1/playoff-participant",
      { token: tokenFor("u-com"), json: { side: "home", participantId: "z" } },
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("participant_not_found");
  });
});
