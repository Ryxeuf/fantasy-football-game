import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bb/sim-engine", async () => {
  const actual = await vi.importActual<typeof import("@bb/sim-engine")>("@bb/sim-engine");
  return { ...actual, simulateMatch: vi.fn(), createSimPool: vi.fn() };
});

vi.mock("../utils/server-log", () => ({
  serverLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as simEngine from "@bb/sim-engine";

import {
  MAX_DEFAULT_WORKERS,
  __resetSimPoolForTesting,
  getSimPoolStats,
  resolveSimPoolSize,
  simulateManyOffLoop,
  simulateMatchOffLoop,
} from "./pro-league-sim-pool";

const input = { seed: 1, home: { id: "h", name: "H", side: "home" }, away: { id: "a", name: "A", side: "away" } } as never;

beforeEach(async () => {
  vi.resetAllMocks();
  await __resetSimPoolForTesting();
});

afterEach(async () => {
  await __resetSimPoolForTesting();
});

describe("resolveSimPoolSize (pur)", () => {
  it("inline en test, sinon cpus − 1 borné à [1, 4], surchargé par PRO_LEAGUE_SIM_WORKERS", () => {
    expect(resolveSimPoolSize({ NODE_ENV: "test" }, 8)).toBe(0);
    expect(resolveSimPoolSize({ TEST_SQLITE: "1" }, 8)).toBe(0);
    expect(resolveSimPoolSize({}, 8)).toBe(MAX_DEFAULT_WORKERS);
    expect(resolveSimPoolSize({}, 3)).toBe(2);
    expect(resolveSimPoolSize({}, 1)).toBe(1);
    expect(resolveSimPoolSize({ PRO_LEAGUE_SIM_WORKERS: "0" }, 8)).toBe(0);
    expect(resolveSimPoolSize({ PRO_LEAGUE_SIM_WORKERS: "6" }, 8)).toBe(6);
    expect(resolveSimPoolSize({ PRO_LEAGUE_SIM_WORKERS: "nope" }, 8)).toBe(MAX_DEFAULT_WORKERS);
  });
});

describe("mode inline (test)", () => {
  it("simule sur l'event loop avec simulateMatch et compte les succès et les échecs", async () => {
    const fake = { summary: { outcome: "home" } } as never;
    vi.mocked(simEngine.simulateMatch).mockReturnValueOnce(fake);
    await expect(simulateMatchOffLoop(input, { driverKind: "full" })).resolves.toBe(fake);
    expect(simEngine.simulateMatch).toHaveBeenCalledWith(input, { driverKind: "full" });
    expect(simEngine.createSimPool).not.toHaveBeenCalled();

    vi.mocked(simEngine.simulateMatch).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    await expect(simulateMatchOffLoop(input)).rejects.toThrow("boom");
    expect(getSimPoolStats()).toEqual({
      mode: "inline",
      size: 0,
      busy: 0,
      queued: 0,
      completed: 1,
      failed: 1,
      respawned: 0,
    });
  });

  it("simulateManyOffLoop garde l'ordre", async () => {
    vi.mocked(simEngine.simulateMatch)
      .mockReturnValueOnce({ summary: { outcome: "home" } } as never)
      .mockReturnValueOnce({ summary: { outcome: "away" } } as never);
    const out = await simulateManyOffLoop([input, input], { driverKind: "hybrid" });
    expect(out.map((r) => r.summary.outcome)).toEqual(["home", "away"]);
  });
});

describe("mode pool", () => {
  it("crée le pool une seule fois avec la taille résolue et lui délègue, en retirant fullReplay", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_SQLITE", "");
    vi.stubEnv("PRO_LEAGUE_SIM_WORKERS", "2");
    const fakePool = {
      simulate: vi.fn(async () => ({ summary: { outcome: "draw" } })),
      simulateMany: vi.fn(async (inputs: unknown[]) => inputs.map(() => ({ summary: { outcome: "draw" } }))),
      stats: () => ({ size: 2, busy: 1, queued: 3, completed: 9, failed: 0, respawned: 0 }),
      close: vi.fn(async () => {}),
    };
    vi.mocked(simEngine.createSimPool).mockReturnValue(fakePool as never);
    try {
      await simulateMatchOffLoop(input, { driverKind: "full" });
      await simulateManyOffLoop([input, input], { driverKind: "full" });
      expect(simEngine.createSimPool).toHaveBeenCalledTimes(1);
      expect(simEngine.createSimPool).toHaveBeenCalledWith({ size: 2, defaults: { stripFullReplay: true } });
      expect(fakePool.simulate).toHaveBeenCalledWith(input, { driverKind: "full" });
      expect(fakePool.simulateMany).toHaveBeenCalledTimes(1);
      expect(simEngine.simulateMatch).not.toHaveBeenCalled();
      expect(getSimPoolStats()).toEqual({ mode: "pool", size: 2, busy: 1, queued: 3, completed: 9, failed: 0, respawned: 0 });
      await __resetSimPoolForTesting();
      expect(fakePool.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
