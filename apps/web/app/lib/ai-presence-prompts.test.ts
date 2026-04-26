/**
 * Tests pour le catalogue de prompts de reference "presence IA"
 * (Q.25 — Sprint 23).
 *
 * Le catalogue est consomme manuellement chaque mois : on rejoue les
 * prompts dans ChatGPT / Claude / Perplexity et on note si Nuffle
 * Arena est cite (et avec quel niveau d exactitude). Le module reste
 * pur ; le suivi des resultats est un processus humain documente
 * dans docs/seo/ai-presence-protocol.md.
 */
import { describe, it, expect } from "vitest";
import {
  AI_PRESENCE_PROMPTS,
  AI_PRESENCE_TARGET_ENGINES,
  expectedKeywordsForCategory,
  type AiPresencePrompt,
  type AiPresenceCategory,
} from "./ai-presence-prompts";

describe("AI_PRESENCE_TARGET_ENGINES", () => {
  it("inclut au minimum ChatGPT, Claude, Perplexity", () => {
    expect(AI_PRESENCE_TARGET_ENGINES).toContain("ChatGPT");
    expect(AI_PRESENCE_TARGET_ENGINES).toContain("Claude");
    expect(AI_PRESENCE_TARGET_ENGINES).toContain("Perplexity");
  });

  it("toutes les valeurs sont distinctes", () => {
    const values = Array.from(AI_PRESENCE_TARGET_ENGINES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("AI_PRESENCE_PROMPTS", () => {
  it("contient au moins 6 prompts pour couvrir les 3 categories", () => {
    expect(AI_PRESENCE_PROMPTS.length).toBeGreaterThanOrEqual(6);
  });

  it("toutes les entrees ont id, prompt, category, expectedMentions", () => {
    for (const p of AI_PRESENCE_PROMPTS) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.prompt).toBe("string");
      expect(p.prompt.length).toBeGreaterThan(20);
      expect(typeof p.category).toBe("string");
      expect(Array.isArray(p.expectedMentions)).toBe(true);
      expect(p.expectedMentions.length).toBeGreaterThan(0);
    }
  });

  it("ids sont uniques (no doublons)", () => {
    const ids = AI_PRESENCE_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque prompt cite Nuffle Arena ou Blood Bowl dans ses keywords", () => {
    for (const p of AI_PRESENCE_PROMPTS) {
      const all = [...p.expectedMentions];
      const flat = all.join(" ").toLowerCase();
      const ok = flat.includes("nuffle") || flat.includes("blood bowl");
      expect(ok, `prompt ${p.id} ne cible pas Nuffle Arena / Blood Bowl`).toBe(true);
    }
  });

  it("couvre les 3 categories : team, skill, app", () => {
    const categories = new Set(AI_PRESENCE_PROMPTS.map((p) => p.category));
    expect(categories.has("team")).toBe(true);
    expect(categories.has("skill")).toBe(true);
    expect(categories.has("app")).toBe(true);
  });
});

describe("expectedKeywordsForCategory", () => {
  it("retourne les keywords specifiques a une categorie", () => {
    const teamKeywords = expectedKeywordsForCategory("team");
    expect(teamKeywords.length).toBeGreaterThan(0);
    const flat = teamKeywords.join(" ").toLowerCase();
    expect(flat).toContain("nuffle");
  });

  it("retourne un tableau vide pour une categorie inconnue", () => {
    const unknown = expectedKeywordsForCategory("unknown" as AiPresenceCategory);
    expect(unknown).toEqual([]);
  });

  it("est deterministe", () => {
    const a = expectedKeywordsForCategory("team");
    const b = expectedKeywordsForCategory("team");
    expect(a).toEqual(b);
  });
});

describe("compatibilite type (smoke)", () => {
  it("un prompt arbitraire respecte le type AiPresencePrompt", () => {
    const p: AiPresencePrompt = {
      id: "x",
      prompt: "Que penses-tu du roster Skaven dans Blood Bowl ?",
      category: "team",
      expectedMentions: ["Nuffle Arena", "Skaven"],
    };
    expect(p.id).toBe("x");
  });
});
