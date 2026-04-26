import type { Metadata } from "next";
import BreadcrumbStructuredData from "../components/BreadcrumbStructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const URL = `${BASE_URL}/a-propos`;

export const metadata: Metadata = {
  title: "A propos - Histoire, chiffres et roadmap | Nuffle Arena",
  description:
    "Histoire de Nuffle Arena, chiffres cles (rosters, star players, competences), equipe open-source et roadmap publique du projet Blood Bowl gratuit.",
  keywords: [
    "Nuffle Arena",
    "A propos",
    "About",
    "Histoire",
    "Roadmap",
    "Blood Bowl gratuit",
    "Open source",
    "Communaute Blood Bowl",
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
    title: "A propos de Nuffle Arena",
    description:
      "Histoire, chiffres cles, equipe et roadmap publique de Nuffle Arena, plateforme gratuite et open-source de gestion d'equipes Blood Bowl.",
    type: "website",
    url: URL,
    siteName: "Nuffle Arena",
    images: [
      {
        url: `${BASE_URL}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "A propos de Nuffle Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A propos de Nuffle Arena",
    description:
      "Histoire, chiffres, equipe et roadmap publique de Nuffle Arena.",
    images: [`${BASE_URL}/images/logo.png`],
  },
};

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${URL}#aboutpage`,
  url: URL,
  name: "A propos de Nuffle Arena",
  description:
    "Histoire, chiffres cles, equipe open-source et roadmap publique du projet Nuffle Arena.",
  inLanguage: ["fr-FR", "en"],
  isPartOf: { "@id": `${BASE_URL}#website` },
  mainEntity: { "@id": `${BASE_URL}#organization` },
  dateModified: new Date().toISOString().split("T")[0],
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData
        baseUrl={BASE_URL}
        id={`${URL}#breadcrumb`}
        items={[
          { name: "Accueil", path: "/" },
          { name: "A propos", path: "/a-propos" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />
      {children}
    </>
  );
}
