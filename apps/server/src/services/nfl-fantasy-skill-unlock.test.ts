import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyPlayerCareer: { findUnique: vi.fn(), update: vi.fn() },
    nflPlayer: { findUnique: vi.fn() },
    position: { findFirst: vi.fn() },
    skill: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  getSkillAccessView,
  listAvailableSkillsForCareer,
  SkillUnlockError,
  unlockSkill,
} from "./nfl-fantasy-skill-unlock";

function mockCareer(
  override: Partial<{
    sppCareer: number;
    sppSpent: number;
    skillsUnlocked: unknown;
  }> = {},
) {
  vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue({
    sppCareer: 30,
    sppSpent: 0,
    skillsUnlocked: [],
    ...override,
  } as never);
}

function mockPlayer(
  override: Partial<{
    bbPosition: string;
    bbSkills: unknown;
    teamCode: string;
    team: { bbRace: string };
  }> = {},
) {
  vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
    bbPosition: "Thrower",
    bbSkills: ["pass"],
    teamCode: "KC",
    team: { bbRace: "Skaven" },
    ...override,
  } as never);
}

function mockPosition(
  override: Partial<{ primarySkills: string | null; secondarySkills: string | null }> = {},
) {
  vi.mocked(prisma.position.findFirst).mockResolvedValue({
    primarySkills: "G,P",
    secondarySkills: "A,S",
    ...override,
  } as never);
}

function mockSkill(category: string | null) {
  vi.mocked(prisma.skill.findFirst).mockResolvedValue(
    category ? ({ category } as never) : (null as never),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("unlockSkill", () => {
  it("happy path : achat primary 6 SPP", async () => {
    mockCareer({ sppCareer: 20, sppSpent: 0 });
    mockPlayer();
    mockPosition({ primarySkills: "G,P", secondarySkills: "A,S" });
    mockSkill("General");
    vi.mocked(prisma.nflFantasyPlayerCareer.update).mockResolvedValue({
      sppCareer: 20,
      sppSpent: 6,
      skillsUnlocked: ["block"],
    } as never);

    const out = await unlockSkill({
      entryId: "e1",
      playerId: "p1",
      skillSlug: "block",
      accessType: "primary",
    });
    expect(out.cost).toBe(6);
    expect(out.sppAvailable).toBe(14);
    expect(out.skillsUnlocked).toEqual(["block"]);
  });

  it("happy path : achat secondary 12 SPP", async () => {
    mockCareer({ sppCareer: 20, sppSpent: 0 });
    mockPlayer();
    mockPosition({ primarySkills: "G,P", secondarySkills: "A,S" });
    mockSkill("Agility");
    vi.mocked(prisma.nflFantasyPlayerCareer.update).mockResolvedValue({
      sppCareer: 20,
      sppSpent: 12,
      skillsUnlocked: ["dodge"],
    } as never);

    const out = await unlockSkill({
      entryId: "e1",
      playerId: "p1",
      skillSlug: "dodge",
      accessType: "secondary",
    });
    expect(out.cost).toBe(12);
    expect(out.sppAvailable).toBe(8);
  });

  it("CAREER_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue(null);
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "CAREER_NOT_FOUND" });
  });

  it("SKILL_ALREADY_OWNED : déjà unlocked", async () => {
    mockCareer({ skillsUnlocked: ["block"] });
    mockPlayer();
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "SKILL_ALREADY_OWNED" });
  });

  it("SKILL_ALREADY_OWNED : starter skill", async () => {
    mockCareer({ skillsUnlocked: [] });
    mockPlayer({ bbSkills: ["block"] });
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "SKILL_ALREADY_OWNED" });
  });

  it("SKILL_CAP_REACHED : 6 skills unlocked", async () => {
    mockCareer({
      sppCareer: 100,
      sppSpent: 0,
      skillsUnlocked: ["a", "b", "c", "d", "e", "f"],
    });
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "g",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "SKILL_CAP_REACHED" });
  });

  it("POSITION_NOT_MAPPED : race manquante (joueur FA)", async () => {
    mockCareer();
    mockPlayer({ team: undefined as never });
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "POSITION_NOT_MAPPED" });
  });

  it("POSITION_NOT_FOUND : DB sans position S3", async () => {
    mockCareer();
    mockPlayer();
    vi.mocked(prisma.position.findFirst).mockResolvedValue(null);
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "POSITION_NOT_FOUND" });
  });

  it("SKILL_NOT_FOUND : slug inexistant DB", async () => {
    mockCareer();
    mockPlayer();
    mockPosition();
    mockSkill(null);
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "ghost-skill",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "SKILL_NOT_FOUND" });
  });

  it("SKILL_NOT_IN_POOL : catégorie hors pool primary", async () => {
    mockCareer();
    mockPlayer();
    mockPosition({ primarySkills: "G,P", secondarySkills: "A" });
    mockSkill("Agility"); // pas dans primary
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "dodge",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "SKILL_NOT_IN_POOL" });
  });

  it("POSITION_HAS_NO_ACCESS : DB primary/secondary null", async () => {
    mockCareer();
    mockPlayer();
    mockPosition({ primarySkills: null, secondarySkills: null });
    mockSkill("General");
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "POSITION_HAS_NO_ACCESS" });
  });

  it("NOT_ENOUGH_SPP : 5 dispo / 6 requis", async () => {
    mockCareer({ sppCareer: 5, sppSpent: 0 });
    mockPlayer();
    mockPosition({ primarySkills: "G,P", secondarySkills: "A" });
    mockSkill("General");
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toMatchObject({ code: "NOT_ENOUGH_SPP" });
  });

  it("NOT_ENOUGH_SPP secondary : 10 dispo / 12 requis", async () => {
    mockCareer({ sppCareer: 10, sppSpent: 0 });
    mockPlayer();
    mockPosition({ primarySkills: "G,P", secondarySkills: "A" });
    mockSkill("Agility");
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "dodge",
        accessType: "secondary",
      }),
    ).rejects.toMatchObject({ code: "NOT_ENOUGH_SPP" });
  });

  it("idempotent : ne refait pas l'update apres erreur (pas d'effet de bord)", async () => {
    mockCareer({ skillsUnlocked: ["block"] });
    mockPlayer();
    await expect(
      unlockSkill({
        entryId: "e1",
        playerId: "p1",
        skillSlug: "block",
        accessType: "primary",
      }),
    ).rejects.toBeInstanceOf(SkillUnlockError);
    expect(prisma.nflFantasyPlayerCareer.update).not.toHaveBeenCalled();
  });
});

