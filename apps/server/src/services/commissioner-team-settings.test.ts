/**
 * Reglages d'equipe commissaire : staff + Ligue regionale.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueParticipant: { count: vi.fn() },
    team: { findUnique: vi.fn(), update: vi.fn() },
    roster: { findFirst: vi.fn() },
    teamStarPlayer: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(async () => ({
    teamValue: 1_100_000,
    currentValue: 1_050_000,
  })),
}));

vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(),
}));

/**
 * Aucun reglement du registre ne neutralise l'axe regional aujourd'hui :
 * on pilote le drapeau pour couvrir la garde, sans figer un slug qui
 * pourrait changer de politique.
 */
const regionalChoice = { allowed: true };
vi.mock("@bb/game-engine", async (importActual) => {
  const actual = await importActual<typeof import("@bb/game-engine")>();
  return { ...actual, allowsRegionalLeagueChoice: () => regionalChoice.allowed };
});

import { prisma } from "../prisma";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  getTeamSettings,
  updateTeamStaff,
  updateTeamRegionalLeague,
  staffCostDelta,
  validateStaff,
  CommissionerSettingsError,
  type TeamStaff,
} from "./commissioner-team-settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const CONFIG = {
  rerollCost: 60_000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50_000,
  maxCheerleaders: 12,
  cheerleaderCost: 10_000,
  maxAssistants: 6,
  assistantCost: 10_000,
  maxDedicatedFans: 6,
  dedicatedFanCost: 10_000,
};

const BASE_STAFF: TeamStaff = {
  rerolls: 2,
  cheerleaders: 1,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
};

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "T1",
    name: "Reikland Reavers",
    roster: "norse",
    ruleset: "season_3",
    format: "bb11",
    tournamentRuleset: null,
    regionalLeague: null,
    treasury: 200_000,
    teamValue: 1_000_000,
    currentValue: 1_000_000,
    ...BASE_STAFF,
    ...overrides,
  };
}

