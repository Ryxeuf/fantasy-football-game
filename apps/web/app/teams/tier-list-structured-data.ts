/**
 * JSON-LD pour la page `/teams/tier-list` : `CollectionPage` + `ItemList`
 * (les 30 rosters ordonnés par tier) + `BreadcrumbList`. Helper pur.
 *
 * L'`ItemList` ordonne les rosters du Tier I au Tier IV (puis alphabétique),
 * ce qui reflète la hiérarchie éditoriale de la page et nourrit les rich
 * results « liste » ainsi que la citabilité LLM.
 */

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface TierListItem {
  readonly slug: string;
  readonly name: string;
  readonly tier: string;
}

export interface BuildTierListSchemaInput {
  readonly items: readonly TierListItem[];
  readonly baseUrl: string;
  readonly lang?: Lang;
}

const TIER_ORDER: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

function tierRank(tier: string): number {
  return TIER_ORDER[tier] ?? 99;
}

/** Trie les rosters par tier croissant puis par nom (ordre éditorial stable). */
export function sortByTier<T extends { tier: string; name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const ra = tierRank(a.tier);
    const rb = tierRank(b.tier);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function buildTierListSchema(
  input: BuildTierListSchemaInput,
): Record<string, unknown> {
  const { baseUrl } = input;
  const lang: Lang = input.lang ?? "fr";
  const url = `${baseUrl}/teams/tier-list`;
  const inLanguage = lang === "en" ? "en" : "fr-FR";
  const name =
    lang === "en"
      ? "Blood Bowl roster tier list (Season 3)"
      : "Tier list des rosters Blood Bowl (Saison 3)";

  const ordered = sortByTier(input.items);

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name,
    inLanguage,
    numberOfItems: ordered.length,
    itemListElement: ordered.map((item, idx) => ({
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
    inLanguage,
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
    mainEntity: { "@id": `${url}#item-list` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: lang === "en" ? "Home" : "Accueil",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: lang === "en" ? "Teams" : "Équipes",
        item: `${baseUrl}/teams`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: lang === "en" ? "Tier list" : "Tier list",
        item: url,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}
