/**
 * Une équipe supprimée n'accepte plus aucune écriture : chaîne Express réelle
 * (routeurs, JWT signés), Prisma mocké. Le garde précède la validation, d'où
 * des corps vides.
 */
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique },
    // Le handler de retrait s'arrête là : ligue introuvable.
    league: { findUnique: vi.fn(async () => null) },
  },
}));

import { JWT_SECRET } from "../config";
import { DELETED_TEAM_READ_ONLY_MESSAGE } from "../middleware/rejectDeletedTeamWrite";
import leagueRoutes from "./league";
import teamRoutes from "./team";
import teamAdvancementRoutes from "./team-advancement";

const adminToken = jwt.sign({ sub: "admin-1", roles: ["admin"] }, JWT_SECRET);

async function call(
  method: string,
  path: string,
  token: string | null = adminToken,
): Promise<{ status: number; error?: string }> {
  const app = express();
  app.use(express.json());
  app.use("/team", teamRoutes);
  app.use("/team", teamAdvancementRoutes);
  app.use("/leagues", leagueRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === "GET" ? undefined : "{}",
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { status: res.status, error: body.error };
  } finally {
    server.close();
  }
}

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue({ deletedAt: new Date("2026-08-25T14:51:12Z") });
});

describe("écritures sur une équipe supprimée", () => {
  it.each([
    ["PUT", "/team/t1"],
    ["PUT", "/team/t1/info"],
    ["PUT", "/team/t1/roster"],
    ["DELETE", "/team/t1"],
    ["PATCH", "/team/t1/name"],
    ["POST", "/team/t1/logo"],
    ["POST", "/team/t1/players"],
    ["PATCH", "/team/t1/players/p1/identity"],
    ["PUT", "/team/t1/players/p1/skills"],
    ["PUT", "/team/t1/psp-pool"],
    ["PUT", "/team/t1/initial-budget"],
    ["DELETE", "/team/t1/players/p1/advancements/0"],
    ["POST", "/team/t1/star-players"],
    ["POST", "/team/t1/purchase"],
    ["POST", "/team/t1/players/p1/advancement"],
    ["POST", "/team/t1/players/p1/advancement/roll-random-primary"],
    ["POST", "/leagues/l1/teams/t1/players/p1/spp"],
    ["PATCH", "/leagues/l1/teams/t1/treasury"],
    ["DELETE", "/leagues/l1/teams/t1/players/p1"],
  ])("%s %s est refusé, même pour un admin", async (method, path) => {
    const res = await call(method, path);
    expect(res.status).toBe(409);
    expect(res.error).toBe(DELETED_TEAM_READ_ONLY_MESSAGE);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "t1" },
      select: { deletedAt: true },
    });
  });

  it("répond 401 à un appel anonyme, sans lire la base", async () => {
    const res = await call("PATCH", "/team/t1/name", null);
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("laisse passer une équipe active jusqu'à la validation", async () => {
    findUnique.mockResolvedValue({ deletedAt: null });
    const res = await call("PATCH", "/team/t1/name");
    expect(res.status).toBe(400);
  });

  it("ne consulte pas le garde sur les créations statiques", async () => {
    const res = await call("POST", "/team/build");
    expect(res.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("n'empêche pas de retirer l'équipe d'une saison", async () => {
    const res = await call("DELETE", "/leagues/l1/seasons/s1/teams/t1");
    expect(res.status).not.toBe(409);
  });
});
