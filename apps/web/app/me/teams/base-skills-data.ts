/**
 * Compétences de base par position et équipe selon les règles officielles de Blood Bowl
 */

export interface BaseSkillsData {
  [teamName: string]: {
    [position: string]: string[];
  };
}

export const BASE_SKILLS_DATA: BaseSkillsData = {
  skaven: {
    "Clanrat Linemen": [],
    "skaven_thrower": ["Passe", "Prise Sûre"],
    "skaven_gutter_runner": ["Esquive"],
    "skaven_blitzer": ["Blocage"],
    "skaven_rat_ogre": ["Sauvagerie Animale*", "Frénésie", "Solitaire (4+)*", "Coup Puissant (+1)", "Queue Préhensile"]
  },
  lizardmen: {
    "Skink Linemen": [],
    "lizardmen_saurus": [],
    "lizardmen_skink": ["Esquive", "Microbe*"],
    "lizardmen_kroxigor": ["Tête de Bois", "Solitaire (4+)*", "Coup Puissant (+1)", "Queue Préhensile", "Crâne Épais", "Lancer d'Équipier"]
  },
  human: {
    "Human Linemen": [],
    "Thrower": ["Passe", "Prise Sûre"],
    "Catcher": ["Réception", "Esquive"],
    "Blitzer": ["Blocage"],
    "Halfling Hopeful": ["Esquive", "Microbe*", "Poids Plume*"],
    "Ogre": ["Tête de Bois", "Solitaire (4+)*", "Coup Puissant (+1)", "Crâne Épais", "Lancer d'Équipier"]
  },
  orc: {
    "Orc Linemen": [],
    "Thrower": ["Passe", "Prise Sûre"],
    "Blitzer": ["Blocage"],
    "Black Orc Blocker": [],
    "Goblin Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Troll": ["Toujours Affamé*", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Lancer d'Équipier"]
  },
  dwarf: {
    "Dwarf Linemen": [],
    "Runner": ["Prise Sûre"],
    "Blitzer": ["Blocage", "Crâne Épais"],
    "Longbeard": ["Blocage", "Crâne Épais"],
    "Deathroller": ["Esquive en Force", "Solitaire (4+)*", "Coup Puissant (+1)", "Sans les Mains*", "Arme Secrète*", "Stabilité", "Crâne Épais"]
  },
  elf: {
    "Elf Linemen": [],
    "Thrower": ["Passe"],
    "Catcher": ["Réception", "Nerfs d'Acier"],
    "Blitzer": ["Blocage"]
  },
  "dark elf": {
    "Dark Elf Linemen": [],
    "Thrower": ["Passe"],
    "Runner": ["Prise Sûre"],
    "Blitzer": ["Blocage"],
    "Assassin": ["Poursuite", "Poignard"]
  },
  "wood elf": {
    "Wood Elf Linemen": [],
    "Thrower": ["Passe"],
    "Catcher": ["Réception", "Esquive"],
    "Wardancer": ["Blocage", "Esquive", "Saut"]
  },
  "high elf": {
    "High Elf Linemen": [],
    "Thrower": ["Passe", "Passe Assurée"],
    "Catcher": ["Réception", "Esquive"],
    "Blitzer": ["Blocage"]
  },
  "chaos": {
    "Chaos Linemen": [],
    "Beastman": [],
    "Chaos Warrior": [],
    "Minotaur": ["Frénésie", "Cornes", "Solitaire (4+)*", "Coup Puissant (+1)", "Crâne Épais", "Fureur Débridée*"]
  },
  "chaos dwarf": {
    "Chaos Dwarf Linemen": [],
    "Bull Centaur": ["Sprint"],
    "Hobgoblin Linemen": [],
    "Minotaur": ["Frénésie", "Cornes", "Solitaire (4+)*", "Coup Puissant (+1)", "Crâne Épais", "Fureur Débridée*"]
  },
  "undead": {
    "Skeleton Linemen": ["Régénération", "Crâne Épais"],
    "Zombie Linemen": ["Régénération"],
    "Ghoul Runner": ["Esquive"],
    "Wight Blitzer": ["Blocage", "Régénération"],
    "Mummy": ["Coup Puissant (+1)", "Régénération", "Stabilité", "Crâne Épais"]
  },
  "necromantic": {
    "Zombie Linemen": ["Régénération"],
    "Ghoul Runner": ["Esquive"],
    "Wraith": ["Blocage", "Présence Perturbante", "Sans les Mains*", "Régénération", "Glissade Contrôlée"],
    "Werewolf": ["Griffes", "Frénésie", "Régénération"],
    "Flesh Golem": ["Régénération", "Stabilité", "Crâne Épais"]
  },
  "norse": {
    "Norse Linemen": ["Blocage"],
    "Thrower": ["Passe", "Prise Sûre"],
    "Catcher": ["Réception", "Esquive"],
    "Berserker": ["Blocage", "Frénésie"],
    "Yhetee": ["Présence Perturbante", "Solitaire (4+)*", "Coup Puissant (+1)", "Crâne Épais", "Fureur Débridée*"]
  },
  "amazon": {
    "Amazon Linemen": [],
    "Thrower": ["Passe", "Prise Sûre"],
    "Catcher": ["Réception", "Esquive"],
    "Blitzer": ["Blocage"]
  },
  "halfling": {
    "Halfling Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Treeman": ["Solitaire (4+)*", "Coup Puissant (+1)", "Stabilité", "Prendre Racine*", "Crâne Épais", "Lancer d'Équipier"]
  },
  "goblin": {
    "Goblin Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Looney": ["Tronçonneuse*", "Solitaire (4+)*", "Coup Puissant (+1)", "Sans les Mains*", "Arme Secrète*"],
    "Fanatic": ["Chaîne et Boulet*", "Solitaire (4+)*", "Coup Puissant (+1)", "Sans les Mains*", "Arme Secrète*"],
    "Pogoer": ["Esquive", "Rétablissement", "Microbe*", "Très Longues Jambes"],
    "Troll": ["Toujours Affamé*", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Lancer d'Équipier"]
  },
  "ogre": {
    "Ogre Linemen": ["Tête de Bois", "Coup Puissant (+1)", "Crâne Épais"],
    "Gnoblar Linemen": ["Esquive", "Poids Plume*", "Microbe*", "Minus*"],
    "Runt Punter": ["Esquive", "Poids Plume*", "Microbe*", "Minus*"]
  },
  "vampire": {
    "Thrall Linemen": [],
    "Vampire": ["Regard Hypnotique", "Régénération"]
  },
  "khemri": {
    "Skeleton Linemen": ["Régénération", "Crâne Épais"],
    "Thrower": ["Passe", "Régénération", "Prise Sûre", "Crâne Épais"],
    "Blitzer": ["Blocage", "Régénération", "Crâne Épais"],
    "Tomb Guardian": ["Décomposition*", "Régénération"]
  },
  "nurgle": {
    "Rotter Linemen": ["Décomposition*"],
    "Pestigor": ["Cornes"],
    "Rotters": ["Décomposition*"],
    "Beast of Nurgle": ["Présence Perturbante", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Tentacules"]
  },
  "khorne": {
    "Bloodborn Marauder Linemen": ["Frénésie"],
    "Khorngor": ["Cornes", "Boulet de Canon"],
    "Bloodseeker": ["Frénésie"],
    "Bloodspawn": ["Griffes", "Frénésie", "Solitaire (4+)*", "Coup Puissant (+1)", "Fureur Débridée*"]
  },
  "underworld": {
    "Goblin Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Skaven Linemen": [],
    "Thrower": ["Passe", "Prise Sûre"],
    "Blitzer": ["Blocage"],
    "Troll": ["Toujours Affamé*", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Lancer d'Équipier"]
  },
  "snotling": {
    "Snotling Linemen": ["Esquive", "Poids Plume*", "Microbe*", "Minus*"],
    "Pump Wagon": ["Solitaire (4+)*", "Coup Puissant (+1)", "Sans les Mains*", "Arme Secrète*"],
    "Troll": ["Toujours Affamé*", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Lancer d'Équipier"]
  },
  "black orc": {
    "Goblin Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Black Orc": [],
    "Troll": ["Toujours Affamé*", "Solitaire (4+)*", "Coup Puissant (+1)", "Gros Débile*", "Régénération", "Lancer d'Équipier"]
  },
  "imperial nobility": {
    "Imperial Retainer Linemen": [],
    "Thrower": ["Passe", "Passe Assurée"],
    "Noble Blitzer": ["Blocage"],
    "Bodyguard": ["Garde"]
  },
  "old world alliance": {
    "Human Linemen": [],
    "Dwarf Linemen": [],
    "Halfling Linemen": ["Esquive", "Microbe*", "Poids Plume*"],
    "Thrower": ["Passe", "Prise Sûre"],
    "Catcher": ["Réception", "Esquive"],
    "Blitzer": ["Blocage"],
    "Ogre": ["Tête de Bois", "Solitaire (4+)*", "Coup Puissant (+1)", "Crâne Épais", "Lancer d'Équipier"]
  }
};

/**
 * Normalise un nom d'équipe ou de position pour la recherche
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, ' ').trim();
}

/**
 * Obtient les compétences de base pour un joueur selon son équipe et sa position
 */
export function getBaseSkills(teamName: string, position: string): string[] {
  // Normaliser le nom de l'équipe (enlever les underscores, mettre en minuscules)
  const normalizedTeamName = normalizeKey(teamName);
  
  // Chercher l'équipe dans BASE_SKILLS_DATA
  let teamData = BASE_SKILLS_DATA[normalizedTeamName];
  
  // Si pas trouvé, chercher dans toutes les clés en normalisant
  if (!teamData) {
    for (const [key, data] of Object.entries(BASE_SKILLS_DATA)) {
      if (normalizeKey(key) === normalizedTeamName) {
        teamData = data;
        break;
      }
    }
  }
  
  if (!teamData) {
    return [];
  }
  
  // Normaliser le nom de position
  const normalizedPosition = normalizeKey(position);
  
  // Recherche exacte d'abord
  if (teamData[position]) {
    return teamData[position];
  }
  
  // Recherche en normalisant les clés
  for (const [pos, skills] of Object.entries(teamData)) {
    const normalizedPos = normalizeKey(pos);
    if (normalizedPos === normalizedPosition || 
        normalizedPos.includes(normalizedPosition) || 
        normalizedPosition.includes(normalizedPos)) {
      return skills;
    }
  }
  
  return [];
}

/**
 * Vérifie si une compétence est une compétence de base pour un joueur
 */
export function isBaseSkill(teamName: string, position: string, skill: string): boolean {
  const baseSkills = getBaseSkills(teamName, position);
  return baseSkills.includes(skill);
}

/**
 * Sépare les compétences en compétences de base et compétences acquises
 */
export function separateSkills(teamName: string, position: string, allSkills: string[]): {
  baseSkills: string[];
  acquiredSkills: string[];
} {
  const baseSkills = getBaseSkills(teamName, position);
  const acquiredSkills: string[] = [];
  
  for (const skill of allSkills) {
    if (baseSkills.includes(skill)) {
      // C'est une compétence de base
    } else {
      acquiredSkills.push(skill);
    }
  }
  
  return {
    baseSkills: baseSkills.filter(skill => allSkills.includes(skill)),
    acquiredSkills
  };
}
