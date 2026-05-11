/**
 * Open Graph image dynamique pour /pro-league/matches/[id] — Sprint O
 * (Lot O.D). Genere une image 1200×630 avec "Home vs Away", score si
 * dispo, journee + status. Reuse `OgImageTemplate` + accent "match".
 */
import { ImageResponse } from "next/og";

import { fetchServerJson, getServerApiBase } from "../../../lib/serverApi";
import { buildProLeagueMatchOgContent } from "../../../lib/og-image-content";
import { OgImageTemplate } from "../../../lib/og-image-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const runtime = "nodejs";
export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface MatchPayload {
  roundNumber: number;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  homeTeam: { name: string; city: string; race: string };
  awayTeam: { name: string; city: string; race: string };
}

async function fetchMatch(id: string): Promise<MatchPayload | null> {
  try {
    const base = getServerApiBase();
    const data = await fetchServerJson<MatchPayload>(
      `${base}/pro-league/matches/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } },
    );
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: { id: string };
}): Promise<ImageResponse> {
  const match = await fetchMatch(params.id);

  if (!match) {
    // Fallback : titre generique
    const content = buildProLeagueMatchOgContent({
      homeName: "Pro League",
      awayName: "Match",
      scoreHome: null,
      scoreAway: null,
      roundNumber: 0,
      status: "scheduled",
    });
    return new ImageResponse(
      (
        <OgImageTemplate
          content={content}
          canonicalUrl={`${SITE_URL.replace(/\/$/, "")}/pro-league/matches/${params.id}`}
        />
      ),
      size,
    );
  }

  const content = buildProLeagueMatchOgContent({
    homeName: match.homeTeam.name,
    awayName: match.awayTeam.name,
    homeMeta: `${match.homeTeam.city} · ${match.homeTeam.race}`,
    awayMeta: `${match.awayTeam.city} · ${match.awayTeam.race}`,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    roundNumber: match.roundNumber,
    status: match.status,
  });

  return new ImageResponse(
    (
      <OgImageTemplate
        content={content}
        canonicalUrl={`${SITE_URL.replace(/\/$/, "")}/pro-league/matches/${params.id}`}
      />
    ),
    size,
  );
}
