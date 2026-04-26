/**
 * Pure RSS 2.0 feed builder for the Nuffle Arena changelog (Q.16).
 *
 * Genere un flux RSS 2.0 valide depuis une liste de `ChangelogEntry`.
 * Pas d'I/O, pas de fetch — la route Next.js `/feed.xml` est responsable
 * de lire CHANGELOG.md, parser, puis appeler ce builder.
 *
 * Le flux est concu comme un signal de fraicheur lisible par les LLM
 * (GEO) en plus d'etre indexable par les agregateurs RSS classiques.
 */
import type { ChangelogEntry } from "./changelog-parser";
import { formatChangelogEntryAsMarkdown } from "./changelog-parser";

export interface RssFeedInput {
  /** URL absolue du site (ex: "https://nufflearena.fr"). Sans trailing slash. */
  siteUrl: string;
  entries: ReadonlyArray<ChangelogEntry>;
  language: "fr" | "en";
  /** Si fourni, limite le nombre d'items emis. */
  maxItems?: number;
}

const DEFAULT_TITLE = "Nuffle Arena - Changelog";
const DEFAULT_DESCRIPTION_FR =
  "Changelog public de Nuffle Arena : nouvelles features, corrections, ameliorations.";
const DEFAULT_DESCRIPTION_EN =
  "Public changelog of Nuffle Arena: new features, fixes, improvements.";

export function buildRssFeed(input: RssFeedInput): string {
  const siteUrl = stripTrailingSlash(input.siteUrl);
  const feedUrl = `${siteUrl}/feed.xml`;
  const description =
    input.language === "fr" ? DEFAULT_DESCRIPTION_FR : DEFAULT_DESCRIPTION_EN;
  const items =
    typeof input.maxItems === "number"
      ? input.entries.slice(0, Math.max(0, input.maxItems))
      : input.entries;

  const lastBuildDate = items.length > 0 ? toRfc822(items[0].date) : toRfc822("1970-01-01");

  const itemsXml = items.map((entry) => renderItem(entry, siteUrl)).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "  <channel>",
    `    <title>${escapeXml(DEFAULT_TITLE)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${input.language === "fr" ? "fr-FR" : "en"}</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemsXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

function renderItem(entry: ChangelogEntry, siteUrl: string): string {
  const title = `Nuffle Arena ${entry.version}`;
  const releaseLink = entry.compareUrl ?? siteUrl + "/changelog";
  const guid = `v${entry.version}`;
  const pubDate = toRfc822(entry.date);
  const body = formatChangelogEntryAsMarkdown(entry);

  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(releaseLink)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description><![CDATA[${body}]]></description>`,
    "    </item>",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function toRfc822(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return new Date(0).toUTCString();
  return date.toUTCString();
}
