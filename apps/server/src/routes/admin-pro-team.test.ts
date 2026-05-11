/**
 * Tests integration des endpoints admin-pro-team (branding).
 *
 * Couvre : GET liste/detail, PATCH branding (succes, validation,
 * 404, audit log, merge meta).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: {
      findMany: vi.fn(),
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

import express from "express";
import http from "http";
import teamRouter from "./admin-pro-team";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

interface MockedPrisma {
  proTeam: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function request(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/pro-league", teamRouter);
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
          path: `/admin/pro-league${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
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
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const teamFixture = {
  id: "t1",
  leagueId: "l1",
  slug: "pit-smashers",
  city: "Pittsburgh",
  name: "Smashers",
  race: "Orc",
  nflFlavor: "Steelers",
  primaryColor: "#000000",
  secondaryColor: "#FFB612",
  baseTv: 1000,
  meta: { motto: "Smash hour", fanbase: 5000 },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("GET /admin/pro-league/teams", () => {
  it("liste toutes les teams (sans filtre leagueId)", async () => {
    mockedPrisma.proTeam.findMany.mockResolvedValueOnce([teamFixture]);

    const res = await request("GET", "/teams");

    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0]).toMatchObject({
      id: "t1",
      slug: "pit-smashers",
      city: "Pittsburgh",
      primaryColor: "#000000",
      motto: "Smash hour",
    });
    expect(mockedPrisma.proTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("filtre par leagueId quand fourni", async () => {
    mockedPrisma.proTeam.findMany.mockResolvedValueOnce([]);
    await request("GET", "/teams?leagueId=l99");
    expect(mockedPrisma.proTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leagueId: "l99" } }),
    );
  });

  it("expose motto/headline depuis meta string sqlite", async () => {
    mockedPrisma.proTeam.findMany.mockResolvedValueOnce([
      { ...teamFixture, meta: JSON.stringify({ motto: "from-string" }) },
    ]);
    const res = await request("GET", "/teams");
    expect(res.body.teams[0].motto).toBe("from-string");
  });
});

describe("GET /admin/pro-league/teams/:id", () => {
  it("retourne le detail d'une team", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    const res = await request("GET", "/teams/t1");
    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({ id: "t1", motto: "Smash hour" });
  });

  it("404 si team introuvable", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/teams/missing");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/introuvable/);
  });
});

describe("PATCH /admin/pro-league/teams/:id", () => {
  it("met a jour les couleurs et trace audit", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockResolvedValueOnce({
      ...teamFixture,
      primaryColor: "#FF0000",
      secondaryColor: "#00FF00",
    });

    const res = await request("PATCH", "/teams/t1", {
      primaryColor: "#FF0000",
      secondaryColor: "#00FF00",
    });

    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({
      primaryColor: "#FF0000",
      secondaryColor: "#00FF00",
    });
    expect(mockedPrisma.proTeam.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { primaryColor: "#FF0000", secondaryColor: "#00FF00" },
    });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const auditArg = mockedAudit.mock.calls[0][2];
    expect(auditArg).toMatchObject({
      action: "pro-team.branding.update",
      entity: "ProTeam",
      entityId: "t1",
    });
    expect(auditArg.oldValue).toMatchObject({ primaryColor: "#000000" });
    expect(auditArg.newValue).toMatchObject({ primaryColor: "#FF0000" });
  });

  it("merge motto sans ecraser fanbase", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockImplementationOnce(async ({ data }: any) => ({
      ...teamFixture,
      meta: data.meta,
    }));

    const res = await request("PATCH", "/teams/t1", {
      motto: "New rallying cry",
    });

    expect(res.status).toBe(200);
    const updateCall = mockedPrisma.proTeam.update.mock.calls[0][0];
    expect(updateCall.data.meta).toEqual({
      motto: "New rallying cry",
      fanbase: 5000,
    });
  });

  it("efface motto quand null explicite", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockImplementationOnce(async ({ data }: any) => ({
      ...teamFixture,
      meta: data.meta,
    }));

    await request("PATCH", "/teams/t1", { motto: null });

    const updateCall = mockedPrisma.proTeam.update.mock.calls[0][0];
    expect(updateCall.data.meta).toEqual({ fanbase: 5000 });
    expect("motto" in updateCall.data.meta).toBe(false);
  });

  it("met a jour city + name + nflFlavor", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockResolvedValueOnce({
      ...teamFixture,
      city: "New City",
      name: "Renamed",
      nflFlavor: "Cowboys",
    });

    const res = await request("PATCH", "/teams/t1", {
      city: "New City",
      name: "Renamed",
      nflFlavor: "Cowboys",
    });

    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({
      city: "New City",
      name: "Renamed",
      nflFlavor: "Cowboys",
    });
  });

  it("rejette une couleur au format invalide (400)", async () => {
    const res = await request("PATCH", "/teams/t1", {
      primaryColor: "red",
    });
    expect(res.status).toBe(400);
    expect(mockedPrisma.proTeam.update).not.toHaveBeenCalled();
  });

  it("rejette une couleur trop courte", async () => {
    const res = await request("PATCH", "/teams/t1", {
      primaryColor: "#F00",
    });
    expect(res.status).toBe(400);
  });

  it("rejette un body vide (au moins un champ requis)", async () => {
    const res = await request("PATCH", "/teams/t1", {});
    expect(res.status).toBe(400);
  });

  it("404 si team introuvable", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(null);
    const res = await request("PATCH", "/teams/missing", {
      motto: "x",
    });
    expect(res.status).toBe(404);
    expect(mockedPrisma.proTeam.update).not.toHaveBeenCalled();
  });

  it("ne touche pas a meta si ni motto ni headline fournis", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockResolvedValueOnce(teamFixture);

    await request("PATCH", "/teams/t1", { primaryColor: "#ABCDEF" });

    const updateCall = mockedPrisma.proTeam.update.mock.calls[0][0];
    expect("meta" in updateCall.data).toBe(false);
  });

  it("efface nflFlavor avec null explicite", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeam.update.mockImplementationOnce(async ({ data }: any) => ({
      ...teamFixture,
      ...data,
    }));

    await request("PATCH", "/teams/t1", { nflFlavor: null });

    const updateCall = mockedPrisma.proTeam.update.mock.calls[0][0];
    expect(updateCall.data.nflFlavor).toBeNull();
  });
});
