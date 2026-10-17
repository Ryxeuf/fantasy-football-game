/**
 * Relance d'une ronde de COUPE : commissaire (ou admin) seulement, exempts
 * ignorés, vocabulaire « ronde », liens vers la coupe — et les mêmes règles
 * de ciblage que la journée d'une ligue.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./push-notifications", () => ({ sendPushToUser: vi.fn() }));
vi.mock("./mailer", () => ({ sendEmail: vi.fn() }));
vi.mock("./in-app-notifications", () => ({
  createInAppNotifications: vi.fn(),
  createInAppNotification: vi.fn(),
}));
vi.mock("../prisma", () => ({
  prisma: { cupRound: { findUnique: vi.fn() } },
}));

import { sendCupRoundFollowups } from "./cup-round-followup-notify";
import { CupRoundError } from "./cup-rounds";
import { sendEmail } from "./mailer";
import { createInAppNotifications } from "./in-app-notifications";
import { prisma } from "../prisma";

const mockEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockInApp = createInAppNotifications as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const NOW = new Date("2026-10-17T12:00:00.000Z");
const COMMISH = { userId: "commish", isAdmin: false };

const team = (ownerId: string, name: string, email: string | null = null) => ({
  ownerId,
  name,
  owner: { coachName: `Coach ${ownerId}`, email },
});

function cupRound(pairings: unknown[]) {
  return {
    id: "r-1",
    roundNumber: 2,
    cup: { id: "cup-1", name: "Coupe du Chaos", creatorId: "commish" },
    pairings,
  };
}

const UNSCHEDULED = {
  id: "p-1",
  status: "scheduled",
  scheduledAt: null,
  matchSheet: null,
  homeTeam: team("u-home", "Orcs", "home@example.com"),
  awayTeam: team("u-away", "Rats"),
};
const BYE = {
  id: "p-bye",
  status: "bye",
  scheduledAt: null,
  matchSheet: null,
  homeTeam: team("u-bye", "Nains"),
  awayTeam: null,
};
const DELIVERED = {
  id: "p-2",
  status: "scheduled",
  scheduledAt: new Date("2026-10-10T20:00:00.000Z"),
  matchSheet: { status: "both_submitted" },
  homeTeam: team("u-a", "Elfes"),
  awayTeam: team("u-b", "Hommes-Lézards"),
};

describe("sendCupRoundFollowups", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEmail.mockResolvedValue({ delivered: true });
  });

  it("relance les deux coachs d'une rencontre non planifiée, vers la coupe", async () => {
    mockPrisma.cupRound.findUnique.mockResolvedValue(
      cupRound([UNSCHEDULED, BYE, DELIVERED]),
    );
    const out = await sendCupRoundFollowups({
      roundId: "r-1",
      actor: COMMISH,
      baseUrl: "https://nuffle.test",
      now: NOW,
    });
    // L'exempt n'est pas une rencontre ; la feuille arrivée n'est pas relancée.
    expect(out.pairingsChecked).toBe(2);
    expect(out.reminders.map((r) => r.pairingId)).toEqual(["p-1"]);
    expect(out.coachesNotified).toBe(2);

    expect(mockInApp).toHaveBeenCalledTimes(1);
    const [userIds, payload] = mockInApp.mock.calls[0];
    expect(userIds).toEqual(["u-home", "u-away"]);
    expect(payload).toMatchObject({
      kind: "cup.round_followup",
      title: "Match non planifié — R2",
      url: "/cups/cup-1#ronde-2",
      meta: { cupId: "cup-1", roundId: "r-1", pairingId: "p-1", reason: "not_scheduled" },
    });
    expect(payload.body).toContain("de la ronde en cours");

    // E-mail au seul coach qui a une adresse, au vocabulaire de la coupe.
    expect(mockEmail).toHaveBeenCalledTimes(1);
    const mail = mockEmail.mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toBe("[Coupe du Chaos] R2 — Match non planifié");
    expect(mail.text).toContain("Coupe du Chaos — Ronde 2");
    expect(mail.text).toContain("Voir la ronde : https://nuffle.test/cups/cup-1#ronde-2");
  });

  it("est réservée au commissaire (ou à un admin)", async () => {
    mockPrisma.cupRound.findUnique.mockResolvedValue(cupRound([UNSCHEDULED]));
    await expect(
      sendCupRoundFollowups({ roundId: "r-1", actor: { userId: "u-home", isAdmin: false }, now: NOW }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const asAdmin = await sendCupRoundFollowups({
      roundId: "r-1",
      actor: { userId: "admin", isAdmin: true },
      now: NOW,
    });
    expect(asAdmin.reminders).toHaveLength(1);
  });

  it("répond « ronde introuvable »", async () => {
    mockPrisma.cupRound.findUnique.mockResolvedValue(null);
    await expect(
      sendCupRoundFollowups({ roundId: "nope", actor: COMMISH, now: NOW }),
    ).rejects.toBeInstanceOf(CupRoundError);
  });
});
