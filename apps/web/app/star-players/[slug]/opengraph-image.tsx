import { ImageResponse } from "next/og";
import { buildStarPlayerOgContent } from "../../lib/og-image-content";
import {
  OgImageTemplate,
  OG_IMAGE_SIZE,
} from "../../lib/og-image-template";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8201";

export const runtime = "nodejs";
export const alt = "Star Player Blood Bowl - Nuffle Arena";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function StarPlayerOgImage({
  params,
}: {
  params: { slug: string };
}) {
  let content;
  try {
    const response = await fetch(`${API_BASE}/star-players/${params.slug}`, {
      next: { revalidate: 3600 },
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.success && data.data) {
        content = buildStarPlayerOgContent({
          displayName: data.data.displayName,
          cost: data.data.cost,
          ma: data.data.ma,
          st: data.data.st,
          ag: data.data.ag,
          pa: data.data.pa,
          av: data.data.av,
          isMegaStar: data.data.isMegaStar,
        });
      }
    }
  } catch (error) {
    console.error("OG star-player fetch failed:", error);
  }
  if (!content) {
    content = buildStarPlayerOgContent({
      displayName: "Star Player Blood Bowl",
      cost: 0,
      ma: 0,
      st: 0,
      ag: 0,
      pa: null,
      av: 0,
    });
  }
  return new ImageResponse(<OgImageTemplate content={content} />, {
    ...OG_IMAGE_SIZE,
  });
}
