/**
 * Tests du handler `PATCH /team/:id/name`.
 *
 * Couvre le mapping erreurs typées → status HTTP (`not_found` → 404,
 * `invalid_name` → 400, inattendue → 500) et le passage de l'identité de
 * l'appelant au service (impossible de renommer l'équipe d'un autre).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Response } from "express";

vi.mock("../services/team-rename", () => {
  class TeamRenameError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "TeamRenameError";
    }
  }
  return { TeamRenameError, renameTeam: vi.fn() };
});

import { renameTeam, TeamRenameError } from "../services/team-rename";
import { handleRenameTeam } from "./team-rename-handler";
import type { AuthenticatedRequest } from "../middleware/authUser";

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function makeRes(): MockRes {
  const res: Partial<MockRes> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as MockRes;
}

function makeReq(name: string, userId = "user-1"): AuthenticatedRequest {
  return {
    user: { id: userId },
    params: { id: "team-1" },
    body: { name },
  } as unknown as AuthenticatedRequest;
}

describe("handleRenameTeam", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renvoie l'équipe renommée (200)", async () => {
    vi.mocked(renameTeam).mockResolvedValue({
      id: "team-1",
      name: "Les Crânes Fêlés",
      previousName: "Les Bourrins",
    });
    const res = makeRes();

    await handleRenameTeam(
      makeReq("Les Crânes Fêlés"),
      res as unknown as Response,
    );

    expect(renameTeam).toHaveBeenCalledWith({
      teamId: "team-1",
      ownerId: "user-1",
      name: "Les Crânes Fêlés",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { team: { id: "team-1", name: "Les Crânes Fêlés" } },
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("propage l'identité de l'appelant (pas de renommage cross-coach)", async () => {
    vi.mocked(renameTeam).mockResolvedValue({
      id: "team-1",
      name: "X",
      previousName: null,
    });

    await handleRenameTeam(
      makeReq("X", "intrus"),
      makeRes() as unknown as Response,
    );

    expect(renameTeam).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "intrus" }),
    );
  });

  it("404 quand l'équipe est introuvable / non possédée / supprimée", async () => {
    vi.mocked(renameTeam).mockRejectedValue(
      new TeamRenameError("not_found", "Équipe introuvable"),
    );
    const res = makeRes();

    await handleRenameTeam(makeReq("X"), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Équipe introuvable" }),
    );
  });

  it("400 sur un nom invalide, avec le message du service", async () => {
    vi.mocked(renameTeam).mockRejectedValue(
      new TeamRenameError(
        "invalid_name",
        "Le nom de l'équipe ne peut pas être vide",
      ),
    );
    const res = makeRes();

    await handleRenameTeam(makeReq(" "), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Le nom de l'équipe ne peut pas être vide",
      }),
    );
  });

  it("500 sur une erreur inattendue, sans fuiter le détail", async () => {
    vi.mocked(renameTeam).mockRejectedValue(new Error("boom db"));
    const res = makeRes();

    await handleRenameTeam(makeReq("X"), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Erreur serveur" }),
    );
  });
});
