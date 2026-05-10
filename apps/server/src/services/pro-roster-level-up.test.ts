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
  pickStatIncrease,
  rollStatVsSkill,
  levelForSpp,
  LevelUpError,
  pickAdvancement,
  pickAdvancementFor,
  SECONDARY_PICK_PROBABILITY,
  SPP_LEVEL_THRESHOLDS,
  sweepLevelUps,
} from "./pro-roster-level-up";
import {
  getEligiblePoolFor,
  skillSourceForPlayer,
} from "./pro-position-skill-access";

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
      position: "Lineman",
    });
    const out = await applyLevelUps("r1");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("level_up_to_date");
    expect(mocked.proTeamRoster.update).not.toHaveBeenCalled();
  });

  it("up-leveling 1 -> 2 ajoute 1 advancement (skill ou stat) et set level=2", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r2",
      spp: 6,
      level: 1,
      skills: [],
      status: "active",
      position: "Lineman",
    });
    const out = await applyLevelUps("r2");
    expect(out.skipped).toBe(false);
    expect(out.newLevel).toBe(2);
    expect(out.advancements).toHaveLength(1);
    const adv = out.advancements[0];
    if (adv.kind === "skill") {
      // Lot 4.D.2 — le skill peut etre primary (G) OU secondary (A/S/P)
      // pour un Lineman.
      const eligible = [
        ...getEligiblePoolFor("Lineman", "primary"),
        ...getEligiblePoolFor("Lineman", "secondary"),
      ];
      expect(eligible).toContain(adv.skill);
    } else {
      expect(["ma", "ag", "pa", "av", "st"]).toContain(adv.stat);
    }
    expect(mocked.proTeamRoster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r2" },
        data: expect.objectContaining({
          level: 2,
          skills: expect.any(Array),
          // Lot 3.C.5 + 4.D.2 — Lineman 50k + 1 skill (20k primary
          // OU 30k secondary selon le tirage).
          tvCached: expect.any(Number),
        }),
      }),
    );
  });

  it("up-leveling 1 -> 3 (jump deux niveaux) ajoute 2 advancements distincts", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r3",
      spp: 16,
      level: 1,
      skills: [],
      status: "active",
      position: "Lineman",
    });
    const out = await applyLevelUps("r3");
    expect(out.newLevel).toBe(3);
    expect(out.advancements).toHaveLength(2);
    // Les 2 advancements ont des seeds differents -> meme s'ils sont
    // tous deux des stats, ils peuvent etre du meme ou de stats
    // differentes. On verifie juste qu'on a bien 2 entrees.
    for (const adv of out.advancements) {
      expect(["skill", "stat"]).toContain(adv.kind);
    }
  });

  it("status='dead' n'est pas eligible level-up", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r_dead",
      spp: 100,
      level: 1,
      skills: [],
      status: "dead",
      position: "Lineman",
    });
    const out = await applyLevelUps("r_dead");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("inactive_roster");
  });

  it("plafonne les advancements si le pool s'epuise (no_skill_available)", async () => {
    // Lot 4.D.2 + 4.D.1 — le pool acccessible a un Lineman = primary G +
    // secondary A/S/P. Pour epuiser, il faut connaitre tous ces skills.
    // M (Mutation) est `unavailable` pour Lineman donc pas utile a remplir.
    // Avec 1/6 doubles probability (4.D.1), certaines rosterIds tomberont
    // sur skill (pool epuise = skip), d'autres sur stat (advancement OK).
    // On cherche la premiere rosterId qui produit le skip
    // 'no_skill_available' sur 30 ids.
    const eligible = [
      ...getEligiblePoolFor("Lineman", "primary"),
      ...getEligiblePoolFor("Lineman", "secondary"),
    ];
    let foundSkip = false;
    for (let i = 0; i < 30 && !foundSkip; i += 1) {
      vi.clearAllMocks();
      mocked.proTeamRoster.update.mockResolvedValue({});
      mocked.proTeamRoster.findUnique.mockResolvedValue({
        id: `r_full_${i}`,
        spp: 6,
        level: 1,
        skills: eligible,
        status: "active",
        position: "Lineman",
        maBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
        stBonus: 0,
      });
      const out = await applyLevelUps(`r_full_${i}`);
      if (out.skipped && out.skipReason === "no_skill_available") {
        foundSkip = true;
      }
    }
    expect(foundSkip).toBe(true);
  });
});

describe("rollStatVsSkill — Lot 4.D.1", () => {
  it("retourne true ~1/6 du temps sur un large echantillon", () => {
    let trues = 0;
    const N = 6000;
    for (let i = 0; i < N; i += 1) {
      if (rollStatVsSkill(i)) trues += 1;
    }
    // 1/6 = 16.67% ; tolerance ±3pp sur 6000 echantillons.
    const ratio = trues / N;
    expect(ratio).toBeGreaterThan(0.13);
    expect(ratio).toBeLessThan(0.2);
  });

  it("deterministe pour un seed donne", () => {
    expect(rollStatVsSkill(42)).toBe(rollStatVsSkill(42));
  });
});

describe("pickStatIncrease — Lot 4.D.1", () => {
  it("retourne toujours une stat valide (ma/ag/pa/av/st)", () => {
    for (let i = 0; i < 100; i += 1) {
      const stat = pickStatIncrease(i);
      expect(["ma", "ag", "pa", "av", "st"]).toContain(stat);
    }
  });

  it("ST est rare (<25% sur 1000 picks)", () => {
    let stCount = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (pickStatIncrease(i) === "st") stCount += 1;
    }
    // ST poids 2 / total 20 = 10% — tolerance generique.
    expect(stCount).toBeLessThan(250);
  });

  it("MA et PA majoritaires (combine > 40% sur 1000 picks)", () => {
    let maPaCount = 0;
    for (let i = 0; i < 1000; i += 1) {
      const s = pickStatIncrease(i);
      if (s === "ma" || s === "pa") maPaCount += 1;
    }
    // ma + pa = 5+5 / total 20 = 50% target.
    expect(maPaCount).toBeGreaterThan(400);
  });

  it("deterministe pour un seed donne", () => {
    expect(pickStatIncrease(42)).toBe(pickStatIncrease(42));
  });
});

