/**
 * JSON-LD pour une page de detail de position `/teams/[slug]/[position]`.
 *
 * Helper pur (testable sans Prisma/React) qui produit un `@graph` :
 *   - `DefinedTerm` : la position elle-meme (nom + stats encodees en
 *     `description`, `url` de la page detail), rattachee a l'ensemble des
 *     positions du roster via `inDefinedTermSet`. Maximise la citabilite
 *     LLM : "la position X du roster Y a MA/ST/AG/PA/AV ...".
 *   - `BreadcrumbList` : Accueil > Equipes > {roster} > {position}.
 *
 * Calque sur `skills/skill-detail-structured-data.ts`.
 */

const ORG_ID_FRAGMENT = "#organization";

export interface PositionDetailInput {
  /** Slug du roster (ex: `skaven`). */
  rosterSlug: string;
  /** Nom d'affichage du roster (ex: `Skavens`). */
  rosterName: string;
  /** Segment d'URL de la position (slug prive du prefixe roster). */
  segment: string;
  /** Nom d'affichage nettoye de la position (ex: `Gutter Runner`). */
  name: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null; // null = pas de passe ("-")
  av: number;
}

export interface BuildPositionDetailSchemaInput {
  position: PositionDetailInput;
  baseUrl: string;
}

function statsSentence(p: PositionDetailInput): string {
  return `Position ${p.name} du roster ${p.rosterName} : MA ${p.ma}, ST ${p.st}, AG ${p.ag}+, PA ${p.pa != null ? `${p.pa}+` : "-"}, AV ${p.av}+. Cout ${p.cost}k po.`;
}

export function buildPositionDetailSchema(
  input: BuildPositionDetailSchemaInput,
): Record<string, unknown> {
  const { position, baseUrl } = input;
  const teamsUrl = `${baseUrl}/teams`;
  const rosterUrl = `${teamsUrl}/${position.rosterSlug}`;
  const detailUrl = `${rosterUrl}/${position.segment}`;

  const definedTerm = {
    "@type": "DefinedTerm",
    "@id": `${rosterUrl}#position-${position.segment}`,
    identifier: `${position.rosterSlug}_${position.segment}`,
    name: position.name,
    description: statsSentence(position),
    url: detailUrl,
    inLanguage: "fr-FR",
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${rosterUrl}#positions`,
      name: `Positions du roster ${position.rosterName}`,
      url: rosterUrl,
    },
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${detailUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Équipes", item: teamsUrl },
      {
        "@type": "ListItem",
        position: 3,
        name: position.rosterName,
        item: rosterUrl,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: position.name,
        item: detailUrl,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [definedTerm, breadcrumb],
  };
}
