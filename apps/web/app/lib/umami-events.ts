/**
 * Umami events helper (Q.19 — Sprint 23).
 *
 * Wrapper safe autour du `window.umami.track()` charge dans le root
 * layout. Permet de tracker des events cles sans avoir a tester
 * `typeof window === 'undefined'` ou `window.umami` partout.
 *
 * Comportement :
 *   - silencieux si Umami n est pas charge (dev, opt-out, network down)
 *   - avale les exceptions du tracker (analytics ne doit jamais casser
 *     l UI)
 *   - centralise les noms d events dans `UMAMI_EVENTS` pour eviter les
 *     typos / inconsistances entre call sites
 */

/** Catalogue des events trackes — Q.19. */
export const UMAMI_EVENTS = {
  /** Clic sur une carte d'equipe (route `/teams`). */
  TEAM_CLICK: "team-click",
  /** Clic sur une carte de star player (route `/star-players`). */
  STAR_PLAYER_HIRE: "star-player-hire",
  /** Export PDF (roster, skill sheet, match sheet). */
  PDF_EXPORT: "pdf-export",
  /** Clic sur un CTA Ko-fi / soutien. */
  SUPPORT_CTA: "support-cta",
} as const;

export type UmamiEventName = (typeof UMAMI_EVENTS)[keyof typeof UMAMI_EVENTS];

/** Donnees additionnelles attachees a un event (evite `any`). */
export type UmamiEventData = Record<string, string | number | boolean | undefined>;

interface UmamiTracker {
  track: (name: string, data?: UmamiEventData) => void;
}

interface MaybeUmamiHost {
  umami?: Partial<UmamiTracker>;
}

function getTracker(): Partial<UmamiTracker> | null {
  // En SSR / test : globalThis.umami peut etre defini (vitest stub).
  // En navigateur : window === globalThis, donc cette branche couvre les deux.
  const host = globalThis as unknown as MaybeUmamiHost;
  if (!host.umami) return null;
  return host.umami;
}

export function trackUmamiEvent(
  name: UmamiEventName,
  data?: UmamiEventData,
): void {
  if (!name || typeof name !== "string") return;
  const tracker = getTracker();
  if (!tracker || typeof tracker.track !== "function") return;
  try {
    tracker.track(name, data);
  } catch {
    // Analytics ne doit jamais casser l UI.
  }
}
