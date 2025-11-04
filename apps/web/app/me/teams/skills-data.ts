/**
 * Interface avec le système de compétences du game-engine
 * Ce fichier sert de pont entre les slugs et l'affichage dans l'interface web
 */

import { 
  getSkillBySlug, 
  getSkillByNameFr, 
  getSkillByNameEn, 
  parseSkillSlugs,
  getDisplayNames,
  convertNamesToSlugs,
  type SkillDefinition 
} from "@bb/game-engine";

export interface SkillDescription {
  name: string;
  description: string;
  category: string;
}

/**
 * Obtient la description d'une compétence par son slug
 */
export function getSkillDescription(slugOrName: string, language: "fr" | "en" = "fr"): SkillDescription | null {
  // Essayer d'abord comme slug
  let skill = getSkillBySlug(slugOrName);
  
  // Si pas trouvé, essayer comme nom français (pour compatibilité)
  if (!skill) {
    skill = getSkillByNameFr(slugOrName);
  }
  
  // Si toujours pas trouvé, essayer comme nom anglais
  if (!skill) {
    skill = getSkillByNameEn(slugOrName);
  }
  
  if (!skill) {
    return null;
  }
  
  return {
    name: language === "fr" ? skill.nameFr : skill.nameEn,
    description: skill.description,
    category: skill.category
  };
}

/**
 * Mapping des slugs français vers les slugs anglais officiels
 */
