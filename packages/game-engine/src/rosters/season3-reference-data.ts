/**
 * Donnees de reference Blood Bowl Saison 3 (2025)
 *
 * Ce fichier sert de source de verite independante pour valider
 * que les rosters implementes dans season3-rosters.ts sont conformes
 * aux regles officielles de la Saison 3.
 *
 * Sources de cross-validation :
 *  - mordorbihan.fr/fr/bloodbowl/2025/equipes (source primaire, utilisee pour le scraping)
 *  - thenaf.net (NAF, autorite tournois, rosters approuves)
 *  - warhammer-community.com (GW errata/FAQ officiels)
 *  - bbtactics.com (wiki communautaire)
 *
 * NOTE : BSData/bloodbowl (GitHub) reference les donnees BB2020 (Saison 2),
 * PAS la Saison 3 de 2025. Ne pas l'utiliser comme reference S3.
 *
 * IMPORTANT : Ce fichier ne contient que des faits (stats numeriques, couts,
 * noms de positions). Les faits ne sont pas proteges par le copyright.
 * Aucun texte creatif, description, illustration ou contenu du livre de regles
 * n'est reproduit ici.
 *
 * Derniere mise a jour : 2026-04-10
 */

// ─── Types de reference ──────────────────────────────────────────────────

export interface ReferencePosition {
  /** Nom anglais canonique (pour cross-ref avec BSData/FUMBBL) */
  nameEn: string;
  cost: number;
  max: number;
  ma: number;
  st: number;
  /** AG en notation target number (2+ = 2, 3+ = 3, etc.) */
  ag: number;
  /** PA en notation target number (2+ = 2, 6+ = 6, 0 = no PA) */
  pa: number;
  /** AV en notation target number (6+ = 6, etc.) */
  av: number;
  /** Skills de depart (slugs tries alphabetiquement) */
  skills: string[];
}

export interface ReferenceRoster {
  nameEn: string;
  tier: 'I' | 'II' | 'III' | 'IV';
  /** Nombre de types de positions */
  positionCount: number;
  /** Budget de depart en milliers de pieces d'or (toujours 1000) */
  budget: number;
  /** Positions cles a verifier (pas necessairement toutes) */
  keyPositions: ReferencePosition[];
}

// ─── Donnees de reference par equipe ──────────────────────────────────────

