/**
 * Tests pour le service level-up (Lot 3.C.4).
 *
 * Couvre :
 *   - `levelForSpp(spp)` (pure) : table BB officielle (6/16/31/51/76/176).
 *   - `pickAdvancement(skills, seed)` (pure) : skill aleatoire deterministe,
 *     dupes filtres.
 *   - `applyLevelUps(rosterId)` (I/O) : append skill, increment level,
 *     idempotent si deja a jour.
 *   - `sweepLevelUps()` cron : sweep rosters dont level < expected.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  applyLevelUps,
  GENERAL_SKILL_POOL,
  levelForSpp,
  LevelUpError,
  pickAdvancement,
  SPP_LEVEL_THRESHOLDS,
  sweepLevelUps,
} from "./pro-roster-level-up";

interface MockedPrisma {
  proTeamRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proTeamRoster.update.mockResolvedValue({});
});

describe("SPP_LEVEL_THRESHOLDS — Lot 3.C.4", () => {
  it("respecte la table BB officielle (cumulative SPP par level)", () => {
    expect(SPP_LEVEL_THRESHOLDS).toEqual([6, 16, 31, 51, 76, 176]);
  });
});

describe("levelForSpp — Lot 3.C.4", () => {
  it("level 1 (rookie) entre 0 et 5 SPP", () => {
    expect(levelForSpp(0)).toBe(1);
    expect(levelForSpp(5)).toBe(1);
  });

  it("seuil 6 SPP = level 2 (experienced)", () => {
    expect(levelForSpp(6)).toBe(2);
    expect(levelForSpp(15)).toBe(2);
  });

  it("seuil 16 SPP = level 3 (veteran)", () => {
    expect(levelForSpp(16)).toBe(3);
    expect(levelForSpp(30)).toBe(3);
  });

  it("seuils intermediaires (31, 51, 76)", () => {
    expect(levelForSpp(31)).toBe(4);
    expect(levelForSpp(51)).toBe(5);
    expect(levelForSpp(76)).toBe(6);
  });

  it("seuil 176 SPP = level 7 (legend), max", () => {
    expect(levelForSpp(176)).toBe(7);
    expect(levelForSpp(500)).toBe(7);
  });

  it("rejette spp negatif (defense-in-depth -> level 1)", () => {
    expect(levelForSpp(-1)).toBe(1);
  });
});

describe("GENERAL_SKILL_POOL — Lot 3.C.4", () => {
  it("contient au moins 8 skills de la categorie General BB", () => {
    expect(GENERAL_SKILL_POOL.length).toBeGreaterThanOrEqual(8);
    // Block / Tackle / Frenzy sont les pilliers du pool General BB.
    expect(GENERAL_SKILL_POOL).toContain("block");
    expect(GENERAL_SKILL_POOL).toContain("frenzy");
    expect(GENERAL_SKILL_POOL).toContain("tackle");
  });

  it("ne contient pas de skill Agility (ex: 'dodge' qui est categorie A)", () => {
    expect(GENERAL_SKILL_POOL).not.toContain("dodge");
  });
});

describe("pickAdvancement — Lot 3.C.4", () => {
  it("retourne un skill du pool quand aucun n'est connu (deterministe)", () => {
    const a = pickAdvancement([], 42);
    const b = pickAdvancement([], 42);
    expect(a).toBe(b);
    expect(GENERAL_SKILL_POOL).toContain(a as string);
  });

  it("filtre les skills deja connus", () => {
    const known = [...GENERAL_SKILL_POOL.slice(0, GENERAL_SKILL_POOL.length - 1)];
    const skill = pickAdvancement(known, 1);
    expect(skill).toBe(GENERAL_SKILL_POOL[GENERAL_SKILL_POOL.length - 1]);
  });

  it("retourne null quand toutes les skills sont connues", () => {
    expect(pickAdvancement([...GENERAL_SKILL_POOL], 1)).toBeNull();
  });

  it("varie selon le seed", () => {
    const seeds = [0, 1, 2, 3, 4, 5, 6, 7];
    const picks = new Set(seeds.map((s) => pickAdvancement([], s)));
    // Avec 8 seeds + ~10 skills, on attend au moins 2 valeurs distinctes.
    expect(picks.size).toBeGreaterThanOrEqual(2);
  });
});

describe("applyLevelUps — Lot 3.C.4", () => {
  it("ROSTER_NOT_FOUND si l'id n'existe pas", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(null);
    await expect(applyLevelUps("missing")).rejects.toThrow(LevelUpError);
    await expect(applyLevelUps("missing")).rejects.toMatchObject({
      code: "ROSTER_NOT_FOUND",
    });
  });

  it("idempotent : skip si level deja a jour", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r1",
      spp: 5,
      level: 1,
      skills: [],
      status: "active",
    });
    const out = await applyLevelUps("r1");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("level_up_to_date");
    expect(mocked.proTeamRoster.update).not.toHaveBeenCalled();
  });

  it("up-leveling 1 -> 2 ajoute 1 skill et set level=2", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r2",
      spp: 6,
      level: 1,
      skills: [],
      status: "active",
    });
    const out = await applyLevelUps("r2");
    expect(out.skipped).toBe(false);
    expect(out.newLevel).toBe(2);
    expect(out.advancements).toHaveLength(1);
    expect(GENERAL_SKILL_POOL).toContain(out.advancements[0]);
    expect(mocked.proTeamRoster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r2" },
        data: expect.objectContaining({
          level: 2,
          skills: expect.any(Array),
        }),
      }),
    );
  });

  it("up-leveling 1 -> 3 (jump deux niveaux) ajoute 2 skills distincts", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r3",
      spp: 16,
      level: 1,
      skills: [],
      status: "active",
    });
    const out = await applyLevelUps("r3");
    expect(out.newLevel).toBe(3);
    expect(out.advancements).toHaveLength(2);
    expect(new Set(out.advancements).size).toBe(2);
  });

  it("status='dead' n'est pas eligible level-up", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r_dead",
      spp: 100,
      level: 1,
      skills: [],
      status: "dead",
    });
    const out = await applyLevelUps("r_dead");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("inactive_roster");
  });

  it("plafonne les advancements si le pool s'epuise (no_skill_available)", async () => {
    // Roster a tous les skills general -> impossible de pick.
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r_full",
      spp: 6,
      level: 1,
      skills: [...GENERAL_SKILL_POOL],
      status: "active",
    });
    const out = await applyLevelUps("r_full");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("no_skill_available");
    // Niveau pas update car aucun skill ajoute.
    expect(mocked.proTeamRoster.update).not.toHaveBeenCalled();
  });
});

describe("sweepLevelUps — Lot 3.C.4", () => {
  it("0/0/0 si rien", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    expect(await sweepLevelUps()).toEqual({
      inspected: 0,
      processed: 0,
      failed: 0,
    });
  });

  it("filtre status='active' uniquement", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    await sweepLevelUps();
    expect(mocked.proTeamRoster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("agrege processed + failed", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([
      { id: "ok" },
      { id: "fail" },
    ]);
    mocked.proTeamRoster.findUnique
      .mockResolvedValueOnce({
        id: "ok",
        spp: 6,
        level: 1,
        skills: [],
        status: "active",
      })
      .mockResolvedValueOnce(null); // 2eme = ROSTER_NOT_FOUND
    const out = await sweepLevelUps();
    expect(out.inspected).toBe(2);
    expect(out.processed).toBe(1);
    expect(out.failed).toBe(1);
  });
});
