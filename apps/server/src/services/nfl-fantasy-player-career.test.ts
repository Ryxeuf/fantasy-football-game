import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyPlayerCareer: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  accumulateCareerSpp,
  buildAccumulateUpsert,
  getCareerForPlayer,
  listCareersForEntry,
  mapCareerRow,
} from "./nfl-fantasy-player-career";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildAccumulateUpsert", () => {
  it("genere un upsert prisma avec create + update increment", () => {
    const fakeUpsert = vi.fn().mockReturnValue("UPSERT_OP");
    const fakeClient = {
      nflFantasyPlayerCareer: { upsert: fakeUpsert },
    } as never;

    const out = buildAccumulateUpsert(fakeClient, {
      entryId: "e1",
      playerId: "p1",
      sppDelta: 5,
    });

    expect(out).toBe("UPSERT_OP");
    const arg = fakeUpsert.mock.calls[0]![0];
    expect(arg.where).toEqual({
      entryId_playerId: { entryId: "e1", playerId: "p1" },
    });
    expect(arg.create).toMatchObject({
      entryId: "e1",
      playerId: "p1",
      sppCareer: 5,
      sppSpent: 0,
      skillsUnlocked: [],
      statsBonus: {},
    });
    expect(arg.update).toEqual({ sppCareer: { increment: 5 } });
  });
});

describe("accumulateCareerSpp", () => {
  it("skip si sppDelta === 0 (pas de call DB)", async () => {
    await accumulateCareerSpp({ entryId: "e1", playerId: "p1", sppDelta: 0 });
    expect(prisma.nflFantasyPlayerCareer.upsert).not.toHaveBeenCalled();
  });

  it("appelle upsert si sppDelta != 0", async () => {
    vi.mocked(prisma.nflFantasyPlayerCareer.upsert).mockResolvedValue({} as never);
    await accumulateCareerSpp({ entryId: "e1", playerId: "p1", sppDelta: 7 });
    expect(prisma.nflFantasyPlayerCareer.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("mapCareerRow", () => {
  it("derive sppAvailable = sppCareer - sppSpent", () => {
    const out = mapCareerRow({
      id: "c1",
      entryId: "e1",
      playerId: "p1",
      sppCareer: 20,
      sppSpent: 8,
      skillsUnlocked: ["block", "dodge"],
    });
    expect(out.sppAvailable).toBe(12);
    expect(out.skillsUnlocked).toEqual(["block", "dodge"]);
  });

  it("skillsUnlocked string sqlite parse OK", () => {
    const out = mapCareerRow({
      id: "c1",
      entryId: "e1",
      playerId: "p1",
      sppCareer: 5,
      sppSpent: 0,
      skillsUnlocked: JSON.stringify(["block"]),
    });
    expect(out.skillsUnlocked).toEqual(["block"]);
  });

  it("skillsUnlocked null / invalid -> []", () => {
    const a = mapCareerRow({
      id: "c1",
      entryId: "e1",
      playerId: "p1",
      sppCareer: 0,
      sppSpent: 0,
      skillsUnlocked: null,
    });
    expect(a.skillsUnlocked).toEqual([]);

    const b = mapCareerRow({
      id: "c2",
      entryId: "e1",
      playerId: "p2",
      sppCareer: 0,
      sppSpent: 0,
      skillsUnlocked: "not json",
    });
    expect(b.skillsUnlocked).toEqual([]);
  });
});

describe("listCareersForEntry", () => {
  it("mappe les rows DB en CareerRow", async () => {
    vi.mocked(prisma.nflFantasyPlayerCareer.findMany).mockResolvedValue([
      {
        id: "c1",
        entryId: "e1",
        playerId: "p1",
        sppCareer: 10,
        sppSpent: 3,
        skillsUnlocked: [],
      },
      {
        id: "c2",
        entryId: "e1",
        playerId: "p2",
        sppCareer: 5,
        sppSpent: 0,
        skillsUnlocked: ["pass"],
      },
    ] as never);
    const out = await listCareersForEntry("e1");
    expect(out).toHaveLength(2);
    expect(out[0]!.sppAvailable).toBe(7);
    expect(out[1]!.skillsUnlocked).toEqual(["pass"]);
  });
});

describe("getCareerForPlayer", () => {
  it("retourne null si non trouvee", async () => {
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue(null);
    const out = await getCareerForPlayer({ entryId: "e1", playerId: "p1" });
    expect(out).toBeNull();
  });

  it("mappe la row si trouvee", async () => {
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue({
      id: "c1",
      entryId: "e1",
      playerId: "p1",
      sppCareer: 12,
      sppSpent: 0,
      skillsUnlocked: ["dodge"],
    } as never);
    const out = await getCareerForPlayer({ entryId: "e1", playerId: "p1" });
    expect(out?.sppAvailable).toBe(12);
    expect(out?.skillsUnlocked).toEqual(["dodge"]);
  });
});
