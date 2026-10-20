/**
 * Double validation des feuilles d'une coupe — la VRAIE chaîne Express :
 * routeur `/cup`, `authUser` avec de vrais JWT, `validate(schema)`, Prisma
 * mocké. Sous test :
 *
 *   - une coupe créée sans choix a l'option DÉCOCHÉE (comme l'existant), un
 *     choix explicite est écrit et servi ;
 *   - le commissaire coche ou décoche l'option en cours de coupe ; une
 *     valeur non booléenne est refusée (400).
 *
 * Pattern `http.createServer(express())` + `http.request` natif
 * (cf. `routes/league-access.test.ts`) : supertest n'est pas dans les deps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    cupRound: { count: vi.fn() },
  },
}));

import router from "./cup";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { create: MockFn; findUnique: MockFn; update: MockFn };
  cupRound: { count: MockFn };
};

const COMMISH = "commish";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function request(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  token: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/cup", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            authorization: `Bearer ${token}`,
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

/** Ligne renvoyée par `cup.create` : ce que la route remet en forme. */
function createdCup(data: Record<string, unknown>) {
  return {
    id: "cup-1",
    creator: { id: COMMISH, coachName: "Coach" },
    participants: [],
    status: "ouverte",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...data,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.cup.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve(createdCup(data)),
  );
});

describe("POST /cup — double validation", () => {
  it("crée une coupe SANS choix avec l'option décochée", async () => {
    const res = await request("POST", "/cup", { name: "Coupe neuve" }, tokenFor(COMMISH));

    expect(res.status).toBe(201);
    expect(db.cup.create.mock.calls[0][0].data.sheetDoubleValidation).toBe(false);
    expect((res.body.cup as Record<string, unknown>).sheetDoubleValidation).toBe(
      false,
    );
  });

  it("écrit et sert l'option cochée à la création", async () => {
    const res = await request(
      "POST",
      "/cup",
      { name: "Coupe exigeante", sheetDoubleValidation: true },
      tokenFor(COMMISH),
    );

    expect(res.status).toBe(201);
    expect(db.cup.create.mock.calls[0][0].data.sheetDoubleValidation).toBe(true);
    expect((res.body.cup as Record<string, unknown>).sheetDoubleValidation).toBe(
      true,
    );
  });
});

describe("PATCH /cup/:id — double validation", () => {
  function cupRow(status: string) {
    return { id: "cup-1", creatorId: COMMISH, status };
  }

  it("coche l'option d'une coupe EN COURS, sans verrou de ronde", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow("en_cours"));
    db.cup.update.mockResolvedValue({
      id: "cup-1",
      name: "Coupe",
      tieBreakRules: null,
      sheetDoubleValidation: true,
    });

    const res = await request(
      "PATCH",
      "/cup/cup-1",
      { sheetDoubleValidation: true },
      tokenFor(COMMISH),
    );

    expect(res.status).toBe(200);
    expect(db.cup.update.mock.calls[0][0].data).toEqual({
      sheetDoubleValidation: true,
    });
    expect(db.cupRound.count).not.toHaveBeenCalled();
    expect((res.body.cup as Record<string, unknown>).sheetDoubleValidation).toBe(
      true,
    );
  });

  it("décoche l'option (levier du commissaire si un coach ne soumet jamais)", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow("en_cours"));
    db.cup.update.mockResolvedValue({
      id: "cup-1",
      name: "Coupe",
      tieBreakRules: null,
      sheetDoubleValidation: false,
    });

    const res = await request(
      "PATCH",
      "/cup/cup-1",
      { sheetDoubleValidation: false },
      tokenFor(COMMISH),
    );

    expect(res.status).toBe(200);
    expect(db.cup.update.mock.calls[0][0].data).toEqual({
      sheetDoubleValidation: false,
    });
  });

  it("refuse une valeur non booléenne (400) sans rien écrire", async () => {
    const res = await request(
      "PATCH",
      "/cup/cup-1",
      { sheetDoubleValidation: "oui" },
      tokenFor(COMMISH),
    );

    expect(res.status).toBe(400);
    expect(db.cup.update).not.toHaveBeenCalled();
  });

  it("refuse un tiers (403)", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow("en_cours"));

    const res = await request(
      "PATCH",
      "/cup/cup-1",
      { sheetDoubleValidation: true },
      tokenFor("stranger"),
    );

    expect(res.status).toBe(403);
    expect(db.cup.update).not.toHaveBeenCalled();
  });
});
