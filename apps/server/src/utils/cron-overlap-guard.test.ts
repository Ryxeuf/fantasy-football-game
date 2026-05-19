import { describe, it, expect, vi } from "vitest";

import { runOnceAtATime } from "./cron-overlap-guard";

vi.mock("./server-log", () => ({
  serverLog: {
    debug: vi.fn(),
  },
}));

describe("runOnceAtATime — audit round 7", () => {
  it("skip silencieusement les ticks concurrents", async () => {
    let calls = 0;
    let resolveTick: (() => void) | null = null;
    const slowTick = (): Promise<void> => {
      calls += 1;
      return new Promise<void>((r) => {
        resolveTick = r;
      });
    };

    const guarded = runOnceAtATime("test", slowTick);

    // Lance le premier tick — il est in-flight (running=true set sync).
    const p1 = guarded();
    expect(calls).toBe(1);
    // resolveTick a ete capture lors de la 1ere invocation de slowTick.
    expect(resolveTick).not.toBeNull();

    // Lance un 2e tick pendant que le 1er est in-flight → skipped sync.
    const p2 = guarded();
    expect(calls).toBe(1);
    await p2; // skip is a resolved promise

    // Termine le 1er tick.
    resolveTick!();
    await p1;

    // Apres la fin, un nouveau tick passe.
    const p3 = guarded();
    expect(calls).toBe(2);
    resolveTick!();
    await p3;
  });

  it("clear running flag meme si fn throw", async () => {
    let calls = 0;
    const throwingTick = async (): Promise<void> => {
      calls += 1;
      throw new Error("boom");
    };

    const guarded = runOnceAtATime("test-throw", throwingTick);

    // Premier appel throw → le flag doit etre clear.
    await expect(guarded()).rejects.toThrow("boom");
    expect(calls).toBe(1);

    // Le second appel passe (flag clear apres throw).
    await expect(guarded()).rejects.toThrow("boom");
    expect(calls).toBe(2);
  });
});
