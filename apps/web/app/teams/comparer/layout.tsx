import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

const title = "Comparateur d'équipes Blood Bowl — Comparer les rosters";
const description =
  "Comparez 2 à 3 équipes Blood Bowl côte à côte : tier, budget, positions, difficulté, style de jeu et Star Players. Outil interactif pour choisir votre roster.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Blood Bowl",
    "comparateur",
    "comparer équipes",
    "rosters",
    "tier",
    "Nuffle Arena",
  ],
  alternates: {
    canonical: `${BASE_URL}/teams/comparer`,
    languages: {
      "fr-FR": `${BASE_URL}/teams/comparer`,
      en: `${BASE_URL}/teams/comparer`,
      "x-default": `${BASE_URL}/teams/comparer`,
    },
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: `${BASE_URL}/teams/comparer`,
    siteName: "Nuffle Arena",
    images: [
      {
        url: `${BASE_URL}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Comparateur d'équipes Blood Bowl - Nuffle Arena",
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

export default function ComparerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
