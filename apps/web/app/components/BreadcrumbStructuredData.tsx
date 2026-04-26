import {
  buildBreadcrumbSchema,
  type BuildBreadcrumbSchemaInput,
} from "./breadcrumb-schema";

/**
 * Composant serveur emettant un JSON-LD `BreadcrumbList` autonome.
 *
 * Utiliser pour les pages profondes qui n'ont pas deja un `@graph`
 * embarquant leur breadcrumb (ex: tutoriel). Pour les pages qui ont
 * deja un schema racine (teams, star-players, skills), prefere
 * inliner le breadcrumb dans leur `@graph`.
 */
export default function BreadcrumbStructuredData(
  props: BuildBreadcrumbSchemaInput,
) {
  const data = buildBreadcrumbSchema(props);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
