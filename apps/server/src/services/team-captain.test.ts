/**
 * Règle spéciale "Capitaine" — tests unitaires du service de désignation.
 *
 * Mocks : prisma (team/teamPlayer/$transaction), roster-helpers
 * (règles spéciales + positions de base), team-lock-status (frozen).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CaptainError,
  canFirePlayer,
  designateCaptain,
  getCaptainStatus,
  isBigGuyPlayer,
  parseSkillsCsv,
} from "./team-captain";
import { prisma } from "../prisma";
import { getRosterFromDb } from "../utils/roster-helpers";
import { isTeamRosterFrozen } from "./team-lock-status";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    teamPlayer: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

vi.mock("./team-lock-status", () => ({
  isTeamRosterFrozen: vi.fn(),
}));

const mockTeamFindFirst = vi.mocked(prisma.team.findFirst);
const mockPlayerFindMany = vi.mocked(prisma.teamPlayer.findMany);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockGetRoster = vi.mocked(getRosterFromDb);
const mockFrozen = vi.mocked(isTeamRosterFrozen);

const HUMAN_ROSTER = {
  name: "Humains",
  budget: 1000,
  tier: "II",
  naf: false,
  positions: [
    {
      slug: "human_lineman",
      displayName: "Trois-quarts",
      cost: 50,
      min: 0,
      max: 16,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
      keywords: null,
      keywordsEn: null,
      primarySkills: "G",
      secondarySkills: "A,S",
    },
    {
      slug: "human_blitzer",
      displayName: "Blitzer",
      cost: 90,
      min: 0,
      max: 4,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      keywords: null,
      keywordsEn: null,
      primarySkills: "G,S",
      secondarySkills: "A,P",
    },
    {
      slug: "human_ogre",
      displayName: "Ogre",
      cost: 140,
      min: 0,
      max: 1,
      ma: 5,
      st: 5,
      ag: 4,
      pa: 5,
      av: 10,
      skills: "bone-head,loner-4,mighty-blow-1,thick-skull,throw-team-mate",
      keywords: null,
      keywordsEn: null,
      primarySkills: "S",
      secondarySkills: "A,G",
    },
  ],
  specialRules: [
    { slug: "capitaine", name: "Capitaine", description: "…" },
  ],
};

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Joueur 1",
    number: 1,
    position: "human_lineman",
    skills: "",
    dead: false,
    firedAt: null,
    isCaptain: false,
    maReduction: 0,
    stReduction: 0,
    agReduction: 0,
    paReduction: 0,
    avReduction: 0,
    advancements: "[]",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockTeamFindFirst.mockResolvedValue({
    id: "team1",
    roster: "human",
    ruleset: "season_3",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetRoster.mockResolvedValue(HUMAN_ROSTER as any);
  mockFrozen.mockResolvedValue(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockTransaction.mockResolvedValue([] as any);
});

describe("helpers purs", () => {
  it("parseSkillsCsv tolère vide/espaces", () => {
    expect(parseSkillsCsv("")).toEqual([]);
    expect(parseSkillsCsv(null)).toEqual([]);
    expect(parseSkillsCsv("block, dodge ,")).toEqual(["block", "dodge"]);
  });

  it("isBigGuyPlayer détecte Solitaire (loner-X et loner_X)", () => {
    expect(isBigGuyPlayer("bone-head,loner-4,mighty-blow-1")).toBe(true);
    expect(isBigGuyPlayer("loner_4")).toBe(true);
    expect(isBigGuyPlayer("block,dodge")).toBe(false);
  });

  it("canFirePlayer : capitaine licenciable seulement si carac réduite", () => {
    const base = makePlayer({ isCaptain: true });
    expect(canFirePlayer(base)).toBe(false);
    expect(canFirePlayer({ ...base, stReduction: 1 })).toBe(true);
    expect(canFirePlayer({ ...base, avReduction: 1 })).toBe(true);
    expect(canFirePlayer(makePlayer())).toBe(true); // non-capitaine
  });
});

describe("getCaptainStatus", () => {
  it("roster sans la règle → hasCaptainRule=false", async () => {
    mockGetRoster.mockResolvedValue({
      ...HUMAN_ROSTER,
      specialRules: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPlayerFindMany.mockResolvedValue([]);
    const status = await getCaptainStatus("team1", "user1");
    expect(status.hasCaptainRule).toBe(false);
    expect(status.canDesignate).toBe(false);
  });

  it("règle présente, pas de capitaine → désignation possible, Gros Bras exclu", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer(),
      makePlayer({ id: "p2", number: 2 }),
      makePlayer({
        id: "ogre",
        number: 3,
        position: "human_ogre",
        skills: "bone-head,loner-4,mighty-blow-1",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const status = await getCaptainStatus("team1", "user1");
    expect(status.hasCaptainRule).toBe(true);
    expect(status.captain).toBeNull();
    expect(status.canDesignate).toBe(true);
    expect(status.eligiblePlayers.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("capitaine mort → lostCaptain + désignation possible même équipe engagée", async () => {
    mockFrozen.mockResolvedValue(true);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, dead: true }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const status = await getCaptainStatus("team1", "user1");
    expect(status.captain).toBeNull();
    expect(status.lostCaptain?.id).toBe("cap");
    expect(status.lostCaptain?.dead).toBe(true);
    expect(status.canDesignate).toBe(true);
    expect(status.eligiblePlayers.map((p) => p.id)).toEqual(["p2"]);
  });

  it("capitaine licencié → lostCaptain.fired=true", async () => {
    mockFrozen.mockResolvedValue(true);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, firedAt: new Date() }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const status = await getCaptainStatus("team1", "user1");
    expect(status.lostCaptain?.fired).toBe(true);
    expect(status.canDesignate).toBe(true);
  });

  it("capitaine actif + équipe engagée → pas de re-désignation", async () => {
    mockFrozen.mockResolvedValue(true);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, skills: "pro" }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const status = await getCaptainStatus("team1", "user1");
    expect(status.captain?.id).toBe("cap");
    expect(status.canDesignate).toBe(false);
    expect(status.eligiblePlayers).toEqual([]);
  });

  it("équipe introuvable → CaptainError team_not_found", async () => {
    mockTeamFindFirst.mockResolvedValue(null);
    await expect(getCaptainStatus("nope", "user1")).rejects.toMatchObject({
      code: "team_not_found",
    });
  });
});

describe("designateCaptain", () => {
  it("désigne le capitaine et ajoute Pro sans advancement", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "p1", skills: "block" }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await designateCaptain("team1", "user1", "p1");
    expect(result.proGranted).toBe(true);
    expect(result.captain.skills).toBe("block,pro");
    // La transaction pose le flag + les skills, sans toucher advancements.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const ops = mockTransaction.mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    expect(vi.mocked(prisma.teamPlayer.update)).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isCaptain: true, skills: "block,pro" },
    });
    expect(vi.mocked(prisma.teamPlayer.updateMany)).toHaveBeenCalledWith({
      where: { teamId: "team1", isCaptain: true, id: { not: "p1" } },
      data: { isCaptain: false },
    });
  });

  it("ne duplique pas Pro si le joueur l'a déjà", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "p1", skills: "pass,pro" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await designateCaptain("team1", "user1", "p1");
    expect(result.proGranted).toBe(false);
    expect(result.captain.skills).toBe("pass,pro");
  });

  it("refuse un Gros Bras", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({
        id: "ogre",
        position: "human_ogre",
        skills: "bone-head,loner-4",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    await expect(
      designateCaptain("team1", "user1", "ogre"),
    ).rejects.toMatchObject({ code: "player_big_guy" });
  });

  it("refuse un joueur mort ou licencié", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "dead1", dead: true }),
      makePlayer({ id: "fired1", firedAt: new Date() }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    await expect(
      designateCaptain("team1", "user1", "dead1"),
    ).rejects.toMatchObject({ code: "player_inactive" });
    await expect(
      designateCaptain("team1", "user1", "fired1"),
    ).rejects.toMatchObject({ code: "player_inactive" });
  });

  it("refuse si roster sans la règle", async () => {
    mockGetRoster.mockResolvedValue({
      ...HUMAN_ROSTER,
      specialRules: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    await expect(
      designateCaptain("team1", "user1", "p1"),
    ).rejects.toMatchObject({ code: "no_captain_rule" });
  });

  it("équipe engagée avec capitaine actif → captain_already_active", async () => {
    mockFrozen.mockResolvedValue(true);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, skills: "pro" }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    await expect(
      designateCaptain("team1", "user1", "p2"),
    ).rejects.toMatchObject({ code: "captain_already_active" });
  });

  it("équipe engagée, capitaine MORT → successeur autorisé", async () => {
    mockFrozen.mockResolvedValue(true);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, dead: true, skills: "pro" }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await designateCaptain("team1", "user1", "p2");
    expect(result.proGranted).toBe(true);
    // Le flag du mort est nettoyé par l'updateMany d'unicité.
    expect(vi.mocked(prisma.teamPlayer.updateMany)).toHaveBeenCalledWith({
      where: { teamId: "team1", isCaptain: true, id: { not: "p2" } },
      data: { isCaptain: false },
    });
  });

  it("brouillon : changer de capitaine retire Pro (issue de la désignation) à l'ancien", async () => {
    mockFrozen.mockResolvedValue(false);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, skills: "pro" }),
      makePlayer({ id: "p2", number: 2, position: "human_blitzer", skills: "block" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await designateCaptain("team1", "user1", "p2");
    expect(result.captain.skills).toBe("block,pro");
    expect(vi.mocked(prisma.teamPlayer.update)).toHaveBeenCalledWith({
      where: { id: "cap" },
      data: { skills: "" },
    });
  });

  it("brouillon : l'ancien capitaine garde Pro si achetée en advancement", async () => {
    mockFrozen.mockResolvedValue(false);
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({
        id: "cap",
        isCaptain: true,
        skills: "pro",
        advancements: JSON.stringify([
          { skillSlug: "pro", type: "primary", isRandom: false, at: 1 },
        ]),
      }),
      makePlayer({ id: "p2", number: 2 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    await designateCaptain("team1", "user1", "p2");
    // Pas de retrait de skills sur l'ancien capitaine.
    expect(vi.mocked(prisma.teamPlayer.update)).not.toHaveBeenCalledWith({
      where: { id: "cap" },
      data: { skills: "" },
    });
  });

  it("idempotent : re-désigner le capitaine actuel ne change rien", async () => {
    mockPlayerFindMany.mockResolvedValue([
      makePlayer({ id: "cap", isCaptain: true, skills: "pro" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await designateCaptain("team1", "user1", "cap");
    expect(result.proGranted).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("erreur typée CaptainError avec instanceof", async () => {
    mockTeamFindFirst.mockResolvedValue(null);
    try {
      await designateCaptain("team1", "user1", "p1");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CaptainError);
      expect((e as CaptainError).code).toBe("team_not_found");
    }
  });
});
