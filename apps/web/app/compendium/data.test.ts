import { describe, expect, it } from "vitest";
import { chapters, chapterToc, compendium, getChapter, headingId } from "./data";

describe("compendium data integrity", () => {
  it("expose une meta complète", () => {
    for (const key of ["title", "edition", "sourceDir", "version", "disclaimer"] as const) {
      expect(compendium.meta[key], `meta.${key}`).toBeTruthy();
    }
  });

  it("a des chapitres avec des slugs uniques", () => {
    expect(chapters.length).toBeGreaterThan(0);
    const slugs = chapters.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("chaque chapitre a title, summary, sourcePages et blocks", () => {
    for (const c of chapters) {
      expect(c.title, `${c.slug}.title`).toBeTruthy();
      expect(c.summary, `${c.slug}.summary`).toBeTruthy();
      expect(c.sourcePages.length, `${c.slug}.sourcePages`).toBeGreaterThan(0);
      expect(c.blocks.length, `${c.slug}.blocks`).toBeGreaterThan(0);
    }
  });

  it("ne contient que des blocs au schéma valide", () => {
    const allowed = new Set(["heading", "paragraph", "list", "table", "callout"]);
    for (const c of chapters) {
      c.blocks.forEach((b, i) => {
        const ctx = `${c.slug}#${i}`;
        expect(allowed.has(b.type), `${ctx} type=${b.type}`).toBe(true);
        if (b.type === "heading") expect([2, 3]).toContain(b.level);
        if (b.type === "callout")
          expect(["info", "warning", "example"]).toContain(b.variant);
        if (b.type === "list") expect(b.items.length).toBeGreaterThan(0);
        if (b.type === "table") {
          expect(b.columns.length).toBeGreaterThan(0);
          b.rows.forEach((row, r) =>
            expect(row.length, `${ctx} row${r}`).toBe(b.columns.length),
          );
        }
      });
    }
  });

  it("getChapter retrouve un chapitre par slug", () => {
    const first = chapters[0];
    expect(getChapter(first.slug)?.title).toBe(first.title);
    expect(getChapter("slug-inexistant")).toBeUndefined();
  });

  it("chapterToc produit des ancres uniques", () => {
    for (const c of chapters) {
      const toc = chapterToc(c);
      const ids = toc.map((t) => t.id);
      expect(new Set(ids).size, `${c.slug} toc ids`).toBe(ids.length);
    }
  });

  it("headingId enlève accents et caractères spéciaux", () => {
    expect(headingId("Tableau de blessure !")).toBe("tableau-de-blessure");
    expect(headingId("Améliorations de caractéristique")).toBe(
      "ameliorations-de-caracteristique",
    );
  });
});
