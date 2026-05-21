/**
 * Pseudonymisation des joueurs NFL pour le module NFL Fantasy.
 *
 * Source : docs/nfl-fantasy/01-legal.md § "Conventions de pseudonymisation"
 * + decision Q8 dans 00-vision.md (pseudo full + flag DB).
 *
 * Strategie niveau 2 : pseudonymisation totale en V1.
 * - Pas de noms reels joueurs (privacy / EU droit a l'image)
 * - Pas de noms d'equipes NFL (trademarks)
 * - Pas de logos ni photos
 * - OK : villes (geonymes publics), stats reelles (faits factuels)
 *
 * Format public : "{Adjectif descriptif} {Poste BB} de {Ville}, #{Jersey}"
 * Exemple : "Le Sidearm Wizard de Kansas City, #15" (identifiable comme Mahomes)
 *
 * Fonction PURE et DETERMINISTE : meme input -> meme output, jamais de
 * randomness. Crucial pour la stabilite de l'UI et les replays.
 */

import type { BbPosition } from './position-to-bb.js';

/**
 * Archetype optionnel pour enrichir le pseudonyme (Speed/Power/etc.).
 * V1 : optionnel, derive en V2 via combine data (cf. 05-position-mapping.md
 * Q5 race fixe, archetype repousse V2).
 */
export type PlayerArchetype = 'speed' | 'power' | 'agility' | 'receiving' | 'gunslinger' | 'rookie';

export interface PseudonymOptions {
  /** Ville pseudonymisee (cf. data/teams.json). Ex: "Kansas City". */
  readonly cityTag: string;
  /** Poste BB derive de NflPosition x race (cf. position-to-bb.ts). */
  readonly bbPosition: BbPosition;
  /** Numero de maillot reel (legalement OK : jersey numbers ne sont pas IP). */
  readonly jerseyNumber: number;
  /** Archetype optionnel (V2). */
  readonly archetype?: PlayerArchetype;
  /**
   * Identifiant stable du joueur (gsis_id). Si fourni, derive un
   * surnom BB-flavored deterministe a partir du hash → garantit
   * l'unicite meme quand jersey=0 ou que plusieurs joueurs partagent
   * le meme (city, position, jersey) au fil des saisons.
   */
  readonly playerId?: string;
}

/**
 * Descripteur BB-flavored par BbPosition. Choix unique par poste pour
 * garantir le determinisme. Les variantes par archetype sont gerees
 * via `DESCRIPTOR_BY_ARCHETYPE` ci-dessous.
 */
const DESCRIPTOR_BY_POSITION: Readonly<Record<BbPosition, string>> = {
  // Generic
  Lineman: 'Trench Warrior',
  Thrower: 'Sidearm Wizard',
  Catcher: 'Glove Hero',
  Blitzer: 'Edge Hunter',
  Runner: 'Yard Sprinter',
  // Skaven
  GutterRunner: 'Sprint Daemon',
  StormVermin: 'Storm Striker',
  RatOgre: 'Trench Goliath',
  // WoodElf
  Wardancer: 'Phantom Striker',
  Treeman: 'Old Oak',
  // Orc
  BlackOrc: 'Mountain Wall',
  Goblin: 'Tiny Specialist',
  Troll: 'Lumbering Beast',
  // Human
  Ogre: 'Heavy Bruiser',
  // Norse
  Berserker: 'Frenzied Hammer',
  Ulfwerener: 'Wolf Runner',
  Yhetee: 'Frost Beast',
  // Dwarf
  Blocker: 'Stout Bulwark',
  Trollslayer: 'Frenzy Beard',
  Deathroller: 'Iron Roller',
  // Khorne
  Bloodseeker: 'Blood Stalker',
  Khorngor: 'Horn Charger',
  Bloodspawn: 'Berserker Spawn',
  Bloodthirster: 'Greater Daemon',
  // Necromantic
  Zombie: 'Eternal Grinder',
  Ghoul: 'Sly Devourer',
  Wight: 'Cursed Veteran',
  FleshGolem: 'Stitched Colossus',
  Werewolf: 'Lunar Predator',
};

/**
 * Override descripteur quand un archetype est fourni. Le premier match
 * gagne (poste specifique > poste generique). Fallback sur le descripteur
 * standard du poste si l'archetype n'a pas d'override.
 */
const DESCRIPTOR_BY_ARCHETYPE: Readonly<Partial<Record<`${BbPosition}-${PlayerArchetype}`, string>>> = {
  // Thrower variants
  'Thrower-gunslinger': 'Gunslinger Wizard',
  'Thrower-power': 'Cannon Thrower',
  'Thrower-rookie': 'Rookie Thrower',
  // Catcher variants
  'Catcher-speed': 'Vertical Burner',
  'Catcher-power': 'Mountain Hands',
  'Catcher-rookie': 'Rookie Catcher',
  // Runner / Blitzer offensifs
  'Runner-speed': 'Lightning Foot',
  'Runner-power': 'Pile Driver',
  'GutterRunner-rookie': 'Rookie Sprinter',
  'Blitzer-power': 'Cement Blitzer',
  'Blitzer-speed': 'Whirlwind Blitzer',
  // Defensifs marquants
  'StormVermin-power': 'Iron Storm',
  'BlackOrc-power': 'Wall of Bone',
  'Werewolf-speed': 'Moonlight Sprinter',
};

