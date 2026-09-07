/**
 * Tests du service `cup-invitation-notify` — miroir de
 * `league-invitation-notify.test.ts`, centré sur le routage par cible et la
 * notification interne (in-app) ajoutée devant le push et l'e-mail.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./push-notifications", () => ({
  sendPushToUser: vi.fn(),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import {
  notifyInvitedCoach,
  buildJoinUrl,
  buildInAppUrl,
} from "./cup-invitation-notify";
import { sendPushToUser } from "./push-notifications";
import { sendEmail } from "./mailer";
import { createInAppNotification } from "./in-app-notifications";
import { prisma } from "../prisma";

const mockSendPush = sendPushToUser as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockInApp = createInAppNotification as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("cup-invitation-notify", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("cible userId : notification interne + push + e-mail", async () => {
    mockInApp.mockResolvedValue(null);
    mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: "coach@example.com" });
    mockSendEmail.mockResolvedValue({ delivered: true });

    await notifyInvitedCoach({
      invitation: { inviteeUserId: "user-1", code: "cup123", cupId: "cup-1" },
      cupName: "Nuffle Cup",
      baseUrl: "https://nuffle.test/",
    });

    expect(mockInApp).toHaveBeenCalledWith({
      userId: "user-1",
      kind: "cup.invitation",
      title: "Invitation à une coupe",
      body: "Tu es invité à rejoindre la coupe « Nuffle Cup »",
      url: "/cups/invitations/cup123",
      meta: { cupId: "cup-1", code: "cup123" },
    });
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].text).toContain(
      "https://nuffle.test/cups/invitations/cup123",
    );
  });

  it("cible e-mail seul : e-mail sans notification interne ni push", async () => {
    mockSendEmail.mockResolvedValue({ delivered: true });
    await notifyInvitedCoach({
      invitation: { inviteeEmail: "x@example.com", code: "c" },
      cupName: "Nuffle Cup",
    });
    expect(mockInApp).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("code public seul : aucun effet", async () => {
    await notifyInvitedCoach({ invitation: { code: "c" }, cupName: "N" });
    expect(mockInApp).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("ne throw jamais, même si tout échoue", async () => {
    mockInApp.mockRejectedValue(new Error("db"));
    mockSendPush.mockRejectedValue(new Error("push"));
    mockPrisma.user.findUnique.mockRejectedValue(new Error("lookup"));
    await expect(
      notifyInvitedCoach({
        invitation: { inviteeUserId: "u", code: "c" },
        cupName: "N",
      }),
    ).resolves.toBeUndefined();
  });

  it("helpers d'URL", () => {
    expect(buildJoinUrl("https://a.test/", "c")).toBe(
      "https://a.test/cups/invitations/c",
    );
    expect(buildJoinUrl(null, "c")).toBeNull();
    expect(buildInAppUrl("c")).toBe("/cups/invitations/c");
    expect(buildInAppUrl(null)).toBe("/cups");
  });
});
