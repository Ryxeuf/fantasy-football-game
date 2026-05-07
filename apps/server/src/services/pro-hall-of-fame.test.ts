import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), findMany: vi.fn() },
    proHallOfFame: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  inductPlayer,
  listHallOfFame,
  sweepDeathInductions,
} from "./pro-hall-of-fame";

interface MockedPrisma {
  proTeamRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proHallOfFame: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}
const mocked = prisma as unknown as MockedPrisma;

const FULL_ROSTER_FIXTURE = {
  id: "r1",
  name: "Grimgut Ironjaw",
  position: "Lineman",
  ma: 5,
  st: 3,
  ag: 3,
  pa: 4,
  av: 10,
  skills: ["block"],
  careerStats: { td: 12, casualtiesInflicted: 4 },
  team: { slug: "pit-smashers", name: "Pittsburgh Smashers", race: "Orc" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proHallOfFame.create.mockResolvedValue({ id: "hof1" });
});

describe("inductPlayer — sprint 1.E.5", () => {
  it("skip si roster introuvable", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(null);
    const out = await inductPlayer("missing", "death_in_match");
    expect(out.inducted).toBe(false);
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("roster_not_found");
    expect(mocked.proHallOfFame.create).not.toHaveBeenCalled();
  });

  it("skip idempotent si deja inducte (rosterId, reason)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(FULL_ROSTER_FIXTURE);
    mocked.proHallOfFame.findUnique.mockResolvedValue({ id: "existing" });
    const out = await inductPlayer("r1", "death_in_match");
    expect(out.inducted).toBe(false);
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("already_inducted");
    expect(out.hofId).toBe("existing");
    expect(mocked.proHallOfFame.create).not.toHaveBeenCalled();
  });

  it("induit le joueur en figeant le snapshot", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(FULL_ROSTER_FIXTURE);
    mocked.proHallOfFame.findUnique.mockResolvedValue(null);
    const out = await inductPlayer("r1", "death_in_match", "RIP");
    expect(out.inducted).toBe(true);
    expect(out.skipped).toBe(false);
    expect(out.hofId).toBe("hof1");
    const data = mocked.proHallOfFame.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      rosterId: "r1",
      teamSlug: "pit-smashers",
      teamName: "Pittsburgh Smashers",
      playerName: "Grimgut Ironjaw",
      race: "Orc",
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 10,
      reason: "death_in_match",
      citation: "RIP",
    });
  });

  it("induit avec citation undefined (no-op param)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValue(FULL_ROSTER_FIXTURE);
    mocked.proHallOfFame.findUnique.mockResolvedValue(null);
    const out = await inductPlayer("r1", "career_tds");
    expect(out.inducted).toBe(true);
    const data = mocked.proHallOfFame.create.mock.calls[0][0].data;
    expect(data.reason).toBe("career_tds");
    expect(data.citation).toBeUndefined();
  });
});

describe("sweepDeathInductions — sprint 1.E.5", () => {
  it("0/0/0 si aucun mort", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    expect(await sweepDeathInductions()).toEqual({
      inspected: 0,
      inducted: 0,
      failed: 0,
    });
  });

  it("induit chaque mort + isole les erreurs", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([
      { id: "r1" },
      { id: "r2" },
      { id: "r3" },
    ]);
    mocked.proTeamRoster.findUnique
      .mockResolvedValueOnce(FULL_ROSTER_FIXTURE)
      .mockResolvedValueOnce(null) // r2 -> roster_not_found -> skipped (ne compte pas comme failed)
      .mockResolvedValueOnce({
        ...FULL_ROSTER_FIXTURE,
        id: "r3",
        name: "Mox Bonecruncher",
      });
    mocked.proHallOfFame.findUnique.mockResolvedValue(null);
    const out = await sweepDeathInductions();
    expect(out.inspected).toBe(3);
    expect(out.inducted).toBe(2);
    expect(out.failed).toBe(0);
  });

  it("compte les exceptions comme failed", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([{ id: "r1" }]);
    mocked.proTeamRoster.findUnique.mockRejectedValue(new Error("DB blew up"));
    const out = await sweepDeathInductions();
    expect(out.failed).toBe(1);
    expect(out.inducted).toBe(0);
  });

  it("ne re-induit pas un joueur deja inducte", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([{ id: "r1" }]);
    mocked.proTeamRoster.findUnique.mockResolvedValue(FULL_ROSTER_FIXTURE);
    mocked.proHallOfFame.findUnique.mockResolvedValue({ id: "old" });
    const out = await sweepDeathInductions();
    expect(out.inducted).toBe(0);
    expect(out.failed).toBe(0);
    expect(mocked.proHallOfFame.create).not.toHaveBeenCalled();
  });
});

describe("listHallOfFame — sprint 1.E.5", () => {
  it("renvoie [] si aucune entree", async () => {
    mocked.proHallOfFame.findMany.mockResolvedValue([]);
    expect(await listHallOfFame()).toEqual([]);
  });

  it("clamp limit (max 200, min 1)", async () => {
    mocked.proHallOfFame.findMany.mockResolvedValue([]);
    await listHallOfFame({ limit: 1_000_000 });
    expect(mocked.proHallOfFame.findMany.mock.calls[0][0].take).toBe(200);
    await listHallOfFame({ limit: 0 });
    expect(mocked.proHallOfFame.findMany.mock.calls[1][0].take).toBe(1);
  });

  it("filtre par teamSlug si fourni", async () => {
    mocked.proHallOfFame.findMany.mockResolvedValue([]);
    await listHallOfFame({ teamSlug: "pit-smashers" });
    expect(mocked.proHallOfFame.findMany.mock.calls[0][0].where).toEqual({
      teamSlug: "pit-smashers",
    });
  });

  it("renvoie {} where si pas de filtre", async () => {
    mocked.proHallOfFame.findMany.mockResolvedValue([]);
    await listHallOfFame();
    expect(mocked.proHallOfFame.findMany.mock.calls[0][0].where).toEqual({});
  });

  it("transforme les rows en HallOfFameEntry", async () => {
    const inductedAt = new Date("2026-05-07T00:00:00Z");
    mocked.proHallOfFame.findMany.mockResolvedValue([
      {
        id: "hof1",
        playerName: "Grimgut",
        teamSlug: "pit",
        teamName: "Pit",
        race: "Orc",
        position: "Lineman",
        reason: "death_in_match",
        citation: "Tombe",
        inductedAt,
      },
    ]);
    const out = await listHallOfFame({ limit: 50 });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: "hof1",
      playerName: "Grimgut",
      teamSlug: "pit",
      teamName: "Pit",
      race: "Orc",
      position: "Lineman",
      reason: "death_in_match",
      citation: "Tombe",
      inductedAt,
    });
  });
});
