/**
 * Tests pour le service `getProPlayerDetail` (Lot G).
 *
 * Couvre :
 *   - happy path : tous les champs (stats, bonuses, progression, career,
 *     skillAccess, team) sont correctement remontés.
 *   - 404 : `ProPlayerNotFoundError` si l'id n'existe pas.
 *   - Recompute legacy : level recompute depuis spp si la colonne level
 *     n'a pas été migrée.
 *   - Position inconnue : fallback sur l'accès Lineman.
 *   - Fallback null sur colonnes optionnelles.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  ProPlayerNotFoundError,
  getProPlayerDetail,
} from "./pro-player-detail";

interface MockedPrisma {
  proTeamRoster: { findUnique: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

const FAKE_TEAM = {
  slug: "buf-snow-ogres",
  name: "Snow Ogres",
  city: "Buffalo",
  race: "Ogre",
  primaryColor: "#00338D",
};

describe("getProPlayerDetail — Lot G", () => {
  it("retourne 404 si l'id n'existe pas", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce(null);
    await expect(getProPlayerDetail("missing")).rejects.toThrow(
      ProPlayerNotFoundError,
    );
  });

  it("retourne tous les champs pour un Blitzer level 3", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p1",
      name: "Veteran",
      position: "Blitzer",
      ma: 6,
      st: 4,
      ag: 3,
      pa: 4,
      av: 10,
      skills: ["block", "tackle"],
      status: "active",
      form: 60,
      niggling: 0,
      spp: 25,
      level: 3,
      tvCached: 110000,
      tdCount: 5,
      casCount: 2,
      compCount: 0,
      mvpCount: 1,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p1");
    expect(out.id).toBe("p1");
    expect(out.name).toBe("Veteran");
    expect(out.position).toBe("Blitzer");
    expect(out.skills).toEqual(["block", "tackle"]);
    expect(out.stats).toEqual({ ma: 6, st: 4, ag: 3, pa: 4, av: 10 });
    expect(out.statBonuses).toEqual({ ma: 0, st: 0, ag: 0, pa: 0, av: 0 });
    expect(out.progression).toEqual({
      level: 3,
      spp: 25,
      nextLevelSpp: 31,
      readyToLevelUp: false,
      tv: 110000,
    });
    expect(out.career).toEqual({
      tdCount: 5,
      casCount: 2,
      compCount: 0,
      mvpCount: 1,
    });
    // Blitzer → primary G+S, secondary A
    expect(out.skillAccess.primary).toEqual(["G", "S"]);
    expect(out.skillAccess.secondary).toEqual(["A"]);
    expect(out.team).toEqual({
      slug: "buf-snow-ogres",
      name: "Snow Ogres",
      city: "Buffalo",
      race: "Ogre",
      primaryColor: "#00338D",
    });
  });

  it("recompute le level si la colonne level est en retard (legacy)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_legacy",
      name: "Legacy",
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status: "active",
      form: 50,
      niggling: 0,
      spp: 50, // 50 SPP ⇒ level 4
      level: 1, // legacy : non MAJ
      tvCached: 50000,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_legacy");
    expect(out.progression.level).toBe(4);
  });

  it("expose stat bonuses non-zero (Lot 4.D.1)", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_star",
      name: "Star",
      position: "Catcher",
      ma: 8,
      st: 2,
      ag: 4,
      pa: null,
      av: 8,
      skills: ["dodge", "catch"],
      status: "active",
      form: 70,
      niggling: 0,
      spp: 80,
      level: 5,
      tvCached: 130000,
      tdCount: 12,
      casCount: 1,
      compCount: 3,
      mvpCount: 2,
      maBonus: 1,
      stBonus: 0,
      agBonus: 1,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_star");
    expect(out.statBonuses).toEqual({ ma: 1, st: 0, ag: 1, pa: 0, av: 0 });
    // Catcher → primary G+A, secondary S+M (selon table BB)
    expect(out.skillAccess.primary).toEqual(["G", "A"]);
  });

  it("position inconnue → fallback sur l'accès Lineman", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_unknown",
      name: "Mystery",
      position: "GhostWalker",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status: "active",
      form: 50,
      niggling: 0,
      spp: 0,
      level: 1,
      tvCached: 50000,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_unknown");
    expect(out.skillAccess.primary).toEqual(["G"]);
    expect(out.skillAccess.secondary).toEqual(["A", "S", "P"]);
  });

  it("fallback sur valeurs par défaut quand colonnes nulles", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_old",
      name: "Old",
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status: null,
      form: null,
      niggling: null,
      spp: null,
      level: null,
      tvCached: null,
      tdCount: null,
      casCount: null,
      compCount: null,
      mvpCount: null,
      maBonus: null,
      stBonus: null,
      agBonus: null,
      paBonus: null,
      avBonus: null,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_old");
    expect(out.status).toBe("active");
    expect(out.form).toBe(50);
    expect(out.niggling).toBe(0);
    expect(out.progression.spp).toBe(0);
    expect(out.progression.level).toBe(1);
    expect(out.progression.nextLevelSpp).toBe(6);
    expect(out.progression.tv).toBe(50000);
    expect(out.career).toEqual({
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
    });
  });

  it("Lot K — readyToLevelUp=true quand l'applier est en retard", async () => {
    // 50 SPP ⇒ levelForSpp=4. DB level=2 (sweep en retard de 2 paliers).
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_lag",
      name: "Lagging",
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status: "active",
      form: 50,
      niggling: 0,
      spp: 50,
      level: 2,
      tvCached: 50000,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_lag");
    expect(out.progression.readyToLevelUp).toBe(true);
    // level affiché = max(rawDb=2, computed=4) = 4
    expect(out.progression.level).toBe(4);
  });

  it("Lot K — readyToLevelUp=false quand DB level synchro avec spp", async () => {
    mocked.proTeamRoster.findUnique.mockResolvedValueOnce({
      id: "p_sync",
      name: "Synchro",
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status: "active",
      form: 50,
      niggling: 0,
      spp: 25,
      level: 3, // levelForSpp(25) = 3 → pas de retard
      tvCached: 60000,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
      team: FAKE_TEAM,
    });
    const out = await getProPlayerDetail("p_sync");
    expect(out.progression.readyToLevelUp).toBe(false);
  });
});
