/**
 * Coups de pouce de création figés dans un roster « version du match »
 * (`RosterSnapshot.inducements`). Module PUR et sans dépendance, pour être lu
 * par la feuille de match sans tirer `cup-roster-snapshot` (Prisma).
 */

/**
 * Coup de pouce acheté à la création, figé dans le snapshot (coupe en mode
 * `build`) : il vaut pour chaque rencontre de la coupe.
 */
export interface SnapshotInducement {
  readonly slug: string;
  /** Libellé FR du catalogue au moment de la capture (repli : le slug). */
  readonly name: string;
  readonly quantity: number;
  /** Prix unitaire figé à l'achat, en po. */
  readonly unitCost: number;
}

/**
 * Coups de pouce figés dans un snapshot sérialisé (objet natif PG, chaîne du
 * miroir SQLite, ou colonne `rosterSnapshotHome/Away` d'une feuille).
 * Tolérant : un snapshot antérieur ou illisible vaut « aucun ».
 *
 * PUR : aucune I/O.
 */
export function parseSnapshotInducements(
  raw: unknown,
): SnapshotInducement[] {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const list = (obj as { inducements?: unknown }).inducements;
  if (!Array.isArray(list)) return [];
  const out: SnapshotInducement[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    if (typeof o.slug !== 'string' || o.slug.length === 0) continue;
    const quantity = typeof o.quantity === 'number' ? Math.floor(o.quantity) : 0;
    if (quantity <= 0) continue;
    out.push({
      slug: o.slug,
      name: typeof o.name === 'string' && o.name ? o.name : o.slug,
      quantity,
      unitCost:
        typeof o.unitCost === 'number' && Number.isFinite(o.unitCost)
          ? Math.max(0, Math.floor(o.unitCost))
          : 0,
    });
  }
  return out;
}
