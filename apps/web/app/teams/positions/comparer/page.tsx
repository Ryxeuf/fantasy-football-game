import type { Metadata } from "next";
import { fetchServerJson, getServerApiBase } from "../../../lib/serverApi";
import { parsePositionIds, type ListedPosition } from "../../position-rankings";
import PositionComparatorClient from "./PositionComparatorClient";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const MAX_SELECTION = 4;

// Rendu dynamique (au request) : evite le prerender au build sans backend.
export const dynamic = "force-dynamic";

interface ComparerPageProps {
  searchParams: { ids?: string };
}

async function fetchListedPositions(): Promise<ListedPosition[]> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ positions?: ListedPosition[] }>(
    `${base}/api/positions?lang=fr&ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  return data?.positions ?? [];
}

export function generateMetadata(): Metadata {
  const url = `${BASE_URL}/teams/positions/comparer`;
  const title = "Comparateur de positions Blood Bowl";
  const description =
    "Comparez côte à côte les caractéristiques (MA, ST, AG, PA, AV, coût, compétences) de 2 à 4 positions de n'importe quel roster Blood Bowl Saison 3.";
  return {
    title,
    description,
    keywords: [
      "Blood Bowl",
      "comparateur",
      "positions",
      "stats",
      "Nuffle Arena",
    ],
    alternates: {
      canonical: url,
      languages: { "fr-FR": url, en: url, "x-default": url },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "Nuffle Arena",
      images: [
        { url: `${BASE_URL}/images/logo.png`, width: 1200, height: 630 },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PositionComparerPage({
  searchParams,
}: ComparerPageProps) {
  const positions = await fetchListedPositions();
  const initialSelected = parsePositionIds(searchParams.ids, MAX_SELECTION);

  return (
    <PositionComparatorClient
      initialPositions={positions}
      initialSelected={initialSelected}
    />
  );
}
