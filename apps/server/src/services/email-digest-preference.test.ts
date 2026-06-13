import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    emailDigestPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Real token module (pure) — we drive a known secret via env.
process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret";

import {
  getEmailDigestPreference,
  setEmailDigestPreference,
  unsubscribeByToken,
} from "./email-digest-preference";
import { buildUnsubscribeToken } from "./email-unsubscribe-token";
import { prisma } from "../prisma";

describe("email-digest-preference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to disabled when no row exists (RGPD opt-in)", async () => {
    vi.mocked(prisma.emailDigestPreference.findUnique).mockResolvedValue(null);
    expect(await getEmailDigestPreference("u1")).toEqual({ enabled: false });
  });

  it("reads the stored enabled flag", async () => {
    vi.mocked(prisma.emailDigestPreference.findUnique).mockResolvedValue({
      enabled: true,
    });
    expect(await getEmailDigestPreference("u1")).toEqual({ enabled: true });
  });

  it("opt-in upserts enabled=true and clears unsubscribedAt", async () => {
    vi.mocked(prisma.emailDigestPreference.upsert).mockResolvedValue({
      enabled: true,
    });
    const out = await setEmailDigestPreference("u1", true);
    expect(out).toEqual({ enabled: true });
    const call = vi.mocked(prisma.emailDigestPreference.upsert).mock.calls[0][0];
    expect(call.create.enabled).toBe(true);
    expect(call.create.unsubscribedAt).toBeNull();
    expect(call.update.unsubscribedAt).toBeNull();
  });

  it("opt-out upserts enabled=false and stamps unsubscribedAt", async () => {
    vi.mocked(prisma.emailDigestPreference.upsert).mockResolvedValue({
      enabled: false,
    });
    await setEmailDigestPreference("u1", false);
    const call = vi.mocked(prisma.emailDigestPreference.upsert).mock.calls[0][0];
    expect(call.update.enabled).toBe(false);
    expect(call.update.unsubscribedAt).toBeInstanceOf(Date);
  });

  it("unsubscribes via a valid signed token", async () => {
    vi.mocked(prisma.emailDigestPreference.upsert).mockResolvedValue({
      enabled: false,
    });
    const token = buildUnsubscribeToken("u1", "test-secret");
    expect(await unsubscribeByToken(token)).toBe(true);
    const call = vi.mocked(prisma.emailDigestPreference.upsert).mock.calls[0][0];
    expect(call.where).toEqual({ userId: "u1" });
    expect(call.update.enabled).toBe(false);
  });

  it("rejects an invalid token without touching the DB", async () => {
    expect(await unsubscribeByToken("garbage")).toBe(false);
    expect(prisma.emailDigestPreference.upsert).not.toHaveBeenCalled();
  });
});