export const SEASON_3_REFERENCE: Record<string, ReferenceRoster> = {

  // ── TIER I ────────────────────────────────────────────────────────────

  old_world_alliance: {
    nameEn: 'Old World Alliance',
    tier: 'I',
    positionCount: 11,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Human Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
      { nameEn: 'Halfling Hopeful', cost: 30, max: 3, ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Dwarf Blocker', cost: 70, max: 3, ma: 4, st: 3, ag: 4, pa: 5, av: 10, skills: ['block', 'defensive', 'thick-skull'] },
      { nameEn: 'Ogre', cost: 140, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['bone-head', 'loner-3', 'mighty-blow-1', 'thick-skull', 'throw-team-mate'] },
    ],
  },

  amazon: {
    nameEn: 'Amazon',
    tier: 'I',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Eagle Warrior Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: ['dodge'] },
      { nameEn: 'Jaguar Warrior Blocker', cost: 110, max: 2, ma: 6, st: 4, ag: 3, pa: 4, av: 9, skills: ['defensive', 'dodge'] },
    ],
  },

  underworld: {
    nameEn: 'Underworld Denizens',
    tier: 'I',
    positionCount: 8,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Underworld Goblin Lineman', cost: 40, max: 16, ma: 6, st: 2, ag: 3, pa: 4, av: 8, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Skaven Clanrat Lineman', cost: 50, max: 3, ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: ['animosity-underworld'] },
      { nameEn: 'Rat Ogre', cost: 150, max: 1, ma: 6, st: 5, ag: 4, pa: 6, av: 9, skills: ['animal-savagery', 'frenzy', 'loner-4', 'mighty-blow-1', 'prehensile-tail'] },
    ],
  },

  dark_elf: {
    nameEn: 'Dark Elf',
    tier: 'I',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Dark Elf Lineman', cost: 65, max: 16, ma: 6, st: 3, ag: 2, pa: 3, av: 9, skills: [] },
      { nameEn: 'Dark Elf Blitzer', cost: 105, max: 2, ma: 7, st: 3, ag: 2, pa: 3, av: 9, skills: ['block'] },
      { nameEn: 'Witch Elf', cost: 110, max: 2, ma: 7, st: 3, ag: 2, pa: 4, av: 8, skills: ['dodge', 'frenzy', 'jump-up'] },
    ],
  },

  wood_elf: {
    nameEn: 'Wood Elf',
    tier: 'I',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Wood Elf Lineman', cost: 65, max: 12, ma: 7, st: 3, ag: 2, pa: 3, av: 8, skills: [] },
      { nameEn: 'Wardancer', cost: 130, max: 2, ma: 8, st: 3, ag: 2, pa: 3, av: 8, skills: ['block', 'dodge', 'leap'] },
      { nameEn: 'Treeman', cost: 120, max: 1, ma: 2, st: 6, ag: 5, pa: 5, av: 11, skills: ['loner-4', 'mighty-blow-1', 'stand-firm', 'strong-arm', 'take-root', 'thick-skull', 'throw-team-mate'] },
    ],
  },

  chaos_dwarf: {
    nameEn: 'Chaos Dwarf',
    tier: 'I',
    positionCount: 6,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Hobgoblin Lineman', cost: 40, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
      { nameEn: 'Chaos Dwarf Blocker', cost: 70, max: 4, ma: 4, st: 3, ag: 4, pa: 6, av: 10, skills: ['block', 'iron-hard-skin', 'thick-skull'] },
      { nameEn: 'Bull Centaur Blitzer', cost: 130, max: 2, ma: 6, st: 4, ag: 4, pa: 6, av: 10, skills: ['instable', 'sprint', 'sure-feet', 'thick-skull'] },
      { nameEn: 'Minotaur', cost: 150, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: ['frenzy', 'horns', 'loner-4', 'mighty-blow-1', 'thick-skull', 'wild-animal'] },
    ],
  },

  dwarf: {
    nameEn: 'Dwarf',
    tier: 'I',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Dwarf Blocker Lineman', cost: 70, max: 16, ma: 4, st: 3, ag: 4, pa: 5, av: 10, skills: ['block', 'defensive', 'thick-skull'] },
      { nameEn: 'Troll Slayer', cost: 95, max: 2, ma: 5, st: 3, ag: 4, pa: 5, av: 9, skills: ['block', 'dauntless', 'frenzy', 'hate', 'thick-skull'] },
      { nameEn: 'Dwarf Blitzer', cost: 100, max: 2, ma: 5, st: 3, ag: 4, pa: 4, av: 10, skills: ['block', 'diving-tackle', 'tackle', 'thick-skull'] },
      { nameEn: 'Deathroller', cost: 170, max: 1, ma: 5, st: 7, ag: 5, pa: 6, av: 11, skills: ['break-tackle', 'dirty-player-1', 'juggernaut', 'loner-4', 'mighty-blow-1', 'no-hands', 'secret-weapon', 'stand-firm', 'tackle'] },
    ],
  },

  high_elf: {
    nameEn: 'High Elf',
    tier: 'I',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'High Elf Lineman', cost: 65, max: 16, ma: 6, st: 3, ag: 2, pa: 3, av: 9, skills: [] },
      { nameEn: 'High Elf Catcher', cost: 90, max: 4, ma: 8, st: 3, ag: 2, pa: 3, av: 8, skills: ['catch'] },
      // Note: Le Lanceur (cost=100, max=2) et le Blitzer (cost=100, max=2) ont le meme cout et max
      // On valide le Lanceur ici (premier match) car il apparait avant dans le roster
      { nameEn: 'High Elf Thrower', cost: 100, max: 2, ma: 6, st: 3, ag: 2, pa: 2, av: 9, skills: ['cloud-burster', 'pass', 'safe-pass'] },
    ],
  },

  lizardmen: {
    nameEn: 'Lizardmen',
    tier: 'I',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Skink Runner Lineman', cost: 60, max: 16, ma: 8, st: 2, ag: 3, pa: 4, av: 8, skills: ['dodge', 'titchy'] },
      { nameEn: 'Saurus Blocker', cost: 90, max: 6, ma: 6, st: 4, ag: 5, pa: 6, av: 10, skills: ['instable', 'juggernaut'] },
      { nameEn: 'Kroxigor', cost: 140, max: 1, ma: 6, st: 5, ag: 5, pa: 6, av: 10, skills: ['bone-head', 'loner-4', 'mighty-blow-1', 'prehensile-tail', 'thick-skull'] },
    ],
  },

  norse: {
    nameEn: 'Norse',
    tier: 'I',
    positionCount: 6,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Norse Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: ['block', 'drunkard', 'instable', 'thick-skull'] },
      { nameEn: 'Beer Boar', cost: 20, max: 2, ma: 5, st: 1, ag: 3, pa: 6, av: 6, skills: ['dodge', 'no-hands', 'pick-me-up', 'stunty', 'titchy'] },
      { nameEn: 'Ulfwerener', cost: 105, max: 2, ma: 6, st: 4, ag: 4, pa: 6, av: 9, skills: ['frenzy', 'instable'] },
      { nameEn: 'Yhetee', cost: 140, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: ['claws', 'disturbing-presence', 'frenzy', 'loner-4', 'wild-animal'] },
    ],
  },

  // ── TIER II ───────────────────────────────────────────────────────────

  necromantic_horror: {
    nameEn: 'Necromantic Horror',
    tier: 'II',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Zombie Lineman', cost: 40, max: 16, ma: 4, st: 3, ag: 4, pa: 6, av: 9, skills: ['fork', 'instable', 'regeneration'] },
      { nameEn: 'Ghoul Runner', cost: 75, max: 2, ma: 7, st: 3, ag: 3, pa: 3, av: 8, skills: ['dodge', 'regeneration'] },
      { nameEn: 'Werewolf', cost: 120, max: 2, ma: 8, st: 3, ag: 3, pa: 3, av: 9, skills: ['claws', 'frenzy', 'regeneration'] },
    ],
  },

  human: {
    nameEn: 'Human',
    tier: 'II',
    positionCount: 6,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Human Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
      { nameEn: 'Halfling Hopeful', cost: 30, max: 3, ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Human Thrower', cost: 75, max: 2, ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: ['pass', 'sure-hands'] },
      { nameEn: 'Human Blitzer', cost: 85, max: 2, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['block', 'tackle'] },
      { nameEn: 'Ogre', cost: 140, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['bone-head', 'loner-3', 'mighty-blow-1', 'thick-skull', 'throw-team-mate'] },
    ],
  },

  undead: {
    nameEn: 'Shambling Undead',
    tier: 'II',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      // Note: Skeleton (cost=40, max=16) et Zombie (cost=40, max=16) ont meme cout et max
      // Le Skeleton apparait en premier dans le roster, on le valide
      { nameEn: 'Skeleton Lineman', cost: 40, max: 16, ma: 5, st: 3, ag: 4, pa: 6, av: 8, skills: ['regeneration', 'thick-skull'] },
      { nameEn: 'Ghoul Runner', cost: 75, max: 2, ma: 7, st: 3, ag: 3, pa: 3, av: 8, skills: ['dodge', 'regeneration'] },
      { nameEn: 'Mummy', cost: 125, max: 2, ma: 3, st: 5, ag: 5, pa: 6, av: 10, skills: ['mighty-blow-1', 'regeneration'] },
    ],
  },

  imperial_nobility: {
    nameEn: 'Imperial Nobility',
    tier: 'II',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Imperial Retainer Lineman', cost: 45, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: ['fend'] },
      { nameEn: 'Noble Blitzer', cost: 90, max: 2, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['block', 'catch', 'pro'] },
      { nameEn: 'Ogre', cost: 140, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['bone-head', 'loner-3', 'mighty-blow-1', 'thick-skull', 'throw-team-mate'] },
    ],
  },

  orc: {
    nameEn: 'Orc',
    tier: 'II',
    positionCount: 6,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Orc Lineman', cost: 50, max: 16, ma: 5, st: 3, ag: 3, pa: 4, av: 10, skills: [] },
      { nameEn: 'Goblin Lineman', cost: 40, max: 4, ma: 6, st: 2, ag: 3, pa: 3, av: 8, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Orc Blitzer', cost: 85, max: 2, ma: 6, st: 3, ag: 3, pa: 4, av: 10, skills: ['block', 'break-tackle'] },
      { nameEn: 'Troll', cost: 115, max: 1, ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['always-hungry', 'loner-4', 'mighty-blow-1', 'projectile-vomit', 'really-stupid', 'regeneration', 'throw-team-mate'] },
    ],
  },

  tomb_kings: {
    nameEn: 'Tomb Kings',
    tier: 'II',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Skeleton Lineman', cost: 40, max: 16, ma: 5, st: 3, ag: 4, pa: 6, av: 8, skills: ['regeneration', 'thick-skull'] },
      { nameEn: 'Tomb Guardian', cost: 115, max: 4, ma: 4, st: 5, ag: 5, pa: 6, av: 10, skills: ['brawler', 'decay', 'regeneration'] },
      { nameEn: 'Tomb Kings Blitzer', cost: 85, max: 2, ma: 6, st: 3, ag: 4, pa: 5, av: 9, skills: ['block', 'regeneration', 'thick-skull'] },
    ],
  },

  skaven: {
    nameEn: 'Skaven',
    tier: 'II',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Skaven Clanrat Lineman', cost: 50, max: 16, ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
      { nameEn: 'Skaven Thrower', cost: 80, max: 2, ma: 7, st: 3, ag: 3, pa: 2, av: 8, skills: ['pass', 'sure-hands'] },
      { nameEn: 'Gutter Runner', cost: 85, max: 2, ma: 9, st: 2, ag: 2, pa: 4, av: 8, skills: ['dodge', 'stab'] },
      { nameEn: 'Skaven Blitzer', cost: 90, max: 2, ma: 8, st: 3, ag: 3, pa: 4, av: 9, skills: ['block', 'strip-ball'] },
      { nameEn: 'Rat Ogre', cost: 150, max: 1, ma: 6, st: 5, ag: 4, pa: 6, av: 9, skills: ['animal-savagery', 'frenzy', 'loner-4', 'mighty-blow-1', 'prehensile-tail'] },
    ],
  },

  slann: {
    nameEn: 'Slann',
    tier: 'II',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Slann Lineman', cost: 60, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ['pogo-stick', 'very-long-legs'] },
      { nameEn: 'Slann Catcher', cost: 80, max: 4, ma: 7, st: 2, ag: 2, pa: 4, av: 8, skills: ['diving-catch', 'pogo-stick', 'very-long-legs'] },
      { nameEn: 'Slann Blitzer', cost: 110, max: 4, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['diving-tackle', 'jump-up', 'pogo-stick', 'very-long-legs'] },
      { nameEn: 'Kroxigor', cost: 140, max: 1, ma: 6, st: 5, ag: 5, pa: 6, av: 10, skills: ['bone-head', 'loner-4', 'mighty-blow-1', 'prehensile-tail', 'thick-skull'] },
    ],
  },

  elven_union: {
    nameEn: 'Elven Union',
    tier: 'II',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Elven Union Lineman', cost: 65, max: 16, ma: 6, st: 3, ag: 2, pa: 3, av: 8, skills: ['fumblerooskie'] },
      { nameEn: 'Elven Union Catcher', cost: 100, max: 2, ma: 8, st: 3, ag: 2, pa: 4, av: 8, skills: ['catch', 'diving-catch', 'nerves-of-steel'] },
      { nameEn: 'Elven Union Blitzer', cost: 115, max: 2, ma: 7, st: 3, ag: 2, pa: 3, av: 9, skills: ['block', 'sidestep'] },
    ],
  },

  vampire: {
    nameEn: 'Vampire',
    tier: 'II',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Thrall Lineman', cost: 40, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [] },
      { nameEn: 'Vampire Runner', cost: 100, max: 2, ma: 8, st: 3, ag: 2, pa: 3, av: 8, skills: ['bloodlust', 'hypnotic-gaze', 'regeneration'] },
      { nameEn: 'Vampire Blitzer', cost: 110, max: 2, ma: 6, st: 4, ag: 2, pa: 4, av: 9, skills: ['bloodlust', 'hypnotic-gaze', 'juggernaut', 'regeneration'] },
      { nameEn: 'Vargheist', cost: 150, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 10, skills: ['bloodlust', 'claws', 'frenzy', 'loner-4', 'regeneration'] },
    ],
  },

  // ── TIER III ──────────────────────────────────────────────────────────

  chaos_chosen: {
    nameEn: 'Chaos Chosen',
    tier: 'III',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Beastman Runner Lineman', cost: 55, max: 16, ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: ['horns', 'thick-skull'] },
      { nameEn: 'Chosen Blocker', cost: 100, max: 4, ma: 5, st: 4, ag: 3, pa: 5, av: 10, skills: ['arm-bar'] },
      { nameEn: 'Minotaur', cost: 150, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: ['frenzy', 'horns', 'loner-4', 'mighty-blow-1', 'thick-skull', 'wild-animal'] },
    ],
  },

  khorne: {
    nameEn: 'Khorne',
    tier: 'III',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Marauder Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: ['frenzy'] },
      { nameEn: 'Khorngor', cost: 70, max: 2, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ['horns', 'juggernaut', 'jump-up', 'thick-skull'] },
      { nameEn: 'Bloodspawn', cost: 160, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: ['claws', 'frenzy', 'loner-4', 'mighty-blow-1', 'wild-animal'] },
    ],
  },

  nurgle: {
    nameEn: 'Nurgle',
    tier: 'III',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Rotter Lineman', cost: 40, max: 16, ma: 5, st: 3, ag: 4, pa: 6, av: 9, skills: ['contagieux', 'decay'] },
      { nameEn: 'Bloater', cost: 110, max: 4, ma: 4, st: 4, ag: 4, pa: 6, av: 10, skills: ['contagieux', 'disturbing-presence', 'foul-appearance', 'instable', 'regeneration', 'stand-firm'] },
      { nameEn: 'Rotspawn', cost: 140, max: 1, ma: 4, st: 5, ag: 5, pa: 6, av: 10, skills: ['contagieux', 'disturbing-presence', 'foul-appearance', 'loner-4', 'mighty-blow-1', 'pick-me-up', 'really-stupid', 'regeneration', 'tentacles'] },
    ],
  },

  black_orc: {
    nameEn: 'Black Orc',
    tier: 'III',
    positionCount: 3,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Goblin Bruiser Lineman', cost: 45, max: 16, ma: 6, st: 2, ag: 3, pa: 4, av: 8, skills: ['dodge', 'right-stuff', 'thick-skull', 'titchy'] },
      { nameEn: 'Black Orc', cost: 90, max: 6, ma: 4, st: 4, ag: 4, pa: 5, av: 10, skills: ['brawler', 'grab'] },
      { nameEn: 'Trained Troll', cost: 115, max: 1, ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['always-hungry', 'mighty-blow-1', 'projectile-vomit', 'really-stupid', 'regeneration', 'throw-team-mate'] },
    ],
  },

  chaos_renegade: {
    nameEn: 'Chaos Renegades',
    tier: 'III',
    positionCount: 10,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Renegade Human Lineman', cost: 50, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ['animosity'] },
      { nameEn: 'Renegade Dark Elf', cost: 65, max: 1, ma: 6, st: 3, ag: 2, pa: 3, av: 9, skills: ['animosity'] },
      { nameEn: 'Renegade Minotaur', cost: 150, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: ['frenzy', 'horns', 'loner-4', 'mighty-blow-1', 'thick-skull', 'wild-animal'] },
    ],
  },

  // ── TIER IV ──────────────────────────────────────────────────────────

  gnome: {
    nameEn: 'Gnome',
    tier: 'IV',
    positionCount: 5,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Gnome Lineman', cost: 40, max: 16, ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['jump-up', 'right-stuff', 'titchy', 'wrestle'] },
      { nameEn: 'Treeman', cost: 120, max: 2, ma: 2, st: 6, ag: 5, pa: 5, av: 11, skills: ['mighty-blow-1', 'stand-firm', 'strong-arm', 'take-root', 'thick-skull', 'throw-team-mate', 'timmm-ber'] },
    ],
  },

  goblin: {
    nameEn: 'Goblin',
    tier: 'IV',
    positionCount: 8,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Goblin Lineman', cost: 40, max: 16, ma: 6, st: 2, ag: 3, pa: 4, av: 8, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Trained Troll', cost: 115, max: 2, ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['always-hungry', 'mighty-blow-1', 'projectile-vomit', 'really-stupid', 'regeneration', 'throw-team-mate'] },
      { nameEn: 'Fanatic', cost: 70, max: 1, ma: 3, st: 7, ag: 3, pa: 6, av: 8, skills: ['ball-and-chain', 'no-hands', 'secret-weapon', 'titchy'] },
    ],
  },

  halfling: {
    nameEn: 'Halfling',
    tier: 'IV',
    positionCount: 4,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Halfling Hopeful Lineman', cost: 30, max: 16, ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['dodge', 'right-stuff', 'titchy'] },
      { nameEn: 'Halfling Catcher', cost: 55, max: 2, ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['catch', 'dodge', 'right-stuff', 'sprint', 'titchy'] },
      { nameEn: 'Treeman', cost: 120, max: 2, ma: 2, st: 6, ag: 5, pa: 5, av: 11, skills: ['mighty-blow-1', 'stand-firm', 'strong-arm', 'take-root', 'thick-skull', 'throw-team-mate', 'timmm-ber'] },
    ],
  },

  ogre: {
    nameEn: 'Ogre',
    tier: 'IV',
    positionCount: 3,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Gnoblar Lineman', cost: 15, max: 16, ma: 5, st: 1, ag: 3, pa: 4, av: 6, skills: ['dodge', 'right-stuff', 'sidestep', 'stunty', 'titchy'] },
      { nameEn: 'Ogre Blocker', cost: 140, max: 5, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['bone-head', 'mighty-blow-1', 'thick-skull', 'throw-team-mate'] },
    ],
  },

  snotling: {
    nameEn: 'Snotling',
    tier: 'IV',
    positionCount: 6,
    budget: 1000,
    keyPositions: [
      { nameEn: 'Snotling Lineman', cost: 15, max: 16, ma: 5, st: 1, ag: 3, pa: 4, av: 6, skills: ['dodge', 'insignifiant', 'right-stuff', 'sidestep', 'stunty', 'titchy'] },
      { nameEn: 'Pump Wagon', cost: 100, max: 2, ma: 5, st: 5, ag: 5, pa: 6, av: 9, skills: ['dirty-player-1', 'juggernaut', 'mighty-blow-1', 'really-stupid', 'stand-firm'] },
      { nameEn: 'Trained Troll', cost: 115, max: 2, ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['always-hungry', 'mighty-blow-1', 'projectile-vomit', 'really-stupid', 'regeneration', 'throw-team-mate'] },
    ],
  },
};

// ─── Regles structurelles de reference ───────────────────────────────────

export const STRUCTURAL_RULES = {
  /** Budget de depart identique pour toutes les equipes */
  startingBudget: 1000,
  /** Nombre de tours par mi-temps (regles completes) */
  turnsPerHalf: 8,
  /** Nombre maximum de joueurs sur le terrain */
  maxPlayersOnPitch: 11,
  /** Nombre minimum de joueurs pour commencer */
  minPlayersToStart: 3,
  /** Tiers valides */
  validTiers: ['I', 'II', 'III', 'IV'] as const,
  /** Plages de stats valides (en notation target number pour AG/PA/AV) */
  statRanges: {
    ma: { min: 1, max: 9 },
    st: { min: 1, max: 7 },
    ag: { min: 1, max: 6 },
    pa: { min: 1, max: 6 },
    av: { min: 5, max: 11 },
    cost: { min: 10, max: 200 },
  },
  /** Chaque equipe doit avoir au moins un type de position avec max >= 11 (lineman) */
  mustHaveLinemanType: true,
  /** Nombre total d'equipes attendu en S3 */
  expectedTeamCount: 30,
};
