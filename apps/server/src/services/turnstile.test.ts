import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe("verifyTurnstileToken", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY;
    // Bypass desactive par defaut pour eviter de masquer des regressions.
    delete process.env.TURNSTILE_BYPASS;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("rejects when token is missing or empty", async () => {
    const result = await verifyTurnstileToken("", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("missing-token");
  });

  it("bypasses verification when TURNSTILE_BYPASS=1 (dev/test only)", async () => {
    process.env.TURNSTILE_BYPASS = "1";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    const result = await verifyTurnstileToken("anything", "1.2.3.4");

    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects when secret key is missing in non-bypass mode", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    const result = await verifyTurnstileToken("token-123", "1.2.3.4");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("missing-secret");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok=true when Cloudflare confirms the token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: "example.com" }),
    });
    globalThis.fetch = fetchSpy as any;

    const result = await verifyTurnstileToken("token-123", "9.9.9.9");

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("token-123");
    expect(body.get("remoteip")).toBe("9.9.9.9");
  });

  it("returns ok=false with error codes when Cloudflare rejects", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    }) as any;

    const result = await verifyTurnstileToken("bad-token", "1.2.3.4");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid-input-response");
  });

  it("returns ok=false when fetch throws (network/timeout)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;

    const result = await verifyTurnstileToken("token", "1.2.3.4");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("network-error");
  });

  it("returns ok=false when Cloudflare returns non-2xx HTTP status", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    }) as any;

    const result = await verifyTurnstileToken("token", "1.2.3.4");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("http-error");
  });

  it("omits remoteip when caller does not provide one", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    globalThis.fetch = fetchSpy as any;

    await verifyTurnstileToken("token", undefined);

    const [, init] = fetchSpy.mock.calls[0];
    const body = init.body as URLSearchParams;
    expect(body.has("remoteip")).toBe(false);
  });
});
