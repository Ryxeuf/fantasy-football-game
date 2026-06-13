/**
 * JSON-LD pour la page liste `/star-players` : `CollectionPage` +
 * `ItemList` + `BreadcrumbList`. Helper pur (testable sans React).
 */

const ORG_ID_FRAGMENT = "#organization";

export interface StarPlayersListItem {
  slug: string;
  name: string;
}

export interface BuildStarPlayersListSchemaInput {
  items: StarPlayersListItem[];
  baseUrl: string;
  lang?: "fr" | "en";
}

export function buildStarPlayersListSchema(
  input: BuildStarPlayersListSchemaInput,
): Record<string, unknown> {
  const { items, baseUrl } = input;
  const lang = input.lang ?? "fr";
  const url = `${baseUrl}/star-players`;
  const name = lang === "en" ? "Blood Bowl Star Players" : "Star Players Blood Bowl";

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      url: `${baseUrl}/star-players/${item.slug}`,
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
      { "@type": "ListItem", position: 2, name: "Star Players", item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}
