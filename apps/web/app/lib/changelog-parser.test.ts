/**
 * Tests pour le parser pur du CHANGELOG.md (Q.16 — Sprint 23).
 *
 * Le format genere par semantic-release :
 *
 *   ## [1.72.1](https://.../compare/v1.72.0...v1.72.1) (2026-04-24)
 *
 *   ### 🐛 Bug Fixes
 *
 *   * **docker:** cap Node V8 heap to 2GB ... ([sha](url))
 *
 * Le parser produit une liste d'entrees citables consommables par la
 * page `/changelog` et le flux `/feed.xml`.
 */
import { describe, it, expect } from "vitest";
import { parseChangelog, formatChangelogEntryAsMarkdown } from "./changelog-parser";

const SAMPLE = `## [1.72.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.72.0...v1.72.1) (2026-04-24)


### 🐛 Bug Fixes

* **docker:** cap Node V8 heap to 2GB ([42f902e](https://github.com/x/y/commit/42f902e3f44f69e8eaa8c384ebbdae2c887a21e4))

## [1.72.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.71.0...v1.72.0) (2026-04-23)


### ✨ Features

* **auth:** add discordUserId to user profile updates ([d425697](https://github.com/x/y/commit/d425697822))
* **game-engine:** O.3 — audit S2 vs S3 rules ([#338](https://github.com/x/y/issues/338)) ([664664a](https://github.com/x/y/commit/664664a))

### 🐛 Bug Fixes

* **prisma:** fix typo ([abc1234](https://github.com/x/y/commit/abc1234))
`;

describe("parseChangelog", () => {
  it("retourne un tableau vide pour une chaine vide", () => {
    expect(parseChangelog("")).toEqual([]);
  });

  it("ignore le contenu hors entree versionnee", () => {
    const md = "Hello world\nNothing semver here.\n";
    expect(parseChangelog(md)).toEqual([]);
  });

  it("parse plusieurs versions et retourne dans l ordre du fichier", () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries.length).toBe(2);
    expect(entries[0].version).toBe("1.72.1");
    expect(entries[1].version).toBe("1.72.0");
  });

  it("extrait la date au format ISO YYYY-MM-DD", () => {
    const [first] = parseChangelog(SAMPLE);
    expect(first.date).toBe("2026-04-24");
  });

  it("groupe les bullets par section (Features / Bug Fixes / ...)", () => {
    const [, second] = parseChangelog(SAMPLE);
    expect(second.sections.length).toBe(2);
    expect(second.sections[0].title).toContain("Features");
    expect(second.sections[1].title).toContain("Bug Fixes");
  });

  it("garde les bullets bruts (pas de transformation perdue)", () => {
    const [, second] = parseChangelog(SAMPLE);
    expect(second.sections[0].items.length).toBe(2);
    expect(second.sections[0].items[0]).toContain("auth");
    expect(second.sections[0].items[1]).toContain("game-engine");
  });

  it("preserve l URL de comparaison de la version dans compareUrl", () => {
    const [first] = parseChangelog(SAMPLE);
    expect(first.compareUrl).toBe(
      "https://github.com/Ryxeuf/fantasy-football-game/compare/v1.72.0...v1.72.1",
    );
  });

  it("rejette les versions avec un numero invalide (defense)", () => {
    const bad = "## [not-a-version](http://x) (2026-01-01)\n\n### Features\n* foo\n";
    expect(parseChangelog(bad)).toEqual([]);
  });

  it("rejette une date invalide (defense)", () => {
    const bad = "## [1.0.0](http://x) (not-a-date)\n\n### Features\n* foo\n";
    expect(parseChangelog(bad)).toEqual([]);
  });

  it("est deterministe : meme entree -> meme sortie", () => {
    expect(parseChangelog(SAMPLE)).toEqual(parseChangelog(SAMPLE));
  });

  it("ignore les sections sans bullets (silencieusement)", () => {
    const md = `## [1.0.0](http://x) (2026-01-01)\n\n### ✨ Features\n\n### 🐛 Bug Fixes\n\n* something ([sha](url))\n`;
    const [entry] = parseChangelog(md);
    expect(entry.sections.length).toBe(1);
    expect(entry.sections[0].title).toContain("Bug Fixes");
  });
});

describe("formatChangelogEntryAsMarkdown", () => {
  it("reconstruit un markdown lisible et stable", () => {
    const [, second] = parseChangelog(SAMPLE);
    const md = formatChangelogEntryAsMarkdown(second);
    expect(md).toContain("## 1.72.0");
    expect(md).toContain("Features");
    expect(md).toContain("Bug Fixes");
    expect(md).toContain("auth");
  });
});
