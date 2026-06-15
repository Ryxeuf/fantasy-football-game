/**
 * Métadonnées curées par slug pour le comparateur de rosters et la tier-list.
 *
 * L'API `/api/rosters` n'expose que { slug, name, budget, tier, naf,
 * positions }. Les dimensions qualitatives utiles pour comparer deux équipes
 * — difficulté de prise en main, style de jeu, Star Players emblématiques,
 * résumé éditorial — ne sont pas dérivables des données brutes. On les
 * maintient ici dans une carte curée, 100 % pure (testable sans React ni
 * backend) et réutilisée par :
 *   - le comparateur interactif `/teams/comparer`
 *   - les pages de comparaison SSR `/teams/comparer/[matchup]`
 *   - la tier-list `/teams/tier-list`
 *
 * Les libellés sont fournis en français ET en anglais (parité i18n).
 */

export type Lang = "fr" | "en";

/** Difficulté de prise en main (du plus accessible au plus exigeant). */
export type Difficulty = "beginner" | "intermediate" | "advanced";

/** Style de jeu dominant. */
export type PlayStyle = "bash" | "agile" | "balanced" | "stunty" | "hybrid";

export interface RosterMeta {
  readonly difficulty: Difficulty;
  readonly playStyle: PlayStyle;
  /** Star Players emblématiques hirables (noms propres, non traduits). */
  readonly starPlayers: readonly string[];
  /** Résumé court orienté comparaison. */
  readonly shortFr: string;
  readonly shortEn: string;
  /** Recommandé pour débuter. */
  readonly beginnerFriendly?: boolean;
}

/**
 * Rang numérique de difficulté — utile pour trier et pour rendre une échelle
 * (1 = accessible, 3 = exigeant).
 */
export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export const DIFFICULTY_LABELS: Record<Lang, Record<Difficulty, string>> = {
  fr: {
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Expert",
  },
  en: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  },
};

export const PLAYSTYLE_LABELS: Record<Lang, Record<PlayStyle, string>> = {
  fr: {
    bash: "Bagarre",
    agile: "Agile",
    balanced: "Polyvalent",
    stunty: "Stunty",
    hybrid: "Hybride",
  },
  en: {
    bash: "Bashy",
    agile: "Agile",
    balanced: "Balanced",
    stunty: "Stunty",
    hybrid: "Hybrid",
  },
};

/**
 * Carte curée des 31 rosters officiels Saison 3. Les slugs correspondent aux
 * clés de `SEASON_THREE_ROSTERS` (game-engine) et aux slugs renvoyés par
 * `/api/rosters`.
 */
