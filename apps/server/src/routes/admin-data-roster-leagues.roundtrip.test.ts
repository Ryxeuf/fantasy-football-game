/**
 * Aller-retour admin sur les ligues d'un roster : GET (ligues effectives)
 * -> l'admin coche une ligue de plus -> PUT -> GET.
 *
 * Ecrit apres un rapport « l'ajout d'une ligue ne fonctionne pas, la
 * suppression si » : ce test verrouille les deux sens sur le vrai routeur,
 * avec une base en memoire (le stockage est une colonne texte, c'est la
 * serialisation qui est en cause dans ce genre de bug).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    roster: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../services/audit-log", () => ({
  recordAdminAction: vi.fn(),
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("../services/revalidate-web", () => ({
  revalidateRosterPages: vi.fn(async () => {}),
}));

import express from "express";
import http from "http";
import adminDataRouter from "./admin-data";
import { prisma } from "../prisma";

const mocked = prisma as unknown as {
  roster: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

/** Ligne en base : `regionalRules` est une colonne TEXTE. */
let row: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  row = {
    id: "r1",
    slug: "wood_elf",
    ruleset: "season_3",
    name: "Elfes Sylvains",
    nameEn: "Wood Elf",
    descriptionFr: null,
    descriptionEn: null,
    budget: 1150,
    tier: "I",
    regionalRules: null, // cas majoritaire : rien en base
    specialRules: null,
    naf: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    positions: [],
    staffConfigs: [],
  };
  mocked.roster.findUnique.mockImplementation(async () => row);
  mocked.roster.update.mockImplementation(async ({ data }: never) => {
    row = { ...row, ...(data as Record<string, unknown>) };
    return row;
  });
});

interface RosterResponse {
  roster?: {
    regionalRules?: string[];
    regionalRulesSource?: string;
  };
  error?: string;
}

async function call(
  method: "GET" | "PUT",
  body?: Record<string, unknown>,
): Promise<{ status: number; body: RosterResponse }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/data", adminDataRouter);
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
          path: "/admin/data/rosters/r1",
          method,
          headers: payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload).toString(),
              }
            : {},
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: buf ? JSON.parse(buf) : {},
            });
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

/** Corps envoyé par le formulaire d'admin pour une liste de ligues donnée. */
function putBody(regionalRules: string[]): Record<string, unknown> {
  return {
    name: "Elfes Sylvains",
    nameEn: "Wood Elf",
    descriptionFr: null,
    descriptionEn: null,
    budget: 1150,
    tier: "I",
    regionalRules: regionalRules.length > 0 ? regionalRules : null,
    specialRules: null,
    naf: true,
    ruleset: "season_3",
  };
}

describe("Admin — aller-retour sur les ligues d'un roster", () => {
  it("part des ligues effectives quand la colonne est vide", async () => {
    const got = await call("GET");
    expect(got.status).toBe(200);
    expect(got.body.roster?.regionalRulesSource).toBe("roster-defaults");
    expect(got.body.roster?.regionalRules).toEqual(
      expect.arrayContaining(["elven_kingdoms_league", "woodland_league"]),
    );
  });

  it("AJOUT : une ligue cochée en plus est persistée et relue", async () => {
    const before = (await call("GET")).body.roster?.regionalRules ?? [];
    const added = [...before, "old_world_classic"];

    const put = await call("PUT", putBody(added));
    expect(put.status).toBe(200);
    // La colonne stocke bien la liste complète, ajout compris.
    expect(JSON.parse(String(row.regionalRules))).toEqual(added);

    const after = await call("GET");
    expect(after.body.roster?.regionalRulesSource).toBe("db");
    expect(after.body.roster?.regionalRules).toEqual(added);
    expect(after.body.roster?.regionalRules).toContain("old_world_classic");
  });

  it("SUPPRESSION : une ligue décochée disparaît de la relecture", async () => {
    await call("PUT", putBody(["elven_kingdoms_league", "woodland_league"]));
    await call("PUT", putBody(["elven_kingdoms_league"]));

    const after = await call("GET");
    expect(after.body.roster?.regionalRulesSource).toBe("db");
    expect(after.body.roster?.regionalRules).toEqual([
      "elven_kingdoms_league",
    ]);
  });

  it("tout décocher revient aux ligues par défaut du roster", async () => {
    await call("PUT", putBody(["elven_kingdoms_league"]));
    await call("PUT", putBody([]));

    const after = await call("GET");
    // Colonne remise à NULL => l'API repart du catalogue (et le dit).
    expect(after.body.roster?.regionalRulesSource).toBe("roster-defaults");
  });
});
