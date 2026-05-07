/**
 * Anthropic Claude API client — minimal raw fetch.
 *
 * Used by `pro-gazette-llm.ts` (sprint 1.E.1). Direct call to
 * `/v1/messages` to keep the dep surface small.
 *
 * Auth via `ANTHROPIC_API_KEY` env. Calls fail explicitly if absent.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

export class AnthropicError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.name = "AnthropicError";
    this.status = status;
  }
}

export interface CallClaudeOptions {
  readonly model: string;
  readonly maxTokens: number;
  readonly system: string;
  readonly userPrompt: string;
  /** Optional — defaults to the value from `ANTHROPIC_API_KEY` env. */
  readonly apiKey?: string;
  /** Override fetch (tests). */
  readonly fetchImpl?: typeof fetch;
}

export interface CallClaudeResult {
  readonly text: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Calls `/v1/messages` and returns the text concatenation of all `text`
 * content blocks. Throws AnthropicError on any failure (no fallback).
 */
export async function callClaude(
  opts: CallClaudeOptions,
): Promise<CallClaudeResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError(
      "MISSING_API_KEY",
      "ANTHROPIC_API_KEY env var is not set",
    );
  }
  const fetchFn = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.userPrompt }],
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new AnthropicError("NETWORK_ERROR", `fetch failed: ${msg}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AnthropicError(
      "HTTP_ERROR",
      `Anthropic returned ${response.status}: ${text.slice(0, 256)}`,
      response.status,
    );
  }
  let body: AnthropicResponse;
  try {
    body = (await response.json()) as AnthropicResponse;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new AnthropicError("INVALID_JSON", `cannot parse JSON: ${msg}`);
  }
  const blocks = Array.isArray(body.content) ? body.content : [];
  const text = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
  if (text.length === 0) {
    throw new AnthropicError("EMPTY_RESPONSE", "no text content returned");
  }
  return {
    text,
    usage: {
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
    },
  };
}
