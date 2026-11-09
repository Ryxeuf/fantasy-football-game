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

// Visibilité d'une ligue privée : testée à part (`league-access.test.ts`).
vi.mock("../services/league-access", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-access")>();
  return { ...actual, isLeaguePairingHiddenFrom: vi.fn(async () => false) };
});

vi.mock("../services/league-match-sheet", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-match-sheet")>();
  return {
    ...actual,
    setInducementsDone: vi.fn(),
    submitByCoach: vi.fn(),
    unsubmitByCoach: vi.fn(),
    getMatchSheet: vi.fn(),
  };
});

import leagueRouter from "./league";
import cupSheetRouter from "./cup-match-sheet";
import { JWT_SECRET } from "../config";
import {
  MatchSheetError,
  getMatchSheet,
  setInducementsDone,
  submitByCoach,
  unsubmitByCoach,
} from "../services/league-match-sheet";

const mockDone = setInducementsDone as unknown as ReturnType<typeof vi.fn>;
const mockSubmit = submitByCoach as unknown as ReturnType<typeof vi.fn>;
const mockUnsubmit = unsubmitByCoach as unknown as ReturnType<typeof vi.fn>;
const mockGet = getMatchSheet as unknown as ReturnType<typeof vi.fn>;

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, roles: ["user"] }, JWT_SECRET);
}

function request(
  path: string,
  body: unknown,
  method: "POST" | "GET" = "POST",
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
          method,
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

describe("soumission / retrait par côté", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSubmit.mockResolvedValue({ id: "ms1", status: "submitted_away" });
    mockUnsubmit.mockResolvedValue({ id: "ms1", status: "draft" });
  });

  it.each([
    ["/leagues", "submit"],
    ["/leagues", "unsubmit"],
    ["/cup", "submit"],
    ["/cup", "unsubmit"],
  ] as const)("%s …/%s transmet le côté demandé", async (prefix, action) => {
    const out = await request(`${prefix}/pairings/p1/sheet/${action}`, {
      side: "away",
    });
    expect(out.status).toBe(200);
    const mock = action === "submit" ? mockSubmit : mockUnsubmit;
    expect(mock).toHaveBeenCalledWith({
      pairingId: "p1",
      userId: "coach-1",
      side: "away",
    });
  });

  it("corps vide : côté déduit par le service", async () => {
    const out = await request("/leagues/pairings/p1/sheet/submit", undefined);
    expect(out.status).toBe(200);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ side: undefined }),
    );
  });

  it("côté inconnu : 400 sans appel au service", async () => {
    const out = await request("/leagues/pairings/p1/sheet/submit", {
      side: "both",
    });
    expect(out.status).toBe(400);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("double propriétaire sans côté : 400 explicite", async () => {
    mockSubmit.mockRejectedValueOnce(
      new MatchSheetError("side_required", "Précisez le côté"),
    );
    const out = await request("/leagues/pairings/p1/sheet/submit", {});
    expect(out.status).toBe(400);
    expect(JSON.stringify(out.body)).toContain("Précisez le côté");
  });

  it("GET ?side= : transmis au service, valeur inconnue refusée", async () => {
    mockGet.mockResolvedValue({ viewerSides: ["home", "away"] });
    const ok = await request("/cup/pairings/p1/sheet?side=away", undefined, "GET");
    expect(ok.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith({
      pairingId: "p1",
      userId: "coach-1",
      side: "away",
    });
    const bad = await request("/cup/pairings/p1/sheet?side=middle", undefined, "GET");
    expect(bad.status).toBe(400);
  });
});
