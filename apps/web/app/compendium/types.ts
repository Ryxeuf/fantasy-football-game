/**
 * Types du Compendium des règles Blood Bowl.
 *
 * SOURCE DE VÉRITÉ : apps/web/app/compendium/data/rules-bb-2025.json,
 * lui-même dérivé des transcriptions Markdown docs/regles-bb-2025/*.md.
 * Toute modification d'une règle doit être répercutée DANS LE MÊME COMMIT
 * sur le .md ET sur le .json (cf. CLAUDE.md + mémoire compendium-md-json-sync).
 */

export type CompendiumBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  | {
      type: "callout";
      variant: "info" | "warning" | "example";
      title?: string;
      text: string;
    };

export interface CompendiumChapter {
  /** Identifiant d'URL, ex. "coup-d-envoi". */
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** Pages source dans docs/regles-bb-2025/, ex. ["page-01", "page-14"]. */
  readonly sourcePages: readonly string[];
  readonly blocks: readonly CompendiumBlock[];
}

export interface CompendiumMeta {
  readonly title: string;
  readonly edition: string;
  readonly sourceDir: string;
  readonly version: string;
  readonly disclaimer: string;
}

export interface Compendium {
  readonly meta: CompendiumMeta;
  readonly chapters: readonly CompendiumChapter[];
}
