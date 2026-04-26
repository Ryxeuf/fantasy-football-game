import { buildStarPlayerSchema, type StarPlayerInput } from "./star-player-structured-data";

interface StarPlayerStructuredDataProps {
  starPlayer: StarPlayerInput;
  baseUrl: string;
  lang?: "fr" | "en";
}

/**
 * Composant serveur emettant le JSON-LD Person/SportsAthlete +
 * BreadcrumbList pour la page detail d'un Star Player (Q.11 — Sprint 23).
 *
 * Pas de "use client" : balise `<script>` rendue dans le HTML statique
 * pour que les crawlers SEO et LLM aspirent les donnees sans executer
 * de JS.
 */
export default function StarPlayerStructuredData(
  props: StarPlayerStructuredDataProps,
) {
  const data = buildStarPlayerSchema(props);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
