import type { Metadata } from "next";
import BreadcrumbStructuredData from "../components/BreadcrumbStructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const URL = `${BASE_URL}/tutoriel`;

export const metadata: Metadata = {
  title: "Tutoriels Blood Bowl - Apprenez Nuffle Arena",
  description:
    "Tutoriels interactifs Blood Bowl pour debutants et joueurs experimentes : decouvrez les regles, le placement, les actions et la strategie pas a pas.",
  keywords: [
    "Blood Bowl",
    "Tutoriel",
    "Apprendre Blood Bowl",
    "Regles",
    "Nuffle Arena",
    "Debutant",
  ],
  alternates: {
    canonical: URL,
    languages: {
      "fr-FR": URL,
      en: URL,
      "x-default": URL,
    },
  },
  openGraph: {
    title: "Tutoriels Blood Bowl - Nuffle Arena",
    description:
      "Tutoriels interactifs Blood Bowl pour decouvrir les regles, le placement, les actions et la strategie pas a pas.",
    type: "website",
    url: URL,
    siteName: "Nuffle Arena",
    images: [
      {
        url: `${BASE_URL}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Tutoriels Blood Bowl - Nuffle Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tutoriels Blood Bowl - Nuffle Arena",
    description:
      "Tutoriels interactifs Blood Bowl : regles, placement, actions, strategie.",
    images: [`${BASE_URL}/images/logo.png`],
  },
};

export default function TutorielLayout({
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
          { name: "Tutoriels", path: "/tutoriel" },
        ]}
      />
      {children}
    </>
  );
}
