/**
 * Tests integration des endpoints fan predictions (Q.B.3).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/pro-match-predictions", () => {
  class PredictionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "PredictionError";
    }
  }
  return {
    PredictionError,
    createOrUpdatePrediction: vi.fn(),
    listPredictions: vi.fn(),
    deletePrediction: vi.fn(),
    getSeerLeaderboard: vi.fn(),
  };
});

import express from "express";
import http from "http";
import {
  handleListFanPredictions,
  handleSubmitFanPrediction,
  handleDeleteFanPrediction,
  handleGetSeerLeaderboard,
} from "./pro-league";
import {
  PredictionError,
  createOrUpdatePrediction,
  listPredictions,
  deletePrediction,
  getSeerLeaderboard,
} from "../services/pro-match-predictions";

const mockedSubmit = vi.mocked(createOrUpdatePrediction);
const mockedList = vi.mocked(listPredictions);
const mockedDelete = vi.mocked(deletePrediction);
const mockedSeers = vi.mocked(getSeerLeaderboard);

async function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: "user-1", role: "user" };
    next();
  });
  app.get(
    "/pro-league/matches/:id/predictions",
    handleListFanPredictions,
  );
  app.post(
    "/pro-league/matches/:id/predictions",
    handleSubmitFanPrediction,
  );
  app.delete(
    "/pro-league/matches/:id/predictions/me",
    handleDeleteFanPrediction,
  );
  app.get("/pro-league/seers/weekly", handleGetSeerLeaderboard);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body !== null ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
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
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

const predictionViewFixture = {
  id: "p1",
  matchId: "m1",
  userId: "user-1",
  userName: "Alice",
  userEmail: "a@x.com",
  body: "Buf gagne 3-1",
  score: null,
  createdAt: "2026-05-21T10:00:00.000Z",
  scoredAt: null,
};

describe("GET /pro-league/matches/:id/predictions", () => {
  it("liste les predictions (public)", async () => {
    mockedList.mockResolvedValueOnce([predictionViewFixture]);
    const res = await request(
      "GET",
      "/pro-league/matches/m1/predictions",
    );
    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
  });
});

describe("POST /pro-league/matches/:id/predictions", () => {
  it("201 si premier post", async () => {
    mockedSubmit.mockResolvedValueOnce({
      prediction: predictionViewFixture,
      isUpdate: false,
    });
    const res = await request(
      "POST",
      "/pro-league/matches/m1/predictions",
      { body: "Buf gagne 3-1" },
    );
    expect(res.status).toBe(201);
    expect(res.body.isUpdate).toBe(false);
    expect(mockedSubmit).toHaveBeenCalledWith({
      matchId: "m1",
      userId: "user-1",
      body: "Buf gagne 3-1",
    });
  });

  it("200 si update", async () => {
    mockedSubmit.mockResolvedValueOnce({
      prediction: predictionViewFixture,
      isUpdate: true,
    });
    const res = await request(
      "POST",
      "/pro-league/matches/m1/predictions",
      { body: "updated" },
    );
    expect(res.status).toBe(200);
    expect(res.body.isUpdate).toBe(true);
  });

  it("400 si body manquant", async () => {
    const res = await request(
      "POST",
      "/pro-league/matches/m1/predictions",
      {},
    );
    expect(res.status).toBe(400);
  });

  it("400 BODY_TOO_LONG", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new PredictionError("BODY_TOO_LONG", "trop long") as any,
    );
    const res = await request(
      "POST",
      "/pro-league/matches/m1/predictions",
      { body: "x" },
    );
    expect(res.status).toBe(400);
  });

  it("409 MATCH_LOCKED", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new PredictionError("MATCH_LOCKED", "ferme") as any,
    );
    const res = await request(
      "POST",
      "/pro-league/matches/m1/predictions",
      { body: "Buf wins" },
    );
    expect(res.status).toBe(409);
  });

  it("404 MATCH_NOT_FOUND", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new PredictionError("MATCH_NOT_FOUND", "introuvable") as any,
    );
    const res = await request(
      "POST",
      "/pro-league/matches/x/predictions",
      { body: "test" },
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /pro-league/matches/:id/predictions/me", () => {
  it("204 si suppression OK", async () => {
    mockedDelete.mockResolvedValueOnce(undefined);
    const res = await request(
      "DELETE",
      "/pro-league/matches/m1/predictions/me",
    );
    expect(res.status).toBe(204);
    expect(mockedDelete).toHaveBeenCalledWith("m1", "user-1");
  });

  it("404 PREDICTION_NOT_FOUND", async () => {
    mockedDelete.mockRejectedValueOnce(
      new PredictionError("PREDICTION_NOT_FOUND", "rien") as any,
    );
    const res = await request(
      "DELETE",
      "/pro-league/matches/m1/predictions/me",
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/seers/weekly", () => {
  it("liste les top seers", async () => {
    mockedSeers.mockResolvedValueOnce([
      {
        userId: "u1",
        userName: "Alice",
        userEmail: "a@x.com",
        perfectCount: 3,
        winnerCount: 5,
        totalScored: 10,
      },
    ]);
    const res = await request("GET", "/pro-league/seers/weekly?limit=5");
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(mockedSeers).toHaveBeenCalledWith(5);
  });

  it("default limit=10", async () => {
    mockedSeers.mockResolvedValueOnce([]);
    await request("GET", "/pro-league/seers/weekly");
    expect(mockedSeers).toHaveBeenCalledWith(10);
  });

  it("cap a 50", async () => {
    mockedSeers.mockResolvedValueOnce([]);
    await request("GET", "/pro-league/seers/weekly?limit=999");
    expect(mockedSeers).toHaveBeenCalledWith(50);
  });
});
