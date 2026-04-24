"use client";
import StructuredData from "./StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

/**
 * Composant pour ajouter les données structurées JSON-LD à la page d'accueil.
 *
 * Combine plusieurs types schema.org dans un @graph unique :
 * - Organization (pour Google Knowledge Panel)
 * - WebSite (pour sitelinks search box)
 * - WebApplication (pour la nature logicielle du site)
 * - FAQPage (pour les rich results FAQ)
 */
export default function HomeStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE_URL}#organization`,
        name: "Nuffle Arena",
        url: BASE_URL,
        logo: `${BASE_URL}/images/logo.png`,
        description:
          "Plateforme digitale gratuite pour créer et gérer vos équipes Blood Bowl selon les règles officielles 2025 (Saison 3).",
        sameAs: ["https://discord.gg/XEZJTgEHKn"],
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}#website`,
        url: BASE_URL,
        name: "Nuffle Arena",
        description:
          "Gestionnaire d'équipes Blood Bowl : rosters, Star Players, compétences, export PDF et suivi de match sur table.",
        inLanguage: ["fr-FR", "en"],
        publisher: { "@id": `${BASE_URL}#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${BASE_URL}#webapp`,
        name: "Nuffle Arena",
        alternateName: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
        description:
          "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin. Créez et gérez vos équipes, explorez les 30 rosters officiels et 60+ Star Players, et exportez vos rosters en PDF pour vos matchs sur table.",
        url: BASE_URL,
        applicationCategory: "GameApplication",
        applicationSubCategory: "Fantasy Football",
        operatingSystem: "Web (tout navigateur moderne)",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        inLanguage: ["fr-FR", "en"],
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "30 rosters officiels Saison 3",
          "60+ Star Players avec règles spéciales",
          "130+ compétences, mutations et traits",
          "Recrutement et gestion de budget",
          "Export PDF prêt pour la table",
          "Tutoriels interactifs",
          "Suivi des matchs joués sur table",
          "Multilingue français / anglais",
        ],
        screenshot: `${BASE_URL}/images/logo.png`,
        publisher: { "@id": `${BASE_URL}#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${BASE_URL}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Nuffle Arena est-il gratuit ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oui. Nuffle Arena est 100% gratuit, sans publicité ni paywall. Vous pouvez nous soutenir via Ko-fi pour aider à couvrir les frais de serveurs.",
            },
          },
          {
            "@type": "Question",
            name: "Nuffle Arena est-il un produit officiel Blood Bowl ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Non. Nuffle Arena est un projet de fans, indépendant de Games Workshop. Il respecte les règles Blood Bowl 2025 (Saison 3) pour une expérience fidèle.",
            },
          },
          {
            "@type": "Question",
            name: "Puis-je utiliser Nuffle Arena pour mes matchs Blood Bowl sur table ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oui. Créez votre équipe, exportez-la en PDF et suivez vos matchs sur table avec notre outil de suivi (scores, blessures, progression des joueurs, trésorerie).",
            },
          },
          {
            "@type": "Question",
            name: "Quelles équipes Blood Bowl sont disponibles ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Les 30 rosters officiels Saison 3 : Skaven, Elfes (Union, Sylvains, Noirs, Pro Elves, Hauts Elfes), Orques, Orques Noirs, Nains, Hommes-Lézards, Gnomes, Halflings, Noblesse Impériale, Chaos, Khemri, Nurgle, Morts-Vivants, Vampires, Amazones, Nordiques, Ogres, Gobelins, Snotlings, Alliance du Vieux Monde et plus.",
            },
          },
        ],
      },
    ],
  };

  return <StructuredData data={structuredData} />;
}
