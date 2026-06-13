/**
 * JSON-LD pour une page de comparaison `/teams/comparer/[matchup]`.
 *
 * Helper pur (testable sans React) produisant un `@graph` :
 *   - `ItemList` ordonné des deux équipes comparées, chaque entrée pointant
 *     vers la page détail `/teams/[slug]` (maillage interne + citabilité LLM :
 *     « Nuffle Arena compare X et Y »).
 *   - `BreadcrumbList` : Accueil > Équipes > Comparer > {X vs Y}.
 *
 * L'URL de la page utilise toujours le matchup CANONIQUE (ordre alphabétique)
 * pour éviter de dupliquer l'entité entre `a-vs-b` et `b-vs-a`.
 */

import { canonicalMatchup } from "./matchup";

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface ComparisonTeam {
  readonly slug: string;
  readonly name: string;
}

export interface BuildComparisonSchemaInput {
  readonly teams: readonly [ComparisonTeam, ComparisonTeam];
  readonly baseUrl: string;
  readonly lang?: Lang;
}

export function buildComparisonSchema(
  input: BuildComparisonSchemaInput,
): Record<string, unknown> {
  const { teams, baseUrl } = input;
  const lang: Lang = input.lang ?? "fr";
  const [first, second] = teams;
  const matchup = canonicalMatchup(first.slug, second.slug);
  const url = `${baseUrl}/teams/comparer/${matchup}`;
  const compareUrl = `${baseUrl}/teams/comparer`;
  const inLanguage = lang === "en" ? "en" : "fr-FR";

  const name =
    lang === "en"
      ? `${first.name} vs ${second.name} — Blood Bowl roster comparison`
      : `${first.name} vs ${second.name} — comparaison de rosters Blood Bowl`;

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list`,
    name,
    inLanguage,
    numberOfItems: 2,
    itemListElement: teams.map((team, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: team.name,
      url: `${baseUrl}/teams/${team.slug}`,
    })),
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
        name: lang === "en" ? "Compare" : "Comparer",
        item: compareUrl,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: `${first.name} vs ${second.name}`,
        item: url,
      },
    ],
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

  return {
    "@context": "https://schema.org",
    "@graph": [collectionPage, itemList, breadcrumb],
  };
}
