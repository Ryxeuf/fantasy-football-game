/**
 * Accès admin à l'édition d'équipe : le `where` s'élargit, le gel tombe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./team-lock-status", () => ({
  isTeamRosterFrozen: vi.fn(),
  TEAM_ENGAGED_MESSAGE: "engagée",
}));

import type { AuthenticatedRequest } from "../middleware/authUser";
import { isTeamRosterFrozen } from "./team-lock-status";
import {
  isAdminRequest,
  isRosterFrozenFor,
  teamAccessWhere,
} from "./team-edit-access";

const mockedFrozen = vi.mocked(isTeamRosterFrozen);

function reqAs(roles: string[]): AuthenticatedRequest {
  return {
    user: { id: "u-1", role: roles[0], roles },
  } as unknown as AuthenticatedRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isAdminRequest", () => {
  it("reconnaît le rôle admin dans `roles`", () => {
    expect(isAdminRequest(reqAs(["user", "admin"]))).toBe(true);
  });

  it("refuse un coach simple", () => {
    expect(isAdminRequest(reqAs(["user"]))).toBe(false);
  });

  it("retombe sur `role` quand `roles` est absent", () => {
    const req = { user: { id: "u-1", role: "admin" } } as unknown as
      AuthenticatedRequest;
    expect(isAdminRequest(req)).toBe(true);
  });

  it("refuse une requête sans utilisateur", () => {
    expect(isAdminRequest({} as AuthenticatedRequest)).toBe(false);
  });

  it("ne confond pas moderator avec admin", () => {
    expect(isAdminRequest(reqAs(["moderator"]))).toBe(false);
  });
});

describe("teamAccessWhere", () => {
  it("contraint le coach à ses propres équipes", () => {
    expect(teamAccessWhere(reqAs(["user"]), "team-1")).toEqual({
      id: "team-1",
      ownerId: "u-1",
    });
  });

  it("laisse l'admin atteindre n'importe quelle équipe", () => {
    expect(teamAccessWhere(reqAs(["admin"]), "team-1")).toEqual({
      id: "team-1",
    });
  });
});

describe("isRosterFrozenFor", () => {
  it("ne consulte même pas le gel pour un admin", async () => {
    await expect(isRosterFrozenFor(reqAs(["admin"]), "team-1")).resolves.toBe(
      false,
    );
    expect(mockedFrozen).not.toHaveBeenCalled();
  });

  it("applique le gel au coach", async () => {
    mockedFrozen.mockResolvedValueOnce(true);
    await expect(isRosterFrozenFor(reqAs(["user"]), "team-1")).resolves.toBe(
      true,
    );
    expect(mockedFrozen).toHaveBeenCalledWith("team-1");
  });

  it("laisse passer le coach quand l'équipe est en brouillon", async () => {
    mockedFrozen.mockResolvedValueOnce(false);
    await expect(isRosterFrozenFor(reqAs(["user"]), "team-1")).resolves.toBe(
      false,
    );
  });
});
