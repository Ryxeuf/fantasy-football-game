/**
 * Open Graph image dynamique pour /star-players/[slug] (Q.14 — Sprint 23).
 */
import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { buildStarPlayerOgContent } from "../../lib/og-image-content";
import { OgImageTemplate } from "../../lib/og-image-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface StarPayload {
  displayName?: string;
  cost?: number;
  ma?: number;
  st?: number;
  ag?: number;
  pa?: number | null;
  av?: number;
  isMegaStar?: boolean;
}

async function fetchStar(slug: string): Promise<StarPayload | null> {
  try {
    const base = getServerApiBase();
    const data = await fetchServerJson<{ data?: StarPayload; success?: boolean }>(
      `${base}/star-players/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
    if (data?.success && data?.data) return data.data;
    return null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { slug: string } }) {
  const star = await fetchStar(params.slug);
  const content = buildStarPlayerOgContent({
    displayName: star?.displayName ?? "Star Player Blood Bowl",
    cost: star?.cost ?? 0,
    ma: star?.ma ?? 6,
    st: star?.st ?? 3,
    ag: star?.ag ?? 3,
    pa: star?.pa ?? null,
    av: star?.av ?? 9,
    isMegaStar: star?.isMegaStar,
  });

  return new ImageResponse(
    (
      <OgImageTemplate
        content={content}
        canonicalUrl={`${SITE_URL.replace(/\/$/, "")}/star-players/${params.slug}`}
      />
    ),
    size,
  );
}
