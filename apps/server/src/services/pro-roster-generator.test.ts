import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn(), findMany: vi.fn() },
    proTeamRoster: { count: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  generateRookieData,
  replenishTeamRoster,
  seedTeamRoster,
  sweepRookieReplenish,
} from "./pro-roster-generator";

interface MockedPrisma {
  proTeam: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proTeamRoster: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proTeamRoster.create.mockResolvedValue({});
});

describe("generateRookieData — sprint 1.E.6", () => {
  it("retourne stats baseline pour Orc", () => {
    const rng = () => 0.1;
    const { name, stats } = generateRookieData("Orc", rng);
    expect(stats.ma).toBe(5);
    expect(stats.st).toBe(3);
    expect(stats.ag).toBe(3);
    expect(stats.av).toBe(10);
    expect(stats.position).toBe("Lineman");
    expect(stats.skills).toContain("block");
    expect(name.length).toBeGreaterThan(0);
    expect(name).toContain(" ");
  });

  it("retourne stats baseline pour Ogre (pa=null)", () => {
    const rng = () => 0.2;
    const { stats } = generateRookieData("Ogre", rng);
    expect(stats.st).toBe(5);
    expect(stats.pa).toBeNull();
    expect(stats.position).toBe("Big Guy");
    expect(stats.skills).toContain("mighty_blow");
  });

  it("fallback sur stats par défaut si race inconnue", () => {
    const rng = () => 0.5;
    const { name, stats } = generateRookieData("Unknown Race", rng);
    expect(stats.ma).toBe(6);
    expect(stats.st).toBe(3);
    expect(stats.position).toBe("Lineman");
    expect(name).toBe("Player Rookie");
  });

  it("est déterministe pour un RNG fixe", () => {
    let i = 0;
    const seq = [0.1, 0.4, 0.7, 0.2];
    const rng = () => seq[i++ % seq.length];
    const a = generateRookieData("Wood Elf", rng);
    i = 0;
    const b = generateRookieData("Wood Elf", rng);
    expect(a.name).toBe(b.name);
  });
});

describe("seedTeamRoster — sprint 1.E.6", () => {
  it("throw si team introuvable", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(seedTeamRoster("missing")).rejects.toThrow(/introuvable/);
  });

  it("idempotent : skip si roster déjà présent", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Orc",
      slug: "orks",
    });
    mocked.proTeamRoster.count.mockResolvedValue(12);
    const out = await seedTeamRoster("t1");
    expect(out.created).toBe(0);
    expect(out.skipped).toBe(12);
    expect(out.skipReason).toBe("roster_already_seeded");
    expect(mocked.proTeamRoster.create).not.toHaveBeenCalled();
  });

  it("crée `count` rookies si roster vide", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Orc",
      slug: "orks",
    });
    mocked.proTeamRoster.count.mockResolvedValue(0);
    const out = await seedTeamRoster("t1", 5);
    expect(out.created).toBe(5);
    expect(out.skipped).toBe(0);
    expect(mocked.proTeamRoster.create).toHaveBeenCalledTimes(5);
    const firstCall = mocked.proTeamRoster.create.mock.calls[0][0];
    expect(firstCall.data.teamId).toBe("t1");
    expect(firstCall.data.status).toBe("active");
    expect(firstCall.data.position).toBe("Lineman");
    expect(firstCall.data.ma).toBe(5);
  });

  it("default count = 12 si non spécifié", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Halfling",
      slug: "halfs",
    });
    mocked.proTeamRoster.count.mockResolvedValue(0);
    const out = await seedTeamRoster("t1");
    expect(out.created).toBe(12);
  });
});

describe("replenishTeamRoster — sprint 1.E.6", () => {
  it("throw si team introuvable", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(replenishTeamRoster("missing")).rejects.toThrow(/introuvable/);
  });

  it("no-op si actifs >= target", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Orc",
      slug: "orks",
    });
    mocked.proTeamRoster.count.mockResolvedValue(12);
    const out = await replenishTeamRoster("t1", 12);
    expect(out.created).toBe(0);
    expect(out.activeBefore).toBe(12);
    expect(mocked.proTeamRoster.create).not.toHaveBeenCalled();
  });

  it("crée le manquant pour atteindre target", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Dwarf",
      slug: "dorfs",
    });
    mocked.proTeamRoster.count.mockResolvedValue(8);
    const out = await replenishTeamRoster("t1", 12);
    expect(out.created).toBe(4);
    expect(out.activeBefore).toBe(8);
    expect(out.targetSize).toBe(12);
    expect(mocked.proTeamRoster.create).toHaveBeenCalledTimes(4);
  });

  it("default target=12", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "t1",
      race: "Skaven",
      slug: "rats",
    });
    mocked.proTeamRoster.count.mockResolvedValue(10);
    const out = await replenishTeamRoster("t1");
    expect(out.targetSize).toBe(12);
    expect(out.created).toBe(2);
  });
});

describe("sweepRookieReplenish — sprint 1.E.6", () => {
  it("0/0/0 si aucune équipe", async () => {
    mocked.proTeam.findMany.mockResolvedValue([]);
    expect(await sweepRookieReplenish()).toEqual({
      inspected: 0,
      replenished: 0,
      failed: 0,
    });
  });

  it("agrège replenished + failed", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "t1" },
      { id: "t2" },
      { id: "t3" },
    ]);
    mocked.proTeam.findUnique
      .mockResolvedValueOnce({ id: "t1", race: "Orc", slug: "o1" })
      .mockResolvedValueOnce(null) // t2 → throw → failed
      .mockResolvedValueOnce({ id: "t3", race: "Orc", slug: "o3" });
    mocked.proTeamRoster.count
      .mockResolvedValueOnce(8) // t1 manque 4 → replenished
      .mockResolvedValueOnce(12); // t3 plein → no-op

    const out = await sweepRookieReplenish(12);
    expect(out.inspected).toBe(3);
    expect(out.replenished).toBe(1);
    expect(out.failed).toBe(1);
  });
});
