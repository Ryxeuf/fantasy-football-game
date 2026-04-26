import type { Metadata } from "next";
import { fetchServerJson, getServerApiBase } from "../lib/serverApi";
import SkillsClient, { type Skill } from "./SkillsClient";
import SkillsStructuredData from "./SkillsStructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

// ISR — skill definitions change only with rules edition updates.
export const revalidate = 3600;

async function fetchSkills(ruleset: string): Promise<Skill[]> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ skills?: Skill[] }>(
    `${base}/api/skills?ruleset=${encodeURIComponent(ruleset)}`,
    { next: { revalidate: 3600 } },
  );
  return data?.skills || [];
}

interface SkillsPageProps {
  searchParams: { ruleset?: string };
}

export async function generateMetadata({
  searchParams,
}: SkillsPageProps): Promise<Metadata> {
  const selectedRuleset =
    searchParams.ruleset === "season_3" ? "season_3" : "season_2";
  const url = `${BASE_URL}/skills`;
  const title = "Compétences Blood Bowl - Skills, Mutations et Traits";
  const description =
    "Explorez les 130+ compétences, mutations et traits Blood Bowl : effets en jeu, catégories (Général, Agilité, Force, Passe, Mutations, Traits), versions Saison 2 et Saison 3.";
  return {
    title,
    description,
    keywords: [
      "Blood Bowl",
      "Compétences",
      "Skills",
      "Mutations",
      "Traits",
      "Nuffle Arena",
      `Ruleset ${selectedRuleset}`,
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
      description,
      type: "website",
      url,
      siteName: "Nuffle Arena",
      images: [
        {
          url: `${BASE_URL}/images/logo.png`,
          width: 1200,
          height: 630,
          alt: "Compétences Blood Bowl - Nuffle Arena",
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
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const selectedRuleset =
    searchParams.ruleset === "season_3" ? "season_3" : "season_2";
  const skills = await fetchSkills(selectedRuleset);

  return (
    <>
      <SkillsStructuredData
        skills={skills}
        ruleset={selectedRuleset}
        baseUrl={BASE_URL}
        lang="fr"
      />
      <SkillsClient skills={skills} selectedRuleset={selectedRuleset} />
    </>
  );
}