describe("getSkillAccessView", () => {
  it("retourne le pool d'acces de la position", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: ["pass"],
      team: { bbRace: "Skaven" },
    } as never);
    vi.mocked(prisma.position.findFirst).mockResolvedValue({
      primarySkills: "G,P",
      secondarySkills: "A,S",
    } as never);

    const out = await getSkillAccessView("p1");
    expect(out).not.toBeNull();
    expect(out!.positionSlug).toBe("skaven_lanceur_skaven");
    expect(out!.primarySkills).toBe("G,P");
    expect(out!.startingSkills).toEqual(["pass"]);
    expect(out!.costs.primary).toBe(6);
    expect(out!.costs.secondary).toBe(12);
    expect(out!.cap).toBe(6);
  });

  it("null si joueur absent", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue(null);
    expect(await getSkillAccessView("ghost")).toBeNull();
  });

  it("null si race manquante", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: [],
      team: null,
    } as never);
    expect(await getSkillAccessView("p1")).toBeNull();
  });

  it("null si position S3 introuvable", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: [],
      team: { bbRace: "Skaven" },
    } as never);
    vi.mocked(prisma.position.findFirst).mockResolvedValue(null);
    expect(await getSkillAccessView("p1")).toBeNull();
  });
});

describe("listAvailableSkillsForCareer", () => {
  it("groupe les skills DB en primary/secondary selon les codes du pool", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: ["pass"],
      team: { bbRace: "Skaven" },
    } as never);
    vi.mocked(prisma.position.findFirst).mockResolvedValue({
      primarySkills: "G,P",
      secondarySkills: "A",
    } as never);
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue({
      sppCareer: 30,
      sppSpent: 6,
      skillsUnlocked: ["block"],
    } as never);
    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { slug: "block", nameFr: "Bloquer", nameEn: "Block", category: "General" },
      { slug: "tackle", nameFr: "Plaquage", nameEn: "Tackle", category: "General" },
      { slug: "accurate", nameFr: "Tireur de precision", nameEn: "Accurate", category: "Passing" },
      { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge", category: "Agility" },
      { slug: "pass", nameFr: "Passe", nameEn: "Pass", category: "Passing" },
    ] as never);

    const out = await listAvailableSkillsForCareer({
      entryId: "e1",
      playerId: "p1",
    });
    expect(out).not.toBeNull();
    // Exclut block (unlocked) + pass (starter).
    expect(out!.primary.map((s) => s.slug)).toEqual(["tackle", "accurate"]);
    // Secondary = Agility = dodge
    expect(out!.secondary.map((s) => s.slug)).toEqual(["dodge"]);
    expect(out!.sppAvailable).toBe(24);
    expect(out!.remaining).toBe(5); // 6 cap - 1 unlocked
  });

  it("retourne null si combo non mappee", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue(null);
    const out = await listAvailableSkillsForCareer({
      entryId: "e1",
      playerId: "p1",
    });
    expect(out).toBeNull();
  });

  it("career absente : sppAvailable=0 mais liste quand meme le pool", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: [],
      team: { bbRace: "Skaven" },
    } as never);
    vi.mocked(prisma.position.findFirst).mockResolvedValue({
      primarySkills: "G",
      secondarySkills: "",
    } as never);
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { slug: "block", nameFr: "Bloquer", nameEn: "Block", category: "General" },
    ] as never);

    const out = await listAvailableSkillsForCareer({
      entryId: "e1",
      playerId: "p1",
    });
    expect(out?.sppAvailable).toBe(0);
    expect(out?.primary.map((s) => s.slug)).toEqual(["block"]);
    expect(out?.remaining).toBe(6);
  });

  it("pools vides (primary='' secondary='') => listes vides", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({
      bbPosition: "Thrower",
      bbSkills: [],
      team: { bbRace: "Skaven" },
    } as never);
    vi.mocked(prisma.position.findFirst).mockResolvedValue({
      primarySkills: "",
      secondarySkills: "",
    } as never);
    vi.mocked(prisma.nflFantasyPlayerCareer.findUnique).mockResolvedValue({
      sppCareer: 0,
      sppSpent: 0,
      skillsUnlocked: [],
    } as never);

    const out = await listAvailableSkillsForCareer({
      entryId: "e1",
      playerId: "p1",
    });
    expect(out?.primary).toEqual([]);
    expect(out?.secondary).toEqual([]);
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
  });
});
