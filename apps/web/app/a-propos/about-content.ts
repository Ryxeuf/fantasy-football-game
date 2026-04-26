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
    teamTitle: "L equipe",
    teamDescription:
      "Nuffle Arena est un projet open-source maintenu par des passionnes de Blood Bowl. Le code est public, les contributions sont bienvenues sur GitHub. La gouvernance est ouverte, les decisions sont discutees sur Discord.",
    statRosters: "Rosters officiels",
    statStarPlayers: "Star Players",
    statSkills: "Competences",
    statTutorials: "Tutoriels interactifs",
    storyParagraphs: (year: number): string[] => [
      `Nuffle Arena est ne en ${year} avec une mission claire : offrir aux coachs Blood Bowl un outil gratuit, complet et fidele aux regles officielles de Games Workshop pour gerer leurs equipes, preparer leurs matchs et apprendre les subtilites du jeu.`,
      "Le projet est entierement gratuit, sans publicite, sans donnees revendues. Le code est open-source et heberge publiquement sur GitHub. Le financement repose uniquement sur les dons via Ko-fi, et la communaute decide collectivement des prochaines features.",
      "Notre objectif a long terme : devenir la reference francophone pour la gestion d equipes Blood Bowl en ligne, avec un mode multijoueur complet et une couverture exhaustive des regles Saison 2 et Saison 3.",
    ],
    roadmap: [
      { title: "Refonte des regles BB3 (Saison 3)", status: "done" as const },
      { title: "Mode multijoueur en ligne (matchmaking, ELO)", status: "done" as const },
      { title: "Tutoriels interactifs et IA adversaire", status: "done" as const },
      { title: "Application mobile (Expo / React Native)", status: "in_progress" as const },
      { title: "Ligues et tournois communautaires", status: "in_progress" as const },
      { title: "Replays partages et mode spectateur enrichi", status: "planned" as const },
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
      "Our long-term goal: become the reference platform for Blood Bowl team management, with a full multiplayer mode and exhaustive coverage of Season 2 and Season 3 rules.",
    ],
    roadmap: [
      { title: "BB3 (Season 3) rules overhaul", status: "done" as const },
      { title: "Online multiplayer (matchmaking, ELO)", status: "done" as const },
      { title: "Interactive tutorials and AI opponent", status: "done" as const },
      { title: "Mobile app (Expo / React Native)", status: "in_progress" as const },
      { title: "Community leagues and tournaments", status: "in_progress" as const },
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
