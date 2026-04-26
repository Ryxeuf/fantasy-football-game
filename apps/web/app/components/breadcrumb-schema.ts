/**
 * Helper pur produisant un JSON-LD `BreadcrumbList` autonome
 * (avec `@context`) pour les pages profondes (Q.13 — Sprint 23).
 *
 * Reutilisable depuis n'importe quelle page. Distinct des breadcrumbs
 * inlinees dans les `@graph` de Q.10/Q.11/Q.12 : ce helper produit un
 * document JSON-LD a part entiere quand on n'a pas de schema racine
 * a etendre (ex: page tutoriel sans SportsTeam ou DefinedTermSet).
 */

export interface BreadcrumbItem {
  /** Libelle visible dans le fil d'Ariane. */
  name: string;
  /** URL relative ("/tutoriel") ou absolue ("https://..."). */
  path: string;
}

export interface BuildBreadcrumbSchemaInput {
  items: BreadcrumbItem[];
  baseUrl: string;
  /** `@id` stable optionnel (utile pour cross-referencer). */
  id?: string;
}

function resolveUrl(path: string, baseUrl: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${baseUrl}${path}`;
  return `${baseUrl}/${path}`;
}

export function buildBreadcrumbSchema(
  input: BuildBreadcrumbSchemaInput,
): Record<string, unknown> {
  const { items, baseUrl, id } = input;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: entry.name,
      item: resolveUrl(entry.path, baseUrl),
    })),
  };
  if (id) {
    schema["@id"] = id;
  }
  return schema;
}
