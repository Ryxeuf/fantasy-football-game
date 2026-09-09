/**
 * Envoi des relances d'une journée : autorisation (commissaire seul),
 * ciblage des DEUX coachs de chaque rencontre retenue, trois canaux, et
 * robustesse — un transport en panne ne doit pas priver les autres coachs
 * de leur relance.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./push-notifications", () => ({
  sendPushToUser: vi.fn(),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotifications: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    leagueRound: { findUnique: vi.fn() },
  },
}));

import {
  sendRoundFollowups,
  LeagueRoundFollowupError,
} from "./league-round-followup-notify";
import { REMINDER_BODIES } from "./league-round-followup";
import { sendPushToUser } from "./push-notifications";
import { sendEmail } from "./mailer";
import { createInAppNotifications } from "./in-app-notifications";
import { prisma } from "../prisma";

const mockPush = sendPushToUser as ReturnType<typeof vi.fn>;
const mockEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockInApp = createInAppNotifications as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const COMMISSIONER = "u-commish";
const NOW = new Date("2026-09-09T12:00:00.000Z");
const PAST = new Date("2026-09-01T20:30:00.000Z");
const FUTURE = new Date("2026-09-20T20:30:00.000Z");

function side(ownerId: string, name: string, email: string | null = null) {
  return {
    team: {
      ownerId,
      name,
      owner: { coachName: `Coach ${ownerId}`, email },
    },
  };
}

function round(pairings: unknown[], creatorId = COMMISSIONER) {
  return {
    id: "r-1",
    roundNumber: 3,
    season: {
      league: { id: "lg-1", name: "Ligue du Mordorbihan", creatorId },
    },
    pairings,
  };
}

/** Rencontre non planifiée : cas « match non planifié ». */
const UNSCHEDULED = {
  id: "p-unscheduled",
  status: "scheduled",
  scheduledAt: null,
  matchSheet: null,
  homeParticipant: side("u-home", "Reikland", "home@example.com"),
  awayParticipant: side("u-away", "Skavenblight", "away@example.com"),
};

/** Rencontre jouée sans feuille : cas « feuille attendue ». */
const OVERDUE = {
  id: "p-overdue",
  status: "scheduled",
  scheduledAt: PAST,
  matchSheet: { status: "draft" },
  homeParticipant: side("u-h2", "Naggaroth", "h2@example.com"),
  awayParticipant: side("u-a2", "Bögenhafen", "a2@example.com"),
};

/** Rencontre à venir : rien à relancer. */
const UPCOMING = {
  id: "p-upcoming",
  status: "scheduled",
  scheduledAt: FUTURE,
  matchSheet: null,
  homeParticipant: side("u-h3", "Altdorf", "h3@example.com"),
  awayParticipant: side("u-a3", "Nurgle", "a3@example.com"),
};

function run(extra: Record<string, unknown> = {}) {
  return sendRoundFollowups({
    roundId: "r-1",
    userId: COMMISSIONER,
    baseUrl: "https://nuffle.example",
    now: NOW,
    ...extra,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockInApp.mockResolvedValue(2);
  mockPush.mockResolvedValue({ sent: 1, failed: 0 });
  mockEmail.mockResolvedValue({ delivered: true });
});

describe("sendRoundFollowups — autorisation", () => {
  it("refuse une journée inconnue", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({
      code: "round_not_found",
    });
    await expect(run()).rejects.toBeInstanceOf(LeagueRoundFollowupError);
  });

  it("refuse un utilisateur qui n'est pas le commissaire", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(
      round([UNSCHEDULED], "someone-else"),
    );
    await expect(run()).rejects.toMatchObject({ code: "forbidden" });
    expect(mockEmail).not.toHaveBeenCalled();
    expect(mockInApp).not.toHaveBeenCalled();
  });
});

