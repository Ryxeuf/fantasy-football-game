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
    "thrower": ["Pass", "Sure Hands"],
    "gutter": ["Dodge"],
    "blitzer": ["Block"],
    "ratogre": ["Animal Savagery", "Frenzy", "Loner (4+)", "Mighty Blow (+1)", "Prehensile Tail"]
  },
  lizardmen: {
    "Skink Linemen": [],
    "saurus": [],
    "skink": ["Dodge", "Stunty"],
    "kroxigor": ["Bone Head", "Loner (4+)", "Mighty Blow (+1)", "Prehensile Tail", "Thick Skull", "Throw Team-mate"]
  },
  human: {
    "Human Linemen": [],
    "Thrower": ["Pass", "Sure Hands"],
    "Catcher": ["Catch", "Dodge"],
    "Blitzer": ["Block"],
    "Halfling Hopeful": ["Dodge", "Stunty", "Right Stuff"],
    "Ogre": ["Bone Head", "Loner (4+)", "Mighty Blow (+1)", "Thick Skull", "Throw Team-mate"]
  },
  orc: {
    "Orc Linemen": [],
    "Thrower": ["Pass", "Sure Hands"],
    "Blitzer": ["Block"],
    "Black Orc Blocker": [],
    "Goblin Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Troll": ["Always Hungry", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Throw Team-mate"]
  },
  dwarf: {
    "Dwarf Linemen": [],
    "Runner": ["Sure Hands"],
    "Blitzer": ["Block", "Thick Skull"],
    "Longbeard": ["Block", "Thick Skull"],
    "Deathroller": ["Break Tackle", "Loner (4+)", "Mighty Blow (+1)", "No Hands", "Secret Weapon", "Stand Firm", "Thick Skull"]
  },
  elf: {
    "Elf Linemen": [],
    "Thrower": ["Pass"],
    "Catcher": ["Catch", "Nerves of Steel"],
    "Blitzer": ["Block"]
  },
  "dark elf": {
    "Dark Elf Linemen": [],
    "Thrower": ["Pass"],
    "Runner": ["Sure Hands"],
    "Blitzer": ["Block"],
    "Assassin": ["Shadowing", "Stab"]
  },
  "wood elf": {
    "Wood Elf Linemen": [],
    "Thrower": ["Pass"],
    "Catcher": ["Catch", "Dodge"],
    "Wardancer": ["Block", "Dodge", "Leap"]
  },
  "high elf": {
    "High Elf Linemen": [],
    "Thrower": ["Pass", "Safe Throw"],
    "Catcher": ["Catch", "Dodge"],
    "Blitzer": ["Block"]
  },
  "chaos": {
    "Chaos Linemen": [],
    "Beastman": [],
    "Chaos Warrior": [],
    "Minotaur": ["Frenzy", "Horns", "Loner (4+)", "Mighty Blow (+1)", "Thick Skull", "Wild Animal"]
  },
  "chaos dwarf": {
    "Chaos Dwarf Linemen": [],
    "Bull Centaur": ["Sprint"],
    "Hobgoblin Linemen": [],
    "Minotaur": ["Frenzy", "Horns", "Loner (4+)", "Mighty Blow (+1)", "Thick Skull", "Wild Animal"]
  },
  "undead": {
    "Skeleton Linemen": ["Regeneration", "Thick Skull"],
    "Zombie Linemen": ["Regeneration"],
    "Ghoul Runner": ["Dodge"],
    "Wight Blitzer": ["Block", "Regeneration"],
    "Mummy": ["Mighty Blow (+1)", "Regeneration", "Stand Firm", "Thick Skull"]
  },
  "necromantic": {
    "Zombie Linemen": ["Regeneration"],
    "Ghoul Runner": ["Dodge"],
    "Wraith": ["Block", "Disturbing Presence", "No Hands", "Regeneration", "Sidestep"],
    "Werewolf": ["Claws", "Frenzy", "Regeneration"],
    "Flesh Golem": ["Regeneration", "Stand Firm", "Thick Skull"]
  },
  "norse": {
    "Norse Linemen": ["Block"],
    "Thrower": ["Pass", "Sure Hands"],
    "Catcher": ["Catch", "Dodge"],
    "Berserker": ["Block", "Frenzy"],
    "Yhetee": ["Disturbing Presence", "Loner (4+)", "Mighty Blow (+1)", "Thick Skull", "Wild Animal"]
  },
  "amazon": {
    "Amazon Linemen": [],
    "Thrower": ["Pass", "Sure Hands"],
    "Catcher": ["Catch", "Dodge"],
    "Blitzer": ["Block"]
  },
  "halfling": {
    "Halfling Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Treeman": ["Loner (4+)", "Mighty Blow (+1)", "Stand Firm", "Take Root", "Thick Skull", "Throw Team-mate"]
  },
  "goblin": {
    "Goblin Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Looney": ["Chainsaw", "Loner (4+)", "Mighty Blow (+1)", "No Hands", "Secret Weapon"],
    "Fanatic": ["Ball & Chain", "Loner (4+)", "Mighty Blow (+1)", "No Hands", "Secret Weapon"],
    "Pogoer": ["Dodge", "Jump Up", "Stunty", "Very Long Legs"],
    "Troll": ["Always Hungry", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Throw Team-mate"]
  },
  "ogre": {
    "Ogre Linemen": ["Bone Head", "Mighty Blow (+1)", "Thick Skull"],
    "Gnoblar Linemen": ["Dodge", "Right Stuff", "Stunty", "Titchy"],
    "Runt Punter": ["Dodge", "Right Stuff", "Stunty", "Titchy"]
  },
  "vampire": {
    "Thrall Linemen": [],
    "Vampire": ["Hypnotic Gaze", "Regeneration"]
  },
  "khemri": {
    "Skeleton Linemen": ["Regeneration", "Thick Skull"],
    "Thrower": ["Pass", "Regeneration", "Sure Hands", "Thick Skull"],
    "Blitzer": ["Block", "Regeneration", "Thick Skull"],
    "Tomb Guardian": ["Decay", "Regeneration"]
  },
  "nurgle": {
    "Rotter Linemen": ["Decay"],
    "Pestigor": ["Horns"],
    "Rotters": ["Decay"],
    "Beast of Nurgle": ["Disturbing Presence", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Tentacles"]
  },
  "khorne": {
    "Bloodborn Marauder Linemen": ["Frenzy"],
    "Khorngor": ["Horns", "Juggernaut"],
    "Bloodseeker": ["Frenzy"],
    "Bloodspawn": ["Claws", "Frenzy", "Loner (4+)", "Mighty Blow (+1)", "Wild Animal"]
  },
  "underworld": {
    "Goblin Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Skaven Linemen": [],
    "Thrower": ["Pass", "Sure Hands"],
    "Blitzer": ["Block"],
    "Troll": ["Always Hungry", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Throw Team-mate"]
  },
  "snotling": {
    "Snotling Linemen": ["Dodge", "Right Stuff", "Stunty", "Titchy"],
    "Pump Wagon": ["Loner (4+)", "Mighty Blow (+1)", "No Hands", "Secret Weapon"],
    "Troll": ["Always Hungry", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Throw Team-mate"]
  },
  "black orc": {
    "Goblin Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Black Orc": [],
    "Troll": ["Always Hungry", "Loner (4+)", "Mighty Blow (+1)", "Really Stupid", "Regeneration", "Throw Team-mate"]
  },
  "imperial nobility": {
    "Imperial Retainer Linemen": [],
    "Thrower": ["Pass", "Safe Throw"],
    "Noble Blitzer": ["Block"],
    "Bodyguard": ["Guard"]
  },
  "old world alliance": {
    "Human Linemen": [],
    "Dwarf Linemen": [],
    "Halfling Linemen": ["Dodge", "Stunty", "Right Stuff"],
    "Thrower": ["Pass", "Sure Hands"],
    "Catcher": ["Catch", "Dodge"],
    "Blitzer": ["Block"],
    "Ogre": ["Bone Head", "Loner (4+)", "Mighty Blow (+1)", "Thick Skull", "Throw Team-mate"]
  }
};

/**
 * Obtient les compétences de base pour un joueur selon son équipe et sa position
 */
export function getBaseSkills(teamName: string, position: string): string[] {
  const teamData = BASE_SKILLS_DATA[teamName.toLowerCase()];
  if (!teamData) {
    return [];
  }
  
  // Recherche exacte d'abord
  if (teamData[position]) {
    return teamData[position];
  }
  
  // Recherche partielle si pas de correspondance exacte
  for (const [pos, skills] of Object.entries(teamData)) {
    if (pos.toLowerCase().includes(position.toLowerCase()) || 
        position.toLowerCase().includes(pos.toLowerCase())) {
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
