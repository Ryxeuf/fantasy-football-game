/**
 * Régime des coups de pouce d'une coupe — la VRAIE chaîne Express (routeur
 * `/cup`, `authUser` avec de vrais JWT, `validate(schema)`, Prisma mocké) :
 *
 *   - création : `build` sans choix en BB11, `match` en Sept, `build` imposé
 *     sous règlement, `build` demandé en Sept refusé (400) ;
 *   - `PATCH /cup/:id/rules` : mêmes règles, dans la fenêtre existante
 *     (coupe validée refusée au commissaire) ;
 *   - la liste autorisée vide est stockée `null`.
 *
 * Pattern `http.createServer(express())` + `http.request` natif.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    cupRound: { count: vi.fn() },
  },
}));

vi.mock("../services/tournament-ruleset-repository", () => ({
  getTournamentRulesetDefinition: vi.fn(),
  tournamentRulesetShortLabel: vi.fn(async (slug: string) => slug),
}));

import router from "./cup";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { getTournamentRulesetDefinition } from "../services/tournament-ruleset-repository";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { create: MockFn; findUnique: MockFn; update: MockFn };
  cupRound: { count: MockFn };
};
const packDef = getTournamentRulesetDefinition as unknown as MockFn;

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
  db.cup.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ format: "bb11", tournamentRuleset: null, ...data }),
  );
  packDef.mockImplementation(async (slug: string | null) =>
    slug === NAF_WORLD_CUP_2027.slug ? NAF_WORLD_CUP_2027 : null,
  );
});

function written(): Record<string, unknown> {
  return db.cup.create.mock.calls[0][0].data;
}

describe("POST /cup — régime des coups de pouce", () => {
  it("BB11 sans choix : build", async () => {
    const res = await request("POST", "/cup", { name: "Coupe" }, tokenFor(COMMISH));
    expect(res.status).toBe(201);
    expect(written().inducementMode).toBe("build");
    const cup = res.body.cup as { rulesConfig: Record<string, unknown> };
    expect(cup.rulesConfig.inducementMode).toBe("build");
  });

  it("Sept sans choix : match", async () => {
    const res = await request(
      "POST",
      "/cup",
      { name: "Coupe à Sept", format: "sevens" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(201);
    expect(written().inducementMode).toBe("match");
  });

  it("Sept : build demandé explicitement est refusé", async () => {
    const res = await request(
      "POST",
      "/cup",
      { name: "Coupe à Sept", format: "sevens", inducementMode: "build" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(400);
    expect(db.cup.create).not.toHaveBeenCalled();
  });

  it("règlement de tournoi : build imposé même si match est demandé", async () => {
    const res = await request(
      "POST",
      "/cup",
      {
        name: "NAF",
        tournamentRuleset: NAF_WORLD_CUP_2027.slug,
        inducementMode: "match",
      },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(201);
    expect(written().inducementMode).toBe("build");
  });

  it("choix explicite conservé, liste autorisée sérialisée", async () => {
    const res = await request(
      "POST",
      "/cup",
      {
        name: "Coupe",
        inducementMode: "none",
        allowedInducements: ["team_mascot", "bloodweiser_kegs"],
      },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(201);
    expect(written().inducementMode).toBe("none");
    expect(written().allowedInducements).toBe(
      JSON.stringify(["team_mascot", "bloodweiser_kegs"]),
    );
  });

  it("une liste autorisée vide est stockée null (aucune restriction)", async () => {
    await request(
      "POST",
      "/cup",
      { name: "Coupe", allowedInducements: [] },
      tokenFor(COMMISH),
    );
    expect(written().allowedInducements).toBeNull();
  });

  it("mode inconnu refusé (400)", async () => {
    const res = await request(
      "POST",
      "/cup",
      { name: "Coupe", inducementMode: "tournoi" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /cup/:id/rules — régime des coups de pouce", () => {
  function cupRow(over: Record<string, unknown> = {}) {
    return {
      id: "cup-1",
      creatorId: COMMISH,
      validated: false,
      format: "bb11",
      tournamentRuleset: null,
      inducementMode: null,
      ...over,
    };
  }

  it("le commissaire passe une coupe en build avant la clôture des inscriptions", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow());
    const res = await request(
      "PATCH",
      "/cup/cup-1/rules",
      { inducementMode: "build", allowedInducements: ["team_mascot"] },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(200);
    const data = db.cup.update.mock.calls[0][0].data;
    expect(data.inducementMode).toBe("build");
    expect(data.allowedInducements).toBe(JSON.stringify(["team_mascot"]));
    expect(
      (res.body.rulesConfig as Record<string, unknown>).allowedInducements,
    ).toEqual(["team_mascot"]);
  });

  it("n'écrit pas le mode quand la demande ne le porte pas", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow());
    await request(
      "PATCH",
      "/cup/cup-1/rules",
      { tierBudgets: { I: 1100 } },
      tokenFor(COMMISH),
    );
    expect(db.cup.update.mock.calls[0][0].data).not.toHaveProperty(
      "inducementMode",
    );
  });

  it("règlement : build maintenu même si none est demandé", async () => {
    db.cup.findUnique.mockResolvedValue(
      cupRow({ tournamentRuleset: NAF_WORLD_CUP_2027.slug, inducementMode: "build" }),
    );
    await request(
      "PATCH",
      "/cup/cup-1/rules",
      { inducementMode: "none" },
      tokenFor(COMMISH),
    );
    expect(db.cup.update.mock.calls[0][0].data.inducementMode).toBe("build");
  });

  it("Sept : build refusé (400)", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow({ format: "sevens" }));
    const res = await request(
      "PATCH",
      "/cup/cup-1/rules",
      { inducementMode: "build" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(400);
    expect(db.cup.update).not.toHaveBeenCalled();
  });

  it("inscriptions closes : refusé au commissaire (400), mode inchangé", async () => {
    db.cup.findUnique.mockResolvedValue(cupRow({ validated: true }));
    const res = await request(
      "PATCH",
      "/cup/cup-1/rules",
      { inducementMode: "none" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(400);
    expect(db.cup.update).not.toHaveBeenCalled();
  });
});

describe("rulesConfig servi par GET /cup/:id (formatCupRules)", () => {
  it("coupe antérieure au réglage (null) : match, liste nulle", async () => {
    const { formatCupRules } = await import("./cup");
    expect(
      formatCupRules({ inducementMode: null, allowedInducements: null, format: "bb11" }),
    ).toMatchObject({ inducementMode: "match", allowedInducements: null });
  });

  it("règlement : build, quoi qu'en dise la colonne ; liste relue du miroir SQLite", async () => {
    const { formatCupRules } = await import("./cup");
    expect(
      formatCupRules({
        inducementMode: "none",
        allowedInducements: '["team_mascot"]',
        format: "bb11",
        tournamentRuleset: NAF_WORLD_CUP_2027.slug,
      }),
    ).toMatchObject({
      inducementMode: "build",
      allowedInducements: ["team_mascot"],
    });
  });
});