/**
 * Pools de syllabes BB-flavored pour generer des surnoms uniques.
 * Combinaison prefixe x suffixe = 24 x 24 = 576 noms possibles. Avec
 * le poste + la ville + jersey, virtuellement unique par joueur.
 */
const NAME_PREFIX: readonly string[] = [
  'Krak', 'Vor', 'Throg', 'Skarn', 'Brel', 'Mor', 'Drak', 'Veth',
  'Kael', 'Yrn', 'Goth', 'Faer', 'Skel', 'Bjor', 'Threx', 'Quel',
  'Zar', 'Lor', 'Hask', 'Aer', 'Grim', 'Vex', 'Olg', 'Snik',
];

const NAME_SUFFIX: readonly string[] = [
  "'Skar", "'Drim", "'Fang", "'Tail", "'Krov", "'Thar", "'Mok", "'Wyn",
  "'Vir", "'Ren", "'Loth", "'Nar", "'Grim", "'Ven", "'Drog", "'Kar",
  "'Lith", "'Morn", "'Tag", "'Khan", "'Bron", "'Ryn", "'Skull", "'Hex",
];

/**
 * Hash FNV-1a 32 bits sur une string. Deterministe, ~uniform. Reuse
 * du pattern game-engine/draft (FNV + mulberry32).
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Derive un surnom BB-flavored a partir d'un playerId. Deterministe.
 * Ex: "00-0033873" -> "Krak'Skar".
 */
export function deriveSurname(playerId: string): string {
  const h = fnv1aHash(playerId);
  const prefix = NAME_PREFIX[h % NAME_PREFIX.length]!;
  const suffix = NAME_SUFFIX[Math.floor(h / NAME_PREFIX.length) % NAME_SUFFIX.length]!;
  return `${prefix}${suffix}`;
}

function pickDescriptor(bbPosition: BbPosition, archetype?: PlayerArchetype): string {
  if (archetype) {
    const key = `${bbPosition}-${archetype}` as const;
    const override = DESCRIPTOR_BY_ARCHETYPE[key];
    if (override) return override;
  }
  return DESCRIPTOR_BY_POSITION[bbPosition];
}

function validateInputs(opts: PseudonymOptions): void {
  if (!opts.cityTag || opts.cityTag.trim().length === 0) {
    throw new Error('[pseudonymize] cityTag requis (non vide)');
  }
  if (!Number.isInteger(opts.jerseyNumber) || opts.jerseyNumber < 0 || opts.jerseyNumber > 99) {
    throw new Error(`[pseudonymize] jerseyNumber doit etre entier 0-99 (recu: ${opts.jerseyNumber})`);
  }
}

/**
 * Genere le pseudonyme public d'un joueur.
 *
 * Format (avec playerId) : "{Surname} le {Descripteur} de {Ville}, #{Jersey}"
 * Format (sans playerId, legacy) : "Le {Descripteur} de {Ville}, #{Jersey}"
 *
 * Exemples :
 * - { playerId: '00-0033873', cityTag: 'Kansas City', bbPosition: 'Thrower', jerseyNumber: 15 }
 *   -> "Krak'Skar le Sidearm Wizard de Kansas City, #15"
 * - { cityTag: 'Buffalo', bbPosition: 'Thrower', jerseyNumber: 17, archetype: 'power' }
 *   -> "Le Cannon Thrower de Buffalo, #17"
 *
 * Le surname garantit l'unicite (576 combinaisons) meme quand
 * jerseyNumber=0 ou que plusieurs joueurs partagent (city, position,
 * jersey) au fil des saisons.
 *
 * @throws si cityTag vide ou jerseyNumber invalide
 */
export function generatePseudonym(opts: PseudonymOptions): string {
  validateInputs(opts);
  const descriptor = pickDescriptor(opts.bbPosition, opts.archetype);
  const city = opts.cityTag.trim();
  if (opts.playerId) {
    const surname = deriveSurname(opts.playerId);
    return `${surname} le ${descriptor} de ${city}, #${opts.jerseyNumber}`;
  }
  return `Le ${descriptor} de ${city}, #${opts.jerseyNumber}`;
}

/**
 * Variante courte sans ville pour les UIs serrees (mobile, leaderboards).
 * Ex: "Krak'Skar #15 KC" ou "Sidearm Wizard #15 Kansas City" si pas
 * de playerId.
 */
export function generateShortPseudonym(opts: PseudonymOptions): string {
  validateInputs(opts);
  const descriptor = pickDescriptor(opts.bbPosition, opts.archetype);
  if (opts.playerId) {
    const surname = deriveSurname(opts.playerId);
    return `${surname} #${opts.jerseyNumber} (${descriptor})`;
  }
  return `${descriptor} #${opts.jerseyNumber} ${opts.cityTag.trim()}`;
}

/**
 * Retourne juste le descripteur (sans ville/numero). Utile pour les
 * tags / badges UI.
 */
export function getDescriptor(bbPosition: BbPosition, archetype?: PlayerArchetype): string {
  return pickDescriptor(bbPosition, archetype);
}
