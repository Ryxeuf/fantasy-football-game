/**
 * Helper pur produisant le JSON-LD `SportsTeam` + `BreadcrumbList`
 * pour la page detail d'une equipe (Q.10 — Sprint 23).
 *
 * Le helper est volontairement decouple du composant React pour rester
 * testable sans dependance Next.js / DOM. Le composant React rendu cote
 * serveur se contente d'envelopper le JSON dans une balise <script>.
 *
 * Citabilite LLM (GEO) : on enrichit avec
 *   - alternateName (si dispo)
 *   - additionalProperty (Tier, Budget, NAF, Ruleset)
 *   - athlete[] = positions du roster (chacune comme Person + role)
 *   - dateModified (signal de fraicheur)
 *   - isPartOf -> Organization (chaine de confiance)
 */

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface TeamSchemaPosition {
  slug: string;
  displayName: string;
  cost?: number;
  ma?: number;
  st?: number;
  ag?: number;
  pa?: number;
  av?: number;
}

export interface TeamSchemaRoster {
  name: string;
  budget?: number;
  tier?: string;
  naf?: boolean;
  descriptionFr?: string;
  descriptionEn?: string;
  positions: TeamSchemaPosition[];
}

export interface BuildTeamSchemaInput {
  slug: string;
  roster: TeamSchemaRoster;
  ruleset: "season_2" | "season_3";
  baseUrl: string;
  lang?: Lang;
  /** Override pour tests deterministes ; sinon ISO date du jour. */
  now?: Date;
}

/** Fallback de description quand le roster n'en a pas. */
function fallbackDescription(name: string, lang: Lang): string {
  if (lang === "en") {
    return `Discover the ${name} Blood Bowl roster: positions, costs, skills and tier information for tabletop play.`;
  }
  return `Decouvrez le roster Blood Bowl ${name} : positions, couts, competences et tier pour jouer sur table.`;
}

/** Convertit un tier en libelle lisible (Tier I -> "Tier I"). */
function tierLabel(tier?: string): string {
  return tier ? `Tier ${tier}` : "Tier inconnu";
}

/** Construit le JSON-LD SportsTeam + BreadcrumbList pour une page d'equipe. */
export function buildTeamSchema(
  input: BuildTeamSchemaInput,
): Record<string, unknown> {
  const lang: Lang = input.lang ?? "fr";
  const url = `${input.baseUrl}/teams/${input.slug}`;
  const orgId = `${input.baseUrl}${ORG_ID_FRAGMENT}`;
  const dateModified = (input.now ?? new Date()).toISOString().split("T")[0];

  const description =
    (lang === "en" ? input.roster.descriptionEn : input.roster.descriptionFr) ??
    input.roster.descriptionFr ??
    input.roster.descriptionEn ??
    fallbackDescription(input.roster.name, lang);

  const additionalProperty: Array<{
    "@type": "PropertyValue";
    name: string;
    value: string | number;
  }> = [];

  if (input.roster.tier) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Tier",
      value: input.roster.tier,
    });
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Tier Label",
      value: tierLabel(input.roster.tier),
    });
  }
  if (typeof input.roster.budget === "number") {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Budget",
      value: `${input.roster.budget} kpo`,
    });
  }
  additionalProperty.push({
    "@type": "PropertyValue",
    name: "Ruleset",
    value: input.ruleset === "season_3" ? "Saison 3" : "Saison 2",
  });
  if (typeof input.roster.naf === "boolean") {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "NAF Approved",
      value: input.roster.naf ? "Oui" : "Non",
    });
  }
  additionalProperty.push({
    "@type": "PropertyValue",
    name: "Positions",
    value: input.roster.positions.length,
  });

  const athlete = input.roster.positions.map((p) => {
    const person: Record<string, unknown> = {
      "@type": "Person",
      name: p.displayName,
      identifier: p.slug,
      jobTitle: p.displayName,
      memberOf: { "@id": `${url}#sportsteam` },
    };
    if (typeof p.cost === "number") {
      person.estimatedSalary = {
        "@type": "MonetaryAmount",
        currency: "GBP",
        value: { "@type": "QuantitativeValue", value: p.cost * 1000 },
      };
    }
    return person;
  });

  const sportsTeam = {
    "@type": "SportsTeam",
    "@id": `${url}#sportsteam`,
    name: input.roster.name,
    url,
    sport: "Blood Bowl",
    description,
    inLanguage: lang === "en" ? "en" : "fr-FR",
    dateModified,
    isPartOf: { "@id": orgId },
    additionalProperty,
    athlete,
  } as Record<string, unknown>;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: input.baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Equipes",
        item: `${input.baseUrl}/teams`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.roster.name,
        item: url,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [sportsTeam, breadcrumb],
  };
}
