/**
 * Helper pur produisant le JSON-LD `Person` / `SportsAthlete` +
 * `BreadcrumbList` pour la page detail d'un Star Player (Q.11 — Sprint 23).
 *
 * Pattern aligne sur `buildTeamSchema` (Q.10) : helper pur testable,
 * composant React server qui ne fait qu'emettre `<script>`.
 *
 * Citabilite LLM (GEO) :
 *   - description en deux langues avec fallback
 *   - knowsAbout[] = liste des skills/competences (utile pour LLM)
 *   - additionalProperty[] = stats brutes (MA, ST, AG+, PA+, AV+, Mega Star)
 *   - dateModified ISO
 *   - isPartOf -> Organization
 */

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface StarPlayerInput {
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  hirableBy: string[];
  specialRule?: string;
  specialRuleEn?: string;
  imageUrl?: string;
  isMegaStar?: boolean;
}

export interface BuildStarPlayerSchemaInput {
  starPlayer: StarPlayerInput;
  baseUrl: string;
  lang?: Lang;
  /** Override pour tests deterministes ; sinon ISO date du jour. */
  now?: Date;
}

function fallbackDescription(name: string, lang: Lang): string {
  if (lang === "en") {
    return `${name} is a Blood Bowl Star Player available for hire. See stats, skills and special rules.`;
  }
  return `${name} est un Star Player Blood Bowl disponible au recrutement. Voir stats, competences et regle speciale.`;
}

/** Convertit une URL d'asset interne vers une URL publique (`/images/...`). */
function resolveImageUrl(
  imageUrl: string | undefined,
  slug: string,
  baseUrl: string,
): string | undefined {
  if (!imageUrl) return undefined;
  // Patterns rencontres : "/data/Star-Players_files/<file>" ou deja absolu
  if (imageUrl.startsWith("http")) return imageUrl;
  const file = imageUrl
    .replace("/data/Star-Players_files/", "")
    .replace(/^\/+/, "");
  const finalFile = file.includes(slug) ? file : `${slug}.jpg`;
  return `${baseUrl}/images/star-players/${finalFile}`;
}

function parseSkills(skills: string): string[] {
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function buildStarPlayerSchema(
  input: BuildStarPlayerSchemaInput,
): Record<string, unknown> {
  const { starPlayer, baseUrl } = input;
  const lang: Lang = input.lang ?? "fr";
  const url = `${baseUrl}/star-players/${starPlayer.slug}`;
  const orgId = `${baseUrl}${ORG_ID_FRAGMENT}`;
  const dateModified = (input.now ?? new Date()).toISOString().split("T")[0];

  const description =
    (lang === "en"
      ? starPlayer.specialRuleEn ?? starPlayer.specialRule
      : starPlayer.specialRule ?? starPlayer.specialRuleEn) ??
    fallbackDescription(starPlayer.displayName, lang);

  const additionalProperty: Array<{
    "@type": "PropertyValue";
    name: string;
    value: string | number;
  }> = [
    {
      "@type": "PropertyValue",
      name: "Cost",
      value: `${(starPlayer.cost / 1000).toLocaleString("fr-FR")} kpo`,
    },
    { "@type": "PropertyValue", name: "MA", value: starPlayer.ma },
    { "@type": "PropertyValue", name: "ST", value: starPlayer.st },
    { "@type": "PropertyValue", name: "AG", value: `${starPlayer.ag}+` },
    {
      "@type": "PropertyValue",
      name: "PA",
      value: starPlayer.pa === null ? "-" : `${starPlayer.pa}+`,
    },
    { "@type": "PropertyValue", name: "AV", value: `${starPlayer.av}+` },
  ];
  if (starPlayer.isMegaStar) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Mega Star",
      value: "Oui",
    });
  }
  if (starPlayer.hirableBy.length > 0) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Hirable By",
      value: starPlayer.hirableBy.join(", "),
    });
  }

  const image = resolveImageUrl(starPlayer.imageUrl, starPlayer.slug, baseUrl);

  const person: Record<string, unknown> = {
    "@type": ["Person", "SportsAthlete"],
    "@id": `${url}#athlete`,
    name: starPlayer.displayName,
    url,
    description,
    sport: "Blood Bowl",
    jobTitle: "Blood Bowl Star Player",
    inLanguage: lang === "en" ? "en" : "fr-FR",
    dateModified,
    isPartOf: { "@id": orgId },
    additionalProperty,
    knowsAbout: parseSkills(starPlayer.skills),
  };
  if (image) {
    person.image = image;
  }

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Star Players",
        item: `${baseUrl}/star-players`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: starPlayer.displayName,
        item: url,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [person, breadcrumb],
  };
}
