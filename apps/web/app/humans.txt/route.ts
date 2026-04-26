/**
 * /humans.txt (Q.22 — Sprint 23).
 *
 * Convention humanstxt.org : credit l equipe et l environnement
 * technique en texte libre. Servi en text/plain; charset=utf-8 avec
 * cache 24h.
 */
import { NextResponse } from "next/server";
import { buildHumansTxt } from "../lib/well-known";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(): Promise<NextResponse> {
  const body = buildHumansTxt({
    siteUrl: SITE_URL,
    teamLine: "Nuffle Arena maintainers (Ryxeuf et la communaute)",
    contactUrl: "https://github.com/Ryxeuf/fantasy-football-game/issues",
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
