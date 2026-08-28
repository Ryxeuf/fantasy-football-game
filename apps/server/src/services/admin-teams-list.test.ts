/**
 * Filtre de la liste d'équipes admin — le défaut MASQUE les supprimées.
 */

import { describe, it, expect } from "vitest";

import {
  ADMIN_TEAMS_DELETED_SCOPES,
  buildAdminTeamsWhere,
} from "./admin-teams-list";

describe("buildAdminTeamsWhere", () => {
  it("masque les équipes supprimées par défaut (aucun paramètre)", () => {
    expect(buildAdminTeamsWhere({}, true)).toEqual({ deletedAt: null });
  });

  it("scope active : deletedAt null", () => {
    expect(buildAdminTeamsWhere({ deleted: "active" }, true)).toEqual({
      deletedAt: null,
    });
  });

  it("scope deleted : ne remonte QUE les équipes supprimées", () => {
    expect(buildAdminTeamsWhere({ deleted: "deleted" }, true)).toEqual({
      deletedAt: { not: null },
    });
  });

  it("scope all : aucune contrainte sur deletedAt", () => {
    const where = buildAdminTeamsWhere({ deleted: "all" }, true);
    expect(where.deletedAt).toBeUndefined();
    expect(where).toEqual({});
  });

  it("combine les filtres métier avec le scope", () => {
    expect(
      buildAdminTeamsWhere(
        {
          search: "Rats",
          roster: "skaven",
          ownerId: "u-1",
          ruleset: "season_3",
          deleted: "all",
        },
        true,
      ),
    ).toEqual({
      name: { contains: "Rats", mode: "insensitive" },
      roster: "skaven",
      ownerId: "u-1",
      ruleset: "season_3",
    });
  });

  it("omet `mode` quand la recherche insensible n'est pas supportée (SQLite)", () => {
    const where = buildAdminTeamsWhere({ search: "Rats" }, false);
    expect(where.name).toEqual({ contains: "Rats" });
  });

  it("ignore les filtres vides (chaînes par défaut du schéma Zod)", () => {
    expect(
      buildAdminTeamsWhere({ search: "", roster: "", ownerId: "" }, true),
    ).toEqual({ deletedAt: null });
  });

  it("expose les trois scopes supportés", () => {
    expect(ADMIN_TEAMS_DELETED_SCOPES).toEqual(["active", "deleted", "all"]);
  });
});
