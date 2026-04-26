import {
  buildTeamSchema,
  type BuildTeamSchemaInput,
} from "./team-structured-data";

/**
 * Composant serveur emettant le JSON-LD SportsTeam + BreadcrumbList
 * pour la page detail d'une equipe (Q.10 — Sprint 23).
 *
 * Pas de "use client" : on rend une simple balise <script> dans le DOM
 * statique pour que les crawlers SEO et LLM aspirent les donnees sans
 * executer de JS.
 */
export default function TeamStructuredData(props: BuildTeamSchemaInput) {
  const data = buildTeamSchema(props);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
