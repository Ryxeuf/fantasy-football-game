/**
 * Phase 6 — A2 : tests du service `league-invitation-notify`.
 *
 * Mock `push-notifications`, `mailer` et `prisma` pour vérifier le
 * routage par type de cible et la robustesse (ne throw jamais).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./push-notifications", () => ({
  sendPushToUser: vi.fn(),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { notifyInvitedCoach, buildJoinUrl } from "./league-invitation-notify";
import { sendPushToUser } from "./push-notifications";
import { sendEmail } from "./mailer";
import { prisma } from "../prisma";

const mockSendPush = sendPushToUser as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("A2 — league-invitation-notify service", () => {
  beforeEach(() => {
    // resetAllMocks vide aussi la queue mockResolvedValueOnce.
    vi.resetAllMocks();
  });

  describe("targeted by userId", () => {
    it("sends push and email when the user has an address", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeUserId: "user-1", code: "abc123" },
        leagueName: "Skaven Cup",
      });

      expect(mockSendPush).toHaveBeenCalledTimes(1);
      const [pushUserId, pushPayload] = mockSendPush.mock.calls[0];
      expect(pushUserId).toBe("user-1");
      expect(pushPayload.title).toBe("Invitation à une ligue");
      expect(pushPayload.body).toContain("Skaven Cup");

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.to).toBe("coach@example.com");
      expect(emailMsg.subject).toBe("Invitation à une ligue");
      expect(emailMsg.text).toContain("Skaven Cup");
      // Le code d'invitation est inclus quand présent.
      expect(emailMsg.text).toContain("abc123");
    });

    it("sends push but no email when the user has no address", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: null,
        coachName: "Griff",
      });

      await notifyInvitedCoach({
        invitation: { inviteeUserId: "user-1" },
        leagueName: "Skaven Cup",
      });

      expect(mockSendPush).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("omits the invitation code from the email when absent", async () => {
      mockSendPush.mockResolvedValue({ sent: 0, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeUserId: "user-1", code: null },
        leagueName: "Skaven Cup",
      });

      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.text).not.toContain("Code d'invitation");
    });
  });

  describe("targeted by email only", () => {
    it("sends an email and never calls push", async () => {
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeEmail: "outside@example.com", code: "xyz789" },
        leagueName: "Orc League",
      });

      expect(mockSendPush).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.to).toBe("outside@example.com");
      expect(emailMsg.text).toContain("Orc League");
      expect(emailMsg.text).toContain("xyz789");
    });

    it("prioritizes userId over email when both are set", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "registered@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: {
          inviteeUserId: "user-1",
          inviteeEmail: "ignored@example.com",
        },
        leagueName: "Dwarf League",
      });

      expect(mockSendPush).toHaveBeenCalledTimes(1);
      // L'e-mail part vers l'adresse du user, pas l'inviteeEmail.
      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.to).toBe("registered@example.com");
    });
  });

  describe("no target", () => {
    it("does nothing for a code-only public invitation", async () => {
      await notifyInvitedCoach({
        invitation: { code: "public-code" },
        leagueName: "Open League",
      });

      expect(mockSendPush).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("does nothing when no targeting fields at all", async () => {
      await notifyInvitedCoach({
        invitation: {},
        leagueName: "Open League",
      });

      expect(mockSendPush).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("join link in the email (baseUrl)", () => {
    it("buildJoinUrl assembles the public acceptance URL and trims trailing slashes", () => {
      expect(buildJoinUrl("https://web.test", "abc123")).toBe(
        "https://web.test/leagues/invitations/abc123",
      );
      expect(buildJoinUrl("https://web.test/", "abc123")).toBe(
        "https://web.test/leagues/invitations/abc123",
      );
    });

    it("buildJoinUrl returns null when baseUrl or code is missing", () => {
      expect(buildJoinUrl(null, "abc")).toBeNull();
      expect(buildJoinUrl("https://web.test", null)).toBeNull();
      expect(buildJoinUrl(undefined, undefined)).toBeNull();
    });

    it("includes the clickable join link in the email when baseUrl is provided (userId target)", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeUserId: "user-1", code: "abc123" },
        leagueName: "Skaven Cup",
        baseUrl: "https://web.test",
      });

      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.text).toContain(
        "https://web.test/leagues/invitations/abc123",
      );
      // Le code reste mentionné en repli pour la saisie manuelle.
      expect(emailMsg.text).toContain("abc123");
    });

    it("includes the link for an email-only target too", async () => {
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeEmail: "outside@example.com", code: "xyz789" },
        leagueName: "Orc League",
        baseUrl: "https://web.test",
      });

      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.text).toContain(
        "https://web.test/leagues/invitations/xyz789",
      );
    });

    it("falls back to code-only (no link) when baseUrl is absent", async () => {
      mockSendPush.mockResolvedValue({ sent: 0, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await notifyInvitedCoach({
        invitation: { inviteeUserId: "user-1", code: "abc123" },
        leagueName: "Skaven Cup",
      });

      const [emailMsg] = mockSendEmail.mock.calls[0];
      expect(emailMsg.text).not.toContain("/leagues/invitations/");
      expect(emailMsg.text).toContain("Code d'invitation : abc123");
    });
  });

  describe("robustness — never throws", () => {
    it("resolves even when sendPushToUser throws", async () => {
      mockSendPush.mockRejectedValue(new Error("push transport down"));
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockResolvedValue({ delivered: true });

      await expect(
        notifyInvitedCoach({
          invitation: { inviteeUserId: "user-1" },
          leagueName: "Skaven Cup",
        }),
      ).resolves.toBeUndefined();

      // L'e-mail est tout de même tenté malgré l'échec du push.
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("resolves even when sendEmail throws", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: "coach@example.com",
        coachName: "Griff",
      });
      mockSendEmail.mockRejectedValue(new Error("smtp boom"));

      await expect(
        notifyInvitedCoach({
          invitation: { inviteeUserId: "user-1" },
          leagueName: "Skaven Cup",
        }),
      ).resolves.toBeUndefined();
    });

    it("resolves even when the prisma lookup throws", async () => {
      mockSendPush.mockResolvedValue({ sent: 1, failed: 0 });
      mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));

      await expect(
        notifyInvitedCoach({
          invitation: { inviteeUserId: "user-1" },
          leagueName: "Skaven Cup",
        }),
      ).resolves.toBeUndefined();

      // Le push a quand même été tenté avant le lookup e-mail.
      expect(mockSendPush).toHaveBeenCalledTimes(1);
    });

    it("resolves even when the email-only path throws", async () => {
      mockSendEmail.mockRejectedValue(new Error("smtp boom"));

      await expect(
        notifyInvitedCoach({
          invitation: { inviteeEmail: "outside@example.com" },
          leagueName: "Orc League",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
