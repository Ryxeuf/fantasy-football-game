/**
 * Date prévisionnelle d'une rencontre : autorisation (coachs impliqués /
 * commissaire), garde-fou sur le statut, écriture et notification des
 * autres coachs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(async () => ({ id: "n1" })),
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  schedulePairing,
  pairingScheduleRole,
  LeaguePairingScheduleError,
} from "./league-pairing-schedule";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  find: prisma.leaguePairing.findUnique as unknown as MockFn,
  update: prisma.leaguePairing.update as unknown as MockFn,
  notify: createInAppNotification as unknown as MockFn,
};

function pairingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pair-1",
    status: "scheduled",
    scheduledAt: null,
    round: {
      roundNumber: 3,
      season: { id: "season-1", league: { id: "league-1", creatorId: "commish" } },
    },
    homeParticipant: {
      team: { ownerId: "u-home", name: "Reikland", owner: { coachName: "Griff" } },
    },
    awayParticipant: {
      team: { ownerId: "u-away", name: "Skavenblight", owner: { coachName: null } },
    },
    ...overrides,
  };
}

const DATE = new Date("2026-09-12T18:30:00.000Z");

describe("pairingScheduleRole (pur)", () => {
  const base = { creatorId: "c", homeOwnerId: "h", awayOwnerId: "a" };
  it("reconnaît le commissaire, le coach domicile et le coach visiteur", () => {
    expect(pairingScheduleRole({ ...base, userId: "c" })).toBe("commissioner");
    expect(pairingScheduleRole({ ...base, userId: "h" })).toBe("home");
    expect(pairingScheduleRole({ ...base, userId: "a" })).toBe("away");
  });
  it("le commissaire-joueur est d'abord commissaire", () => {
    expect(
      pairingScheduleRole({ ...base, homeOwnerId: "c", userId: "c" }),
    ).toBe("commissioner");
  });
  it("refuse un tiers", () => {
    expect(pairingScheduleRole({ ...base, userId: "x" })).toBeNull();
  });
});

describe("schedulePairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.update.mockResolvedValue({ id: "pair-1" });
    mocked.notify.mockResolvedValue({ id: "n1" });
  });

  it("404 si la rencontre n'existe pas", async () => {
    mocked.find.mockResolvedValue(null);
    await expect(
      schedulePairing({ pairingId: "nope", userId: "u-home", scheduledAt: DATE }),
    ).rejects.toMatchObject({ code: "pairing_not_found" });
  });

  it("refuse un coach étranger à la rencontre", async () => {
    mocked.find.mockResolvedValue(pairingRow());
    await expect(
      schedulePairing({ pairingId: "pair-1", userId: "stranger", scheduledAt: DATE }),
    ).rejects.toBeInstanceOf(LeaguePairingScheduleError);
    expect(mocked.update).not.toHaveBeenCalled();
  });

  it("refuse une rencontre déjà jouée ou annulée", async () => {
    mocked.find.mockResolvedValue(pairingRow({ status: "played" }));
    await expect(
      schedulePairing({ pairingId: "pair-1", userId: "u-home", scheduledAt: DATE }),
    ).rejects.toMatchObject({ code: "pairing_closed" });
    mocked.find.mockResolvedValue(pairingRow({ status: "cancelled" }));
    await expect(
      schedulePairing({ pairingId: "pair-1", userId: "commish", scheduledAt: null }),
    ).rejects.toMatchObject({ code: "pairing_closed" });
  });

  it("le coach domicile pose la date : écriture + notification du seul adversaire", async () => {
    mocked.find.mockResolvedValue(pairingRow());
    const out = await schedulePairing({
      pairingId: "pair-1",
      userId: "u-home",
      scheduledAt: DATE,
    });
    expect(mocked.update).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: { scheduledAt: DATE },
      select: { id: true },
    });
    expect(out).toMatchObject({ actorRole: "home", scheduledAt: DATE, notified: 1 });
    expect(mocked.notify).toHaveBeenCalledTimes(1);
    const payload = mocked.notify.mock.calls[0][0];
    expect(payload.userId).toBe("u-away");
    expect(payload.kind).toBe("league.pairing_scheduled");
    expect(payload.url).toBe("/leagues/league-1");
    expect(payload.body).toContain("Griff");
    expect(payload.body).toContain("Reikland vs Skavenblight (J3)");
    expect(payload.meta).toMatchObject({ pairingId: "pair-1", leagueId: "league-1" });
  });

  it("le commissaire (non joueur) notifie les deux coachs", async () => {
    mocked.find.mockResolvedValue(pairingRow());
    const out = await schedulePairing({
      pairingId: "pair-1",
      userId: "commish",
      scheduledAt: DATE,
    });
    expect(out.actorRole).toBe("commissioner");
    expect(out.notified).toBe(2);
    const recipients = mocked.notify.mock.calls.map((c) => c[0].userId).sort();
    expect(recipients).toEqual(["u-away", "u-home"]);
    expect(mocked.notify.mock.calls[0][0].body).toContain("Le commissaire");
  });

  it("retirer la date (null) est accepté sur une rencontre en cours et le dit", async () => {
    mocked.find.mockResolvedValue(pairingRow({ status: "in_progress", scheduledAt: DATE }));
    const out = await schedulePairing({
      pairingId: "pair-1",
      userId: "u-away",
      scheduledAt: null,
    });
    expect(out.scheduledAt).toBeNull();
    expect(mocked.update).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: { scheduledAt: null },
      select: { id: true },
    });
    const payload = mocked.notify.mock.calls[0][0];
    expect(payload.userId).toBe("u-home");
    expect(payload.title).toBe("Date de rencontre retirée");
    // Coach sans pseudo : le nom de l'équipe fait foi.
    expect(payload.body).toContain("Skavenblight a retiré");
  });

  it("une notification en échec ne fait pas échouer la planification", async () => {
    mocked.find.mockResolvedValue(pairingRow());
    mocked.notify.mockResolvedValue(null);
    const out = await schedulePairing({
      pairingId: "pair-1",
      userId: "u-home",
      scheduledAt: DATE,
    });
    expect(out.notified).toBe(0);
    expect(mocked.update).toHaveBeenCalledTimes(1);
  });
});
