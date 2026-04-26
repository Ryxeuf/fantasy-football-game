import {
  buildSkillsSchema,
  type BuildSkillsSchemaInput,
} from "./skills-structured-data";

/**
 * Composant serveur emettant le JSON-LD DefinedTermSet + ItemList +
 * BreadcrumbList pour la page `/skills` (Q.12 — Sprint 23).
 */
export default function SkillsStructuredData(props: BuildSkillsSchemaInput) {
  const data = buildSkillsSchema(props);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