describe("commissioner-team-settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.leagueParticipant.count.mockResolvedValue(1);
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.roster.findFirst.mockResolvedValue(null);
    mockPrisma.teamStarPlayer.findMany.mockResolvedValue([]);
    mockPrisma.team.update.mockResolvedValue({});
    vi.mocked(resolveStaffConfigBySlug).mockResolvedValue(CONFIG);
    regionalChoice.allowed = true;
  });

  describe("staffCostDelta (pur)", () => {
    it("facture les ajouts au barème du roster", () => {
      const after: TeamStaff = {
        ...BASE_STAFF,
        rerolls: 3,
        apothecary: true,
        cheerleaders: 3,
      };
      expect(staffCostDelta(BASE_STAFF, after, CONFIG)).toBe(
        60_000 + 50_000 + 2 * 10_000,
      );
    });

    it("rembourse au même barème quand on retire du staff", () => {
      const after: TeamStaff = { ...BASE_STAFF, rerolls: 0 };
      expect(staffCostDelta(BASE_STAFF, after, CONFIG)).toBe(-120_000);
    });

    it("renvoie 0 quand rien ne change", () => {
      expect(staffCostDelta(BASE_STAFF, { ...BASE_STAFF }, CONFIG)).toBe(0);
    });
  });

  describe("validateStaff (pur)", () => {
    it("refuse au-delà du plafond du roster", () => {
      const out = validateStaff({ ...BASE_STAFF, rerolls: 9 }, CONFIG);
      expect(out?.code).toBe("staff_out_of_bounds");
      expect(out?.message).toContain("relances");
    });

    it("refuse moins d'un fan dévoué", () => {
      expect(validateStaff({ ...BASE_STAFF, dedicatedFans: 0 }, CONFIG)?.code).toBe(
        "staff_out_of_bounds",
      );
    });

    it("refuse l'apothicaire quand le roster n'y a pas droit", () => {
      const out = validateStaff(
        { ...BASE_STAFF, apothecary: true },
        { ...CONFIG, apothecaryAllowed: false },
      );
      expect(out?.code).toBe("apothecary_not_allowed");
    });

    it("accepte un staff dans les bornes", () => {
      expect(validateStaff(BASE_STAFF, CONFIG)).toBeNull();
    });
  });

  describe("getTeamSettings", () => {
    it("refuse une équipe hors de la ligue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      await expect(
        getTeamSettings({ leagueId: "L1", teamId: "T1" }),
      ).rejects.toThrow(/n'est pas inscrite/);
    });

    it("expose staff, plafonds et options de Ligue régionale", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      const out = await getTeamSettings({ leagueId: "L1", teamId: "T1" });
      expect(out.staff.rerolls).toBe(2);
      expect(out.staffConfig.maxRerolls).toBe(8);
      expect(out.regionalLeague.applicable).toBe(true);
      // Les Nordiques ont plusieurs Ligues, dont le Clash du Chaos implicite.
      expect(out.regionalLeague.options.length).toBeGreaterThan(1);
      expect(out.regionalLeague.options[0].label).not.toBe("");
    });

    it("neutralise l'axe régional sous règlement de tournoi qui l'interdit", async () => {
      regionalChoice.allowed = false;
      mockPrisma.team.findUnique.mockResolvedValue(
        teamRow({ tournamentRuleset: "naf_world_cup_2027" }),
      );
      const out = await getTeamSettings({ leagueId: "L1", teamId: "T1" });
      expect(out.regionalLeague.applicable).toBe(false);
      expect(out.regionalLeague.options).toEqual([]);
    });
  });

  describe("updateTeamStaff", () => {
    it("refuse quand rien ne change", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      await expect(
        updateTeamStaff({
          leagueId: "L1",
          teamId: "T1",
          staff: { rerolls: 2 },
          byCommissionerId: "c1",
        }),
      ).rejects.toMatchObject({ code: "no_change" });
    });

    it("refuse un staff hors plafond", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      await expect(
        updateTeamStaff({
          leagueId: "L1",
          teamId: "T1",
          staff: { rerolls: 12 },
          byCommissionerId: "c1",
        }),
      ).rejects.toMatchObject({ code: "staff_out_of_bounds" });
    });

    it("met à jour sans toucher à la trésorerie par défaut", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      const out = await updateTeamStaff({
        leagueId: "L1",
        teamId: "T1",
        staff: { rerolls: 3, apothecary: true },
        byCommissionerId: "c1",
      });
      expect(out.charged).toBe(0);
      expect(out.cost).toBe(110_000);
      expect(out.treasury).toBe(200_000);
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "T1" },
          data: expect.objectContaining({ rerolls: 3, apothecary: true }),
        }),
      );
    });

    it("débite la trésorerie quand chargeTreasury est demandé", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      const out = await updateTeamStaff({
        leagueId: "L1",
        teamId: "T1",
        staff: { rerolls: 3 },
        chargeTreasury: true,
        byCommissionerId: "c1",
      });
      expect(out.charged).toBe(60_000);
      expect(out.treasury).toBe(140_000);
    });

    it("rembourse la trésorerie quand on retire du staff", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      const out = await updateTeamStaff({
        leagueId: "L1",
        teamId: "T1",
        staff: { rerolls: 1 },
        chargeTreasury: true,
        byCommissionerId: "c1",
      });
      expect(out.treasury).toBe(260_000);
    });

    it("refuse un débit qui rendrait la trésorerie négative", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow({ treasury: 10_000 }));
      await expect(
        updateTeamStaff({
          leagueId: "L1",
          teamId: "T1",
          staff: { rerolls: 4 },
          chargeTreasury: true,
          byCommissionerId: "c1",
        }),
      ).rejects.toMatchObject({ code: "insufficient_treasury" });
      expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("journalise l'action dans l'AuditLog", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      await updateTeamStaff({
        leagueId: "L1",
        teamId: "T1",
        staff: { cheerleaders: 4 },
        byCommissionerId: "c1",
        reason: "oubli au build",
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "league.commissioner-edit:update_staff",
          }),
        }),
      );
    });
  });

  describe("updateTeamRegionalLeague", () => {
    it("refuse une Ligue qui n'est pas ouverte au roster", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      await expect(
        updateTeamRegionalLeague({
          leagueId: "L1",
          teamId: "T1",
          regionalLeague: "elven_kingdoms_league",
          byCommissionerId: "c1",
        }),
      ).rejects.toMatchObject({ code: "invalid_regional_league" });
    });

    it("refuse sous un règlement qui neutralise l'axe régional", async () => {
      regionalChoice.allowed = false;
      mockPrisma.team.findUnique.mockResolvedValue(
        teamRow({ tournamentRuleset: "naf_world_cup_2027" }),
      );
      await expect(
        updateTeamRegionalLeague({
          leagueId: "L1",
          teamId: "T1",
          regionalLeague: "chaos_clash",
          byCommissionerId: "c1",
        }),
      ).rejects.toMatchObject({ code: "regional_choice_unavailable" });
    });

    it("enregistre le choix et le journalise", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(teamRow());
      const out = await updateTeamRegionalLeague({
        leagueId: "L1",
        teamId: "T1",
        regionalLeague: "chaos_clash",
        byCommissionerId: "c1",
      });
      expect(out.regionalLeague).toBe("chaos_clash");
      expect(out.label).toBe("Clash du Chaos");
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "T1" },
        data: { regionalLeague: "chaos_clash" },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it("refuse de réécrire le même choix", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(
        teamRow({ regionalLeague: "chaos_clash" }),
      );
      await expect(
        updateTeamRegionalLeague({
          leagueId: "L1",
          teamId: "T1",
          regionalLeague: "chaos_clash",
          byCommissionerId: "c1",
        }),
      ).rejects.toBeInstanceOf(CommissionerSettingsError);
    });

    it("accepte le retrait du choix (null)", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(
        teamRow({ regionalLeague: "chaos_clash" }),
      );
      const out = await updateTeamRegionalLeague({
        leagueId: "L1",
        teamId: "T1",
        regionalLeague: null,
        byCommissionerId: "c1",
      });
      expect(out.regionalLeague).toBeNull();
      expect(out.label).toBeNull();
    });
  });
});
