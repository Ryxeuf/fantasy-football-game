import { describe, it, expect } from "vitest";
import { buildCupListWhere } from "./cup-listing";

describe("buildCupListWhere", () => {
  it("liste les coupes publiques quel que soit leur statut (hors archive)", () => {
    // Régression : seules les coupes publiques `ouverte` étaient listées, une
    // coupe validée (`en_cours`) ou terminée disparaissait de /cups.
    const where = buildCupListWhere({
      userId: "u1",
      userTeamIds: [],
      showAll: false,
    });
    expect(where).toEqual({
      status: { not: "archivee" },
      OR: [{ isPublic: true }, { creatorId: "u1" }],
    });
  });

  it("ajoute les coupes où l'utilisateur a une équipe inscrite", () => {
    const where = buildCupListWhere({
      userId: "u1",
      userTeamIds: ["t1", "t2"],
      showAll: false,
    });
    expect(where).toEqual({
      status: { not: "archivee" },
      OR: [
        { isPublic: true },
        { creatorId: "u1" },
        { participants: { some: { teamId: { in: ["t1", "t2"] } } } },
      ],
    });
  });

  it("le créateur voit sa coupe privée même sans équipe inscrite", () => {
    const where = buildCupListWhere({
      userId: "creator",
      userTeamIds: [],
      showAll: false,
    }) as { OR: unknown[] };
    expect(where.OR).toContainEqual({ creatorId: "creator" });
  });

  it("la vue admin ne filtre rien", () => {
    expect(
      buildCupListWhere({ userId: "a", userTeamIds: ["t"], showAll: true }),
    ).toEqual({});
  });
});
