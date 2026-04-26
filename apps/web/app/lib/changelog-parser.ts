/**
 * Pure parser for the project CHANGELOG.md (Q.16 — Sprint 23).
 *
 * Format produit par semantic-release :
 *   ## [1.72.1](https://.../compare/v1.72.0...v1.72.1) (2026-04-24)
 *
 *   ### 🐛 Bug Fixes
 *
 *   * **scope:** message ([sha](url))
 *
 * Le parser extrait une liste typee `ChangelogEntry[]` consommable par
 * la page `/changelog` et le flux RSS `/feed.xml`. Pure : pas d'I/O,
 * deterministe, totalement testable.
 */

export interface ChangelogSection {
  /** Titre brut tel que parse (ex: "✨ Features", "🐛 Bug Fixes"). */
  title: string;
  /** Bullets bruts de la section, sans le marqueur "* " initial. */
  items: string[];
}

export interface ChangelogEntry {
  /** Numero semver (ex: "1.72.1"). */
  version: string;
  /** Date au format YYYY-MM-DD (verifiee). */
  date: string;
  /** URL GitHub compare/release (peut etre null si format inattendu). */
  compareUrl: string | null;
  /** Sections groupees ; les sections sans bullets sont omises. */
  sections: ChangelogSection[];
}

const HEADER_REGEX = /^##\s+\[([^\]]+)\](?:\(([^)]+)\))?\s+\((\d{4}-\d{2}-\d{2})\)\s*$/;
const SECTION_REGEX = /^###\s+(.+?)\s*$/;
const BULLET_REGEX = /^\*\s+(.*)$/;
const VERSION_REGEX = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Parse a CHANGELOG.md content string into a list of entries.
 * Returns the entries in the same order as they appear in the file
 * (most recent first by convention of semantic-release).
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];

  let current: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;

  const flushSection = () => {
    if (!current || !currentSection) return;
    if (currentSection.items.length > 0) {
      current.sections.push(currentSection);
    }
    currentSection = null;
  };

  const flushEntry = () => {
    flushSection();
    if (current) entries.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const headerMatch = HEADER_REGEX.exec(line);
    if (headerMatch) {
      flushEntry();
      const [, version, compareUrl, date] = headerMatch;
      if (!VERSION_REGEX.test(version)) {
        current = null;
        continue;
      }
      if (!isValidDate(date)) {
        current = null;
        continue;
      }
      current = {
        version,
        date,
        compareUrl: compareUrl ?? null,
        sections: [],
      };
      continue;
    }

    if (!current) continue;

    const sectionMatch = SECTION_REGEX.exec(line);
    if (sectionMatch) {
      flushSection();
      currentSection = { title: sectionMatch[1], items: [] };
      continue;
    }

    const bulletMatch = BULLET_REGEX.exec(line);
    if (bulletMatch && currentSection) {
      currentSection.items.push(bulletMatch[1]);
    }
  }

  flushEntry();
  return entries;
}

/**
 * Render a parsed entry back to a readable markdown block.
 * Useful for embedding inside richer markdown (blog posts, RSS body).
 */
export function formatChangelogEntryAsMarkdown(entry: ChangelogEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.version} (${entry.date})`);
  for (const section of entry.sections) {
    lines.push("");
    lines.push(`### ${section.title}`);
    lines.push("");
    for (const item of section.items) {
      lines.push(`* ${item}`);
    }
  }
  return lines.join("\n");
}

function isValidDate(value: string): boolean {
  // Use UTC noon to avoid TZ rollover edge cases
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}
