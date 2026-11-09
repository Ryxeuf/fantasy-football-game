/**
 * Routes de feuille qui portent un CÔTÉ — la vraie chaîne Express (ligue et
 * coupe), `authUser` avec de vrais JWT, `validate(schema)` ; le service de
 * feuille est mocké (testé à part) : on vérifie ici la validation Zod du
 * corps et ce qui est transmis au service.
 *
 * Pattern `http.createServer(express())` + `http.request` natif : supertest
 * n'est pas dans les deps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/league-match-sheet", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-match-sheet")>();
  return {
    ...actual,
    setInducementsDone: vi.fn(),
  };
});

import leagueRouter from "./league";
import cupSheetRouter from "./cup-match-sheet";
import { JWT_SECRET } from "../config";
import {
  MatchSheetError,
  setInducementsDone,
} from "../services/league-match-sheet";

const mockDone = setInducementsDone as unknown as ReturnType<typeof vi.fn>;

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, roles: ["user"] }, JWT_SECRET);
}

function request(
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/leagues", leagueRouter);
  app.use("/cup", cupSheetRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const payload = body === undefined ? "" : JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            authorization: `Bearer ${tokenFor("coach-1")}`,
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
            });
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.end(payload);
    });
  });
}

describe("POST …/sheet/inducements-done", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDone.mockResolvedValue({ id: "ms1" });
  });

  it.each(["/leagues", "/cup"])(
    "%s : corps vide = confirmation de son côté",
    async (prefix) => {
      const out = await request(`${prefix}/pairings/p1/sheet/inducements-done`, {});
      expect(out.status).toBe(200);
      expect(mockDone).toHaveBeenCalledWith({
        pairingId: "p1",
        userId: "coach-1",
        side: undefined,
        done: true,
      });
    },
  );

  it("transmet le côté et le retrait de confirmation", async () => {
    const out = await request("/leagues/pairings/p1/sheet/inducements-done", {
      side: "away",
      done: false,
    });
    expect(out.status).toBe(200);
    expect(mockDone).toHaveBeenCalledWith(
      expect.objectContaining({ side: "away", done: false }),
    );
  });

  it("refuse un côté inconnu (400, service non appelé)", async () => {
    const out = await request("/leagues/pairings/p1/sheet/inducements-done", {
      side: "middle",
    });
    expect(out.status).toBe(400);
    expect(mockDone).not.toHaveBeenCalled();
  });

  it("mappe les refus du service (403 / 400)", async () => {
    mockDone.mockRejectedValueOnce(new MatchSheetError("forbidden", "non"));
    expect(
      (await request("/leagues/pairings/p1/sheet/inducements-done", {})).status,
    ).toBe(403);
    mockDone.mockRejectedValueOnce(
      new MatchSheetError("side_required", "côté ?"),
    );
    expect(
      (await request("/leagues/pairings/p1/sheet/inducements-done", {})).status,
    ).toBe(400);
  });
});
