import type { Metadata } from "next";
import { findTutorialScript } from "@bb/game-engine";
import BreadcrumbStructuredData from "../../components/BreadcrumbStructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

interface LayoutProps {
  children: React.ReactNode;
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const script = findTutorialScript(params.slug);
  if (!script) {
    return {
      title: "Tutoriel introuvable - Nuffle Arena",
      description: "Le tutoriel demande n'a pas ete trouve.",
    };
  }
  const url = `${BASE_URL}/tutoriel/${params.slug}`;
  const title = `${script.titleFr} - Tutoriel Blood Bowl`;
  return {
    title,
    description: script.summaryFr,
    keywords: [
      "Blood Bowl",
      "Tutoriel",
      script.titleFr,
      "Nuffle Arena",
      script.difficulty,
    ],
    alternates: {
      canonical: url,
      languages: {
        "fr-FR": url,
        en: url,
        "x-default": url,
      },
    },
    openGraph: {
      title,
      description: script.summaryFr,
      type: "website",
      url,
      siteName: "Nuffle Arena",
      images: [
        {
          url: `${BASE_URL}/images/logo.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: script.summaryFr,
      images: [`${BASE_URL}/images/logo.png`],
    },
  };
}

export default function TutorielSlugLayout({ children, params }: LayoutProps) {
  const script = findTutorialScript(params.slug);
  const breadcrumbItems = [
    { name: "Accueil", path: "/" },
    { name: "Tutoriels", path: "/tutoriel" },
    ...(script
      ? [{ name: script.titleFr, path: `/tutoriel/${params.slug}` }]
      : []),
  ];
  return (
    <>
      <BreadcrumbStructuredData
        baseUrl={BASE_URL}
        id={`${BASE_URL}/tutoriel/${params.slug}#breadcrumb`}
        items={breadcrumbItems}
      />
      {children}
    </>
  );
}
