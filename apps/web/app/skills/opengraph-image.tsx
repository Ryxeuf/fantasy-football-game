/**
 * Open Graph image dynamique pour /skills (Q.14 — Sprint 23).
 *
 * Le nombre de compétences vient de l'API (base) : compté sur le catalogue
 * compilé, il vieillissait dès qu'un admin ajoutait une compétence, sur une
 * image partagée et mise en cache par les réseaux sociaux (W14 de l'audit).
 * Repli catalogue si l'API est injoignable au rendu.
 */
import { ImageResponse } from "next/og";
import { SKILLS_DEFINITIONS } from "@bb/game-engine";
import { getServerApiBase, safeServerJson } from "../lib/serverApi";
import { buildSkillsOgContent } from "../lib/og-image-content";
import { OgImageTemplate } from "../lib/og-image-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const payload = await safeServerJson<{ skills?: unknown[] }>(
    `${getServerApiBase()}/api/skills`,
    { next: { revalidate: 3600 } },
  );
  const skillCount = payload?.skills?.length ?? SKILLS_DEFINITIONS.length;
  const content = buildSkillsOgContent({ skillCount });

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
