/**
 * Tests pour le builder de contenu "A propos" (Q.15 — Sprint 23).
 *
 * Le builder est pur : il prend les chiffres reels du jeu en entree
 * (rosters, star players, skills, tutoriels) et produit la structure
 * citable affichee sur /a-propos. On valide ici les invariants de
 * citabilite (faits clairs, chiffres datables, sections completes)
 * sans dependance sur React.
 */
import { describe, it, expect } from "vitest";
import {
  buildAboutContent,
  type AboutContentInput,
  type AboutContent,
} from "./about-content";

const baseInput = (overrides: Partial<AboutContentInput> = {}): AboutContentInput => ({
  rosterCount: 30,
  starPlayerCount: 60,
  skillCount: 130,
  tutorialCount: 4,
  foundingYear: 2025,
  language: "fr",
  ...overrides,
});

describe("buildAboutContent", () => {
  it("produit une histoire avec annee de fondation citable", () => {
    const content = buildAboutContent(baseInput({ foundingYear: 2025 }));
    expect(content.story.title).toBeTruthy();
    expect(content.story.paragraphs.length).toBeGreaterThan(0);
    expect(content.story.paragraphs.join(" ")).toContain("2025");
  });

  it("produit la liste des chiffres cles avec les 4 metriques principales", () => {
    const content = buildAboutContent(
      baseInput({
        rosterCount: 30,
        starPlayerCount: 60,
        skillCount: 130,
        tutorialCount: 4,
      }),
    );
    expect(content.stats.length).toBe(4);
    const labels = content.stats.map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes("roster") || l.includes("equipe"))).toBe(true);
    expect(labels.some((l) => l.includes("star"))).toBe(true);
    expect(labels.some((l) => l.includes("skill") || l.includes("competence"))).toBe(true);
    expect(labels.some((l) => l.includes("tutoriel") || l.includes("tutorial"))).toBe(true);
  });

  it("expose les valeurs numeriques exactes des chiffres cles", () => {
    const content = buildAboutContent(
      baseInput({
        rosterCount: 31,
        starPlayerCount: 67,
        skillCount: 130,
        tutorialCount: 5,
      }),
    );
    const values = content.stats.map((s) => s.value);
    expect(values).toContain(31);
    expect(values).toContain(67);
    expect(values).toContain(130);
    expect(values).toContain(5);
  });

  it("expose la roadmap publique avec au moins 3 jalons", () => {
    const content = buildAboutContent(baseInput());
    expect(content.roadmap.length).toBeGreaterThanOrEqual(3);
    for (const milestone of content.roadmap) {
      expect(milestone.title).toBeTruthy();
      expect(["done", "in_progress", "planned"]).toContain(milestone.status);
    }
  });

  it("expose une section equipe non vide", () => {
    const content = buildAboutContent(baseInput());
    expect(content.team.title).toBeTruthy();
    expect(content.team.description).toBeTruthy();
  });

  it("genere des contenus differents en FR et EN", () => {
    const fr = buildAboutContent(baseInput({ language: "fr" }));
    const en = buildAboutContent(baseInput({ language: "en" }));
    expect(fr.story.title).not.toBe(en.story.title);
    expect(fr.team.title).not.toBe(en.team.title);
  });

  it("est deterministe : meme entree -> meme sortie", () => {
    const a = buildAboutContent(baseInput());
    const b = buildAboutContent(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("clamp les chiffres negatifs a 0 (defense contre input incorrect)", () => {
    const content = buildAboutContent(
      baseInput({
        rosterCount: -5,
        starPlayerCount: -10,
        skillCount: -1,
        tutorialCount: -2,
      }),
    );
    for (const s of content.stats) {
      expect(s.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("expose la mission / pitch citable du projet (free, open-source)", () => {
    const content: AboutContent = buildAboutContent(baseInput({ language: "fr" }));
    const allText = [
      content.story.title,
      ...content.story.paragraphs,
      content.team.description,
    ]
      .join(" ")
      .toLowerCase();
    expect(allText).toContain("gratuit");
    expect(allText.includes("open") || allText.includes("source")).toBe(true);
  });
});
