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
 * Format : "Le {Descripteur} de {Ville}, #{Jersey}"
 * Exemples :
 * - { cityTag: 'Kansas City', bbPosition: 'Thrower', jerseyNumber: 15 }
 *   -> "Le Sidearm Wizard de Kansas City, #15"
 * - { cityTag: 'Buffalo', bbPosition: 'Thrower', jerseyNumber: 17, archetype: 'power' }
 *   -> "Le Cannon Thrower de Buffalo, #17"
 *
 * @throws si cityTag vide ou jerseyNumber invalide
 */
export function generatePseudonym(opts: PseudonymOptions): string {
  validateInputs(opts);
  const descriptor = pickDescriptor(opts.bbPosition, opts.archetype);
  return `Le ${descriptor} de ${opts.cityTag.trim()}, #${opts.jerseyNumber}`;
}

/**
 * Variante courte sans "Le ... de ..." pour les UIs serrees (mobile,
 * leaderboards). Ex: "Sidearm Wizard #15 Kansas City"
 */
export function generateShortPseudonym(opts: PseudonymOptions): string {
  validateInputs(opts);
  const descriptor = pickDescriptor(opts.bbPosition, opts.archetype);
  return `${descriptor} #${opts.jerseyNumber} ${opts.cityTag.trim()}`;
}

/**
 * Retourne juste le descripteur (sans ville/numero). Utile pour les
 * tags / badges UI.
 */
export function getDescriptor(bbPosition: BbPosition, archetype?: PlayerArchetype): string {
  return pickDescriptor(bbPosition, archetype);
}
