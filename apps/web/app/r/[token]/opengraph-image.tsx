/**
 * Image Open Graph dynamique d'un roster partagé /r/[token].
 *
 * Auto-détectée par Next.js : override `openGraph.images` de la route.
 * « Version riche » : nom d'équipe + race + valeur d'équipe + nombre de
 * joueurs + Star Players, via le template OG partagé.
 */
import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { buildRosterShareOgContent } from "../../lib/og-image-content";
import { OgImageTemplate } from "../../lib/og-image-template";
import { prettifySlug } from "../../lib/roster-display";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr").replace(/\/$/, "");

export const runtime = "nodejs";
export const revalidate = 600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgTeam {
  name?: string;
  roster?: string;
  ruleset?: string;
  teamValue?: number;
  players?: unknown[];
  starPlayers?: { starPlayerSlug?: string }[];
}

async function fetchTeam(token: string): Promise<OgTeam | null> {
  try {
    const base = getServerApiBase();
    const data = await fetchServerJson<{ team?: OgTeam }>(
      `${base}/api/public/teams/${encodeURIComponent(token)}`,
      { next: { revalidate: 600 } },
    );
    return data?.team ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { token: string } }) {
  const team = await fetchTeam(params.token);
  const content = buildRosterShareOgContent({
    teamName: team?.name ?? "Équipe Blood Bowl",
    raceName: prettifySlug(team?.roster ?? "") || "Blood Bowl",
    teamValue: team?.teamValue ?? 1000000,
    playerCount: team?.players?.length ?? 0,
    starPlayerNames: (team?.starPlayers ?? []).map((sp) => prettifySlug(sp.starPlayerSlug ?? "")),
    ruleset: team?.ruleset ?? "season_3",
  });

  return new ImageResponse(
    (
      <OgImageTemplate content={content} canonicalUrl={`${SITE_URL}/r/${params.token}`} />
    ),
    size,
  );
}
