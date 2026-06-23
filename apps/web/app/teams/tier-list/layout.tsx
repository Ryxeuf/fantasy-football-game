import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

const title = "Tier List Blood Bowl — Classement des 31 équipes (Saison 3)";
const description =
  "La tier list des 31 rosters Blood Bowl Saison 3, classés du Tier I au Tier IV : compétitivité, difficulté de prise en main et meilleur roster pour débuter.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Blood Bowl",
    "tier list",
    "classement équipes",
    "meilleure équipe Blood Bowl",
    "roster débutant",
    "Saison 3",
    "Nuffle Arena",
  ],
  alternates: {
    canonical: `${BASE_URL}/teams/tier-list`,
    languages: {
      "fr-FR": `${BASE_URL}/teams/tier-list`,
      en: `${BASE_URL}/teams/tier-list`,
      "x-default": `${BASE_URL}/teams/tier-list`,
    },
  },
  openGraph: {
    title,
    description,
    type: "article",
    url: `${BASE_URL}/teams/tier-list`,
    siteName: "Nuffle Arena",
    images: [
      {
        url: `${BASE_URL}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Tier List Blood Bowl - Nuffle Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${BASE_URL}/images/logo.png`],
  },
};

export default function TierListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
