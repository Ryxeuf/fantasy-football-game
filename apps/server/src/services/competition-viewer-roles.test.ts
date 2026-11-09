import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueParticipant: { findMany: vi.fn() },
    leagueSeason: { groupBy: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  buildCupViewerRoles,
  loadLeagueViewerRoles,
} from "./competition-viewer-roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const ME = "u-me";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadLeagueViewerRoles", () => {
  it("UNE requête de participations + UN groupBy pour toute la page (pas de N+1)", async () => {
    db.leagueParticipant.findMany.mockResolvedValue([
      // l1 : je suis commissaire ET je joue la saison courante (2).
      { status: "active", team: { id: "t1", name: "Gobs" }, season: { leagueId: "l1", seasonNumber: 2 } },
      // l2 : j'ai joué la saison 1, la saison 2 existe sans moi.
      { status: "active", team: { id: "t1", name: "Gobs" }, season: { leagueId: "l2", seasonNumber: 1 } },
      // l3 : retiré de la saison courante.
      { status: "withdrawn", team: { id: "t2", name: "Orcs" }, season: { leagueId: "l3", seasonNumber: 1 } },
    ]);
    db.leagueSeason.groupBy.mockResolvedValue([
      { leagueId: "l1", _max: { seasonNumber: 2 } },
      { leagueId: "l2", _max: { seasonNumber: 2 } },
      { leagueId: "l3", _max: { seasonNumber: 1 } },
      { leagueId: "l4", _max: { seasonNumber: 3 } },
    ]);

    const roles = await loadLeagueViewerRoles(ME, [
      { id: "l1", creatorId: ME },
      { id: "l2", creatorId: "other" },
      { id: "l3", creatorId: "other" },
      { id: "l4", creatorId: "other" },
    ]);

    expect(db.leagueParticipant.findMany).toHaveBeenCalledTimes(1);
    expect(db.leagueSeason.groupBy).toHaveBeenCalledTimes(1);
    expect(db.leagueParticipant.findMany.mock.calls[0][0].where).toEqual({
      team: { ownerId: ME },
      season: { leagueId: { in: ["l1", "l2", "l3", "l4"] } },
    });
    expect(roles.get("l1")).toEqual({
      commissioner: true,
      participant: "active",
      teams: [{ id: "t1", name: "Gobs" }],
    });
    expect(roles.get("l2")).toEqual({
      commissioner: false,
      participant: "former",
      teams: [],
    });
    expect(roles.get("l3")).toEqual({
      commissioner: false,
      participant: "withdrawn",
      teams: [],
    });
    // Tiers sur une ligue publique.
    expect(roles.get("l4")).toEqual({
      commissioner: false,
      participant: null,
      teams: [],
    });
  });

  it("page vide : aucune requête", async () => {
    const roles = await loadLeagueViewerRoles(ME, []);
    expect(roles.size).toBe(0);
    expect(db.leagueParticipant.findMany).not.toHaveBeenCalled();
    expect(db.leagueSeason.groupBy).not.toHaveBeenCalled();
  });

  it("sans lecteur : rôles vides, aucune requête", async () => {
    const roles = await loadLeagueViewerRoles(undefined, [
      { id: "l1", creatorId: "x" },
    ]);
    expect(roles.get("l1")).toEqual({
      commissioner: false,
      participant: null,
      teams: [],
    });
    expect(db.leagueParticipant.findMany).not.toHaveBeenCalled();
  });
});

describe("buildCupViewerRoles", () => {
  const cup = {
    id: "c1",
    creatorId: "creator",
    participants: [
      { team: { id: "t1", name: "Gobs", owner: { id: ME } } },
      { team: { id: "t9", name: "Elfes", owner: { id: "other" } } },
    ],
  };

  it("inscrit : participant actif avec ses équipes", () => {
    expect(buildCupViewerRoles(ME, cup)).toEqual({
      commissioner: false,
      participant: "active",
      teams: [{ id: "t1", name: "Gobs" }],
    });
  });

  it("créateur sans équipe", () => {
    expect(buildCupViewerRoles("creator", cup)).toEqual({
      commissioner: true,
      participant: null,
      teams: [],
    });
  });

  it("tiers", () => {
    expect(buildCupViewerRoles("stranger", cup)).toEqual({
      commissioner: false,
      participant: null,
      teams: [],
    });
  });
});