const FRENCH_TO_ENGLISH_SLUGS: Record<string, string> = {
  // Traductions courantes
  "jouer-déloyal": "dirty-player-1",
  "joueur-déloyal-+1": "dirty-player-1",
  "joueur-déloyal-+2": "dirty-player-2",
  "dirty-player-2": "dirty-player-2",
  "présence-perturbante": "disturbing-presence",
  "répulsion": "foul-appearance",
  "sans-les-mains": "no-hands",
  "sournois": "sneaky-git",
  "poignard": "stab",
  "contagieux": "nurgles-rot",
  "grande-gueule": "monstrous-mouth",
  "morsure-rapide": "bloodlust",
  "prise-sûre": "sure-hands",
  "sur-le-ballon": "on-the-ball",
  "châtaigne-+1": "mighty-blow-1",
  "châtaigne-+2": "mighty-blow-2",
  "châtaigne+1": "mighty-blow-1",
  "solitaire-4+": "loner-4",
  "queue-phréhensile": "prehensile-tail",
  "queue": "prehensile-tail",
  "équilibre": "sure-feet",
  "parade": "fend",
  "poursuite": "shadowing",
  "garde": "guard",
  "prise": "sure-hands",
  "châtaigne": "mighty-blow-1",
  "contagion": "nurgles-rot",
  // Compétences en français (noms complets)
  "frénésie": "frenzy",
  "cornes": "horns",
  "fureur-débridée": "wild-animal",
  "sauvagerie-animale": "animal-savagery",
  "crâne-épais": "thick-skull",
  "esquive": "dodge",
  "précision": "accurate",
  "poids-plume": "right-stuff",
  "griffes": "claws",
  "intrépide": "dauntless",
  "rétablissement": "regeneration",
  "arme-secrète": "secret-weapon",
  "arme secrète": "secret-weapon",
  "arme-secrète*": "secret-weapon",
  "arme secrète*": "secret-weapon",
  "esquive-en-force": "break-tackle",
  "bras-musclé": "strong-arm",
  "lancer-de-coéquipier": "throw-team-mate",
  "lancer d'équipier": "throw-team-mate",
  "saut": "leap",
  "délestage": "dump-off",
  "chaîne-&-boulet": "ball-and-chain",
  "chaînes-et-boulet": "ball-and-chain",
  "chaînes et boulet": "ball-and-chain",
  "ball-chain": "ball-and-chain",
  "bagarreur": "brawler",
  "tacle": "tackle",
  "lutte": "wrestle",
  "réception": "catch",
  "réception-plongeante": "diving-catch",
  "réception plongeante": "diving-catch",
  "bounding-leap": "bounding-leap",
  // Compétences supplémentaires en français
  "bras-supplémentaires": "extra-arms",
  "bras supplémentaires": "extra-arms",
  "deux têtes": "two-heads",
  "deux-têtes": "two-heads",
  "queue préhensile": "prehensile-tail",
  "queue-préhensile": "prehensile-tail",
  "tronçonneuse": "chainsaw",
  "pro": "pro",
  "grande gueule": "monstrous-mouth",
  "prise-du-jour": "catch", // Probablement une erreur dans les données, mapping vers catch
  "prise du jour": "catch",
  // Gestion dirty-player-2 (n'existe pas, fallback vers dirty-player-1)
  "dirty-player-2": "dirty-player-1",
  // Compétences qui pourraient être manquantes dans certaines versions
  "bloodlust": "bloodlust", // Si n'existe pas, sera gardé tel quel
  "nurgles-rot": "nurgles-rot", // Si n'existe pas, sera gardé tel quel
  // Compétences en espagnol (pour compatibilité)
  "golpe-mortifero": "mighty-blow-1",
  "golpe-mortifero-+1": "mighty-blow-1",
  // Variantes et formats spéciaux
  "sans les mains": "no-hands",
  "sans-les-mains*": "no-hands",
  "solitaire (4+)": "loner-4",
  "solitaire (4+)*": "loner-4",
  "coup puissant (+1)": "mighty-blow-1",
  "coup puissant": "mighty-blow-1",
  "chataigne-+1": "mighty-blow-1",
  "chataigne-+2": "mighty-blow-2",
  "chaîne-et-boulet": "ball-and-chain",
  "chaîne & boulet": "ball-and-chain",
  // Variantes supplémentaires
  "bombardier": "secret-weapon",
  "libration-contrôlée": "break-tackle",
  "regard-hypnotique": "hypnotic-gaze",
  "regarde-dans-mes-yeux": "hypnotic-gaze",
  "microbe": "stunty",
  "microbe.": "stunty",
  "sans": "no-hands",
  "mains": "no-hands",
  "solitaire": "loner-4",
  "crâne-épais.": "thick-skull",
  // Variantes loner (toutes existent maintenant)
  "loner-3": "loner-3",
  "loner-4": "loner-4",
  "loner-5": "loner-5",
  "solitaire (3+)": "loner-3",
  "solitaire (4+)": "loner-4",
  "solitaire (5+)": "loner-5",
  // Corrections de variantes de compétences
  "claw": "claws",
  "side-step": "sidestep",
  // Variantes mighty-blow (toutes existent maintenant)
  "mighty-blow-2": "mighty-blow-2",
  "châtaigne-+2": "mighty-blow-2",
  // Compétences spéciales qui n'ont pas encore de slug dans le système
  "hurl-teammate": "throw-team-mate",
  "animosity-all": "animosity", // Variante d'animosity
  // Variantes bloodlust (toutes existent maintenant)
  "bloodlust-2": "bloodlust-2",
  "bloodlust-3": "bloodlust-3",
  "soif-de-sang-2+": "bloodlust-2",
  "soif-de-sang-3+": "bloodlust-3",
  "plague-ridden": "plague-ridden", // Trait spécial Nurgle
  "stakes": "stakes", // Trait spécial anti-undead
  "timmm-ber": "timmm-ber", // Trait spécial Treeman
  "glissade-controlée": "sidestep",
  "glissade-contrôlée": "sidestep",
  "blocage-multiple": "multiple-block",
  "blocage multiple": "multiple-block",
  "régénération": "regeneration",
  "stabilité": "stand-firm",
  "réception-plongeante": "diving-catch",
  "nerfs-d'acier": "nerves-of-steel",
  "projection": "grab",
  "poivrot": "drunkard",
  "échasses-à-ressort": "pogo-stick",
  "défenseur": "defensive",
  "boulet-de-canon": "juggernaut",
  "boulet de canon": "juggernaut",
  "soif-de-sang-2+": "bloodlust",
  "soif-de-sang": "bloodlust",
  // Nouvelles compétences ajoutées
  "animosity-underworld": "animosity-underworld",
  "animosity-all-dwarf-halfling": "animosity-all-dwarf-halfling",
  "animosity-all-dwarf-human": "animosity-all-dwarf-human",
  "animosité-underworld": "animosity-underworld",
  "animosité-all-dwarf-halfling": "animosity-all-dwarf-halfling",
  "animosité-all-dwarf-human": "animosity-all-dwarf-human",
  "projectile-vomit": "projectile-vomit",
  "vomissement-projectile": "projectile-vomit",
  "vomissement projectile": "projectile-vomit",
  "really-stupid-2": "really-stupid-2",
  "gros-débile-+2": "really-stupid-2",
  "gros-débile-+2*": "really-stupid-2",
  "kick-team-mate": "kick-team-mate",
  "kick team-mate": "kick-team-mate",
  "kick team mate": "kick-team-mate",
  // Alias et variantes
  "armored-skull": "thick-skull", // Alias probable pour Thick Skull
  "armoured-skull": "thick-skull",
  "crâne-blindé": "thick-skull",
};

