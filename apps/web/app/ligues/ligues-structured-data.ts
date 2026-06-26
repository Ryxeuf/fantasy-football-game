/**
 * JSON-LD pour les pages Ligues régionales `/ligues` et `/ligues/[slug]`.
 * Helpers purs (testables sans React) — `CollectionPage` + `ItemList` +
 * `BreadcrumbList`, sur le même modèle que `teams-list-structured-data.ts`.
 */

const ORG_ID_FRAGMENT = "#organization";

export interface LeagueListItem {
  slug: string;
  name: string;
}

export function buildLeaguesListSchema(input: {
  items: LeagueListItem[];
  baseUrl: string;
}): Record<string, unknown> {
  const { items, baseUrl } = input;
  const url = `${baseUrl}/ligues`;
  const name = "Ligues régionales Blood Bowl";

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      url: `${baseUrl}/ligues/${item.slug}`,
    })),
  };

  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
    mainEntity: { "@id": `${url}#item-list` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Ligues", item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}

export interface LeagueRosterItem {
  slug: string;
  name: string;
}

export function buildLeagueDetailSchema(input: {
  league: { slug: string; name: string; description: string };
  rosters: LeagueRosterItem[];
  baseUrl: string;
}): Record<string, unknown> {
  const { league, rosters, baseUrl } = input;
  const url = `${baseUrl}/ligues/${league.slug}`;

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name: `Équipes de la ${league.name}`,
    numberOfItems: rosters.length,
    itemListElement: rosters.map((roster, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: roster.name,
      url: `${baseUrl}/teams/${roster.slug}`,
    })),
  };

  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: league.name,
    description: league.description,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
    mainEntity: { "@id": `${url}#item-list` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Ligues", item: `${baseUrl}/ligues` },
      { "@type": "ListItem", position: 3, name: league.name, item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}
