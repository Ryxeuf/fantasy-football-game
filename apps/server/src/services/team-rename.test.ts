/**
 * Tests du renommage d'équipe (`services/team-rename.ts`).
 *
 * Couvre :
 *   - renommage nominal (trim, écriture, journal `team.rename`) ;
 *   - no-op quand le nom est identique (ni écriture ni journal) ;
 *   - bornes du nom (vide / blanc / > 100) ;
 *   - ownership + soft delete → `not_found` ;
 *   - PAS de verrou anti-triche : `isTeamRosterFrozen` n'est jamais
 *     consulté (une équipe engagée reste renommable).
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
import { renameTeam, TeamRenameError } from "./team-rename";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const teamId = "team-1";
const ownerId = "user-1";

describe("renameTeam", () => {
  beforeEach(() => {
    // `resetAllMocks` (et non `clearAllMocks`) : les tests ci-dessous
    // utilisent la queue `mockResolvedValueOnce`.
    vi.resetAllMocks();
    mockPrisma.team.findFirst.mockResolvedValue({
      id: teamId,
      name: "Les Bourrins",
    });
    mockPrisma.team.update.mockResolvedValue({
      id: teamId,
      name: "Les Crânes Fêlés",
    });
    vi.mocked(captureTeamState).mockResolvedValue(null);
  });

  it("renomme l'équipe en trimant le nom", async () => {
    const result = await renameTeam({
      teamId,
      ownerId,
      name: "  Les Crânes Fêlés  ",
    });

    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: teamId },
        data: { name: "Les Crânes Fêlés" },
      }),
    );
    expect(result).toEqual({
      id: teamId,
      name: "Les Crânes Fêlés",
      previousName: "Les Bourrins",
    });
  });

  it("cherche l'équipe par propriétaire ET non supprimée", async () => {
    await renameTeam({ teamId, ownerId, name: "Les Crânes Fêlés" });

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: teamId, ownerId, deletedAt: null },
      }),
    );
  });

  it("journalise une étape team.rename avec l'ancien et le nouveau nom", async () => {
    await renameTeam({ teamId, ownerId, name: "Les Crânes Fêlés" });

    expect(captureTeamState).toHaveBeenCalledWith(expect.anything(), teamId);
    expect(safeRecordTeamAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teamId,
        action: "team.rename",
        entity: "Team",
        entityId: teamId,
        details: { from: "Les Bourrins", to: "Les Crânes Fêlés" },
      }),
    );
  });

  it("capture l'état AVANT l'écriture (le diff doit porter l'ancien nom)", async () => {
    const order: string[] = [];
    vi.mocked(captureTeamState).mockImplementation(async () => {
      order.push("capture");
      return null;
    });
    mockPrisma.team.update.mockImplementation(async () => {
      order.push("update");
      return { id: teamId, name: "Les Crânes Fêlés" };
    });

    await renameTeam({ teamId, ownerId, name: "Les Crânes Fêlés" });

    expect(order).toEqual(["capture", "update"]);
  });

  it("no-op quand le nom est identique (après trim)", async () => {
    const result = await renameTeam({
      teamId,
      ownerId,
      name: "  Les Bourrins  ",
    });

    expect(mockPrisma.team.update).not.toHaveBeenCalled();
    expect(safeRecordTeamAudit).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: teamId,
      name: "Les Bourrins",
      previousName: null,
    });
  });

  it("refuse un nom vide ou uniquement blanc", async () => {
    for (const name of ["", "   ", "\t\n"]) {
      await expect(renameTeam({ teamId, ownerId, name })).rejects.toMatchObject(
        { name: "TeamRenameError", code: "invalid_name" },
      );
    }
    expect(mockPrisma.team.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("refuse un nom de plus de 100 caractères", async () => {
    await expect(
      renameTeam({ teamId, ownerId, name: "a".repeat(101) }),
    ).rejects.toBeInstanceOf(TeamRenameError);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("accepte exactement 100 caractères", async () => {
    const name = "a".repeat(100);
    mockPrisma.team.update.mockResolvedValue({ id: teamId, name });

    await expect(renameTeam({ teamId, ownerId, name })).resolves.toMatchObject({
      name,
    });
  });

  it("not_found si l'équipe n'existe pas, appartient à un autre coach ou est supprimée", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await expect(
      renameTeam({ teamId, ownerId, name: "Les Crânes Fêlés" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("ne consulte AUCUN verrou d'engagement (équipe en ligue renommable)", async () => {
    // Le mock prisma n'expose ni teamSelection, ni leagueParticipant, ni
    // cupParticipant : si le service tentait `isTeamRosterFrozen`, il
    // lèverait sur une méthode indéfinie.
    await expect(
      renameTeam({ teamId, ownerId, name: "Les Crânes Fêlés" }),
    ).resolves.toMatchObject({ name: "Les Crânes Fêlés" });
  });
});