export const ROSTER_META: Record<string, RosterMeta> = {
  old_world_alliance: {
    difficulty: "intermediate",
    playStyle: "balanced",
    starPlayers: ["Griff Oberwald", "Grim Ironjaw"],
    shortFr:
      "Mélange d'Humains, Nains et Halflings : une équipe polyvalente qui combine vitesse, blocage et fragilité.",
    shortEn:
      "A mix of Humans, Dwarves and Halflings: a versatile team blending speed, blocking and fragility.",
  },
  bretonnian: {
    difficulty: "intermediate",
    playStyle: "balanced",
    starPlayers: ["Griff Oberwald", "Morg'n'Thorg"],
    shortFr:
      "Chevaliers nobles et écuyers : une équipe rapide et courageuse, taillée pour le jeu de passe et les charges héroïques, mais peu robuste défensivement.",
    shortEn:
      "Noble knights and their squires: a fast, brave team built for the passing game and heroic charges, but short on defensive resilience.",
  },
  amazon: {
    difficulty: "beginner",
    playStyle: "balanced",
    starPlayers: ["Estelle la Veaux"],
    shortFr:
      "Esquive et Bond généralisés rendent les Amazones très résistantes au blocage : idéales pour apprendre la défense.",
    shortEn:
      "Widespread Dodge and Jump Up make Amazons hard to knock down — a great team to learn defence with.",
    beginnerFriendly: true,
  },
  underworld: {
    difficulty: "advanced",
    playStyle: "hybrid",
    starPlayers: ["Hakflem Skuttlespike", "Glart Smashrip"],
    shortFr:
      "Skavens, Gobelins et Trolls : mutations, vitesse et chaos. Puissant mais imprévisible, réservé aux coachs aguerris.",
    shortEn:
      "Skaven, Goblins and Trolls: mutations, speed and chaos. Powerful yet unpredictable — for seasoned coaches.",
  },
  dark_elf: {
    difficulty: "intermediate",
    playStyle: "agile",
    starPlayers: ["Roxanna Darknail", "Horkon Heartripper"],
    shortFr:
      "Élfes polyvalents avec une bonne armure : agiles à la passe comme en défense, sans la fragilité des autres elfes.",
    shortEn:
      "Versatile elves with solid armour: agile in passing and defence, without the fragility of other elves.",
  },
  wood_elf: {
    difficulty: "advanced",
    playStyle: "agile",
    starPlayers: ["Jordell Freshbreeze"],
    shortFr:
      "Les plus rapides et agiles du jeu, mais fragiles. Un jeu de mouvement exigeant qui ne pardonne aucune erreur.",
    shortEn:
      "The fastest, most agile team in the game, but fragile. A demanding movement game that punishes every mistake.",
  },
  chaos_chosen: {
    difficulty: "intermediate",
    playStyle: "bash",
    starPlayers: ["Lord Borak the Despoiler", "Grashnak Blackhoof"],
    shortFr:
      "Brutaux et évolutifs : peu de compétences au départ mais un potentiel énorme grâce aux mutations à la montée.",
    shortEn:
      "Brutal and evolving: few starting skills but huge potential thanks to mutations gained on level-up.",
  },
  gnome: {
    difficulty: "advanced",
    playStyle: "stunty",
    starPlayers: [],
    shortFr:
      "Petite équipe rusée mêlant illusionnistes et arbres : trickster fragile au plafond limité, pour amateurs de défi.",
    shortEn:
      "A cunning small team of illusionists and trees: a fragile trickster with a low ceiling, for challenge seekers.",
  },
  goblin: {
    difficulty: "advanced",
    playStyle: "stunty",
    starPlayers: ["Bomber Dribblesnot", "Fungus the Loon", "Scrappa Sorehead"],
    shortFr:
      "L'équipe gadget par excellence : tronçonneuses, bombes et balle-et-chaîne. Hilarante mais très difficile à gagner.",
    shortEn:
      "The ultimate gimmick team: chainsaws, bombs and ball-and-chain. Hilarious but very hard to win with.",
  },
  halfling: {
    difficulty: "advanced",
    playStyle: "stunty",
    starPlayers: ["Puggy Baconbreath", "Deeproot Strongbranch"],
    shortFr:
      "Minuscules et fragiles, sauvés par leurs Arbres et leurs Chefs-cuisiniers. Le défi ultime du coach Blood Bowl.",
    shortEn:
      "Tiny and fragile, saved by their Treemen and Master Chefs. The ultimate Blood Bowl coaching challenge.",
  },
  high_elf: {
    difficulty: "beginner",
    playStyle: "agile",
    starPlayers: ["Eldril Sidewinder"],
    shortFr:
      "Élfes équilibrés avec une bonne armure : agiles, fiables à la passe et plus pardonnants que les autres elfes.",
    shortEn:
      "Balanced elves with decent armour: agile, reliable passers and more forgiving than other elf teams.",
    beginnerFriendly: true,
  },
  lizardmen: {
    difficulty: "intermediate",
    playStyle: "balanced",
    starPlayers: ["Slibli", "Zolcath the Zoat"],
    shortFr:
      "Sauruses costauds et Skinks vifs : une combinaison force/agilité redoutable, parfaite pour un jeu de plaquage mobile.",
    shortEn:
      "Tough Saurus and nimble Skinks: a fearsome strength/agility combo, perfect for a mobile bashing game.",
  },
  necromantic_horror: {
    difficulty: "intermediate",
    playStyle: "bash",
    starPlayers: ["Wilhelm Chaney"],
    shortFr:
      "Loups-garous et Golems de chair : résistance, régénération et morsures. Un bash qui se renforce avec le temps.",
    shortEn:
      "Werewolves and Flesh Golems: resilience, regeneration and bite. A bashy team that grows stronger over time.",
  },
  human: {
    difficulty: "beginner",
    playStyle: "balanced",
    starPlayers: ["Griff Oberwald", "Mighty Zug"],
    shortFr:
      "L'équipe d'apprentissage par excellence : équilibrée, sans faiblesse criante, idéale pour comprendre les bases.",
    shortEn:
      "The quintessential learning team: balanced, with no glaring weakness — ideal for grasping the fundamentals.",
    beginnerFriendly: true,
  },
  khorne: {
    difficulty: "intermediate",
    playStyle: "bash",
    starPlayers: ["Morg 'n' Thorg"],
    shortFr:
      "Furie sanguinaire et Frénésie : une équipe ultra-agressive bâtie pour blesser, au prix d'un contrôle de balle limité.",
    shortEn:
      "Bloodlust and Frenzy: a hyper-aggressive team built to injure, at the cost of limited ball control.",
  },
  undead: {
    difficulty: "beginner",
    playStyle: "bash",
    starPlayers: ["Ramtut III", "Wilhelm Chaney"],
    shortFr:
      "Momies puissantes, Goules agiles et recrutement infini : résistant, pardonnant et excellent pour débuter le bash.",
    shortEn:
      "Strong Mummies, agile Ghouls and endless recruits: resilient, forgiving and great for learning bashy play.",
    beginnerFriendly: true,
  },
  chaos_dwarf: {
    difficulty: "intermediate",
    playStyle: "bash",
    starPlayers: ["Hthark the Unstoppable", "Kreek Rustgouger"],
    shortFr:
      "Le bash patient : Blocage et Crâne épais de série, Taurus et Hobgobelins. Lent mais d'une solidité écrasante.",
    shortEn:
      "Patient bashing: Block and Thick Skull as standard, Bull Centaurs and Hobgoblins. Slow but crushingly solid.",
  },
  dwarf: {
    difficulty: "beginner",
    playStyle: "bash",
    starPlayers: ["Grim Ironjaw", "Barik Farblast"],
    shortFr:
      "Lents mais blindés : Blocage, Crâne épais et Sûres mains partout. Très pardonnant, idéal pour apprendre le contrôle.",
    shortEn:
      "Slow but armoured: Block, Thick Skull and Sure Hands everywhere. Very forgiving, ideal for learning grind play.",
    beginnerFriendly: true,
  },
  imperial_nobility: {
    difficulty: "intermediate",
    playStyle: "balanced",
    starPlayers: ["Griff Oberwald", "Mighty Zug"],
    shortFr:
      "Humains relookés avec Gardes du corps et Bowlistes : polyvalence classique agrémentée de quelques outils tactiques.",
    shortEn:
      "Humans reimagined with Bodyguards and Bowlers: classic versatility with a few extra tactical tools.",
  },
  norse: {
    difficulty: "intermediate",
    playStyle: "bash",
    starPlayers: ["Icepelt Hammerblow"],
    shortFr:
      "Blocage généralisé mais armure faible : un bash agressif et risqué qui mise tout sur l'attaque, jamais sur la défense.",
    shortEn:
      "Block everywhere but low armour: an aggressive, risky bashing team that bets everything on offence.",
  },
  nurgle: {
    difficulty: "advanced",
    playStyle: "bash",
    starPlayers: ["Bilerot Vomitflesh"],
    shortFr:
      "Puanteur, Tentacules et Crasse : un rouleau-compresseur lent qui colle l'adversaire au sol. Demande de la patience.",
    shortEn:
      "Foul Appearance, Tentacles and Disturbing Presence: a slow grinder that pins opponents down. Requires patience.",
  },
  ogre: {
    difficulty: "advanced",
    playStyle: "bash",
    starPlayers: ["Morg 'n' Thorg"],
    shortFr:
      "Cinq Ogres surpuissants entourés de Snotlings jetables : une force brute énorme minée par les Os de Tête.",
    shortEn:
      "Five mighty Ogres surrounded by expendable Snotlings: enormous raw strength undermined by Bone-head.",
  },
  black_orc: {
    difficulty: "beginner",
    playStyle: "bash",
    starPlayers: ["Varag Ghoul-Chewer", "Grashnak Blackhoof"],
    shortFr:
      "Orcs Noirs costauds appuyés par des Gobelins : un bash simple et solide, très accessible pour un débutant agressif.",
    shortEn:
      "Sturdy Black Orcs backed by Goblins: a simple, solid bashing team, very accessible for an aggressive beginner.",
    beginnerFriendly: true,
  },
  orc: {
    difficulty: "beginner",
    playStyle: "bash",
    starPlayers: ["Varag Ghoul-Chewer", "Grashnak Blackhoof"],
    shortFr:
      "Bash résistant et pardonnant : bonne armure, Blitzers solides et Gobelins fourbes. L'une des meilleures portes d'entrée.",
    shortEn:
      "Resilient, forgiving bash: good armour, solid Blitzers and sneaky Goblins. One of the best entry points.",
    beginnerFriendly: true,
  },
  chaos_renegade: {
    difficulty: "advanced",
    playStyle: "hybrid",
    starPlayers: ["Max Spleenripper"],
    shortFr:
      "Toutes les races du Chaos réunies : Gobelins, Skavens, Orcs et Big Guys. Riche en options mais difficile à équilibrer.",
    shortEn:
      "Every Chaos race in one team: Goblins, Skaven, Orcs and Big Guys. Rich in options but hard to balance.",
  },
  tomb_kings: {
    difficulty: "intermediate",
    playStyle: "balanced",
    starPlayers: ["Ramtut III"],
    shortFr:
      "Momies de Force 5 et Blitz-Ras agiles : du contrôle de ligne brutal compensant un jeu de passe quasi inexistant.",
    shortEn:
      "Strength 5 Mummies and agile Blitz-Ras: brutal line control compensating an almost non-existent passing game.",
  },
  skaven: {
    difficulty: "intermediate",
    playStyle: "agile",
    starPlayers: ["Hakflem Skuttlespike", "Glart Smashrip"],
    shortFr:
      "Vitesse extrême et fragilité assumée : Coureurs des Tempêtes, Rat-Ogre et un Gutter Runner ultra-rapide. Du glass-cannon.",
    shortEn:
      "Extreme speed and embraced fragility: Storm Vermin, a Rat Ogre and a lightning Gutter Runner. Pure glass cannon.",
  },
  slann: {
    difficulty: "advanced",
    playStyle: "agile",
    starPlayers: ["Slibli"],
    shortFr:
      "Sauteurs Très Agiles capables de bonds spectaculaires : un jeu de mouvement aérien unique mais délicat à maîtriser.",
    shortEn:
      "Very Agile Leapers capable of spectacular jumps: a unique aerial movement game, but tricky to master.",
  },
  snotling: {
    difficulty: "advanced",
    playStyle: "stunty",
    starPlayers: ["Bomber Dribblesnot", "Fungus the Loon"],
    shortFr:
      "L'équipe la plus loufoque : Snotlings jetables, Trolls et gadgets en pagaille. Pensée pour le fun, pas pour la victoire.",
    shortEn:
      "The zaniest team of all: expendable Snotlings, Trolls and gadgets galore. Built for fun, not for winning.",
  },
  elven_union: {
    difficulty: "intermediate",
    playStyle: "agile",
    starPlayers: ["Eldril Sidewinder", "Roxanna Darknail"],
    shortFr:
      "L'équipe elfe équilibrée : bons à la passe, agiles et plus accessibles que les Wood Elves, sans excès de fragilité.",
    shortEn:
      "The balanced elf team: strong passers, agile and more accessible than Wood Elves, without extreme fragility.",
  },
  vampire: {
    difficulty: "advanced",
    playStyle: "hybrid",
    starPlayers: ["Count Luthor von Drakenborg"],
    shortFr:
      "Vampires surpuissants mais affamés : la Soif de Sang peut retourner vos propres Thralls. Haut risque, haute récompense.",
    shortEn:
      "Mighty but hungry Vampires: Bloodlust can turn on your own Thralls. High risk, high reward.",
  },
};

/** Métadonnées de repli pour un slug inconnu (défense en profondeur). */
const FALLBACK_META: RosterMeta = {
  difficulty: "intermediate",
  playStyle: "balanced",
  starPlayers: [],
  shortFr: "Roster Blood Bowl officiel.",
  shortEn: "Official Blood Bowl roster.",
};

/** Retourne les métadonnées curées d'un roster, avec repli sûr. */
export function getRosterMeta(slug: string): RosterMeta {
  return ROSTER_META[slug] ?? FALLBACK_META;
}

/** Slugs recommandés pour débuter (encart « meilleur roster débutant »). */
export const BEGINNER_FRIENDLY_SLUGS: readonly string[] = Object.entries(
  ROSTER_META,
)
  .filter(([, meta]) => meta.beginnerFriendly)
  .map(([slug]) => slug);
