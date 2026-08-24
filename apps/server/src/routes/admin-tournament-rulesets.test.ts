/**
 * Tests d'intégration des endpoints /admin/tournament-rulesets :
 * list (DB + statique, archivés inclus), détail, création (slug unique,
 * validation sémantique rosters/tranches), édition (slug immuable, merge
 * champ à champ), archivage/désarchivage idempotents, seed create-only.
 * Chaque écriture audite et invalide le cache public.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    tournamentRuleset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
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

vi.mock("./public-tournament-rulesets", () => ({
  invalidateTournamentRulesetCaches: vi.fn(),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import express from "express";
import http from "node:http";
import adminRouter from "./admin-tournament-rulesets";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidateTournamentRulesetCaches } from "./public-tournament-rulesets";
import { serializeDefinitionForDb } from "../services/tournament-ruleset-repository";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);
const mockedInvalidate = vi.mocked(invalidateTournamentRulesetCaches);

const findMany = prisma.tournamentRuleset
  .findMany as unknown as ReturnType<typeof vi.fn>;
const findUnique = prisma.tournamentRuleset
  .findUnique as unknown as ReturnType<typeof vi.fn>;
const create = prisma.tournamentRuleset
  .create as unknown as ReturnType<typeof vi.fn>;
const update = prisma.tournamentRuleset
  .update as unknown as ReturnType<typeof vi.fn>;

async function request(
  method: "GET" | "POST" | "PUT",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/tournament-rulesets", adminRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {},
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => (buf += chunk));
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
      if (payload) req.write(payload);
      req.end();
    });
  });
}

/** Ligne DB (strings sérialisées) dérivée du pack NAF + surcharges. */
function nafRow(over: Record<string, unknown> = {}) {
  return {
    id: "tr-naf",
    ...serializeDefinitionForDb(NAF_WORLD_CUP_2027),
    descriptionFr: NAF_WORLD_CUP_2027.descriptionFr,
    resurrection: true,
    minRegularPlayersBeforeStars: 11,
    archivedAt: null,
    createdAt: new Date("2026-08-24T10:00:00Z"),
    updatedAt: new Date("2026-08-24T10:00:00Z"),
    ...over,
  };
}

const VALID_CREATE_BODY = {
  slug: "coupe_maison",
  nameFr: "Coupe Maison 2027",
  nameEn: "House Cup 2027",
  shortLabel: "Coupe Maison",
  version: "V1",
  edition: "season_3",
  format: "bb11",
  descriptionFr: "Règlement maison.",
  rosterRules: {
    orc: {
      goldBudget: 1100,
      sppBudget: 50,
      skillStacking: "one_player",
      starPlayersAllowed: true,
    },
  },
  skillCosts: {
    firstPrimary: 6,
    firstSecondary: 10,
    secondPrimary: 8,
    secondSecondary: 12,
    eliteSurcharge: 2,
  },
  starPlayerSppTax: [
    { maxTotalCostK: 199, spp: 18 },
    { maxTotalCostK: null, spp: 32 },
  ],
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /admin/tournament-rulesets", () => {
  it("liste archivés inclus + entrées statiques non seedées", async () => {
    findMany.mockResolvedValue([
      nafRow({ id: "tr-x", slug: "pack_archive", archivedAt: new Date() }),
    ]);
    const { status, body } = await request("GET", "/admin/tournament-rulesets");
    expect(status).toBe(200);
    const slugs = body.data.tournamentRulesets.map((r: any) => r.slug);
    expect(slugs).toContain("pack_archive");
    expect(slugs).toContain("naf_world_cup_2027");
    const archived = body.data.tournamentRulesets.find(
      (r: any) => r.slug === "pack_archive",
    );
    expect(archived.archived).toBe(true);
    expect(archived.source).toBe("db");
  });
});

describe("GET /admin/tournament-rulesets/:id", () => {
  it("détail parsé (tranches null → règles complètes)", async () => {
    findUnique.mockResolvedValue(nafRow());
    const { status, body } = await request(
      "GET",
      "/admin/tournament-rulesets/tr-naf",
    );
    expect(status).toBe(200);
    expect(body.data.tournamentRuleset.slug).toBe("naf_world_cup_2027");
    expect(body.data.tournamentRuleset.rosterRules.orc.goldBudget).toBe(1080);
    expect(body.data.tournamentRuleset.archived).toBe(false);
  });

  it("404 sur id inconnu", async () => {
    findUnique.mockResolvedValue(null);
    const { status } = await request(
      "GET",
      "/admin/tournament-rulesets/absent",
    );
    expect(status).toBe(404);
  });
});

