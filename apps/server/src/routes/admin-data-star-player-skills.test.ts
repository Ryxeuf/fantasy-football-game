/**
 * Admin — Star Players : resolution des competences et recrutement.
 *
 * Ecrit apres un « impossible d'enregistrer les competences d'un Star
 * Player » : `Skill` est unique par [slug, ruleset], donc un
 * `connect: { slug }` est rejete par Prisma. Ce test verrouille la
 * resolution par ID (comme pour les positions), le refus AVANT toute
 * suppression, et la conservation du couple (regle, roster) envoye par
 * le formulaire en cases a cocher.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    skill: { findMany: vi.fn() },
    starPlayer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    starPlayerSkill: { deleteMany: vi.fn() },
    starPlayerHirableBy: { deleteMany: vi.fn() },
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
  skill: { findMany: ReturnType<typeof vi.fn> };
  starPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  starPlayerSkill: { deleteMany: ReturnType<typeof vi.fn> };
  starPlayerHirableBy: { deleteMany: ReturnType<typeof vi.fn> };
};

const SKILLS = [
  { id: "skill-block-s3", slug: "block", ruleset: "season_3" },
  { id: "skill-dodge-s3", slug: "dodge", ruleset: "season_3" },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocked.skill.findMany.mockImplementation(async ({ where }: never) => {
    const w = where as { slug: { in: string[] }; ruleset: string };
    return SKILLS.filter(
      (s) => s.ruleset === w.ruleset && w.slug.in.includes(s.slug),
    ).map((s) => ({ id: s.id, slug: s.slug }));
  });
  mocked.starPlayer.findUnique.mockResolvedValue({
    slug: "griff_oberwald",
    ruleset: "season_3",
    displayName: "Griff Oberwald",
    cost: 280000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 4,
    av: 9,
    specialRule: null,
  });
  mocked.starPlayer.create.mockImplementation(async () => ({
    id: "sp1",
    slug: "griff_oberwald",
    displayName: "Griff Oberwald",
    cost: 280000,
    skills: [],
    hirableBy: [],
  }));
  mocked.starPlayer.update.mockImplementation(async () => ({
    id: "sp1",
    slug: "griff_oberwald",
    displayName: "Griff Oberwald",
    cost: 280000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 4,
    av: 9,
    specialRule: null,
    skills: [],
    hirableBy: [],
  }));
  mocked.starPlayerSkill.deleteMany.mockResolvedValue({ count: 0 });
  mocked.starPlayerHirableBy.deleteMany.mockResolvedValue({ count: 0 });
});

async function call(
  method: "POST" | "PUT",
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: { error?: string } }> {
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
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload).toString(),
          },
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
      req.write(payload);
      req.end();
    });
  });
}

/** Corps envoyé par le formulaire d'édition pour une sélection donnée. */
function putBody(
  skillSlugs: string[],
  hirableBy: Array<string | { rule: string; rosterId: string }>,
): Record<string, unknown> {
  return {
    displayName: "Griff Oberwald",
    cost: 280000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 4,
    av: 9,
    specialRule: null,
    imageUrl: null,
    skillSlugs,
    hirableBy,
  };
}

describe("Admin — Star Player : compétences cochées", () => {
  it("PUT connecte les compétences par ID dans le ruleset du joueur", async () => {
    const res = await call("PUT", "/admin/data/star-players/sp1", putBody(
      ["block", "dodge"],
      ["all"],
    ));

    expect(res.status).toBe(200);
    expect(mocked.skill.findMany).toHaveBeenCalledWith({
      where: { slug: { in: ["block", "dodge"] }, ruleset: "season_3" },
      select: { id: true, slug: true },
    });
    const data = mocked.starPlayer.update.mock.calls[0][0].data;
    expect(data.skills.create).toEqual([
      { skill: { connect: { id: "skill-block-s3" } } },
      { skill: { connect: { id: "skill-dodge-s3" } } },
    ]);
  });

  it("PUT refuse un slug inconnu SANS vider les relations existantes", async () => {
    const res = await call("PUT", "/admin/data/star-players/sp1", putBody(
      ["block", "inconnue"],
      ["all"],
    ));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("inconnue");
    expect(mocked.starPlayerSkill.deleteMany).not.toHaveBeenCalled();
    expect(mocked.starPlayerHirableBy.deleteMany).not.toHaveBeenCalled();
    expect(mocked.starPlayer.update).not.toHaveBeenCalled();
  });

  it("PUT conserve le couple (règle, roster) coché pour un roster précis", async () => {
    const res = await call("PUT", "/admin/data/star-players/sp1", putBody(
      [],
      ["old_world_classic", { rule: "skaven", rosterId: "roster-skaven" }],
    ));

    expect(res.status).toBe(200);
    const data = mocked.starPlayer.update.mock.calls[0][0].data;
    expect(data.hirableBy.create).toEqual([
      { rule: "old_world_classic", rosterId: null },
      { rule: "skaven", rosterId: "roster-skaven" },
    ]);
  });

  it("POST résout les compétences dans le ruleset demandé", async () => {
    const res = await call("POST", "/admin/data/star-players", {
      slug: "griff_oberwald",
      ruleset: "season_3",
      displayName: "Griff Oberwald",
      cost: 280000,
      ma: 7,
      st: 4,
      ag: 2,
      pa: 4,
      av: 9,
      skillSlugs: ["block"],
      hirableBy: ["all"],
    });

    expect(res.status).toBe(201);
    const data = mocked.starPlayer.create.mock.calls[0][0].data;
    expect(data.ruleset).toBe("season_3");
    expect(data.skills.create).toEqual([
      { skill: { connect: { id: "skill-block-s3" } } },
    ]);
  });

  it("PUT sur un Star Player inconnu répond 404 sans rien supprimer", async () => {
    mocked.starPlayer.findUnique.mockResolvedValue(null);

    const res = await call("PUT", "/admin/data/star-players/sp404", putBody(
      ["block"],
      [],
    ));

    expect(res.status).toBe(404);
    expect(mocked.starPlayerSkill.deleteMany).not.toHaveBeenCalled();
  });
});
