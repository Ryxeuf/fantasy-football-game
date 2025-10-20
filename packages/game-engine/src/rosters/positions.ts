/**
 * Système de positions unifiées avec slugs uniques
 * Chaque position a un slug unique (ex: skaven_lineman) et un nom d'affichage
 */

export interface PositionDefinition {
  slug: string;        // Slug unique (ex: skaven_lineman)
  displayName: string; // Nom d'affichage (ex: Lineman)
  cost: number;        // Coût en kpo
  min: number;         // Minimum requis
  max: number;         // Maximum autorisé
  ma: number;          // Movement Allowance
  st: number;          // Strength
  ag: number;          // Agility
  pa: number;          // Passing
  av: number;          // Armour Value
  skills: string;      // Compétences de base (séparées par virgules)
}

export interface TeamRoster {
  name: string;
  budget: number;
  positions: PositionDefinition[];
}

// Mapping complet des équipes avec leurs positions
export const TEAM_ROSTERS: Record<string, TeamRoster> = {
  skaven: {
    name: "Skavens",
    budget: 1000,
    positions: [
      {
        slug: "skaven_lineman",
        displayName: "Lineman",
        cost: 50,
        min: 0,
        max: 16,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      },
      {
        slug: "skaven_thrower",
        displayName: "Thrower",
        cost: 85,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        slug: "skaven_blitzer",
        displayName: "Blitzer",
        cost: 90,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        slug: "skaven_gutter_runner",
        displayName: "Gutter Runner",
        cost: 85,
        min: 0,
        max: 4,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      {
        slug: "skaven_rat_ogre",
        displayName: "Rat Ogre",
        cost: 150,
        min: 0,
        max: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 9,
        skills: "animal-savagery,frenzy,loner-4,mighty-blow-1,prehensile-tail",
      },
    ],
  },
  lizardmen: {
    name: "Hommes-Lézards",
    budget: 1000,
    positions: [
      {
        slug: "lizardmen_skink_runner",
        displayName: "Skink Runner",
        cost: 60,
        min: 0,
        max: 12,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge,stunty",
      },
      {
        slug: "lizardmen_chameleon_skink",
        displayName: "Chameleon Skink",
        cost: 70,
        min: 0,
        max: 2,
        ma: 7,
        st: 2,
        ag: 3,
        pa: 3,
        av: 8,
        skills: "dodge,on-the-ball,shadowing,stunty",
      },
      {
        slug: "lizardmen_saurus",
        displayName: "Saurus",
        cost: 85,
        min: 0,
        max: 6,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        slug: "lizardmen_kroxigor",
        displayName: "Kroxigor",
        cost: 140,
        min: 0,
        max: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 10,
        skills: "bone-head,loner-4,mighty-blow-1,prehensile-tail,thick-skull,throw-team-mate",
      },
    ],
  },
  wood_elf: {
    name: "Elfes Sylvains",
    budget: 1000,
    positions: [
      {
        slug: "wood_elf_lineman",
        displayName: "Lineman",
        cost: 70,
        min: 0,
        max: 12,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "",
      },
      {
        slug: "wood_elf_thrower",
        displayName: "Thrower",
        cost: 95,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        slug: "wood_elf_catcher",
        displayName: "Catcher",
        cost: 90,
        min: 0,
        max: 4,
        ma: 8,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "catch,dodge",
      },
      {
        slug: "wood_elf_wardancer",
        displayName: "Wardancer",
        cost: 125,
        min: 0,
        max: 2,
        ma: 8,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "block,dodge,leap",
      },
      {
        slug: "wood_elf_treeman",
        displayName: "Treeman",
        cost: 120,
        min: 0,
        max: 1,
        ma: 2,
        st: 6,
        ag: 5,
        pa: 5,
        av: 11,
        skills: "loner-4,mighty-blow-1,stand-firm,strong-arm,take-root,thick-skull,throw-team-mate",
      },
    ],
  },
};

// Fonction utilitaire pour obtenir une position par son slug
export function getPositionBySlug(slug: string): PositionDefinition | null {
  for (const roster of Object.values(TEAM_ROSTERS)) {
    const position = roster.positions.find(p => p.slug === slug);
    if (position) return position;
  }
  return null;
}

// Fonction utilitaire pour obtenir toutes les positions d'une équipe
export function getTeamPositions(teamRoster: string): PositionDefinition[] {
  const roster = TEAM_ROSTERS[teamRoster];
  return roster ? roster.positions : [];
}

// Fonction utilitaire pour obtenir le nom d'affichage d'un slug
export function getDisplayName(slug: string): string {
  const position = getPositionBySlug(slug);
  return position ? position.displayName : slug;
}

// Fonction utilitaire pour obtenir le slug à partir du nom d'affichage et de l'équipe
export function getSlugFromDisplayName(displayName: string, teamRoster: string): string | null {
  const positions = getTeamPositions(teamRoster);
  const position = positions.find(p => p.displayName === displayName);
  return position ? position.slug : null;
}

// Mapping des anciennes clés vers les nouveaux slugs (pour migration)
export const LEGACY_POSITION_MAPPING: Record<string, string> = {
  // Skaven
  "lineman": "skaven_lineman",
  "thrower": "skaven_thrower", 
  "blitzer": "skaven_blitzer",
  "gutter": "skaven_gutter_runner",
  "gutter_runner": "skaven_gutter_runner",
  "ratogre": "skaven_rat_ogre",
  "rat_ogre": "skaven_rat_ogre",
  
  // Lizardmen
  "skink": "lizardmen_skink_runner",
  "lizardmen_skink": "lizardmen_skink_runner", // Migration ancien slug
  "chameleon_skink": "lizardmen_chameleon_skink",
  "saurus": "lizardmen_saurus",
  "kroxigor": "lizardmen_kroxigor",
};