describe("POST /admin/tournament-rulesets (création)", () => {
  it("crée, audite et invalide le cache public", async () => {
    findUnique.mockResolvedValue(null);
    create.mockImplementation(async ({ data }: { data: any }) => ({
      id: "tr-new",
      ...data,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const { status, body } = await request(
      "POST",
      "/admin/tournament-rulesets",
      VALID_CREATE_BODY,
    );
    expect(status).toBe(201);
    expect(body.data.tournamentRuleset.slug).toBe("coupe_maison");
    // Colonnes Json écrites en strings sérialisées (PG + miroir SQLite).
    const written = create.mock.calls[0][0].data;
    expect(typeof written.rosterRules).toBe("string");
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "tournamentRuleset.create" }),
    );
    expect(mockedInvalidate).toHaveBeenCalled();
  });

  it("409 sur slug déjà pris", async () => {
    findUnique.mockResolvedValue({ id: "tr-exist" });
    const { status } = await request(
      "POST",
      "/admin/tournament-rulesets",
      VALID_CREATE_BODY,
    );
    expect(status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("400 sémantique : roster inconnu de l'édition", async () => {
    const { status, body } = await request("POST", "/admin/tournament-rulesets", {
      ...VALID_CREATE_BODY,
      rosterRules: {
        roster_fantome: {
          goldBudget: 1000,
          sppBudget: 40,
          skillStacking: "none",
          starPlayersAllowed: false,
        },
      },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Rosters inconnus/);
  });

  it("400 sémantique : bretonnian refusé en season_2", async () => {
    const { status, body } = await request("POST", "/admin/tournament-rulesets", {
      ...VALID_CREATE_BODY,
      edition: "season_2",
      rosterRules: {
        bretonnian: {
          goldBudget: 1160,
          sppBudget: 58,
          skillStacking: "one_player",
          starPlayersAllowed: true,
        },
      },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/season_2/);
  });

  it("400 sémantique : tranche ouverte pas en dernier", async () => {
    const { status, body } = await request("POST", "/admin/tournament-rulesets", {
      ...VALID_CREATE_BODY,
      starPlayerSppTax: [
        { maxTotalCostK: null, spp: 32 },
        { maxTotalCostK: 199, spp: 18 },
      ],
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/dernière/);
  });

  it("400 sémantique : tranches non croissantes", async () => {
    const { status, body } = await request("POST", "/admin/tournament-rulesets", {
      ...VALID_CREATE_BODY,
      starPlayerSppTax: [
        { maxTotalCostK: 299, spp: 24 },
        { maxTotalCostK: 199, spp: 18 },
      ],
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/croissantes/);
  });

  it("400 Zod : slug invalide", async () => {
    const { status } = await request("POST", "/admin/tournament-rulesets", {
      ...VALID_CREATE_BODY,
      slug: "Pas Un Slug",
    });
    expect(status).toBe(400);
  });
});

describe("PUT /admin/tournament-rulesets/:id (édition)", () => {
  it("merge les champs fournis, slug immuable, audite", async () => {
    findUnique.mockResolvedValue(nafRow());
    update.mockImplementation(async ({ data }: { data: any }) => ({
      ...nafRow(),
      ...data,
      updatedAt: new Date(),
    }));
    const { status, body } = await request(
      "PUT",
      "/admin/tournament-rulesets/tr-naf",
      { nameFr: "NAF WC édité", version: "V2.2" },
    );
    expect(status).toBe(200);
    expect(body.data.tournamentRuleset.nameFr).toBe("NAF WC édité");
    // Le slug ne fait jamais partie du update.
    const written = update.mock.calls[0][0].data;
    expect(written.slug).toBeUndefined();
    // Champs non fournis conservés (rosterRules du pack NAF).
    expect(body.data.tournamentRuleset.rosterRules.orc.goldBudget).toBe(1080);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "tournamentRuleset.update" }),
    );
    expect(mockedInvalidate).toHaveBeenCalled();
  });

  it("400 sémantique sur la définition RÉSULTANTE (édition changée)", async () => {
    findUnique.mockResolvedValue(nafRow());
    // Passage en season_2 alors que rosterRules contient bretonnian (S3 only).
    const { status, body } = await request(
      "PUT",
      "/admin/tournament-rulesets/tr-naf",
      { edition: "season_2" },
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/Rosters inconnus/);
    expect(update).not.toHaveBeenCalled();
  });

  it("404 sur id inconnu", async () => {
    findUnique.mockResolvedValue(null);
    const { status } = await request(
      "PUT",
      "/admin/tournament-rulesets/absent",
      { nameFr: "X" },
    );
    expect(status).toBe(404);
  });
});

describe("archive / unarchive", () => {
  it("archive puis idempotent (changed=false)", async () => {
    findUnique.mockResolvedValue({
      id: "tr-naf",
      slug: "naf_world_cup_2027",
      archivedAt: null,
    });
    update.mockResolvedValue({});
    const first = await request(
      "POST",
      "/admin/tournament-rulesets/tr-naf/archive",
    );
    expect(first.status).toBe(200);
    expect(first.body.data.changed).toBe(true);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "tournamentRuleset.archive" }),
    );

    vi.resetAllMocks();
    findUnique.mockResolvedValue({
      id: "tr-naf",
      slug: "naf_world_cup_2027",
      archivedAt: new Date(),
    });
    const second = await request(
      "POST",
      "/admin/tournament-rulesets/tr-naf/archive",
    );
    expect(second.status).toBe(200);
    expect(second.body.data.changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("unarchive rétablit archivedAt=null", async () => {
    findUnique.mockResolvedValue({
      id: "tr-naf",
      slug: "naf_world_cup_2027",
      archivedAt: new Date(),
    });
    update.mockResolvedValue({});
    const { status, body } = await request(
      "POST",
      "/admin/tournament-rulesets/tr-naf/unarchive",
    );
    expect(status).toBe(200);
    expect(body.data.changed).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { archivedAt: null } }),
    );
  });
});

describe("POST /seed", () => {
  it("matérialise les packs statiques manquants (create-only)", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "tr-naf" });
    const { status, body } = await request(
      "POST",
      "/admin/tournament-rulesets/seed",
    );
    expect(status).toBe(200);
    expect(body.data.created).toBeGreaterThan(0);
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "tournamentRuleset.seed" }),
    );
    expect(mockedInvalidate).toHaveBeenCalled();
  });
});
