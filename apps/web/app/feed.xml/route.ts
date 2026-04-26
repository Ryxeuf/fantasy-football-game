/**
 * RSS feed route (Q.16 — Sprint 23).
 *
 * Lit `CHANGELOG.md` (genere par semantic-release), parse via le
 * parser pur, puis serialise via le builder RSS pur. Cache HTTP de
 * 1h (les LLM revisitent par lots).
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseChangelog } from "../lib/changelog-parser";
import { buildRssFeed } from "../lib/rss-builder";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const MAX_ITEMS = 50;
const CACHE_SECONDS = 3600;

export const dynamic = "force-static";
export const revalidate = CACHE_SECONDS;

async function loadChangelog(): Promise<string> {
  // En production le CHANGELOG.md est copie a la racine du repo.
  // En dev / build, on resout depuis le cwd du projet web.
  const candidates = [
    join(process.cwd(), "CHANGELOG.md"),
    join(process.cwd(), "..", "..", "CHANGELOG.md"),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // tente le suivant
    }
  }
  return "";
}

export async function GET(): Promise<NextResponse> {
  const markdown = await loadChangelog();
  const entries = parseChangelog(markdown);
  const xml = buildRssFeed({
    siteUrl: SITE_URL,
    entries,
    language: "fr",
    maxItems: MAX_ITEMS,
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    },
  });
}
