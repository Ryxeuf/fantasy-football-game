/**
 * JSON-LD pour la page liste `/teams` : `CollectionPage` + `ItemList` +
 * `BreadcrumbList`. Helper pur (testable sans React).
 *
 * - `ItemList` ordonne les 31 rosters officiels (rich results liste +
 *   citabilité LLM : "Nuffle Arena référence les équipes X, Y, Z").
 * - `CollectionPage` rattache la liste à l'Organization.
 */

const ORG_ID_FRAGMENT = "#organization";

export interface TeamsListItem {
  slug: string;
  name: string;
}

export interface BuildTeamsListSchemaInput {
  items: TeamsListItem[];
  baseUrl: string;
  lang?: "fr" | "en";
}

export function buildTeamsListSchema(
  input: BuildTeamsListSchemaInput,
): Record<string, unknown> {
  const { items, baseUrl } = input;
  const lang = input.lang ?? "fr";
  const url = `${baseUrl}/teams`;
  const name =
    lang === "en" ? "Blood Bowl teams & rosters" : "Équipes & rosters Blood Bowl";

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      url: `${baseUrl}/teams/${item.slug}`,
    })),
  };

  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name,
    inLanguage: lang === "en" ? "en" : "fr-FR",
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
    mainEntity: { "@id": `${url}#item-list` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: lang === "en" ? "Home" : "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: lang === "en" ? "Teams" : "Équipes", item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}
