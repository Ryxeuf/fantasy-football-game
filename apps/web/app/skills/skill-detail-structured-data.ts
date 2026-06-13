/**
 * JSON-LD pour une page de detail de competence `/skills/[slug]`.
 *
 * Helper pur (testable sans Prisma/React) qui produit un `@graph` :
 *   - `DefinedTerm` : la competence elle-meme. Reutilise le `@id`
 *     canonique `${baseUrl}/skills#term-${slug}` deja emis par la page
 *     liste (`skills-structured-data.ts`) -> meme entite, deux pages.
 *     Ajoute `url` (la page detail) + `inDefinedTermSet` pour rattacher
 *     la competence a l'ensemble. Maximise la citabilite LLM : "le skill
 *     X est categorise Y et fait Z".
 *   - `BreadcrumbList` : Accueil > Competences > {nom}.
 */

const ORG_ID_FRAGMENT = "#organization";

export type Lang = "fr" | "en";

export interface SkillDetailInput {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  category: string;
  ruleset: "season_2" | "season_3" | string;
}

export interface BuildSkillDetailSchemaInput {
  skill: SkillDetailInput;
  baseUrl: string;
  lang?: Lang;
}

function pickName(skill: SkillDetailInput, lang: Lang): string {
  return lang === "en" ? skill.nameEn : skill.nameFr;
}

function pickDescription(skill: SkillDetailInput, lang: Lang): string {
  if (lang === "en") return skill.descriptionEn ?? skill.description ?? "";
  return skill.description ?? skill.descriptionEn ?? "";
}

export function buildSkillDetailSchema(
  input: BuildSkillDetailSchemaInput,
): Record<string, unknown> {
  const { skill, baseUrl } = input;
  const lang: Lang = input.lang ?? "fr";
  const skillsUrl = `${baseUrl}/skills`;
  const detailUrl = `${skillsUrl}/${skill.slug}`;
  const ruleset = skill.ruleset === "season_2" ? "season_2" : "season_3";
  const inLanguage = lang === "en" ? "en" : "fr-FR";

  const definedTerm = {
    "@type": "DefinedTerm",
    "@id": `${skillsUrl}#term-${skill.slug}`,
    identifier: skill.slug,
    name: pickName(skill, lang),
    description: pickDescription(skill, lang),
    termCode: skill.category,
    url: detailUrl,
    inLanguage,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${skillsUrl}#defined-term-set-${ruleset}`,
      name:
        lang === "en"
          ? "Blood Bowl Skills, Mutations and Traits"
          : "Competences, mutations et traits Blood Bowl",
      url: skillsUrl,
    },
    isPartOf: { "@id": `${baseUrl}${ORG_ID_FRAGMENT}` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${detailUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: lang === "en" ? "Home" : "Accueil", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: lang === "en" ? "Skills" : "Compétences",
        item: skillsUrl,
      },
      { "@type": "ListItem", position: 3, name: pickName(skill, lang), item: detailUrl },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [definedTerm, breadcrumb],
  };
}
