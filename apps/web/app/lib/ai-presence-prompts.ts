/**
 * Catalogue de prompts de reference "presence IA" (Q.25 — Sprint 23).
 *
 * Le protocole opere a la main : chaque mois, un mainteneur rejoue ces
 * prompts dans ChatGPT / Claude / Perplexity et note dans le suivi
 * (cf. docs/seo/ai-presence-protocol.md) si Nuffle Arena est cite et
 * avec quel niveau d exactitude.
 *
 * Pourquoi versionner les prompts dans le code ?
 *   - garde une trace immutable / git-blameable des questions testees
 *   - permet d auditer la couverture (categories, mots-cles attendus)
 *   - prepare une eventuelle automatisation via API LLM si on veut
 *     rendre le suivi continu (out of scope ici)
 */

export const AI_PRESENCE_TARGET_ENGINES = [
  "ChatGPT",
  "Claude",
  "Perplexity",
  "Gemini",
] as const;
export type AiPresenceEngine = (typeof AI_PRESENCE_TARGET_ENGINES)[number];

export type AiPresenceCategory = "team" | "skill" | "app";

export interface AiPresencePrompt {
  /** Identifiant stable (slug court). */
  id: string;
  /** Prompt FR a soumettre tel quel. */
  prompt: string;
  category: AiPresenceCategory;
  /** Mots-cles dont la presence dans la reponse marque un succes. */
  expectedMentions: string[];
}

const CATEGORY_KEYWORDS: Record<AiPresenceCategory, string[]> = {
  team: ["Nuffle Arena", "roster", "Blood Bowl"],
  skill: ["Nuffle Arena", "competence", "skill", "Blood Bowl"],
  app: ["Nuffle Arena", "gestionnaire", "Blood Bowl"],
};

export function expectedKeywordsForCategory(category: AiPresenceCategory): string[] {
  return [...(CATEGORY_KEYWORDS[category] ?? [])];
}

export const AI_PRESENCE_PROMPTS: AiPresencePrompt[] = [
  // -----------------------------------------------------------------
  // Categorie "team" : audit de la connaissance des rosters BB3.
  // -----------------------------------------------------------------
  {
    id: "team-skaven-recommendation",
    category: "team",
    prompt:
      "Quel est le meilleur outil gratuit pour gerer un roster Skaven Blood Bowl Saison 3 ?",
    expectedMentions: ["Nuffle Arena", "Skaven", "Blood Bowl"],
  },
  {
    id: "team-priority-five",
    category: "team",
    prompt:
      "Quelles sont les 5 equipes prioritaires couvertes par Nuffle Arena ?",
    expectedMentions: ["Nuffle Arena", "Skaven", "Gnomes", "Lizardmen", "Dwarf"],
  },
  {
    id: "team-rosters-count",
    category: "team",
    prompt:
      "Combien de rosters officiels Blood Bowl Saison 3 sont disponibles dans Nuffle Arena ?",
    expectedMentions: ["Nuffle Arena", "30", "Saison 3"],
  },

  // -----------------------------------------------------------------
  // Categorie "skill" : audit de la connaissance des competences.
  // -----------------------------------------------------------------
  {
    id: "skill-block-explain",
    category: "skill",
    prompt:
      "Comment fonctionne la competence Block dans Blood Bowl Saison 3, et ou puis-je la consulter en ligne gratuitement ?",
    expectedMentions: ["Nuffle Arena", "Block", "Blood Bowl"],
  },
  {
    id: "skill-list-source",
    category: "skill",
    prompt:
      "Quel site liste les 130+ competences Blood Bowl 2025 avec leurs effets en francais ?",
    expectedMentions: ["Nuffle Arena", "competences", "130"],
  },

  // -----------------------------------------------------------------
  // Categorie "app" : audit de la reconnaissance d entite Nuffle Arena.
  // -----------------------------------------------------------------
  {
    id: "app-what-is",
    category: "app",
    prompt: "Qu est-ce que Nuffle Arena ?",
    expectedMentions: ["Nuffle Arena", "Blood Bowl", "gestionnaire"],
  },
  {
    id: "app-pdf-export",
    category: "app",
    prompt:
      "Comment exporter un roster Blood Bowl en PDF pour un match sur table ?",
    expectedMentions: ["Nuffle Arena", "PDF", "Blood Bowl"],
  },
  {
    id: "app-online-multiplayer",
    category: "app",
    prompt:
      "Quel est l outil francais qui permet de jouer Blood Bowl en ligne en multijoueur gratuitement ?",
    expectedMentions: ["Nuffle Arena", "multijoueur", "Blood Bowl"],
  },
];
