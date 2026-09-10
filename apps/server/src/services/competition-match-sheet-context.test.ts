import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn() },
    cupPairing: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  CUP_SHEET_RULES,
  LEAGUE_SHEET_RULES,
  resolveCompetitionPairing,
  sheetCreateData,
  sheetRulesFor,
  sheetWhere,
} from "./competition-match-sheet-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("règles par compétition", () => {
  it("une ligue applique toute la séquence d'après-match", () => {
    expect(LEAGUE_SHEET_RULES).toEqual({
      sppEnabled: true,
      injuriesPersisted: true,
      economyEnabled: true,
      advancementsEnabled: true,
      purchasesEnabled: true,
      firingsEnabled: true,
      resurrection: false,
    });
  });

  it("une coupe n'écrit RIEN sur les équipes et joue en résurrection", () => {
    expect(CUP_SHEET_RULES).toEqual({
      sppEnabled: false,
      injuriesPersisted: false,
      economyEnabled: false,
      advancementsEnabled: false,
      purchasesEnabled: false,
      firingsEnabled: false,
      resurrection: true,
    });
  });

  it("sheetRulesFor mappe le type de compétition", () => {
    expect(sheetRulesFor("cup")).toBe(CUP_SHEET_RULES);
    expect(sheetRulesFor("league")).toBe(LEAGUE_SHEET_RULES);
  });
});

describe("clé de rattachement de la feuille", () => {
  it("cible la FK ligue OU la FK coupe, jamais les deux", () => {
    expect(sheetWhere({ kind: "league", pairingId: "p1" })).toEqual({
      pairingId: "p1",
    });
    expect(sheetWhere({ kind: "cup", pairingId: "cp1" })).toEqual({
      cupPairingId: "cp1",
    });
    expect(sheetCreateData({ kind: "cup", pairingId: "cp1" })).toEqual({
      cupPairingId: "cp1",
    });
  });
});

describe("resolveCompetitionPairing", () => {
  beforeEach(() => vi.resetAllMocks());

  it("résout une rencontre de ligue (et n'interroge pas les coupes)", async () => {
    mockPrisma.leaguePairing.findUnique.mockResolvedValue({
      id: "p1",
      round: {
        season: { league: { id: "L1", name: "Ma Ligue", creatorId: "u-com" } },
      },
      homeParticipant: { teamId: "t1", team: { ownerId: "u-home" } },
      awayParticipant: { teamId: "t2", team: { ownerId: "u-away" } },
    });

    const ctx = await resolveCompetitionPairing("p1");

    expect(ctx).toEqual({
      kind: "league",
      pairingId: "p1",
      competitionId: "L1",
      competitionName: "Ma Ligue",
      creatorId: "u-com",
      homeTeamId: "t1",
      awayTeamId: "t2",
      homeOwnerId: "u-home",
      awayOwnerId: "u-away",
      rules: LEAGUE_SHEET_RULES,
    });
    expect(mockPrisma.cupPairing.findUnique).not.toHaveBeenCalled();
  });

  it("résout une rencontre de coupe quand l'id n'est pas une rencontre de ligue", async () => {
    mockPrisma.leaguePairing.findUnique.mockResolvedValue(null);
    mockPrisma.cupPairing.findUnique.mockResolvedValue({
      id: "cp1",
      homeTeamId: "t1",
      awayTeamId: "t2",
      homeTeam: { ownerId: "u-home" },
      awayTeam: { ownerId: "u-away" },
      round: { cup: { id: "C1", name: "World Cup", creatorId: "u-com" } },
    });

    const ctx = await resolveCompetitionPairing("cp1");

    expect(ctx).toMatchObject({
      kind: "cup",
      competitionId: "C1",
      competitionName: "World Cup",
      creatorId: "u-com",
      homeTeamId: "t1",
      awayTeamId: "t2",
      rules: CUP_SHEET_RULES,
    });
  });

  it("traite un exempt (bye) comme une rencontre sans feuille", async () => {
    mockPrisma.leaguePairing.findUnique.mockResolvedValue(null);
    mockPrisma.cupPairing.findUnique.mockResolvedValue({
      id: "cp1",
      homeTeamId: "t1",
      awayTeamId: null,
      homeTeam: { ownerId: "u-home" },
      awayTeam: null,
      round: { cup: { id: "C1", name: "World Cup", creatorId: "u-com" } },
    });

    await expect(resolveCompetitionPairing("cp1")).resolves.toBeNull();
  });

  it("rend null quand l'id n'appartient à aucune compétition", async () => {
    mockPrisma.leaguePairing.findUnique.mockResolvedValue(null);
    mockPrisma.cupPairing.findUnique.mockResolvedValue(null);
    await expect(resolveCompetitionPairing("nope")).resolves.toBeNull();
  });

  it("tolère une rencontre de ligue dont un participant a disparu", async () => {
    mockPrisma.leaguePairing.findUnique.mockResolvedValue({
      id: "p1",
      round: { season: { league: { id: "L1", name: "L", creatorId: "u" } } },
      homeParticipant: null,
      awayParticipant: null,
    });
    const ctx = await resolveCompetitionPairing("p1");
    expect(ctx).toMatchObject({ homeTeamId: "", awayTeamId: "" });
  });
});
