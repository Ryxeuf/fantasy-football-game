/**
 * Invalidation du cache ISR du front Next.js à la demande depuis le serveur
 * API. Après une écriture de données de référence (rosters), on prévient le
 * conteneur web pour qu'il régénère les pages concernées (`/teams/*`) au lieu
 * d'attendre la fenêtre ISR de 1 h.
 *
 * Cible la route `POST /api/revalidate` du front (cf.
 * `apps/web/app/api/revalidate/route.ts`), protégée par `REVALIDATE_SECRET`.
 *
 * ROBUSTESSE (même pattern que `league-invitation-notify`) : effet secondaire
 * best-effort. Tout échec (web indisponible, non configuré, HTTP non-2xx) est
 * capturé et loggé — la fonction NE THROW JAMAIS, pour ne jamais compromettre
 * l'écriture appelante.
 *
 * Configuration (env serveur) :
 *   - `WEB_REVALIDATE_URL` : origine interne du front, ex.
 *     `http://nufflearena_web:3100`. Absente → no-op (dev sans front).
 *   - `REVALIDATE_SECRET`  : secret partagé avec le front. Absent → no-op.
 */

import { serverLog } from "../utils/server-log";

function revalidateEndpoint(): string | null {
  const base = process.env.WEB_REVALIDATE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/api/revalidate`;
}

export interface RevalidateWebInput {
  readonly tags?: readonly string[];
  readonly paths?: readonly string[];
}

/**
 * Poste une demande d'invalidation au front. Ne throw jamais. No-op si la
 * cible ou le secret ne sont pas configurés, ou si rien à invalider.
 */
export async function revalidateWeb(input: RevalidateWebInput): Promise<void> {
  const url = revalidateEndpoint();
  const secret = process.env.REVALIDATE_SECRET;
  const tags = input.tags ?? [];
  const paths = input.paths ?? [];

  if (!url || !secret) return; // non configuré → no-op silencieux
  if (tags.length === 0 && paths.length === 0) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags, paths }),
    });
    if (!res.ok) {
      serverLog.error(
        `[revalidate-web] HTTP ${res.status} (tags=${tags.join(",")} paths=${paths.join(",")})`,
      );
    }
  } catch (e: unknown) {
    serverLog.error("[revalidate-web] échec (ignoré)", e);
  }
}

/**
 * Invalide les pages liées aux rosters (liste `/teams`, fiches `/teams/:slug`
 * et sous-pages position). Bust le tag global `rosters` ; ajoute un tag
 * `roster:<slug>` par slug fourni pour un ciblage plus fin.
 */
export async function revalidateRosterPages(
  slugs?: readonly string[],
): Promise<void> {
  const tags = [
    "rosters",
    ...(slugs ?? []).filter(Boolean).map((s) => `roster:${s}`),
  ];
  await revalidateWeb({ tags });
}
