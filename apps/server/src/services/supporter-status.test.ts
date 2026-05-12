/**
 * Sprint R lot R.B.3 — tests du service supporter-status.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  SUPPORTER_BENEFITS,
  getSupporterStatus,
  isUserSupporter,
} from "./supporter-status";

const mockedUser = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSupporterStatus", () => {
  it("retourne NO_STATUS si l'user n'existe pas", async () => {
    mockedUser.user.findUnique.mockResolvedValue(null as never);
    const status = await getSupporterStatus("missing");
    expect(status.isSupporter).toBe(false);
    expect(status.benefits).toHaveLength(0);
  });

  it("source=admin_override quand patreon=true", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: true,
      supporterTier: null,
      supporterActiveUntil: null,
    } as never);
    const status = await getSupporterStatus("u_1");
    expect(status.isSupporter).toBe(true);
    expect(status.source).toBe("admin_override");
    expect(status.benefits).toEqual(SUPPORTER_BENEFITS);
  });

  it("source=kofi quand abo actif (now < activeUntil)", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: false,
      supporterTier: "supporter",
      supporterActiveUntil: futureDate,
    } as never);
    const status = await getSupporterStatus("u_1");
    expect(status.isSupporter).toBe(true);
    expect(status.source).toBe("kofi");
    expect(status.tier).toBe("supporter");
    expect(status.activeUntil).toBe(futureDate.toISOString());
  });

  it("NO_STATUS quand abo expire", async () => {
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000);
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: false,
      supporterTier: "supporter",
      supporterActiveUntil: pastDate,
    } as never);
    const status = await getSupporterStatus("u_1");
    expect(status.isSupporter).toBe(false);
    expect(status.source).toBeNull();
  });

  it("NO_STATUS si jamais paye et pas d'override admin", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: false,
      supporterTier: null,
      supporterActiveUntil: null,
    } as never);
    const status = await getSupporterStatus("u_1");
    expect(status.isSupporter).toBe(false);
  });

  it("benefits inclut ad_free + early_replay + profile_badge", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: true,
      supporterTier: null,
      supporterActiveUntil: null,
    } as never);
    const status = await getSupporterStatus("u_1");
    const ids = status.benefits.map((b) => b.id).sort();
    expect(ids).toEqual(["ad_free", "early_replay", "profile_badge"]);
  });
});

describe("isUserSupporter", () => {
  it("retourne true si supporter actif", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: true,
      supporterTier: null,
      supporterActiveUntil: null,
    } as never);
    expect(await isUserSupporter("u_1")).toBe(true);
  });

  it("retourne false si pas supporter", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      id: "u_1",
      patreon: false,
      supporterTier: null,
      supporterActiveUntil: null,
    } as never);
    expect(await isUserSupporter("u_1")).toBe(false);
  });
});
