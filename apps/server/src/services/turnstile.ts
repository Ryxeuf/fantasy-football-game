import { serverLog } from "../utils/server-log";

/**
 * Cloudflare Turnstile siteverify endpoint.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const SITEVERIFY_TIMEOUT_MS = 5000;

// Filet de securite : si TURNSTILE_BYPASS=1 est defini en dehors d'un
// environnement de test, on remonte un avertissement bruyant au boot pour
// que la mauvaise config soit visible immediatement (au lieu de laisser
// passer silencieusement tous les captchas).
if (
  process.env.TURNSTILE_BYPASS === "1" &&
  process.env.NODE_ENV !== "test" &&
  process.env.TEST_SQLITE !== "1"
) {
  serverLog.warn(
    "[turnstile] TURNSTILE_BYPASS=1 detecte hors test : tous les captchas seront acceptes sans verification. NE JAMAIS activer en production.",
  );
}

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; errorCode: string };

/**
 * Verifie un token Turnstile cote serveur.
 *
 * Le bypass `TURNSTILE_BYPASS=1` est destine au developpement et aux tests
 * de bout en bout : il evite de devoir provisionner un compte Cloudflare
 * pour faire tourner les suites locales. En production cette variable
 * d'environnement ne doit JAMAIS etre activee.
 *
 * `remoteIp` est optionnel : Cloudflare l'utilise pour des heuristiques
 * anti-bot supplementaires mais ne l'exige pas.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp: string | undefined,
): Promise<TurnstileVerifyResult> {
  if (!token || token.trim().length === 0) {
    return { ok: false, errorCode: "missing-token" };
  }

  if (process.env.TURNSTILE_BYPASS === "1") {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    serverLog.warn(
      "[turnstile] TURNSTILE_SECRET_KEY missing — refusing to validate captcha token",
    );
    return { ok: false, errorCode: "missing-secret" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    });
  } catch (err) {
    serverLog.warn(
      "[turnstile] siteverify fetch failed:",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, errorCode: "network-error" };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    serverLog.warn(`[turnstile] siteverify HTTP ${response.status}`);
    return { ok: false, errorCode: "http-error" };
  }

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (json.success === true) {
    return { ok: true };
  }

  const errorCode = json["error-codes"]?.[0] ?? "verification-failed";
  return { ok: false, errorCode };
}
