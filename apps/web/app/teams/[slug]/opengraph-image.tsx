import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { buildTeamOgContent } from "../../lib/og-image-content";
import {
  OgImageTemplate,
  OG_IMAGE_SIZE,
} from "../../lib/og-image-template";

export const runtime = "nodejs";
export const alt = "Roster Blood Bowl - Nuffle Arena";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function TeamOgImage({
  params,
}: {
  params: { slug: string };
}) {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ roster?: any }>(
    `${base}/api/rosters/${encodeURIComponent(params.slug)}?lang=fr&ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  const roster = data?.roster;
  const content = roster
    ? buildTeamOgContent({
        name: roster.name,
        tier: roster.tier,
        budget: roster.budget,
        positions: roster.positions ?? [],
      })
    : buildTeamOgContent({
        name: "Roster Blood Bowl",
        positions: [],
      });
  return new ImageResponse(<OgImageTemplate content={content} />, {
    ...OG_IMAGE_SIZE,
  });
}
