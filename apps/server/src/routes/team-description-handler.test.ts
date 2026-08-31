/**
 * Tests du handler `PATCH /team/:id/description`.
 *
 * Couvre le mapping erreurs typées → status HTTP (`not_found` → 404,
 * `invalid_description` → 400, inattendue → 500) et le passage de
 * l'identité de l'appelant au service (impossible de décrire l'équipe d'un
 * autre coach).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Response } from "express";

vi.mock("../services/team-description", () => {
  // La classe d'erreur DOIT être définie dans la factory : la hisser hors
  // du `vi.mock` déclenche « Cannot access X before initialization ».
  class TeamDescriptionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "TeamDescriptionError";
    }
  }
  return { TeamDescriptionError, updateTeamDescription: vi.fn() };
});

import {
  updateTeamDescription,
  TeamDescriptionError,
} from "../services/team-description";
import { handleUpdateTeamDescription } from "./team-description-handler";
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

function makeReq(
  description: string | null,
  userId = "user-1",
): AuthenticatedRequest {
  return {
    user: { id: userId },
    params: { id: "team-1" },
    body: { description },
  } as unknown as AuthenticatedRequest;
}

describe("handleUpdateTeamDescription", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renvoie l'équipe décrite (200)", async () => {
    vi.mocked(updateTeamDescription).mockResolvedValue({
      id: "team-1",
      description: "Bande de rats",
      previousDescription: null,
    });
    const res = makeRes();

    await handleUpdateTeamDescription(
      makeReq("Bande de rats"),
      res as unknown as Response,
    );

    expect(updateTeamDescription).toHaveBeenCalledWith({
      teamId: "team-1",
      ownerId: "user-1",
      description: "Bande de rats",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { team: { id: "team-1", description: "Bande de rats" } },
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("transmet un effacement (null) tel quel", async () => {
    vi.mocked(updateTeamDescription).mockResolvedValue({
      id: "team-1",
      description: null,
      previousDescription: "Ancien fluff",
    });

    await handleUpdateTeamDescription(
      makeReq(null),
      makeRes() as unknown as Response,
    );

    expect(updateTeamDescription).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("propage l'identité de l'appelant (pas d'édition cross-coach)", async () => {
    vi.mocked(updateTeamDescription).mockResolvedValue({
      id: "team-1",
      description: "X",
    });

    await handleUpdateTeamDescription(
      makeReq("X", "intrus"),
      makeRes() as unknown as Response,
    );

    expect(updateTeamDescription).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "intrus" }),
    );
  });

  it("404 quand l'équipe est introuvable / non possédée / supprimée", async () => {
    vi.mocked(updateTeamDescription).mockRejectedValue(
      new TeamDescriptionError("not_found", "Équipe introuvable"),
    );
    const res = makeRes();

    await handleUpdateTeamDescription(makeReq("X"), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Équipe introuvable" }),
    );
  });

  it("400 sur une description invalide, avec le message du service", async () => {
    vi.mocked(updateTeamDescription).mockRejectedValue(
      new TeamDescriptionError(
        "invalid_description",
        "La description ne peut pas dépasser 1000 caractères",
      ),
    );
    const res = makeRes();

    await handleUpdateTeamDescription(
      makeReq("x".repeat(1001)),
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "La description ne peut pas dépasser 1000 caractères",
      }),
    );
  });

  it("500 sur une erreur inattendue, sans fuiter le détail", async () => {
    vi.mocked(updateTeamDescription).mockRejectedValue(new Error("boom db"));
    const res = makeRes();

    await handleUpdateTeamDescription(makeReq("X"), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Erreur serveur" }),
    );
  });
});
