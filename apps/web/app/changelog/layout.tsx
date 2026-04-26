import type { Metadata } from "next";
import BreadcrumbStructuredData from "../components/BreadcrumbStructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const URL = `${BASE_URL}/changelog`;
const FEED_URL = `${BASE_URL}/feed.xml`;

export const metadata: Metadata = {
  title: "Changelog public - Nouveautes Nuffle Arena",
  description:
    "Historique public des releases de Nuffle Arena : nouvelles features, regles BB3, multijoueur, corrections. Disponible aussi en RSS.",
  keywords: [
    "Nuffle Arena",
    "Changelog",
    "Nouveautes",
    "Releases",
    "Blood Bowl",
    "RSS",
  ],
  alternates: {
    canonical: URL,
    languages: {
      "fr-FR": URL,
      en: URL,
      "x-default": URL,
    },
    types: {
      "application/rss+xml": [{ url: FEED_URL, title: "Nuffle Arena Changelog (RSS)" }],
    },
  },
  openGraph: {
    title: "Changelog public - Nuffle Arena",
    description:
      "Historique public des releases de Nuffle Arena : nouveautes, ameliorations, corrections.",
    type: "website",
    url: URL,
    siteName: "Nuffle Arena",
    images: [
      {
        url: `${BASE_URL}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Changelog Nuffle Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog public - Nuffle Arena",
    description: "Historique des releases : features, fixes, ameliorations.",
    images: [`${BASE_URL}/images/logo.png`],
  },
};

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbStructuredData
        baseUrl={BASE_URL}
        id={`${URL}#breadcrumb`}
        items={[
          { name: "Accueil", path: "/" },
          { name: "Changelog", path: "/changelog" },
        ]}
      />
      {children}
    </>
  );
}
