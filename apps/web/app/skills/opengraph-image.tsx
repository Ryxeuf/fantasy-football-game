/**
 * Open Graph image dynamique pour /skills (Q.14 — Sprint 23).
 */
import { ImageResponse } from "next/og";
import { SKILLS_DEFINITIONS } from "@bb/game-engine";
import { buildSkillsOgContent } from "../lib/og-image-content";
import { OgImageTemplate } from "../lib/og-image-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const content = buildSkillsOgContent({ skillCount: SKILLS_DEFINITIONS.length });

  return new ImageResponse(
    (
      <OgImageTemplate
        content={content}
        canonicalUrl={`${SITE_URL.replace(/\/$/, "")}/skills`}
      />
    ),
    size,
  );
}
