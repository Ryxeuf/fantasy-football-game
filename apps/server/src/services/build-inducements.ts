/**
 * Achat de coups de pouce À LA CONSTRUCTION d'une équipe : la demande du
 * coach (`{ slug, quantity }`) confrontée au catalogue EFFECTIF servi par le
 * serveur (`buildInducementCatalogue`).
 *
 * Le PRIX vient toujours du catalogue : la demande n'en porte pas (le schéma
 * Zod ne déclare pas `cost`), si bien qu'un montant saisi côté client ne peut
 * ni réduire ni gonfler la dépense — même posture que le recrutement d'un
 * journalier (`purchasesGoldDelta`).
 *
 * 100 % pur ⇒ testable sans Prisma (`build-inducements.test.ts`).
 */

/** Ligne de catalogue utile à la résolution (cf. `InducementOption`). */
export interface BuildInducementCatalogueEntry {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly maxQuantity: number;
}

/** Demande du coach. */
export interface BuildInducementRequest {
  readonly slug: string;
  readonly quantity: number;
}

/** Ligne achetée, prix unitaire figé au catalogue. */
export interface BuildInducementLine {
  readonly slug: string;
  readonly name: string;
  readonly quantity: number;
  /** Prix unitaire, en po. */
  readonly unitCost: number;
}

export type ResolveBuildInducementsResult =
  | {
      readonly ok: true;
      readonly lines: readonly BuildInducementLine[];
      /** Total, en po. */
      readonly totalCost: number;
    }
  | { readonly ok: false; readonly error: string };

export function resolveBuildInducements(
  requested: readonly BuildInducementRequest[],
  catalogue: readonly BuildInducementCatalogueEntry[],
): ResolveBuildInducementsResult {
  const bySlug = new Map(catalogue.map((entry) => [entry.slug, entry]));
  const seen = new Set<string>();
  const lines: BuildInducementLine[] = [];
  let totalCost = 0;

  for (const request of requested) {
    if (seen.has(request.slug)) {
      return {
        ok: false,
        error: `Coup de pouce demandé deux fois : « ${request.slug} »`,
      };
    }
    seen.add(request.slug);
    const entry = bySlug.get(request.slug);
    if (!entry) {
      return {
        ok: false,
        error: `Coup de pouce non disponible pour cette équipe à la création : « ${request.slug} »`,
      };
    }
    if (!Number.isInteger(request.quantity) || request.quantity < 1) {
      return { ok: false, error: `Quantité invalide pour ${entry.name}` };
    }
    if (request.quantity > entry.maxQuantity) {
      return {
        ok: false,
        error: `${entry.name} : ${entry.maxQuantity} au plus (demandé ${request.quantity})`,
      };
    }
    lines.push({
      slug: entry.slug,
      name: entry.name,
      quantity: request.quantity,
      unitCost: entry.cost,
    });
    totalCost += entry.cost * request.quantity;
  }

  return { ok: true, lines, totalCost };
}
