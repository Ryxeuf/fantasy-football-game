/**
 * Sprint R lot R.D.3 — tests du service naf-sync.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  getNafStatsForUser,
  isValidNafName,
  type FetchNafStatsFn,
} from "./naf-sync";

const mockedUser = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isValidNafName", () => {
  it("accepte un nom alphanumerique simple", () => {
    expect(isValidNafName("Ryxeuf")).toBe(true);
    expect(isValidNafName("Coach123")).toBe(true);
  });

  it("accepte des espaces et chars latins accentues", () => {
    expect(isValidNafName("Coach Helene")).toBe(true);
    expect(isValidNafName("Jérôme")).toBe(true);
  });

  it("refuse trop court (<2)", () => {
    expect(isValidNafName("a")).toBe(false);
    expect(isValidNafName("")).toBe(false);
  });

  it("refuse trop long (>64)", () => {
    expect(isValidNafName("a".repeat(65))).toBe(false);
  });

  it("refuse les chars de controle ASCII", () => {
    expect(isValidNafName("Coach\nNewline")).toBe(false);
    expect(isValidNafName("Coach\x00Null")).toBe(false);
    expect(isValidNafName("Coach\x7fDel")).toBe(false);
  });
});

describe("getNafStatsForUser", () => {
  it("retourne null si user inexistant", async () => {
    mockedUser.user.findUnique.mockResolvedValue(null as never);
    const stats = await getNafStatsForUser("missing");
    expect(stats).toBeNull();
  });

  it("retourne null si nafName n'est pas set (pas opt-in)", async () => {
    mockedUser.user.findUnique.mockResolvedValue({ nafName: null } as never);
    const stats = await getNafStatsForUser("u_1");
    expect(stats).toBeNull();
  });

  it("appelle le fetcher avec nafName si opt-in", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      nafName: "Ryxeuf",
    } as never);
    const fetcher: FetchNafStatsFn = vi.fn().mockResolvedValue({
      nafName: "Ryxeuf",
      tournaments: [],
      totalMatches: 0,
      totalWins: 0,
      fetchedAt: "2026-05-12T10:00:00Z",
    });
    const stats = await getNafStatsForUser("u_1", fetcher);
    expect(fetcher).toHaveBeenCalledWith("Ryxeuf", expect.any(AbortSignal));
    expect(stats).toMatchObject({ nafName: "Ryxeuf" });
  });

  it("retourne null si le fetcher renvoie null (NAF down)", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      nafName: "Ryxeuf",
    } as never);
    const fetcher: FetchNafStatsFn = vi.fn().mockResolvedValue(null);
    const stats = await getNafStatsForUser("u_1", fetcher);
    expect(stats).toBeNull();
  });

  it("abort le fetcher apres timeout", async () => {
    mockedUser.user.findUnique.mockResolvedValue({
      nafName: "Ryxeuf",
    } as never);
    let signalCaptured: AbortSignal | null = null;
    const fetcher: FetchNafStatsFn = async (_name, signal) => {
      signalCaptured = signal;
      // Wait for abort
      return await new Promise<null>((resolve) => {
        signal.addEventListener("abort", () => resolve(null));
      });
    };
    const stats = await getNafStatsForUser("u_1", fetcher, 10);
    expect(stats).toBeNull();
    expect(signalCaptured).not.toBeNull();
    expect((signalCaptured as unknown as AbortSignal).aborted).toBe(true);
  });
});
