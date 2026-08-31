/**
 * Tests de la description d'équipe (`services/team-description.ts`).
 *
 * Couvre :
 *   - écriture nominale (trim, journal `team.description.update`) ;
 *   - normalisation chaîne blanche / null ⇒ `null` (un seul état vide) ;
 *   - no-op quand la valeur est identique (ni écriture ni journal), y
 *     compris entre `null` et `"   "` ;
 *   - borne haute (> 1000 caractères) ;
 *   - ownership + soft delete → `not_found` ;
 *   - PAS de verrou anti-triche : `isTeamRosterFrozen` n'est jamais
 *     consulté (une équipe engagée reste descriptible).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./team-audit", () => ({
  captureTeamState: vi.fn(),
  safeRecordTeamAudit: vi.fn(),
}));

import { prisma } from "../prisma";
import { captureTeamState, safeRecordTeamAudit } from "./team-audit";
import {
  normalizeTeamDescription,
  updateTeamDescription,
  TeamDescriptionError,
  TEAM_DESCRIPTION_MAX_LENGTH,
} from "./team-description";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const teamId = "team-1";
const ownerId = "user-1";

describe("normalizeTeamDescription", () => {
  it("trime la saisie", () => {
    expect(normalizeTeamDescription("  Bande de rats  ")).toBe("Bande de rats");
  });

  it("ramène toute forme de vide à null", () => {
    expect(normalizeTeamDescription("")).toBeNull();
    expect(normalizeTeamDescription("   ")).toBeNull();
    expect(normalizeTeamDescription(null)).toBeNull();
    expect(normalizeTeamDescription(undefined)).toBeNull();
  });
});

describe("updateTeamDescription", () => {
  beforeEach(() => {
    // `resetAllMocks` (et non `clearAllMocks`) : les tests utilisent la
    // queue `mockResolvedValueOnce`.
    vi.resetAllMocks();
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      description: null,
    });
    mockPrisma.team.update.mockResolvedValue({
      id: teamId,
      description: "Bande de rats",
    });
    vi.mocked(captureTeamState).mockResolvedValue(null);
  });

  it("écrit la description en la trimant", async () => {
    const result = await updateTeamDescription({
      teamId,
      ownerId,
      description: "  Bande de rats  ",
    });

    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: teamId },
        data: { description: "Bande de rats" },
      }),
    );
    expect(result).toEqual({
      id: teamId,
      description: "Bande de rats",
      previousDescription: null,
    });
  });

  it("journalise l'étape team.description.update avec l'avant/après", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      description: "Ancien fluff",
    });

    await updateTeamDescription({
      teamId,
      ownerId,
      description: "Bande de rats",
    });

    expect(safeRecordTeamAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teamId,
        action: "team.description.update",
        details: { from: "Ancien fluff", to: "Bande de rats" },
      }),
    );
  });

  it("efface la description quand la saisie est blanche", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      description: "Ancien fluff",
    });
    mockPrisma.team.update.mockResolvedValue({ id: teamId, description: null });

    const result = await updateTeamDescription({
      teamId,
      ownerId,
      description: "   ",
    });

    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { description: null } }),
    );
    expect(result.description).toBeNull();
  });

  it("ne réécrit rien quand la valeur est identique", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      description: "Bande de rats",
    });

    const result = await updateTeamDescription({
      teamId,
      ownerId,
      description: "Bande de rats",
    });

    expect(mockPrisma.team.update).not.toHaveBeenCalled();
    expect(safeRecordTeamAudit).not.toHaveBeenCalled();
    expect(result).toEqual({ id: teamId, description: "Bande de rats" });
  });

  it("traite « null » et « chaîne blanche » comme la même valeur (no-op)", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      description: null,
    });

    await updateTeamDescription({ teamId, ownerId, description: "  " });

    expect(mockPrisma.team.update).not.toHaveBeenCalled();
    expect(safeRecordTeamAudit).not.toHaveBeenCalled();
  });

  it("refuse une description au-delà de la borne", async () => {
    await expect(
      updateTeamDescription({
        teamId,
        ownerId,
        description: "x".repeat(TEAM_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: "invalid_description" });
    expect(mockPrisma.team.findFirst).not.toHaveBeenCalled();
  });

  it("accepte exactement la borne", async () => {
    const atLimit = "x".repeat(TEAM_DESCRIPTION_MAX_LENGTH);
    mockPrisma.team.update.mockResolvedValue({
      id: teamId,
      description: atLimit,
    });

    await expect(
      updateTeamDescription({ teamId, ownerId, description: atLimit }),
    ).resolves.toMatchObject({ description: atLimit });
  });

  it("répond not_found pour une équipe non possédée ou supprimée", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await expect(
      updateTeamDescription({ teamId, ownerId: "intrus", description: "X" }),
    ).rejects.toBeInstanceOf(TeamDescriptionError);

    // Le filtre exclut les équipes soft-deletées : une équipe supprimée
    // doit être indiscernable d'une équipe inexistante.
    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: teamId, ownerId: "intrus", deletedAt: null },
      }),
    );
  });
});
