/**
 * Pure builders for /humans.txt and /.well-known/security.txt
 * (Q.22 — Sprint 23).
 *
 * - humans.txt : convention humanstxt.org (texte libre, sections
 *   marquees par /+ TEAM +/ / /+ SITE +/ etc., ici servis litteraux)
 * - security.txt : RFC 9116 (champs Contact / Expires obligatoires,
 *   Preferred-Languages / Canonical / Acknowledgments optionnels).
 *
 * Pure : pas de fetch, pas d I/O. Les routes Next.js consomment ces
 * fonctions et servent du text/plain charset=utf-8.
 */

export interface HumansTxtInput {
  siteUrl: string;
  /** Une ligne decrivant l equipe ("Nuffle Arena maintainers"). */
  teamLine: string;
  /** URL pour contacter l equipe (Issues GitHub typiquement). */
  contactUrl: string;
  /** Date de mise a jour (defaut : aujourd hui). */
  lastUpdate?: Date;
}

const STACK_LINES = [
  "Language: Français / English",
  "Doctype: HTML5",
  "Standards: WCAG 2.1 AA",
  "Components: Next.js, React, TypeScript, Tailwind CSS, Pixi.js",
  "Software: VS Code, Claude Code",
];

export function buildHumansTxt(input: HumansTxtInput): string {
  const lastUpdate = input.lastUpdate ?? new Date();
  const dateStr = formatYyyyMmDdSlash(lastUpdate);

  return [
    "/* TEAM */",
    `Maintainers: ${input.teamLine}`,
    `Contact: ${input.contactUrl}`,
    `Site: ${stripTrailingSlash(input.siteUrl)}`,
    "",
    "/* THANKS */",
    "Thanks: Games Workshop pour Blood Bowl, la communaute francophone et",
    "Thanks: tous les contributeurs open-source du projet.",
    "",
    "/* SITE */",
    `Last update: ${dateStr}`,
    ...STACK_LINES,
    "",
  ].join("\n");
}

export interface SecurityTxtInput {
  /** Contact valide (mailto:, https:, tel:). */
  contact: string;
  /** Date d expiration future (rejet si dans le passe). */
  expires: Date;
  /** Date "maintenant" pour la verification expires (test only). */
  now?: Date;
  preferredLanguages?: string[];
  canonical?: string;
  acknowledgments?: string;
}

const CONTACT_REGEX = /^(mailto:|https?:\/\/|tel:)/;

export function buildSecurityTxt(input: SecurityTxtInput): string {
  if (!CONTACT_REGEX.test(input.contact)) {
    throw new Error(
      "Invalid Contact field: must start with mailto:, https://, or tel:",
    );
  }
  const now = input.now ?? new Date();
  if (input.expires.getTime() <= now.getTime()) {
    throw new Error("Invalid Expires field: must be in the future");
  }

  const lines: string[] = [];
  lines.push(`Contact: ${input.contact}`);
  lines.push(`Expires: ${input.expires.toISOString()}`);
  if (input.preferredLanguages && input.preferredLanguages.length > 0) {
    lines.push(`Preferred-Languages: ${input.preferredLanguages.join(", ")}`);
  }
  if (input.canonical) {
    lines.push(`Canonical: ${input.canonical}`);
  }
  if (input.acknowledgments) {
    lines.push(`Acknowledgments: ${input.acknowledgments}`);
  }
  return lines.join("\n") + "\n";
}

function formatYyyyMmDdSlash(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
