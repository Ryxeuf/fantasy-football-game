"use client";
import StructuredData from "./StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

/**
 * Composant pour ajouter les données structurées JSON-LD à la page d'accueil
 */
export default function HomeStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Nuffle Arena",
    "alternateName": "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
    "description": "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin. Créez et gérez vos équipes, explorez les rosters officiels et les Star Players.",
    "url": BASE_URL,
    "applicationCategory": "GameApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "ratingCount": "1"
    },
    "featureList": [
      "Gestion d'équipes Blood Bowl",
      "Rosters officiels",
      "Star Players",
      "Export PDF",
      "Création d'équipes personnalisées"
    ],
    "screenshot": `${BASE_URL}/images/logo.png`,
    "softwareVersion": "1.0",
    "releaseNotes": "Application de gestion d'équipes Blood Bowl",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareHelp": {
      "@type": "CreativeWork",
      "text": "Application web pour créer et gérer vos équipes Blood Bowl"
    }
  };

  return <StructuredData data={structuredData} />;
}

