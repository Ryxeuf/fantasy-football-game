import raw from "./data/rules-bb-2025.json";
import type { Compendium, CompendiumBlock, CompendiumChapter } from "./types";

/**
 * Les transcriptions marquent les zones illisibles du livre source par
 * `[illisible ...]`. La transcription `.md`/`.json` reste fidèle (elle
 * conserve ces marqueurs), mais on ne les AFFICHE pas : on les retire au
 * rendu et on supprime les blocs qui deviennent vides.
 */
const ILLEGIBLE_RE = /\[illisible[^\]]*\]/gi;

/** Retire les marqueurs `[illisible …]` et nettoie les espaces résiduels. */
export function stripIllegible(text: string): string {
  return text
    .replace(ILLEGIBLE_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?»])/g, "$1")
    .replace(/(«)\s+/g, "$1")
    .trim();
}

/** Nettoie un bloc ; renvoie `null` si le bloc devient vide (à supprimer). */
function sanitizeBlock(block: CompendiumBlock): CompendiumBlock | null {
  switch (block.type) {
    case "heading": {
      const text = stripIllegible(block.text);
      return text ? { ...block, text } : null;
    }
    case "paragraph": {
      const text = stripIllegible(block.text);
      return text ? { ...block, text } : null;
    }
    case "callout": {
      const text = stripIllegible(block.text);
      if (!text) return null;
      return {
        ...block,
        text,
        ...(block.title ? { title: stripIllegible(block.title) } : {}),
      };
    }
    case "list": {
      const items = block.items.map(stripIllegible).filter(Boolean);
      return items.length ? { ...block, items } : null;
    }
    case "table": {
      return {
        ...block,
        columns: block.columns.map(stripIllegible),
        rows: block.rows.map((row) => row.map(stripIllegible)),
        ...(block.caption ? { caption: stripIllegible(block.caption) } : {}),
      };
    }
    default:
      return block;
  }
}

function sanitizeChapter(chapter: CompendiumChapter): CompendiumChapter {
  return {
    ...chapter,
    blocks: chapter.blocks
      .map(sanitizeBlock)
      .filter((b): b is CompendiumBlock => b !== null),
  };
}

const rawCompendium = raw as Compendium;

export const compendium: Compendium = {
  ...rawCompendium,
  chapters: rawCompendium.chapters.map(sanitizeChapter),
};
export const chapters = compendium.chapters;

export function getChapter(slug: string): CompendiumChapter | undefined {
  return chapters.find((c) => c.slug === slug);
}

/** Slug stable pour ancrer un titre de section (sommaire interne). */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Liste des titres de niveau 2 d'un chapitre, pour générer un sommaire. */
export function chapterToc(
  chapter: CompendiumChapter,
): ReadonlyArray<{ id: string; text: string }> {
  const seen = new Set<string>();
  const toc: Array<{ id: string; text: string }> = [];
  for (const block of chapter.blocks) {
    if (block.type === "heading" && block.level === 2) {
      const base = headingId(block.text);
      let id = base;
      let n = 2;
      while (seen.has(id)) id = `${base}-${n++}`;
      seen.add(id);
      toc.push({ id, text: block.text });
    }
  }
  return toc;
}

export type { CompendiumBlock };
