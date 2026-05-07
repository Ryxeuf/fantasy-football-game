import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnthropicError, callClaude } from "./anthropic-client";

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  }
});

function makeFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (url: string, init?: RequestInit) => impl(url, init));
}

describe("callClaude — sprint 1.E.1", () => {
  it("MISSING_API_KEY si pas de clé", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      callClaude({
        model: "claude-haiku-4-5-20251001",
        maxTokens: 100,
        system: "sys",
        userPrompt: "user",
      }),
    ).rejects.toMatchObject({ code: "MISSING_API_KEY" });
  });

  it("appelle l'endpoint correct avec headers + body", async () => {
    const fetchImpl = makeFetch(async (url, init) => {
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["content-type"]).toBe("application/json");
      const body = JSON.parse(init?.body as string);
      expect(body.model).toBe("claude-haiku-4-5-20251001");
      expect(body.max_tokens).toBe(100);
      expect(body.system).toBe("sys");
      expect(body.messages[0].content).toBe("user");
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "hello" }],
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
        { status: 200 },
      );
    });
    const out = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 100,
      system: "sys",
      userPrompt: "user",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.text).toBe("hello");
    expect(out.usage?.inputTokens).toBe(5);
    expect(out.usage?.outputTokens).toBe(1);
  });

  it("concatene plusieurs blocks text", async () => {
    const fetchImpl = makeFetch(async () =>
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "foo" },
            { type: "tool_use", id: "x" },
            { type: "text", text: "bar" },
          ],
        }),
        { status: 200 },
      ),
    );
    const out = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 100,
      system: "sys",
      userPrompt: "user",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.text).toBe("foobar");
  });

  it("HTTP_ERROR si status != 2xx", async () => {
    const fetchImpl = makeFetch(async () =>
      new Response("rate limit hit", { status: 429 }),
    );
    await expect(
      callClaude({
        model: "claude-haiku-4-5-20251001",
        maxTokens: 100,
        system: "sys",
        userPrompt: "user",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR", status: 429 });
  });

  it("EMPTY_RESPONSE si pas de text content", async () => {
    const fetchImpl = makeFetch(async () =>
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );
    await expect(
      callClaude({
        model: "claude-haiku-4-5-20251001",
        maxTokens: 100,
        system: "sys",
        userPrompt: "user",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(AnthropicError);
  });

  it("INVALID_JSON si reponse invalide", async () => {
    const fetchImpl = makeFetch(async () =>
      new Response("not json", { status: 200 }),
    );
    await expect(
      callClaude({
        model: "m",
        maxTokens: 100,
        system: "s",
        userPrompt: "u",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "INVALID_JSON" });
  });

  it("NETWORK_ERROR si fetch throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("conn refused");
    });
    await expect(
      callClaude({
        model: "m",
        maxTokens: 100,
        system: "s",
        userPrompt: "u",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});
