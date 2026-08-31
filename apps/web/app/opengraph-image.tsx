/**
 * Image Open Graph par DÉFAUT du site.
 *
 * Convention Next.js : détectée automatiquement à la racine de l'app, elle
 * alimente toutes les pages qui ne déclarent pas leur propre `openGraph`
 * (accueil, `/me/*`…).
 *
 * Elle remplace l'ancien `openGraph.images = /images/logo.png` de
 * `app/layout.tsx`, qui annonçait `1200 × 630` pour un fichier CARRÉ de
 * 1024 × 1024 : Discord, Slack et X faisaient confiance aux dimensions
 * déclarées et ÉTIRAIENT le logo dans la boîte 1,91:1. Ici les dimensions
 * annoncées sont celles réellement générées, et le logo est posé en
 * `objectFit: contain` dans une boîte carrée.
 *
 * ATTENTION : `mergeStaticMetadata` (Next 14) n'applique ce fichier que si
 * `app/layout.tsx` ne déclare PAS `openGraph.images`. Les deux ne peuvent
 * pas coexister — c'est pourquoi l'entrée statique a été retirée du layout.
 */
import { ImageResponse } from "next/og";
import { buildSiteOgContent } from "./lib/og-image-content";
import { OgImageTemplate } from "./lib/og-image-template";
import { loadSiteOgLogo } from "./lib/og-site-logo";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "Nuffle Arena — Gestionnaire d'équipes Blood Bowl";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoUrl = await loadSiteOgLogo();
  const content = buildSiteOgContent({ logoUrl: logoUrl ?? undefined });

  return new ImageResponse(
    <OgImageTemplate
      content={content}
      canonicalUrl={SITE_URL.replace(/^https?:\/\//, "")}
    />,
    size,
  );
}
