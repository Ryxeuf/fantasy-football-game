/**
 * Tri chronologique des évènements de feuille de match. Extrait de
 * `page.tsx` : Next.js interdit tout export non-conventionnel dans un
 * fichier page (le typecheck `.next/types` échoue sinon), et la
 * logique pure doit rester importable par les tests.
 */

/**
 * Trie les évènements de manière chronologique : mi-temps puis tour, en
 * conservant l'ordre de saisie initial comme départage stable. Pur,
 * exporté pour test. Renvoie chaque évènement accompagné de son `meta`
 * résolu une seule fois.
 */
export function chronologicalTimeline<
  T extends { meta?: { half?: number; turn?: number } | null },
>(events: readonly T[]): Array<{ ev: T; m: { half?: number; turn?: number } }> {
  const items = events.map((ev, i) => ({ ev, i, m: parseEventMeta(ev.meta) }));
  items.sort((a, b) => {
    const ha = a.m.half ?? 1;
    const hb = b.m.half ?? 1;
    if (ha !== hb) return ha - hb;
    const ta = a.m.turn ?? 0;
    const tb = b.m.turn ?? 0;
    if (ta !== tb) return ta - tb;
    return a.i - b.i;
  });
  return items.map(({ ev, m }) => ({ ev, m }));
}

/** Lit half/turn depuis le meta (tolérant : objet natif ou string JSON). */
function parseEventMeta(raw: unknown): { half?: number; turn?: number } {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  const half = typeof o.half === "number" ? o.half : undefined;
  const turn = typeof o.turn === "number" ? o.turn : undefined;
  return { half, turn };
}
