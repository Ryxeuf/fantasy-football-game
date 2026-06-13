import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../prisma", () => ({
  prisma: {
    emailDigestPreference: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn() },
    team: { findMany: vi.fn().mockResolvedValue([]) },
    match: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true }),
}));

vi.mock("./pro-gazette", () => ({
  listLatestEdition: vi.fn().mockResolvedValue(null),
}));

import { runWeeklyDigest } from "./weekly-digest-job";
import { prisma } from "../prisma";
import { sendEmail } from "./mailer";

const now = new Date("2026-06-13T12:00:00Z");

function mockUser(id: string, email: string | null) {
  return { email, coachName: `coach-${id}` };
}

describe("runWeeklyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    vi.mocked(prisma.match.count).mockResolvedValue(0);
    vi.mocked(prisma.emailDigestPreference.update).mockResolvedValue({});
    vi.mocked(sendEmail).mockResolvedValue({ delivered: true });
  });

  it("sends to opt-in recipients and marks them sent (idempotence)", async () => {
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: null },
    ]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser("u1", "u1@test"),
    );

    const result = await runWeeklyDigest({ now });

    expect(result).toEqual({ selected: 1, sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u1@test" }),
    );
    // lastSentAt updated → guards against double-send.
    expect(prisma.emailDigestPreference.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { lastSentAt: now },
    });
  });

  it("skips recipients already sent within the idempotence window", async () => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: recent },
    ]);

    const result = await runWeeklyDigest({ now });

    expect(result.selected).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.emailDigestPreference.update).not.toHaveBeenCalled();
  });

  it("force mode (windowMs=0) re-sends even if recently sent", async () => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: recent },
    ]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser("u1", "u1@test"),
    );

    const result = await runWeeklyDigest({ now, windowMs: 0 });

    expect(result.selected).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("marks-sent but does not e-mail a user without an address", async () => {
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: null },
    ]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser("u1", null));

    const result = await runWeeklyDigest({ now });

    expect(result).toEqual({ selected: 1, sent: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.emailDigestPreference.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { lastSentAt: now },
    });
  });

  it("counts a non-delivered mail (no transport) as failed but still marks sent", async () => {
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: null },
    ]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      mockUser("u1", "u1@test"),
    );
    vi.mocked(sendEmail).mockResolvedValue({
      delivered: false,
      reason: "no-transport",
    });

    const result = await runWeeklyDigest({ now });

    expect(result).toEqual({ selected: 1, sent: 0, failed: 1 });
    expect(prisma.emailDigestPreference.update).toHaveBeenCalledTimes(1);
  });

  it("processes multiple recipients independently", async () => {
    vi.mocked(prisma.emailDigestPreference.findMany).mockResolvedValue([
      { userId: "u1", enabled: true, lastSentAt: null },
      { userId: "u2", enabled: true, lastSentAt: null },
    ]);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(mockUser("u1", "u1@test"))
      .mockResolvedValueOnce(mockUser("u2", "u2@test"));

    const result = await runWeeklyDigest({ now });

    expect(result.selected).toBe(2);
    expect(result.sent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
