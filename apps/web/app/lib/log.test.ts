import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadLog() {
  vi.resetModules();
  return import("./log");
}

describe("webLog", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("debug() does not call console.log in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { webLog } = await loadLog();

    webLog.debug("hello", { a: 1 });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("debug() forwards to console.log in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { webLog } = await loadLog();

    webLog.debug("hello", { a: 1 });

    expect(logSpy).toHaveBeenCalledWith("hello", { a: 1 });
  });

  it("debug() forwards to console.log in test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { webLog } = await loadLog();

    webLog.debug("dbg");

    expect(logSpy).toHaveBeenCalledWith("dbg");
  });

  it("warn() always forwards to console.warn", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { webLog } = await loadLog();

    webLog.warn("oops", { code: 42 });

    expect(warnSpy).toHaveBeenCalledWith("oops", { code: 42 });
  });

  it("error() always forwards to console.error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { webLog } = await loadLog();

    const err = new Error("boom");
    webLog.error("fail", err);

    expect(errorSpy).toHaveBeenCalledWith("fail", err);
  });

  it("debug() is a no-op when NODE_ENV is undefined and treated as production", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    const { webLog } = await loadLog();

    webLog.debug("nope");

    expect(logSpy).not.toHaveBeenCalled();
  });
});
