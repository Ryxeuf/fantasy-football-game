import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invalidateAllMemo,
  invalidateMemoNamespace,
  memoizeAsync,
} from "./memoize-async";

afterEach(() => {
  invalidateAllMemo();
  vi.useRealTimers();
});

describe("memoizeAsync", () => {
  it("returns the producer value and caches it", async () => {
    const producer = vi.fn().mockResolvedValue(42);
    const first = await memoizeAsync("ns", "k", 10_000, producer);
    const second = await memoizeAsync("ns", "k", 10_000, producer);
    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("expires after ttlMs", async () => {
    vi.useFakeTimers();
    const producer = vi
      .fn()
      .mockResolvedValueOnce("a")
      .mockResolvedValueOnce("b");
    const first = await memoizeAsync("ns", "k", 100, producer);
    vi.setSystemTime(new Date(Date.now() + 200));
    const second = await memoizeAsync("ns", "k", 100, producer);
    expect(first).toBe("a");
    expect(second).toBe("b");
  });

  it("coalesces concurrent callers into a single producer call", async () => {
    let resolveOnce: (v: string) => void;
    const producer = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOnce = resolve;
        }),
    );
    const p1 = memoizeAsync("ns", "same", 10_000, producer);
    const p2 = memoizeAsync("ns", "same", 10_000, producer);
    resolveOnce!("shared");
    await expect(p1).resolves.toBe("shared");
    await expect(p2).resolves.toBe("shared");
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("does not cache rejections", async () => {
    const producer = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(memoizeAsync("ns", "k", 10_000, producer)).rejects.toThrow(
      "boom",
    );
    await expect(memoizeAsync("ns", "k", 10_000, producer)).resolves.toBe(
      "ok",
    );
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("isolates namespaces", async () => {
    await memoizeAsync("a", "k", 10_000, async () => 1);
    await memoizeAsync("b", "k", 10_000, async () => 2);
    invalidateMemoNamespace("a");
    const refreshedA = await memoizeAsync("a", "k", 10_000, async () => 3);
    const stillB = await memoizeAsync("b", "k", 10_000, async () => 4);
    expect(refreshedA).toBe(3);
    expect(stillB).toBe(2);
  });
});