describe("sendRoundFollowups — ciblage", () => {
  it("relance les DEUX coachs d'une rencontre non planifiée", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UNSCHEDULED]));

    const result = await run();

    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0]).toMatchObject({
      pairingId: "p-unscheduled",
      reason: "not_scheduled",
      matchLabel: "Reikland vs Skavenblight",
      emailsDelivered: 2,
    });
    expect(result.coachesNotified).toBe(2);
    expect(mockInApp).toHaveBeenCalledWith(
      ["u-home", "u-away"],
      expect.objectContaining({
        kind: "league.round_followup",
        body: REMINDER_BODIES.not_scheduled,
        url: "/leagues/lg-1#journee-3",
      }),
    );
    expect(mockEmail.mock.calls.map((c) => c[0].to)).toEqual([
      "home@example.com",
      "away@example.com",
    ]);
  });

  it("écrit le bon message à chaque cas d'une même journée", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(
      round([UNSCHEDULED, OVERDUE, UPCOMING]),
    );

    const result = await run();

    expect(result.reminders.map((r) => [r.pairingId, r.reason])).toEqual([
      ["p-unscheduled", "not_scheduled"],
      ["p-overdue", "sheet_overdue"],
    ]);
    expect(result.pairingsChecked).toBe(3);
    expect(result.coachesNotified).toBe(4);
    const bodies = mockEmail.mock.calls.map((c) => c[0].text);
    expect(bodies.filter((b) => b.includes(REMINDER_BODIES.not_scheduled))).toHaveLength(2);
    expect(bodies.filter((b) => b.includes(REMINDER_BODIES.sheet_overdue))).toHaveLength(2);
  });

  it("ne relance rien quand la journée est en ordre", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UPCOMING]));

    const result = await run();

    expect(result.reminders).toEqual([]);
    expect(result.coachesNotified).toBe(0);
    expect(result.pairingsChecked).toBe(1);
    expect(mockInApp).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("n'écrit qu'une fois au coach qui possède les deux équipes", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(
      round([
        {
          ...UNSCHEDULED,
          homeParticipant: side("u-solo", "A", "solo@example.com"),
          awayParticipant: side("u-solo", "B", "solo@example.com"),
        },
      ]),
    );

    const result = await run();

    expect(result.coachesNotified).toBe(1);
    expect(mockInApp).toHaveBeenCalledWith(["u-solo"], expect.anything());
    expect(mockEmail).toHaveBeenCalledTimes(1);
  });

  it("porte le lien de la journée dans l'e-mail", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UNSCHEDULED]));

    await run();

    const { subject, text } = mockEmail.mock.calls[0][0];
    expect(subject).toBe("[Ligue du Mordorbihan] J3 — Match non planifié");
    expect(text).toContain("https://nuffle.example/leagues/lg-1#journee-3");
  });

  it("se passe du lien quand l'origine web est inconnue", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UNSCHEDULED]));

    await run({ baseUrl: null });

    expect(mockEmail.mock.calls[0][0].text).not.toContain("Voir la journée");
  });
});

describe("sendRoundFollowups — robustesse", () => {
  it("saute un coach sans adresse sans priver l'autre de son e-mail", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(
      round([
        {
          ...UNSCHEDULED,
          awayParticipant: side("u-away", "Skavenblight", null),
        },
      ]),
    );

    const result = await run();

    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(result.reminders[0].emailsDelivered).toBe(1);
    // Les deux gardent leur notification interne.
    expect(mockInApp).toHaveBeenCalledWith(
      ["u-home", "u-away"],
      expect.anything(),
    );
  });

  it("ne laisse pas un e-mail en erreur interrompre la relance", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(
      round([UNSCHEDULED, OVERDUE]),
    );
    mockEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const result = await run();

    expect(result.reminders).toHaveLength(2);
    expect(result.reminders[0].emailsDelivered).toBe(1);
    expect(result.reminders[1].emailsDelivered).toBe(2);
  });

  it("ne laisse pas un push en erreur interrompre la relance", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UNSCHEDULED]));
    mockPush.mockRejectedValue(new Error("no subscription"));

    const result = await run();

    expect(result.reminders).toHaveLength(1);
    expect(mockEmail).toHaveBeenCalledTimes(2);
  });

  it("compte les e-mails REELLEMENT acceptés par le transport", async () => {
    mockPrisma.leagueRound.findUnique.mockResolvedValue(round([UNSCHEDULED]));
    // Sans transport branché (dev/CI), `sendEmail` logge et ne délivre pas.
    mockEmail.mockResolvedValue({ delivered: false, reason: "no-transport" });

    const result = await run();

    expect(result.reminders[0].emailsDelivered).toBe(0);
  });
});