describe("applyLevelUps stat increases (Lot 4.D.1) — wire integration", () => {
  it("incremente le bon stat counter via Prisma `increment`", async () => {
    // Cherche un rosterId qui produit un stat increase au lvl 2.
    // Plus elegant : tester la presence de la cle increment dans le
    // UPDATE quel que soit le stat.
    mocked.proTeamRoster.findUnique.mockResolvedValue({
      id: "r_stat_test",
      spp: 6,
      level: 1,
      skills: [],
      status: "active",
      position: "Lineman",
      maBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      stBonus: 0,
    });
    await applyLevelUps("r_stat_test");
    // Le UPDATE doit toujours appeler increment sur les 5 compteurs
    // (la valeur peut etre 0 si le tirage a donne un skill, ou >=1
    // si stat).
    expect(mocked.proTeamRoster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maBonus: { increment: expect.any(Number) },
          agBonus: { increment: expect.any(Number) },
          paBonus: { increment: expect.any(Number) },
          avBonus: { increment: expect.any(Number) },
          stBonus: { increment: expect.any(Number) },
        }),
      }),
    );
  });

  it("sur 50 rosters fictifs, observe au moins 3 stat advancements (proba >= 1/10)", async () => {
    // Sample 50 rosterIds different pour echantillonner la proba 1/6
    // des doubles. On attend au moins ~6-9 stat increases mais on
    // baisse a 3 pour etre robuste a la variance.
    let statCount = 0;
    let skillCount = 0;
    for (let i = 0; i < 50; i += 1) {
      vi.clearAllMocks();
      mocked.proTeamRoster.update.mockResolvedValue({});
      mocked.proTeamRoster.findUnique.mockResolvedValue({
        id: `roster_${i}`,
        spp: 6,
        level: 1,
        skills: [],
        status: "active",
        position: "Lineman",
        maBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
        stBonus: 0,
      });
      const out = await applyLevelUps(`roster_${i}`);
      const adv = out.advancements[0];
      if (adv?.kind === "stat") statCount += 1;
      else if (adv?.kind === "skill") skillCount += 1;
    }
    expect(statCount).toBeGreaterThanOrEqual(3);
    expect(skillCount).toBeGreaterThan(statCount); // skills doivent dominer
  });
});

describe("pickAdvancementFor — Lot 4.D.2", () => {
  it("Lineman + skills vides -> pick valide (primary OU secondary)", () => {
    const out = pickAdvancementFor("Lineman", [], 42);
    expect(out).not.toBeNull();
    if (out) {
      expect(["primary", "secondary"]).toContain(out.source);
      expect(skillSourceForPlayer("Lineman", out.slug)).toBe(out.source);
    }
  });

  it("filtre les skills deja connus", () => {
    // Pas de seed magique : on test sur 200 seeds qu'aucun ne pioche
    // un skill deja connu.
    const known = ["block", "tackle"];
    for (let s = 0; s < 200; s += 1) {
      const out = pickAdvancementFor("Lineman", known, s);
      if (out) {
        expect(known).not.toContain(out.slug);
      }
    }
  });

  it("retourne null quand tous les pools accessibles sont epuises", () => {
    const all = [
      ...getEligiblePoolFor("Lineman", "primary"),
      ...getEligiblePoolFor("Lineman", "secondary"),
    ];
    expect(pickAdvancementFor("Lineman", all, 42)).toBeNull();
  });

  it("biais vers primary : sur 200 picks, ~75% sont primary", () => {
    let primaryCount = 0;
    let secondaryCount = 0;
    for (let s = 0; s < 200; s += 1) {
      const out = pickAdvancementFor("Lineman", [], s);
      if (out?.source === "primary") primaryCount += 1;
      else if (out?.source === "secondary") secondaryCount += 1;
    }
    // Target = 75/25 avec tolerance large pour 200 echantillons.
    const ratio = primaryCount / (primaryCount + secondaryCount);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.9);
    expect(SECONDARY_PICK_PROBABILITY).toBe(0.25);
  });

  it("Big Guy ne pioche pas de skills A (unavailable)", () => {
    for (let s = 0; s < 100; s += 1) {
      const out = pickAdvancementFor("Big Guy", [], s);
      if (out) {
        // Big Guy : primary S, secondary G, A/P/M unavailable.
        expect(skillSourceForPlayer("Big Guy", out.slug)).not.toBe(
          "unavailable",
        );
      }
    }
  });

  it("primary epuise -> fallback sur secondary", () => {
    // Lineman primary = G ; on connait tout G. Le picker doit pioche
    // dans secondary (A/S/P).
    const knownPrimary = getEligiblePoolFor("Lineman", "primary");
    const out = pickAdvancementFor("Lineman", knownPrimary, 42);
    expect(out).not.toBeNull();
    if (out) {
      expect(out.source).toBe("secondary");
    }
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
        position: "Lineman",
      })
      .mockResolvedValueOnce(null); // 2eme = ROSTER_NOT_FOUND
    const out = await sweepLevelUps();
    expect(out.inspected).toBe(2);
    expect(out.processed).toBe(1);
    expect(out.failed).toBe(1);
  });
});
