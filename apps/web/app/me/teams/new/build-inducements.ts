/**
 * Coups de pouce achetés À LA CONSTRUCTION d'une équipe (coupe en mode
 * `build`, règlement de tournoi) : la sélection du coach, confrontée au
 * catalogue servi par `GET /team/build-inducements`.
 *
 * Aucun prix n'est calculé ici : le builder affiche ceux du serveur, qui les
 * recalcule de toute façon au build. Ce module ne fait que borner la
 * sélection (plafonds, slugs inconnus), en totaliser le coût et préparer la
 * requête. 100 % pur, testable sans React.
 */

/** Option servie par le serveur (cf. `InducementOption` côté serveur). */
export interface BuildInducementOption {
  readonly slug: string;
  readonly name: string;
  /** Prix unitaire pour CE roster, en po. */
  readonly cost: number;
  readonly maxQuantity: number;
  readonly description: string;
}

/** Sélection : slug → quantité (> 0). */
export type InducementSelection = Readonly<Record<string, number>>;

export const EMPTY_SELECTION: InducementSelection = Object.freeze({});

/**
 * Sélection bornée au catalogue : slugs inconnus retirés, quantités ramenées
 * dans [1, plafond] (une quantité nulle disparaît). Appelée quand le
 * catalogue change — changement de roster, de Ligue, de Star Players (le
 * plafond « Arme Secrète » peut baisser).
 */
export function clampSelection(
  selection: InducementSelection,
  options: readonly BuildInducementOption[],
): InducementSelection {
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  const out: Record<string, number> = {};
  for (const [slug, qty] of Object.entries(selection)) {
    const option = bySlug.get(slug);
    if (!option) continue;
    const clamped = Math.min(option.maxQuantity, Math.max(0, Math.floor(qty)));
    if (clamped > 0) out[slug] = clamped;
  }
  return out;
}

/** Nouvelle sélection avec `slug` à `quantity` (bornée au plafond). */
export function withQuantity(
  selection: InducementSelection,
  slug: string,
  quantity: number,
  options: readonly BuildInducementOption[],
): InducementSelection {
  return clampSelection({ ...selection, [slug]: quantity }, options);
}

/** Coût de la sélection, en kpo (unité du budget du builder). */
export function selectionCostK(
  selection: InducementSelection,
  options: readonly BuildInducementOption[],
): number {
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  let po = 0;
  for (const [slug, qty] of Object.entries(selection)) {
    const option = bySlug.get(slug);
    if (option) po += option.cost * qty;
  }
  return po / 1000;
}

/** Corps `inducements` de `POST /team/build` (sans prix : le serveur tarife). */
export function toBuildRequest(
  selection: InducementSelection,
): Array<{ slug: string; quantity: number }> {
  return Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([slug, quantity]) => ({ slug, quantity }));
}

/** Coup de pouce de l'équipe de base que la coupe n'autorise pas. */
export interface DiscardedInducement {
  readonly slug: string;
  readonly name: string;
  readonly quantity: number;
}

/**
 * « Adapter à la coupe » : les coups de pouce de l'équipe de base que le
 * catalogue de la coupe autorise sont repris (au prix de la COUPE, bornés à
 * son plafond), les autres sont listés comme écartés.
 */
export function partitionCloneInducements(
  base: ReadonlyArray<{ slug: string; name?: string; quantity: number }>,
  options: readonly BuildInducementOption[],
): { retained: InducementSelection; discarded: DiscardedInducement[] } {
  const known = new Set(options.map((o) => o.slug));
  const retained: Record<string, number> = {};
  const discarded: DiscardedInducement[] = [];
  for (const row of base) {
    if (known.has(row.slug)) {
      retained[row.slug] = (retained[row.slug] ?? 0) + row.quantity;
    } else {
      discarded.push({
        slug: row.slug,
        name: row.name ?? row.slug,
        quantity: row.quantity,
      });
    }
  }
  return { retained: clampSelection(retained, options), discarded };
}
