"use client";
import StructuredData from "./StructuredData";
import { buildExternalSameAs } from "../lib/external-identity";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

const EXTERNAL_SAME_AS = buildExternalSameAs({
  NEXT_PUBLIC_WIKIDATA_QID: process.env.NEXT_PUBLIC_WIKIDATA_QID,
  NEXT_PUBLIC_WIKIPEDIA_FR_URL: process.env.NEXT_PUBLIC_WIKIPEDIA_FR_URL,
  NEXT_PUBLIC_WIKIPEDIA_EN_URL: process.env.NEXT_PUBLIC_WIKIPEDIA_EN_URL,
});

/**
 * Données structurées JSON-LD de la page d'accueil.
 *
 * Regroupe plusieurs types schema.org dans un `@graph` unique :
 * - Organization (Google Knowledge Panel, reconnaissance d'entité)
 * - WebSite (sitelinks search box)
 * - WebApplication (nature logicielle, feature list, offre gratuite)
 * - FAQPage (rich results FAQ pour Google et pour les LLM)
 *
 * Objectif secondaire : maximiser la citabilité par les modèles de
 * langage (GEO / LLMO) — chaque bloc contient des faits clairs,
 * datés et sourcés.
 */
export default function HomeStructuredData() {
  const lastUpdated = new Date().toISOString().split("T")[0];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE_URL}#organization`,
        name: "Nuffle Arena",
        alternateName: ["Nuffle Arena - Blood Bowl", "NuffleArena"],
        url: BASE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${BASE_URL}/images/logo.png`,
          width: 1200,
          height: 630,
        },
        description:
          "Plateforme digitale gratuite pour créer et gérer vos équipes Blood Bowl selon les règles officielles 2025 (Saison 3).",
        foundingDate: "2025",
        sameAs: [
          "https://discord.gg/XEZJTgEHKn",
          "https://ko-fi.com/nufflearena",
          ...EXTERNAL_SAME_AS,
        ],
        knowsAbout: [
          "Blood Bowl",
          "Blood Bowl 2025",
          "Blood Bowl Saison 3",
          "Fantasy Football",
          "Games Workshop",
          "Warhammer",
          "Tabletop games",
          "Team management",
          "Roster building",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}#website`,
        url: BASE_URL,
        name: "Nuffle Arena",
        description:
          "Gestionnaire d'équipes Blood Bowl : rosters, Star Players, compétences, export PDF, ligues et coupes avec feuilles de match.",
        inLanguage: ["fr-FR", "en"],
        publisher: { "@id": `${BASE_URL}#organization` },
        dateModified: lastUpdated,
      },
      {
        "@type": "WebApplication",
        "@id": `${BASE_URL}#webapp`,
        name: "Nuffle Arena",
        alternateName: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
        description:
          "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin. Créez et gérez vos équipes, explorez les 31 rosters officiels et 60+ Star Players, et exportez vos rosters en PDF pour vos matchs sur table.",
        url: BASE_URL,
        applicationCategory: "GameApplication",
        applicationSubCategory: "Fantasy Football",
        operatingSystem: "Web (tout navigateur moderne)",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        inLanguage: ["fr-FR", "en"],
        isAccessibleForFree: true,
        dateModified: lastUpdated,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "31 rosters officiels Saison 3",
          "60+ Star Players avec règles spéciales",
          "130+ compétences, mutations et traits",
          "Recrutement et gestion de budget",
          "Export PDF prêt pour la table",
          "Tutoriels interactifs",
          "Gestion de ligue : poules, calendrier, classements, play-offs, pronostics",
          "Coupes et tournois : rondes suisses, poules et play-offs",
          "Feuilles de match conformes au livre (PSP, blessures, trésorerie)",
          "Multilingue français / anglais",
        ],
        screenshot: `${BASE_URL}/images/logo.png`,
        publisher: { "@id": `${BASE_URL}#organization` },
        about: {
          "@type": "Game",
          name: "Blood Bowl",
          description:
            "Jeu de plateau de Fantasy Football édité par Games Workshop, mêlant stratégie de football américain et univers fantastique Warhammer.",
          genre: ["Fantasy Football", "Tabletop", "Strategy"],
          gamePlatform: "Tabletop",
        },
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
              text: "Oui. Créez votre équipe, exportez-la en PDF, puis inscrivez-la à une ligue ou à une coupe : chaque match se saisit sur une feuille de match (score, sorties, blessures, PSP, évolutions, trésorerie) qui fait vivre votre équipe d'une rencontre à l'autre.",
            },
          },
          {
            "@type": "Question",
            name: "Puis-je organiser ma propre ligue Blood Bowl ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oui, la gestion de ligue est ouverte à tous et gratuite. Créez une ligue publique ou privée, invitez les coachs, générez le calendrier, validez les feuilles de match et suivez classements, play-offs et pronostics. Les coupes (rondes suisses, poules et play-offs) fonctionnent de la même façon.",
            },
          },
          {
            "@type": "Question",
            name: "Quelles équipes Blood Bowl sont disponibles ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Les 31 rosters officiels Saison 3 : Skaven, Elfes (Union, Sylvains, Noirs, Pro Elves, Hauts Elfes), Orques, Orques Noirs, Nains, Hommes-Lézards, Gnomes, Halflings, Noblesse Impériale, Chaos, Khemri, Nurgle, Morts-Vivants, Vampires, Amazones, Nordiques, Ogres, Gobelins, Snotlings, Alliance du Vieux Monde et plus.",
            },
          },
          {
            "@type": "Question",
            name: "Combien de Star Players sont disponibles ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Plus de 60 Star Players sont référencés avec leurs statistiques, compétences et règles spéciales, parmi lesquels Griff Oberwald, Morg 'n' Thorg, Hakflem Skuttlespike, Helmut Wulf, Grashnak Blackhoof. Chaque équipe peut recruter les Star Players autorisés par ses règles régionales.",
            },
          },
          {
            "@type": "Question",
            name: "Quelle version des règles est utilisée ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Nuffle Arena suit les règles officielles Blood Bowl 2025 (Saison 3) de Games Workshop, avec compatibilité historique Saison 2.",
            },
          },
        ],
      },
    ],
  };

  return <StructuredData data={structuredData} />;
}
