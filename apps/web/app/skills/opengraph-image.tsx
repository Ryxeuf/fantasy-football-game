import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../lib/serverApi";
import { buildSkillsOgContent } from "../lib/og-image-content";
import {
  OgImageTemplate,
  OG_IMAGE_SIZE,
} from "../lib/og-image-template";

export const runtime = "nodejs";
export const alt = "Compétences Blood Bowl - Nuffle Arena";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function SkillsOgImage() {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ skills?: unknown[] }>(
    `${base}/api/skills?ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  const count = data?.skills?.length ?? 130;
  const content = buildSkillsOgContent({ skillCount: count });
  return new ImageResponse(<OgImageTemplate content={content} />, {
    ...OG_IMAGE_SIZE,
  });
}
