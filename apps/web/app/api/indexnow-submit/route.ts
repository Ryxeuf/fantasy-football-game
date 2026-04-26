/**
 * Endpoint admin de soumission IndexNow (Q.18 — Sprint 23).
 *
 * Protege par un secret partage `INDEXNOW_ADMIN_TOKEN` (header
 * `Authorization: Bearer <token>`). Re-soumet la liste d URLs publiques
 * (par defaut le sitemap minimal) aux operateurs IndexNow.
 *
 * Note : on POST sur `api.indexnow.org` qui propage automatiquement aux
 * autres operateurs participants — un seul appel suffit.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildIndexNowPayload, isValidIndexNowKey } from "../../lib/indexnow";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const KEY = process.env.NEXT_PUBLIC_INDEXNOW_KEY;
const ADMIN_TOKEN = process.env.INDEXNOW_ADMIN_TOKEN;
const ENDPOINT = "https://api.indexnow.org/indexnow";

const DEFAULT_URLS = [
  `${SITE_URL}`,
  `${SITE_URL}/teams`,
  `${SITE_URL}/star-players`,
  `${SITE_URL}/skills`,
  `${SITE_URL}/changelog`,
  `${SITE_URL}/a-propos`,
  `${SITE_URL}/tutoriel`,
];

interface SubmitResponseBody {
  success: boolean;
  submitted: number;
  endpoint: string;
  status?: number;
  error?: string;
}

function host(): string {
  return new URL(SITE_URL).hostname;
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json<SubmitResponseBody>(
    { success: false, submitted: 0, endpoint: ENDPOINT, error: message },
    { status: 401 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!ADMIN_TOKEN) {
    return unauthorized("INDEXNOW_ADMIN_TOKEN not configured");
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${ADMIN_TOKEN}`;
  if (auth !== expected) {
    return unauthorized("Invalid authorization token");
  }
  if (!isValidIndexNowKey(KEY)) {
    return NextResponse.json<SubmitResponseBody>(
      {
        success: false,
        submitted: 0,
        endpoint: ENDPOINT,
        error: "NEXT_PUBLIC_INDEXNOW_KEY missing or invalid",
      },
      { status: 500 },
    );
  }

  let urls: string[] = DEFAULT_URLS;
  try {
    const body = await request.json().catch(() => null);
    if (body && Array.isArray(body.urls)) {
      urls = body.urls.filter((u: unknown): u is string => typeof u === "string");
    }
  } catch {
    // body absent ou invalide : utilise les defauts.
  }

  let payload;
  try {
    payload = buildIndexNowPayload({
      host: host(),
      key: KEY!,
      keyLocation: `${SITE_URL}/indexnow-key.txt`,
      urls,
    });
  } catch (err) {
    return NextResponse.json<SubmitResponseBody>(
      {
        success: false,
        submitted: 0,
        endpoint: ENDPOINT,
        error: err instanceof Error ? err.message : "payload error",
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return NextResponse.json<SubmitResponseBody>(
      {
        success: response.ok,
        submitted: payload.urlList.length,
        endpoint: ENDPOINT,
        status: response.status,
      },
      { status: response.ok ? 200 : 502 },
    );
  } catch (err) {
    return NextResponse.json<SubmitResponseBody>(
      {
        success: false,
        submitted: 0,
        endpoint: ENDPOINT,
        error: err instanceof Error ? err.message : "fetch failed",
      },
      { status: 502 },
    );
  }
}