/**
 * Parse une chaîne de compétences et retourne les slugs
 * Supporte à la fois les slugs et les noms (pour migration)
 */
export function parseSkills(skillsString: string): string[] {
  if (!skillsString || skillsString.trim() === "") {
    return [];
  }
  
  // Nettoyer les caractères HTML et les balises
  const cleaned = skillsString
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<\/?strong>/g, "")
    .replace(/<br\s*\/?>/gi, ",")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  const parts = cleaned.split(",").map(s => s.trim()).filter(s => s.length > 0);
  const slugs: string[] = [];
  
  for (const part of parts) {
    // Nettoyer la partie : enlever les caractères spéciaux en fin de chaîne, espaces, etc.
    let cleanedPart = part.trim();
    
    // Enlever les caractères spéciaux à la fin comme les astérisques, points, etc.
    // Mais garder les modificateurs entre parenthèses comme (4+), (+1), etc.
    cleanedPart = cleanedPart.replace(/[.*]+$/, '').trim();
    // Normaliser les espaces dans les modificateurs
    cleanedPart = cleanedPart.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');
    
    // Vérifier d'abord le mapping français vers anglais (correspondance exacte)
    let cleanPart = cleanedPart;
    if (FRENCH_TO_ENGLISH_SLUGS[cleanedPart]) {
      cleanPart = FRENCH_TO_ENGLISH_SLUGS[cleanedPart];
    } else {
      // Essayer de trouver une correspondance en normalisant (minuscules, accents)
      const normalized = cleanedPart.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const foundKey = Object.keys(FRENCH_TO_ENGLISH_SLUGS).find(key => {
        const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalized === normalizedKey || cleanedPart.toLowerCase() === key.toLowerCase();
      });
      if (foundKey) {
        cleanPart = FRENCH_TO_ENGLISH_SLUGS[foundKey];
      }
    }
    
    // Si c'est déjà un slug valide, l'utiliser directement
    if (getSkillBySlug(cleanPart)) {
      slugs.push(cleanPart);
    } else {
      // Essayer de le convertir depuis un nom français ou anglais
      const skill = getSkillByNameFr(cleanPart) || getSkillByNameEn(cleanPart) || 
                    getSkillByNameFr(cleanedPart) || getSkillByNameEn(cleanedPart);
      if (skill) {
        slugs.push(skill.slug);
      } else {
        // Si on ne trouve pas la compétence, garder le texte original nettoyé
        // (pour debug ou compétences non encore ajoutées)
        slugs.push(cleanPart);
      }
    }
  }
  
  return slugs;
}

/**
 * Obtient les noms d'affichage (français) à partir d'une chaîne de compétences
 */
export function getSkillDisplayNames(skillsString: string): string[] {
  const slugs = parseSkills(skillsString);
  return slugs.map(slug => {
    const skill = getSkillBySlug(slug);
    return skill ? skill.nameFr : slug;
  });
}

/**
 * Convertit une liste de slugs en noms français pour l'affichage
 */
export function slugsToDisplayNames(slugs: string[]): string[] {
  return slugs.map(slug => {
    const skill = getSkillBySlug(slug);
    return skill ? skill.nameFr : slug;
  });
}

/**
 * Convertit une chaîne de noms (français ou anglais) en chaîne de slugs
 * Utile pour la migration des données existantes
 */
export function migrateNamesToSlugs(skillsString: string): string {
  return convertNamesToSlugs(skillsString);
}
