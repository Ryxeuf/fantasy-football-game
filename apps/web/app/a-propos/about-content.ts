/**
 * Builder de contenu pur pour la page "A propos" (Q.15 — Sprint 23).
 *
 * Pourquoi un builder pur ?
 *   - Permet de tester le contenu sans monter React / Next.
 *   - Decouple les chiffres reels (rosters, star players, skills) du
 *     rendu visuel — le caller (page server component) injecte les
 *     compteurs reels et ce module produit la structure citable.
 *   - Centralise les libelles FR / EN au meme endroit pour faciliter
 *     les revues editoriales et la cohesion ton de marque.
 */

export type AboutLanguage = "fr" | "en";

export interface AboutContentInput {
  rosterCount: number;
  starPlayerCount: number;
  skillCount: number;
  tutorialCount: number;
  /** Annee de fondation du projet (utilisee dans l'histoire). */
  foundingYear: number;
  language: AboutLanguage;
}

export interface AboutSectionStory {
  title: string;
  /** Paragraphes successifs — affiches en bloc dans la page. */
  paragraphs: string[];
}

export interface AboutSectionTeam {
  title: string;
  description: string;
}

export interface AboutStat {
  label: string;
  value: number;
  /** Suffixe optionnel ("+", "%", etc.) */
  suffix?: string;
}

export type AboutMilestoneStatus = "done" | "in_progress" | "planned";

export interface AboutMilestone {
  title: string;
  status: AboutMilestoneStatus;
}

export interface AboutContent {
  story: AboutSectionStory;
  stats: AboutStat[];
  team: AboutSectionTeam;
  roadmap: AboutMilestone[];
}

const TEXTS = {
  fr: {
    storyTitle: "Notre histoire",
    teamTitle: "L'équipe",
    teamDescription:
      "Nuffle Arena est un projet open-source maintenu par des passionnés de Blood Bowl. Le code est public, les contributions sont les bienvenues sur GitHub. La gouvernance est ouverte et les décisions se discutent sur Discord.",
    statRosters: "Rosters officiels",
    statStarPlayers: "Star Players",
    statSkills: "Compétences",
    statTutorials: "Tutoriels interactifs",
    storyParagraphs: (year: number): string[] => [
      `Nuffle Arena est né en ${year} avec une mission claire : offrir aux coachs Blood Bowl un outil gratuit, complet et fidèle aux règles officielles de Games Workshop pour gérer leurs équipes, préparer leurs matchs et apprendre les subtilités du jeu.`,
      "Le projet est entièrement gratuit, sans publicité et sans revente de données. Le code est open-source et hébergé publiquement sur GitHub. Le financement repose uniquement sur les dons via Ko-fi, et la communauté décide collectivement des prochaines fonctionnalités.",
      "Notre objectif à long terme : rester la référence francophone pour la gestion d'équipes et le jeu Blood Bowl en ligne, avec une couverture exhaustive des règles Saison 2 et Saison 3, un mode multijoueur abouti et une communauté active.",
    ],
    roadmap: [
      { title: "Refonte des règles BB3 (Saison 3)", status: "done" as const },
      { title: "Tutoriels interactifs", status: "done" as const },
      { title: "Gestion de coupes", status: "done" as const },
      { title: "Ligues communautaires", status: "in_progress" as const },
      { title: "Gestion d'équipe Blood Bowl Sevens", status: "planned" as const },
      { title: "Replays partagés et mode spectateur enrichi", status: "planned" as const },
    ] satisfies AboutMilestone[],
  },
  en: {
    storyTitle: "Our story",
    teamTitle: "The team",
    teamDescription:
      "Nuffle Arena is an open-source project maintained by Blood Bowl enthusiasts. The code is public, contributions are welcome on GitHub. Governance is open, decisions are discussed on Discord.",
    statRosters: "Official rosters",
    statStarPlayers: "Star Players",
    statSkills: "Skills",
    statTutorials: "Interactive tutorials",
    storyParagraphs: (year: number): string[] => [
      `Nuffle Arena was born in ${year} with a clear mission: give Blood Bowl coaches a free, comprehensive tool faithful to the official Games Workshop rules — to manage teams, prepare matches and learn the game's subtleties.`,
      "The project is entirely free, ad-free, and never resells data. The code is open-source and publicly hosted on GitHub. Funding relies solely on Ko-fi donations, and the community collectively decides the next features.",
      "Our long-term goal: remain the reference platform for Blood Bowl team management and online play, with exhaustive coverage of Season 2 and Season 3 rules, a polished multiplayer mode and an active community.",
    ],
    roadmap: [
      { title: "BB3 (Season 3) rules overhaul", status: "done" as const },
      { title: "Interactive tutorials", status: "done" as const },
      { title: "Cup management", status: "done" as const },
      { title: "Community leagues", status: "in_progress" as const },
      { title: "Blood Bowl Sevens team management", status: "planned" as const },
      { title: "Shared replays and enriched spectator mode", status: "planned" as const },
    ] satisfies AboutMilestone[],
  },
};

export function buildAboutContent(input: AboutContentInput): AboutContent {
  const t = TEXTS[input.language];

  const stats: AboutStat[] = [
    { label: t.statRosters, value: clampNonNegative(input.rosterCount) },
    {
      label: t.statStarPlayers,
      value: clampNonNegative(input.starPlayerCount),
      suffix: "+",
    },
    { label: t.statSkills, value: clampNonNegative(input.skillCount), suffix: "+" },
    { label: t.statTutorials, value: clampNonNegative(input.tutorialCount) },
  ];

  return {
    story: {
      title: t.storyTitle,
      paragraphs: t.storyParagraphs(input.foundingYear),
    },
    stats,
    team: {
      title: t.teamTitle,
      description: t.teamDescription,
    },
    roadmap: t.roadmap.map((m) => ({ ...m })),
  };
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : Math.floor(value);
}
