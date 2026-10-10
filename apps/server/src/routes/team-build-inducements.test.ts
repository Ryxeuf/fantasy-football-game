/**
 * `GET /team/build-inducements` — la VRAIE chaîne Express (routeur `/team`,
 * `authUser` avec de vrais JWT, `validateQuery`, Prisma mocké). Le catalogue
 * effectif est testé à part (`inducement-options.test.ts`) : ici, le
 * contexte (coupe, mode, règlement) et l'enveloppe de réponse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";

vi.mock("../prisma", () => ({
  prisma: { cup: { findUnique: vi.fn() } },
}));
vi.mock("../services/tournament-ruleset-repository", () => ({
  getTournamentRulesetDefinition: vi.fn(),
}));
vi.mock("../services/inducement-options", () => ({
  buildInducementCatalogue: vi.fn(),
}));

import router from "./team";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { getTournamentRulesetDefinition } from "../services/tournament-ruleset-repository";
import { buildInducementCatalogue } from "../services/inducement-options";

type MockFn = ReturnType<typeof vi.fn>;
const cupFind = (prisma as unknown as { cup: { findUnique: MockFn } }).cup
  .findUnique;
const packDef = getTournamentRulesetDefinition as unknown as MockFn;
const catalogue = buildInducementCatalogue as unknown as MockFn;

const MASCOT = {
  slug: "team_mascot",
  name: "Mascotte",
  cost: 25_000,
  maxQuantity: 1,
  description: "",
};

function get(path: string): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/team", router);
  const server = http.createServer(app);
  const token = jwt.sign({ sub: "coach", roles: ["user"] }, JWT_SECRET);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method: "GET",
          headers: { authorization: `Bearer ${token}` },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : {} });
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
  vi.resetAllMocks();
  catalogue.mockResolvedValue([MASCOT]);
  packDef.mockImplementation(async (slug: string) =>
    slug === NAF_WORLD_CUP_2027.slug ? NAF_WORLD_CUP_2027 : null,
  );
});

describe("GET /team/build-inducements", () => {
  it("coupe en build : sert le catalogue, avec la liste de la coupe", async () => {
    cupFind.mockResolvedValue({
      format: "bb11",
      tournamentRuleset: null,
      inducementMode: "build",
      allowedInducements: '["team_mascot"]',
    });

    const res = await get(
      "/team/build-inducements?roster=human&ruleset=season_3&cupId=cup-1&stars=griff_oberwald,griff_oberwald",
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      allowed: true,
      cupMode: "build",
      inducements: [MASCOT],
    });
    expect(catalogue).toHaveBeenCalledWith(
      expect.objectContaining({
        roster: "human",
        allowlist: ["team_mascot"],
        pack: null,
        hiredStarSlugs: ["griff_oberwald"],
      }),
    );
  });

  it("coupe en match : rien à acheter au build", async () => {
    cupFind.mockResolvedValue({
      format: "bb11",
      tournamentRuleset: null,
      inducementMode: "match",
      allowedInducements: null,
    });

    const res = await get("/team/build-inducements?roster=human&cupId=cup-1");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      allowed: false,
      cupMode: "match",
      inducements: [],
    });
    expect(catalogue).not.toHaveBeenCalled();
  });

  it("coupe antérieure au réglage (null) : match, rien au build", async () => {
    cupFind.mockResolvedValue({ format: "bb11", inducementMode: null });
    const res = await get("/team/build-inducements?roster=human&cupId=cup-1");
    expect(res.body.data.allowed).toBe(false);
  });

  it("règlement seul (hors coupe) : catalogue du règlement", async () => {
    const res = await get(
      `/team/build-inducements?roster=goblin&tournamentRuleset=${NAF_WORLD_CUP_2027.slug}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(true);
    expect(res.body.data.cupMode).toBeNull();
    expect(catalogue).toHaveBeenCalledWith(
      expect.objectContaining({ pack: NAF_WORLD_CUP_2027, ruleset: "season_3" }),
    );
  });

  it("jeu libre : rien à acheter au build", async () => {
    const res = await get("/team/build-inducements?roster=human");
    expect(res.body.data).toMatchObject({ allowed: false, inducements: [] });
  });

  it("coupe inconnue : 404", async () => {
    cupFind.mockResolvedValue(null);
    const res = await get("/team/build-inducements?roster=human&cupId=nope");
    expect(res.status).toBe(404);
  });

  it("roster absent : 400", async () => {
    const res = await get("/team/build-inducements");
    expect(res.status).toBe(400);
  });
});
