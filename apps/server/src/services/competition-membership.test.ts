import { describe, it, expect } from "vitest";
import {
  buildViewerRoles,
  cupMineWhere,
  leagueMineWhere,
  type BuildViewerRolesInput,
} from "./competition-membership";

describe("leagueMineWhere / cupMineWhere", () => {
  it("ligue : créateur OU propriétaire d'une équipe inscrite à une saison", () => {
    expect(leagueMineWhere("u1")).toEqual({
      OR: [
        { creatorId: "u1" },
        {
          seasons: {
            some: { participants: { some: { team: { ownerId: "u1" } } } },
          },
        },
      ],
    });
  });

  it("coupe : créateur OU propriétaire d'une équipe inscrite", () => {
    expect(cupMineWhere("u1")).toEqual({
      OR: [
        { creatorId: "u1" },
        { participants: { some: { team: { ownerId: "u1" } } } },
      ],
    });
  });

  it("aucun filtre de statut d'inscription ni d'équipe supprimée ; ni invitation, ni rôle admin", () => {
    for (const where of [leagueMineWhere("u1"), cupMineWhere("u1")]) {
      const json = JSON.stringify(where);
      // Retrait compris : pas de filtre sur le statut de l'inscription.
      expect(json).not.toContain("status");
      // Équipe supprimée comprise : pas de filtre `deletedAt`.
      expect(json).not.toContain("deletedAt");
      // Une invitation en attente ne rend pas la compétition « à moi ».
      expect(json).not.toContain("invitation");
      expect(json).not.toContain("isPublic");
    }
  });
});

function roles(over: Partial<BuildViewerRolesInput> = {}) {
  return buildViewerRoles({
    viewerId: "u1",
    creatorId: "u-other",
    currentEdition: 2,
    participations: [],
    ...over,
  });
}

const TEAM = { id: "t1", name: "Les Gobs" };

describe("buildViewerRoles", () => {
  it.each([
    ["commissaire seul", { creatorId: "u1" }, { commissioner: true, participant: null, teams: [] }],
    [
      "commissaire qui joue",
      { creatorId: "u1", participations: [{ edition: 2, status: "active", team: TEAM }] },
      { commissioner: true, participant: "active", teams: [TEAM] },
    ],
    [
      "joueur retiré de la saison courante",
      { participations: [{ edition: 2, status: "withdrawn", team: TEAM }] },
      { commissioner: false, participant: "withdrawn", teams: [] },
    ],
    [
      "saison passée seulement",
      { participations: [{ edition: 1, status: "active", team: TEAM }] },
      { commissioner: false, participant: "former", teams: [] },
    ],
    [
      // L'équipe supprimée garde sa participation (la requête ne filtre pas
      // `deletedAt`) : le rôle se tranche comme pour une autre.
      "équipe supprimée ayant joué l'édition courante",
      { participations: [{ edition: 2, status: "active", team: { id: "t-del", name: "Dissoute" } }] },
      { commissioner: false, participant: "active", teams: [{ id: "t-del", name: "Dissoute" }] },
    ],
    ["invité seulement (aucune inscription)", {}, { commissioner: false, participant: null, teams: [] }],
    ["admin non membre", { viewerId: "u-admin" }, { commissioner: false, participant: null, teams: [] }],
    ["anonyme", { viewerId: null }, { commissioner: false, participant: null, teams: [] }],
  ] as const)("%s", (_label, over, expected) => {
    expect(roles(over as Partial<BuildViewerRolesInput>)).toEqual(expected);
  });

  it("deux équipes à l'édition courante, une retirée : active avec la seule engagée", () => {
    expect(
      roles({
        participations: [
          { edition: 2, status: "withdrawn", team: TEAM },
          { edition: 2, status: "active", team: { id: "t2", name: "Les Orques" } },
          { edition: 1, status: "active", team: TEAM },
        ],
      }),
    ).toEqual({
      commissioner: false,
      participant: "active",
      teams: [{ id: "t2", name: "Les Orques" }],
    });
  });
});
