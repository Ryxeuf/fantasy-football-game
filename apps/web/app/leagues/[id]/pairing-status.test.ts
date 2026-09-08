import { describe, it, expect } from "vitest";
import {
  canSchedulePairing,
  formatPlannedDate,
  fromDateTimeLocalValue,
  isPairingPlanned,
  toDateTimeLocalValue,
} from "./pairing-status";

const pairing = {
  status: "scheduled",
  scheduledAt: null as string | null,
  homeParticipant: {
    id: "p1",
    teamId: "t1",
    team: { id: "t1", name: "Reikland", roster: "human", ownerId: "o1" },
  },
  awayParticipant: {
    id: "p2",
    teamId: "t2",
    team: { id: "t2", name: "Skavenblight", roster: "skaven", ownerId: "o2" },
  },
};

describe("isPairingPlanned", () => {
  it("est vrai pour une rencontre à jouer avec une date", () => {
    expect(
      isPairingPlanned({ status: "scheduled", scheduledAt: "2026-09-12T18:30:00.000Z" }),
    ).toBe(true);
  });
  it("est faux sans date ou une fois jouée", () => {
    expect(isPairingPlanned({ status: "scheduled", scheduledAt: null })).toBe(false);
    expect(
      isPairingPlanned({ status: "played", scheduledAt: "2026-09-12T18:30:00.000Z" }),
    ).toBe(false);
  });
});

describe("formatPlannedDate", () => {
  it("rend une date lisible et tolère l'illisible", () => {
    const label = formatPlannedDate("2026-09-12T18:30:00.000Z", "fr");
    expect(label).toMatch(/2026/);
    expect(formatPlannedDate(null, "fr")).toBeNull();
    expect(formatPlannedDate("pas-une-date", "fr")).toBeNull();
  });
});

describe("canSchedulePairing", () => {
  it("autorise les deux coachs et le commissaire", () => {
    expect(canSchedulePairing({ pairing, currentUserId: "o1", isCommissioner: false })).toBe(true);
    expect(canSchedulePairing({ pairing, currentUserId: "o2", isCommissioner: false })).toBe(true);
    expect(canSchedulePairing({ pairing, currentUserId: "zz", isCommissioner: true })).toBe(true);
  });
  it("refuse un tiers et un anonyme", () => {
    expect(canSchedulePairing({ pairing, currentUserId: "zz", isCommissioner: false })).toBe(false);
    expect(canSchedulePairing({ pairing, currentUserId: null, isCommissioner: false })).toBe(false);
  });
  it("refuse une rencontre jouée ou annulée, même au commissaire", () => {
    expect(
      canSchedulePairing({
        pairing: { ...pairing, status: "played" },
        currentUserId: "o1",
        isCommissioner: true,
      }),
    ).toBe(false);
    expect(
      canSchedulePairing({
        pairing: { ...pairing, status: "cancelled" },
        currentUserId: "o1",
        isCommissioner: true,
      }),
    ).toBe(false);
  });
});

describe("datetime-local <-> ISO", () => {
  it("fait l'aller-retour sur une date valide", () => {
    const iso = "2026-09-12T18:30:00.000Z";
    const local = toDateTimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDateTimeLocalValue(local)).toBe(iso);
  });
  it("renvoie vide / null pour l'absence de date", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("n'importe quoi")).toBeNull();
  });
});
