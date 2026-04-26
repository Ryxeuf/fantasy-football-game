/**
 * Helper pur produisant le JSON-LD `DefinedTermSet` + `ItemList` +
 * `BreadcrumbList` pour la page `/skills` (Q.12 — Sprint 23).
 *
 * Suit le meme pattern que Q.10 (teams) et Q.11 (star players) :
 * helper pur testable + composant React server qui ne fait qu'emettre
 * `<script>`.
 *
 * Citabilite LLM :
 *   - chaque skill devient un `DefinedTerm` avec `name`, `description`,
 *     `identifier` (slug), `termCode` (categorie) -> les LLM peuvent
 *     citer "le skill X est categorise Y et fait Z"
 *   - DefinedTermSet rassemble les 130+ skills sous un meme @id stable,
 *     avec `dateModified` pour la fraicheur
 *   - ItemList fournit l'ordre canonique pour les rich results
 */

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface SkillInput {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  category: string;
}

export interface BuildSkillsSchemaInput {
  skills: SkillInput[];
  ruleset: "season_2" | "season_3";
  baseUrl: string;
  lang?: Lang;
  /** Override pour tests deterministes ; sinon ISO date du jour. */
  now?: Date;
}

function buildName(skill: SkillInput, lang: Lang): string {
  return lang === "en" ? skill.nameEn : skill.nameFr;
}

function buildDescription(skill: SkillInput, lang: Lang): string {
  if (lang === "en") {
    return skill.descriptionEn ?? skill.description;
  }
  return skill.description ?? skill.descriptionEn ?? "";
}

export function buildSkillsSchema(
  input: BuildSkillsSchemaInput,
): Record<string, unknown> {
  const { skills, ruleset, baseUrl } = input;
  const lang: Lang = input.lang ?? "fr";
  const url = `${baseUrl}/skills`;
  const orgId = `${baseUrl}${ORG_ID_FRAGMENT}`;
  const setId = `${url}#defined-term-set-${ruleset}`;
  const dateModified = (input.now ?? new Date()).toISOString().split("T")[0];

  const setName =
    lang === "en"
      ? "Blood Bowl Skills, Mutations and Traits"
      : "Competences, mutations et traits Blood Bowl";
  const setDescription =
    lang === "en"
      ? "All Blood Bowl skills, mutations and traits, with categories and effects."
      : "Toutes les competences, mutations et traits Blood Bowl, avec categories et effets en jeu.";

  const definedTerms = skills.map((skill) => ({
    "@type": "DefinedTerm",
    "@id": `${url}#term-${skill.slug}`,
    identifier: skill.slug,
    name: buildName(skill, lang),
    description: buildDescription(skill, lang),
    termCode: skill.category,
    inLanguage: lang === "en" ? "en" : "fr-FR",
    inDefinedTermSet: { "@id": setId },
  }));

  const definedTermSet = {
    "@type": "DefinedTermSet",
    "@id": setId,
    name: setName,
    description: setDescription,
    url,
    inLanguage: lang === "en" ? "en" : "fr-FR",
    dateModified,
    isPartOf: { "@id": orgId },
    hasDefinedTerm: definedTerms,
  };

  const itemList = {
    "@type": "ItemList",
    "@id": `${url}#item-list-${ruleset}`,
    name: setName,
    numberOfItems: skills.length,
    itemListElement: skills.map((skill, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: { "@id": `${url}#term-${skill.slug}` },
    })),
  };

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
        name: lang === "en" ? "Skills" : "Competences",
        item: url,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [definedTermSet, itemList, breadcrumb],
  };
}
