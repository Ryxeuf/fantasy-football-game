import raw from "./data/rules-bb-2025.json";
import type { Compendium, CompendiumBlock, CompendiumChapter } from "./types";

export const compendium = raw as Compendium;
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
