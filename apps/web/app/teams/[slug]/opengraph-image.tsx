/**
 * Open Graph image dynamique pour /teams/[slug] (Q.14 — Sprint 23).
 *
 * Auto-detecte par Next.js : le seul fait de poser un fichier
 * `opengraph-image.tsx` dans le dossier de la route override
 * `openGraph.images` du `generateMetadata` de la route avec le PNG
 * genere ici.
 */
import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { buildTeamOgContent } from "../../lib/og-image-content";
import { OgImageTemplate } from "../../lib/og-image-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface RosterPayload {
  name?: string;
  tier?: string;
  budget?: number;
  _count?: { positions?: number };
  ruleset?: string;
}

async function fetchRoster(slug: string): Promise<RosterPayload | null> {
  try {
    const base = getServerApiBase();
    const data = await fetchServerJson<{ roster?: RosterPayload }>(
      `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=season_3`,
      { next: { revalidate: 3600 } },
    );
    return data?.roster ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { slug: string } }) {
  const roster = await fetchRoster(params.slug);
  const content = buildTeamOgContent({
    name: roster?.name ?? "Roster Blood Bowl",
    tier: roster?.tier,
    budget: roster?.budget ?? 1000000,
    positionCount: roster?._count?.positions ?? 0,
    ruleset: roster?.ruleset ?? "season_3",
  });

  return new ImageResponse(
    (
      <OgImageTemplate
        content={content}
        canonicalUrl={`${SITE_URL.replace(/\/$/, "")}/teams/${params.slug}`}
      />
    ),
    size,
  );
}
