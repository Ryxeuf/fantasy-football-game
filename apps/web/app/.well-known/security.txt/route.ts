/**
 * /.well-known/security.txt (Q.22 — Sprint 23).
 *
 * RFC 9116 : indique aux chercheurs en securite comment reporter une
 * vulnerabilite. Champs Contact + Expires obligatoires. Expiration
 * fixee a 1 an par defaut, regenere a chaque rebuild (force-static
 * + revalidate 24h pour rafraichir).
 */
import { NextResponse } from "next/server";
import { buildSecurityTxt } from "../../lib/well-known";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const dynamic = "force-static";
export const revalidate = 86400;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<NextResponse> {
  const expires = new Date(Date.now() + ONE_YEAR_MS);
  const body = buildSecurityTxt({
    contact:
      process.env.NEXT_PUBLIC_SECURITY_CONTACT ??
      "https://github.com/Ryxeuf/fantasy-football-game/security/advisories/new",
    expires,
    preferredLanguages: ["fr", "en"],
    canonical: `${stripTrailingSlash(SITE_URL)}/.well-known/security.txt`,
    acknowledgments: `${stripTrailingSlash(SITE_URL)}/a-propos`,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
