/**
 * Lot I — Tests du service `commissioner-team-edit`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueParticipant: { count: vi.fn() },
    teamPlayer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    team: { findUnique: vi.fn(), update: vi.fn() },
    position: { findFirst: vi.fn(), findMany: vi.fn() },
    skill: { findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  adjustPlayerSpp,
  addPlayerSkill,
  removePlayerSkill,
  adjustCharacteristic,
  updatePlayerIdentity,
  adjustTreasury,
  listAuditLog,
  getTeamForEdit,
  CommissionerEditError,
} from "./commissioner-team-edit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const commish = "commish-1";

describe("Lot I — commissioner-team-edit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    // Par défaut : pas de données d'accès (retro-compat season_2) et pas
    // de compétences innées connues.
    mockPrisma.position.findFirst.mockResolvedValue(null);
    mockPrisma.position.findMany.mockResolvedValue([]);
    mockPrisma.teamPlayer.count.mockResolvedValue(0);
    // $transaction : exécute le callback avec le mock lui-même.
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe("getTeamForEdit (FR12)", () => {
    it("rejette si l'équipe n'est pas inscrite dans la ligue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      await expect(
        getTeamForEdit({ leagueId: "L1", teamId: "T1" }),
      ).rejects.toMatchObject({ code: "team_not_in_league" });
    });

    it("renvoie l'équipe + joueurs actifs quand elle appartient à la ligue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "T1",
        name: "Skavens",
        roster: "skaven",
        treasury: 50000,
      });
      mockPrisma.teamPlayer.findMany.mockResolvedValue([
        { id: "P1", name: "Rat", position: "skaven_lineman", number: 1, ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: "block", spp: 6, dead: false },
      ]);
      const out = await getTeamForEdit({ leagueId: "L1", teamId: "T1" });
      expect(out.team.treasury).toBe(50000);
      expect(out.players).toHaveLength(1);
      // Filtre sur joueurs non licenciés.
      expect(mockPrisma.teamPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: "T1", firedAt: null } }),
      );
    });

    it("rejette si l'équipe est introuvable", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.team.findUnique.mockResolvedValue(null);
      await expect(
        getTeamForEdit({ leagueId: "L1", teamId: "T1" }),
      ).rejects.toMatchObject({ code: "team_not_found" });
    });
  });

  describe("adjustPlayerSpp", () => {
    it("rejects delta=0", async () => {
      await expect(
        adjustPlayerSpp({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          delta: 0,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_delta" });
    });

    it("rejects non-integer delta", async () => {
      await expect(
        adjustPlayerSpp({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          delta: 1.5,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_delta" });
    });

    it("rejects when team not in league", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      await expect(
        adjustPlayerSpp({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          delta: 5,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_not_in_league" });
    });

    it("rejects when player not in given team", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "OTHER",
        spp: 5,
        name: "X",
      });
      await expect(
        adjustPlayerSpp({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          delta: 5,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "player_not_in_team" });
    });

    it("rejects if final SPP would be negative", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        spp: 3,
        name: "X",
      });
      await expect(
        adjustPlayerSpp({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          delta: -5,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_delta" });
    });

    it("applies delta and creates audit entry", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        spp: 5,
        name: "X",
      });
      mockPrisma.teamPlayer.update.mockResolvedValue({ id: "P1", spp: 11 });
      const out = await adjustPlayerSpp({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        delta: 6,
        byCommissionerId: commish,
        reason: "Saisie corrigee",
      });
      expect(out).toMatchObject({ spp: 11 });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(
        "league.commissioner-edit:adjust_spp",
      );
    });
  });

  describe("addPlayerSkill", () => {
    it("rejects when team not in league", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(0);
      await expect(
        addPlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "Block",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "team_not_in_league" });
    });

    it("rejects empty skill", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "",
        name: "X",
      });
      await expect(
        addPlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "   ",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_value" });
    });

    it("rejects when skill already present", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "Block,Tackle",
        name: "X",
      });
      await expect(
        addPlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "Block",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "skill_already_present" });
    });

    it("appends skill to CSV and audits with pickKind", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "Block",
        name: "X",
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: { skills: string } }) => ({
          id: "P1",
          skills: a.data.skills,
        }),
      );
      const out = await addPlayerSkill({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        skill: "Dodge",
        pickKind: "random",
        byCommissionerId: commish,
      });
      expect((out as { skills: string }).skills).toBe("Block,Dodge");
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(
        "league.commissioner-edit:add_skill:random",
      );
    });
  });

  describe("removePlayerSkill", () => {
    it("rejects if skill not present", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "Block",
      });
      await expect(
        removePlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "Dodge",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "skill_not_present" });
    });

    it("removes skill from CSV", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "Block,Dodge,Tackle",
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: { skills: string } }) => ({
          id: "P1",
          skills: a.data.skills,
        }),
      );
      const out = await removePlayerSkill({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        skill: "Dodge",
        byCommissionerId: commish,
      });
      expect((out as { skills: string }).skills).toBe("Block,Tackle");
    });
  });

  describe("A64 — updatePlayerIdentity", () => {
    it("rejette un numéro déjà pris dans l'équipe", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        name: "Rat",
        number: 3,
      });
      mockPrisma.teamPlayer.count.mockResolvedValue(1); // numéro occupé
      await expect(
        updatePlayerIdentity({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          number: 7,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "number_taken" });
    });

    it("met à jour nom + numéro et journalise", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        name: "Rat",
        number: 3,
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({
          id: "P1",
          ...a.data,
        }),
      );
      const out = await updatePlayerIdentity({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        name: "Scrat Le Rapide",
        number: 7,
        byCommissionerId: commish,
      });
      expect(out).toMatchObject({ name: "Scrat Le Rapide", number: 7 });
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(
        "league.commissioner-edit:update_identity",
      );
    });
  });

  describe("E13/A6 — addPlayerSkill avec données d'accès", () => {
    function mockAccess(primary: string | null, secondary: string | null) {
      mockPrisma.position.findFirst.mockResolvedValue({
        primarySkills: primary,
        secondarySkills: secondary,
      });
    }

    it("rejette une compétence hors pool primaire+secondaire", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "",
        name: "X",
        position: "skaven_lineman",
        advancements: "[]",
        team: { roster: "skaven", ruleset: "season_3" },
      });
      mockAccess("G", "A");
      // "claw" = Mutation (M) → hors pool G/A.
      mockPrisma.skill.findFirst.mockResolvedValue({ category: "Mutation" });
      await expect(
        addPlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "claw",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "skill_not_accessible" });
    });

    it("A6 — enregistre un avancement et incrémente la VE (+20k primaire)", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "",
        name: "X",
        position: "skaven_lineman",
        advancements: "[]",
        team: { roster: "skaven", ruleset: "season_3" },
      });
      mockAccess("G", "A");
      mockPrisma.skill.findFirst.mockResolvedValue({ category: "General" });
      let updatedPlayerData: Record<string, unknown> | null = null;
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => {
          updatedPlayerData = a.data;
          return { id: "P1", ...a.data };
        },
      );
      await addPlayerSkill({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        skill: "block",
        pickKind: "random",
        byCommissionerId: commish,
      });
      // Avancement random-primary enregistré + VE +20k (comme une choisie, A6).
      const advs = JSON.parse(
        (updatedPlayerData as unknown as { advancements: string })
          .advancements,
      );
      expect(advs).toHaveLength(1);
      expect(advs[0]).toMatchObject({
        skillSlug: "block",
        type: "random-primary",
        isRandom: true,
      });
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentValue: { increment: 20000 } },
        }),
      );
    });

    it("compétence secondaire → +40k", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "",
        name: "X",
        position: "skaven_lineman",
        advancements: "[]",
        team: { roster: "skaven", ruleset: "season_3" },
      });
      mockAccess("G", "A");
      mockPrisma.skill.findFirst.mockResolvedValue({ category: "Agility" });
      mockPrisma.teamPlayer.update.mockResolvedValue({ id: "P1" });
      await addPlayerSkill({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        skill: "dodge",
        byCommissionerId: commish,
      });
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentValue: { increment: 40000 } },
        }),
      );
    });
  });

  describe("E15 — removePlayerSkill et compétences innées", () => {
    it("refuse de supprimer une compétence innée du poste", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "dodge,block",
        position: "skaven_gutter_runner",
        advancements: "[]",
        team: { roster: "skaven", ruleset: "season_3" },
      });
      mockPrisma.position.findFirst.mockResolvedValue({
        skills: [{ skill: { slug: "dodge" } }],
      });
      await expect(
        removePlayerSkill({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          skill: "dodge",
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "innate_skill" });
    });

    it("reverse l'avancement correspondant et décrémente la VE", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        skills: "dodge,block",
        position: "skaven_gutter_runner",
        advancements: JSON.stringify([
          { skillSlug: "block", type: "secondary", isRandom: false, at: 1 },
        ]),
        team: { roster: "skaven", ruleset: "season_3" },
      });
      mockPrisma.position.findFirst.mockResolvedValue({
        skills: [{ skill: { slug: "dodge" } }],
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({
          id: "P1",
          ...a.data,
        }),
      );
      const out = await removePlayerSkill({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        skill: "block",
        byCommissionerId: commish,
      });
      expect((out as { skills: string }).skills).toBe("dodge");
      expect(
        JSON.parse((out as { advancements: string }).advancements),
      ).toEqual([]);
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentValue: { decrement: 40000 } },
        }),
      );
    });
  });

  describe("E14 — adjustCharacteristic par valeur cible", () => {
    it("applique une valeur absolue", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({
          id: "P1",
          ...a.data,
        }),
      );
      const out = await adjustCharacteristic({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        characteristic: "ST",
        value: 4,
        byCommissionerId: commish,
      });
      expect((out as { st: number }).st).toBe(4);
    });

    it("rejette delta ET value simultanés", async () => {
      await expect(
        adjustCharacteristic({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          characteristic: "ST",
          delta: 1,
          value: 4,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_value" });
    });
  });

  describe("adjustCharacteristic", () => {
    it("rejects unknown characteristic", async () => {
      await expect(
        adjustCharacteristic({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          characteristic: "XX" as any,
          delta: 1,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_characteristic" });
    });

    it("clamps to [1, 10]", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        ma: 9,
        st: 3,
        ag: 3,
        pa: 3,
        av: 9,
      });
      mockPrisma.teamPlayer.update.mockImplementation(
        async (a: { data: Record<string, number> }) => ({
          id: "P1",
          ma: a.data.ma,
        }),
      );
      // delta=+5 sur MA=9 -> clamp 10
      const out = await adjustCharacteristic({
        leagueId: "L1",
        teamId: "T1",
        playerId: "P1",
        characteristic: "MA",
        delta: 5,
        byCommissionerId: commish,
      });
      expect((out as { ma: number }).ma).toBe(10);
    });

    it("rejects if delta has no effect (already at bound)", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.teamPlayer.findUnique.mockResolvedValue({
        id: "P1",
        teamId: "T1",
        ma: 10,
        st: 3,
        ag: 3,
        pa: 3,
        av: 9,
      });
      await expect(
        adjustCharacteristic({
          leagueId: "L1",
          teamId: "T1",
          playerId: "P1",
          characteristic: "MA",
          delta: 2,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_value" });
    });
  });

  describe("adjustTreasury", () => {
    it("rejects negative final treasury", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "T1",
        treasury: 50_000,
      });
      await expect(
        adjustTreasury({
          leagueId: "L1",
          teamId: "T1",
          delta: -100_000,
          byCommissionerId: commish,
        }),
      ).rejects.toMatchObject({ code: "invalid_delta" });
    });

    it("applies delta on success", async () => {
      mockPrisma.leagueParticipant.count.mockResolvedValue(1);
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "T1",
        treasury: 1_000_000,
      });
      mockPrisma.team.update.mockResolvedValue({ id: "T1", treasury: 1_100_000 });
      const out = await adjustTreasury({
        leagueId: "L1",
        teamId: "T1",
        delta: 100_000,
        byCommissionerId: commish,
      });
      expect((out as { treasury: number }).treasury).toBe(1_100_000);
    });
  });

  describe("listAuditLog", () => {
    it("calls findMany with action prefix filter", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: "a1" }]);
      await listAuditLog({ leagueId: "L1" });
      const callArgs = mockPrisma.auditLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action.startsWith).toBe(
        "league.commissioner-edit:",
      );
    });

    it("returns empty array if AuditLog table missing", async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error("no table"));
      const out = await listAuditLog({ leagueId: "L1" });
      expect(out).toEqual([]);
    });
  });

  describe("CommissionerEditError", () => {
    it("preserves code", () => {
      const e = new CommissionerEditError("player_not_found", "x");
      expect(e.code).toBe("player_not_found");
      expect(e).toBeInstanceOf(Error);
    });
  });
});
