/**
 * /admin/match-sheets — supervision des feuilles de match (ligues et
 * coupes) : liste filtrée et remise à zéro d'une feuille non validée.
 *
 * Chaîne Express réelle, Prisma mocké (cf. `admin-cups.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueMatchSheet: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
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

import express from "express";
import http from "http";
import adminMatchSheetsRouter, {
  buildAdminMatchSheetsWhere,
  toAdminMatchSheetItem,
} from "./admin-match-sheets";
import { prisma } from "../prisma";

const mockedPrisma = prisma as unknown as {
  leagueMatchSheet: Record<
    "findMany" | "count" | "groupBy" | "findUnique" | "delete",
    ReturnType<typeof vi.fn>
  >;
};

function call(
  method: "GET" | "DELETE",
  path: string,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use("/admin/match-sheets", adminMatchSheetsRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const req = http.request(
        { hostname: "127.0.0.1", port: addr.port, path, method },
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
      req.end();
    });
  });
}

const BASE_ROW = {
  status: "both_submitted",
  scoreHome: 2,
  scoreAway: 1,
  forfeitSide: null,
  submittedByHomeAt: null,
  submittedByAwayAt: null,
  validatedAt: null,
  invalidatedAt: null,
  invalidationReason: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  _count: { events: 7 },
};

const LEAGUE_ROW = {
  ...BASE_ROW,
  id: "ms-l",
  pairingId: "lp1",
  cupPairingId: null,
  cupPairing: null,
  pairing: {
    round: {
      roundNumber: 3,
      name: null,
      season: { id: "s1", name: "Saison 1", league: { id: "l1", name: "Ligue" } },
    },
    homeParticipant: {
      team: { id: "t1", name: "Rats", owner: { id: "u1", coachName: "Ratman" } },
    },
    awayParticipant: {
      team: { id: "t2", name: "Nains", owner: { id: "u2", coachName: "Grim" } },
    },
  },
};

const CUP_ROW = {
  ...BASE_ROW,
  id: "ms-c",
  status: "validated",
  pairingId: null,
  cupPairingId: "cp1",
  pairing: null,
  cupPairing: {
    round: { roundNumber: 1, name: "Ronde 1", cup: { id: "c1", name: "Coupe" } },
    homeTeam: { id: "t3", name: "Elfes", owner: { id: "u3", coachName: "Ely" } },
    awayTeam: null,
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("toAdminMatchSheetItem", () => {
  it("aplatit une feuille de ligue", () => {
    expect(toAdminMatchSheetItem(LEAGUE_ROW as never)).toMatchObject({
      id: "ms-l",
      kind: "league",
      pairingId: "lp1",
      competition: { id: "l1", name: "Ligue" },
      seasonName: "Saison 1",
      roundNumber: 3,
      eventsCount: 7,
      home: { teamId: "t1", teamName: "Rats", coachName: "Ratman" },
      away: { teamId: "t2", teamName: "Nains", coachName: "Grim" },
    });
  });

  it("aplatit une feuille de coupe, adversaire absent compris", () => {
    expect(toAdminMatchSheetItem(CUP_ROW as never)).toMatchObject({
      kind: "cup",
      pairingId: "cp1",
      competition: { id: "c1", name: "Coupe" },
      seasonName: null,
      away: null,
    });
  });

  it("ignore une feuille orpheline", () => {
    expect(
      toAdminMatchSheetItem({
        ...BASE_ROW,
        id: "x",
        pairingId: null,
        cupPairingId: null,
        pairing: null,
        cupPairing: null,
      } as never),
    ).toBeNull();
  });
});

describe("buildAdminMatchSheetsWhere", () => {
  it("sans filtre : toutes les feuilles", () => {
    expect(buildAdminMatchSheetsWhere({})).toEqual({});
  });

  it("famille + statut, recherche limitée à la famille choisie", () => {
    const where = buildAdminMatchSheetsWhere({
      kind: "cup",
      status: "validated",
      search: " elfes ",
    }) as { AND: Array<Record<string, unknown>> };
    expect(where.AND[0]).toEqual({ status: "validated" });
    expect(where.AND[1]).toEqual({ cupPairingId: { not: null } });
    const or = (where.AND[2] as { OR: unknown[] }).OR;
    expect(or).toHaveLength(3);
    expect(JSON.stringify(or)).toContain('"contains":"elfes"');
    expect(JSON.stringify(or)).not.toContain("homeParticipant");
  });
});

describe("GET /admin/match-sheets", () => {
  it("liste les deux familles et les compteurs par statut", async () => {
    mockedPrisma.leagueMatchSheet.findMany.mockResolvedValue([LEAGUE_ROW, CUP_ROW]);
    mockedPrisma.leagueMatchSheet.count.mockResolvedValue(2);
    mockedPrisma.leagueMatchSheet.groupBy.mockResolvedValue([
      { status: "both_submitted", _count: { _all: 4 } },
      { status: "validated", _count: { _all: 6 } },
    ]);

    const res = await call("GET", "/admin/match-sheets?status=both_submitted");

    expect(res.status).toBe(200);
    expect(mockedPrisma.leagueMatchSheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ status: "both_submitted" }] } }),
    );
    expect(res.body.data.sheets.map((s: { kind: string }) => s.kind)).toEqual([
      "league",
      "cup",
    ]);
    expect(res.body.data.counts).toEqual({
      total: 10,
      status: { both_submitted: 4, validated: 6 },
    });
  });

  it("400 sur un statut inconnu", async () => {
    const res = await call("GET", "/admin/match-sheets?status=nope");
    expect(res.status).toBe(400);
    expect(mockedPrisma.leagueMatchSheet.findMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/match-sheets/:id", () => {
  it("supprime une feuille non validée", async () => {
    mockedPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
      id: "ms-l",
      status: "both_submitted",
      pairingId: "lp1",
      cupPairingId: null,
    });
    mockedPrisma.leagueMatchSheet.delete.mockResolvedValue({});

    const res = await call("DELETE", "/admin/match-sheets/ms-l");

    expect(res.status).toBe(200);
    expect(mockedPrisma.leagueMatchSheet.delete).toHaveBeenCalledWith({
      where: { id: "ms-l" },
    });
  });

  it("409 sur une feuille validée : il faut l'invalider d'abord", async () => {
    mockedPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
      id: "ms-c",
      status: "validated",
      pairingId: null,
      cupPairingId: "cp1",
    });

    const res = await call("DELETE", "/admin/match-sheets/ms-c");

    expect(res.status).toBe(409);
    expect(mockedPrisma.leagueMatchSheet.delete).not.toHaveBeenCalled();
  });

  it("404 sur une feuille inconnue", async () => {
    mockedPrisma.leagueMatchSheet.findUnique.mockResolvedValue(null);
    expect((await call("DELETE", "/admin/match-sheets/nope")).status).toBe(404);
  });
});
