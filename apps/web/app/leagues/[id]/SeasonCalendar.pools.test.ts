/**
 * FR5 — non-régression du groupement des pairings par poule dans le
 * calendrier de saison. Vérifie qu'on ne découpe que lorsqu'au moins deux
 * poules sont effectivement représentées dans la journée.
 */
import { describe, it, expect } from "vitest";
import { groupPairingsByPool } from "./SeasonCalendar";
import type { LeaguePairingDetail } from "./types";

function pairing(id: string, homeParticipantId: string): LeaguePairingDetail {
  return {
    id,
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: {
      id: homeParticipantId,
      teamId: `team-${homeParticipantId}`,
      team: { id: `team-${homeParticipantId}`, name: homeParticipantId, roster: "skaven", ownerId: "o" },
    },
    awayParticipant: {
      id: `away-${id}`,
      teamId: `team-away-${id}`,
      team: { id: `team-away-${id}`, name: `away-${id}`, roster: "orc", ownerId: "o2" },
    },
    match: null,
  };
}

describe("groupPairingsByPool", () => {
  const poolNames = { A: "Poule A", B: "Poule B" };

  it("retourne null sans poules définies", () => {
    expect(groupPairingsByPool([pairing("1", "p1")], {}, { p1: "A" })).toBeNull();
  });

  it("retourne null si une seule poule est représentée", () => {
    const groups = groupPairingsByPool(
      [pairing("1", "p1"), pairing("2", "p2")],
      poolNames,
      { p1: "A", p2: "A" },
    );
    expect(groups).toBeNull();
  });

  it("groupe par poule quand au moins deux poules sont présentes", () => {
    const groups = groupPairingsByPool(
      [pairing("1", "p1"), pairing("2", "p2"), pairing("3", "p3")],
      poolNames,
      { p1: "A", p2: "B", p3: "A" },
    );
    expect(groups).not.toBeNull();
    expect(groups!.map((g) => g.poolName)).toEqual(["Poule A", "Poule B"]);
    expect(groups!.find((g) => g.poolName === "Poule A")!.pairings).toHaveLength(2);
  });

  it("regroupe les non-affectés sous un groupe nul", () => {
    const groups = groupPairingsByPool(
      [pairing("1", "p1"), pairing("2", "p2")],
      poolNames,
      { p1: "A", p2: null },
    );
    expect(groups).not.toBeNull();
    const unassigned = groups!.find((g) => g.poolId === null);
    expect(unassigned).toBeTruthy();
    expect(unassigned!.poolName).toBeNull();
  });
});
