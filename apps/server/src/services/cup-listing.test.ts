import { describe, it, expect } from "vitest";
import {
  buildArchivedCupListWhere,
  buildCupListWhere,
  cupVisibleClauses,
} from "./cup-listing";
import { cupMineWhere } from "./competition-membership";

describe("buildCupListWhere", () => {
  it("liste les coupes publiques quel que soit leur statut (hors archive) + les miennes", () => {
    // Régression : seules les coupes publiques `ouverte` étaient listées, une
    // coupe validée (`en_cours`) ou terminée disparaissait de /cups.
    const where = buildCupListWhere({ userId: "u1", showAll: false });
    expect(where).toEqual({
      status: { not: "archivee" },
      OR: [
        { isPublic: true },
        { creatorId: "u1" },
        { participants: { some: { team: { ownerId: "u1" } } } },
      ],
    });
  });

  it("une équipe SUPPRIMÉE compte : le filtre suit la relation, sans `deletedAt`", () => {
    // Coupe privée jouée avec une équipe supprimée depuis : listée.
    const where = buildCupListWhere({ userId: "u1", showAll: false });
    expect(JSON.stringify(where)).not.toContain("deletedAt");
    expect(where.OR).toContainEqual({
      participants: { some: { team: { ownerId: "u1" } } },
    });
  });

  it("le créateur voit sa coupe privée même sans équipe inscrite", () => {
    const where = buildCupListWhere({ userId: "creator", showAll: false }) as {
      OR: unknown[];
    };
    expect(where.OR).toContainEqual({ creatorId: "creator" });
  });

  it("« à moi » ⊆ « visible »", () => {
    for (const clause of cupMineWhere("u1").OR) {
      expect(cupVisibleClauses("u1")).toContainEqual(clause);
    }
  });

  it("la vue admin ne filtre rien", () => {
    expect(buildCupListWhere({ userId: "a", showAll: true })).toEqual({});
  });

  it("scope=mine : « à moi » sans clause de visibilité, hors archives", () => {
    expect(
      buildCupListWhere({ userId: "u1", showAll: false, scope: "mine" }),
    ).toEqual({ status: { not: "archivee" }, ...cupMineWhere("u1") });
  });

  it("scope=mine en vue admin : les siennes, archivées comprises", () => {
    expect(
      buildCupListWhere({ userId: "u1", showAll: true, scope: "mine" }),
    ).toEqual(cupMineWhere("u1"));
  });
});

describe("buildArchivedCupListWhere", () => {
  it("archivées « à moi » seulement, équipe supprimée comprise", () => {
    expect(buildArchivedCupListWhere("u1")).toEqual({
      status: "archivee",
      OR: [
        { creatorId: "u1" },
        { participants: { some: { team: { ownerId: "u1" } } } },
      ],
    });
  });
});
