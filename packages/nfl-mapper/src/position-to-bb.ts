import type { BbRace } from './types.js';

/**
 * Postes NFL standards (granularite V1).
 *
 * Source : aligne avec le champ `position` du CSV nflverse
 * `stats_player_week_{year}.csv` (cf. docs/nfl-fantasy/03-api-strategy.md).
 *
 * V1 : on garde les postes "officiels" NFL sans sub-archetype (speed/
 * power/agility derives en V2 via combine data).
 */
export type NflPosition =
  | 'QB'
  | 'RB'
  | 'FB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'C'
  | 'G'
  | 'OT'
  | 'K'
  | 'P'
  | 'DT'
  | 'NT'
  | 'DE'
  | 'EDGE'
  | 'LB'
  | 'ILB'
  | 'OLB'
  | 'MLB'
  | 'CB'
  | 'DB'
  | 'S'
  | 'SAF'
  | 'FS'
  | 'SS'
  | 'NB';

export const NFL_POSITIONS: readonly NflPosition[] = [
  'QB', 'RB', 'FB', 'WR', 'TE',
  'OL', 'C', 'G', 'OT',
  'K', 'P',
  'DT', 'NT', 'DE', 'EDGE',
  'LB', 'ILB', 'OLB', 'MLB',
  'CB', 'DB', 'S', 'SAF', 'FS', 'SS', 'NB',
];

/**
 * Postes BB couverts par le mapping (union de toutes les races).
 * Reference : docs/nfl-fantasy/05-position-mapping.md
 */
export type BbPosition =
  // Generic (multi-race)
  | 'Lineman'
  | 'Thrower'
  | 'Catcher'
  | 'Blitzer'
  | 'Runner'
  // Skaven
  | 'GutterRunner'
  | 'StormVermin'
  | 'RatOgre'
  // WoodElf
  | 'Wardancer'
  | 'Treeman'
  // Orc
  | 'BlackOrc'
  | 'Goblin'
  | 'Troll'
  // Human
  | 'Ogre'
  // Norse
  | 'Berserker'
  | 'Ulfwerener'
  | 'Yhetee'
  // Dwarf
  | 'Blocker'
  | 'Trollslayer'
  | 'Deathroller'
  // Khorne
  | 'Bloodseeker'
  | 'Khorngor'
  | 'Bloodspawn'
  | 'Bloodthirster'
  // Necromantic
  | 'Zombie'
  | 'Ghoul'
  | 'Wight'
  | 'FleshGolem'
  | 'Werewolf';

/**
 * Classification haut-niveau du role en BB :
 * - "linemen" : poste de base, faible cout, role d'aile
 * - "specialist" : poste premium (Thrower, Catcher, Blitzer eq.)
 * - "bigGuy" : Big Guy (un seul par roster, ST5+, Loner)
 *
 * Utile pour les regles d'inducement et le cap roster.
 */
export type BbPositionRole = 'lineman' | 'specialist' | 'bigGuy';

/**
 * Archetype fin pour les caps de composition de lineup (option A : plafonner
 * les postes premium plutot que forcer un plancher de linemen).
 *
 * Contrairement a `BbPositionRole` (3 buckets grossiers), l'archetype
 * distingue les sous-roles offensifs/defensifs pour permettre des plafonds
 * fins ("max 1 passer", "max 4 receveurs"). Il est derive du **poste NFL**
 * (couche universelle : chaque equipe a un QB/RB/WR quelle que soit la race)
 * et NON du poste BB — ce qui evite le probleme des noms divergents
 * (Blitzer / Berserker / Wardancer sont tous des specialistes selon la race
 * mais proviennent de postes NFL identiques).
 *
 * - `passer`     : QB
 * - `rusher`     : RB, FB
 * - `receiver`   : WR, TE
 * - `lineman`    : OL/C/G/OT + K/P (filler bas-cout)
 * - `frontSeven` : DE/EDGE/LB/ILB/OLB/MLB (defense front)
 * - `secondary`  : CB/DB/S/SAF/FS/SS/NB (defense arriere)
 * - `bigGuy`     : DT/NT (mappes Big Guy dans toutes les races)
 */
export type CompositionArchetype =
  | 'passer'
  | 'rusher'
  | 'receiver'
  | 'lineman'
  | 'frontSeven'
  | 'secondary'
  | 'bigGuy';

const NFL_POSITION_ARCHETYPE: Readonly<Record<NflPosition, CompositionArchetype>> = {
  QB: 'passer',
  RB: 'rusher',
  FB: 'rusher',
  WR: 'receiver',
  TE: 'receiver',
  OL: 'lineman',
  C: 'lineman',
  G: 'lineman',
  OT: 'lineman',
  K: 'lineman',
  P: 'lineman',
  DT: 'bigGuy',
  NT: 'bigGuy',
  DE: 'frontSeven',
  EDGE: 'frontSeven',
  LB: 'frontSeven',
  ILB: 'frontSeven',
  OLB: 'frontSeven',
  MLB: 'frontSeven',
  CB: 'secondary',
  DB: 'secondary',
  S: 'secondary',
  SAF: 'secondary',
  FS: 'secondary',
  SS: 'secondary',
  NB: 'secondary',
};

const POSITION_ROLE: Readonly<Record<BbPosition, BbPositionRole>> = {
  Lineman: 'lineman', Thrower: 'specialist', Catcher: 'specialist',
  Blitzer: 'specialist', Runner: 'specialist',
  GutterRunner: 'specialist', StormVermin: 'specialist', RatOgre: 'bigGuy',
  Wardancer: 'specialist', Treeman: 'bigGuy',
  BlackOrc: 'specialist', Goblin: 'lineman', Troll: 'bigGuy',
  Ogre: 'bigGuy',
  Berserker: 'specialist', Ulfwerener: 'specialist', Yhetee: 'bigGuy',
  Blocker: 'lineman', Trollslayer: 'specialist', Deathroller: 'bigGuy',
  Bloodseeker: 'lineman', Khorngor: 'specialist', Bloodspawn: 'specialist',
  Bloodthirster: 'bigGuy',
  Zombie: 'lineman', Ghoul: 'specialist', Wight: 'specialist',
  FleshGolem: 'specialist', Werewolf: 'specialist',
};

/**
 * Table de mapping NFL position -> BB position par race.
 * Source : docs/nfl-fantasy/05-position-mapping.md § "Mapping par race".
 *
 * Default fallback (cle 'default') applique pour tout NflPosition non
 * explicitement liste.
 */
type RaceMapping = Readonly<Partial<Record<NflPosition, BbPosition>>> & {
  readonly default: BbPosition;
};

const SKAVEN_MAP: RaceMapping = {
  QB: 'Thrower',
  RB: 'GutterRunner',
  FB: 'Lineman',
  WR: 'GutterRunner',
  TE: 'StormVermin',
  OL: 'Lineman', C: 'Lineman', G: 'Lineman', OT: 'Lineman',
  K: 'Lineman', P: 'Lineman',
  DT: 'RatOgre', NT: 'RatOgre',
  DE: 'StormVermin', EDGE: 'StormVermin',
  LB: 'StormVermin', ILB: 'StormVermin', OLB: 'StormVermin', MLB: 'StormVermin',
  CB: 'GutterRunner', DB: 'GutterRunner',
  S: 'GutterRunner', SAF: 'GutterRunner', FS: 'GutterRunner', SS: 'GutterRunner', NB: 'GutterRunner',
  default: 'Lineman',
};

const WOODELF_MAP: RaceMapping = {
  QB: 'Thrower',
  RB: 'Lineman',
  FB: 'Lineman',
  WR: 'Catcher',
  TE: 'Catcher',
  OL: 'Lineman', C: 'Lineman', G: 'Lineman', OT: 'Lineman',
  K: 'Lineman', P: 'Lineman',
  DT: 'Treeman', NT: 'Treeman',
  DE: 'Wardancer', EDGE: 'Wardancer',
  LB: 'Wardancer', ILB: 'Wardancer', OLB: 'Wardancer', MLB: 'Wardancer',
  CB: 'Catcher', DB: 'Catcher',
  S: 'Catcher', SAF: 'Catcher', FS: 'Catcher', SS: 'Catcher', NB: 'Catcher',
  default: 'Lineman',
};

const ORC_MAP: RaceMapping = {
  QB: 'Thrower',
  RB: 'BlackOrc',
  FB: 'BlackOrc',
  WR: 'Blitzer',
  TE: 'BlackOrc',
  OL: 'BlackOrc', C: 'Lineman', G: 'Lineman', OT: 'BlackOrc',
  K: 'Goblin', P: 'Goblin',
  DT: 'Troll', NT: 'Troll',
  DE: 'Blitzer', EDGE: 'Blitzer',
  LB: 'Blitzer', ILB: 'Blitzer', OLB: 'Blitzer', MLB: 'Blitzer',
  CB: 'Lineman', DB: 'Lineman',
  S: 'Blitzer', SAF: 'Blitzer', FS: 'Blitzer', SS: 'Blitzer', NB: 'Lineman',
  default: 'Lineman',
};

const HUMAN_MAP: RaceMapping = {
  QB: 'Thrower',
  RB: 'Blitzer',
  FB: 'Lineman',
  WR: 'Catcher',
  TE: 'Catcher',
  OL: 'Lineman', C: 'Lineman', G: 'Lineman', OT: 'Lineman',
  K: 'Lineman', P: 'Lineman',
  DT: 'Ogre', NT: 'Ogre',
  DE: 'Blitzer', EDGE: 'Blitzer',
  LB: 'Blitzer', ILB: 'Blitzer', OLB: 'Blitzer', MLB: 'Blitzer',
  CB: 'Catcher', DB: 'Catcher',
  S: 'Blitzer', SAF: 'Blitzer', FS: 'Catcher', SS: 'Blitzer', NB: 'Catcher',
  default: 'Lineman',
};

const NORSE_MAP: RaceMapping = {
  QB: 'Thrower',
  RB: 'Ulfwerener',
  FB: 'Ulfwerener',
  WR: 'Catcher',
  TE: 'Berserker',
  OL: 'Lineman', C: 'Lineman', G: 'Lineman', OT: 'Lineman',
  K: 'Lineman', P: 'Lineman',
  DT: 'Yhetee', NT: 'Yhetee',
  DE: 'Berserker', EDGE: 'Berserker',
  LB: 'Berserker', ILB: 'Berserker', OLB: 'Berserker', MLB: 'Berserker',
  CB: 'Catcher', DB: 'Catcher',
  S: 'Berserker', SAF: 'Runner', FS: 'Runner', SS: 'Berserker', NB: 'Runner',
  default: 'Lineman',
};

const DWARF_MAP: RaceMapping = {
  QB: 'Runner',
  RB: 'Blocker',
  FB: 'Blocker',
  WR: 'Runner',
  TE: 'Blocker',
  OL: 'Blocker', C: 'Blocker', G: 'Blocker', OT: 'Blocker',
  K: 'Blocker', P: 'Blocker',
  DT: 'Deathroller', NT: 'Deathroller',
  DE: 'Blitzer', EDGE: 'Blitzer',
  LB: 'Blitzer', ILB: 'Blitzer', OLB: 'Trollslayer', MLB: 'Blitzer',
  CB: 'Runner', DB: 'Runner',
  S: 'Blitzer', SAF: 'Blitzer', FS: 'Runner', SS: 'Blitzer', NB: 'Runner',
  default: 'Blocker',
};

const KHORNE_MAP: RaceMapping = {
  QB: 'Bloodseeker',
  RB: 'Bloodspawn',
  FB: 'Bloodspawn',
  WR: 'Khorngor',
  TE: 'Bloodspawn',
  OL: 'Bloodseeker', C: 'Bloodseeker', G: 'Bloodseeker', OT: 'Bloodseeker',
  K: 'Bloodseeker', P: 'Bloodseeker',
  DT: 'Bloodthirster', NT: 'Bloodthirster',
  DE: 'Bloodspawn', EDGE: 'Bloodspawn',
  LB: 'Khorngor', ILB: 'Khorngor', OLB: 'Khorngor', MLB: 'Khorngor',
  CB: 'Khorngor', DB: 'Khorngor',
  S: 'Bloodseeker', SAF: 'Khorngor', FS: 'Khorngor', SS: 'Bloodseeker', NB: 'Khorngor',
  default: 'Bloodseeker',
};

const NECROMANTIC_MAP: RaceMapping = {
  QB: 'Ghoul',
  RB: 'Wight',
  FB: 'Wight',
  WR: 'Ghoul',
  TE: 'Wight',
  OL: 'Zombie', C: 'Zombie', G: 'Zombie', OT: 'Zombie',
  K: 'Zombie', P: 'Zombie',
  DT: 'FleshGolem', NT: 'FleshGolem',
  DE: 'Werewolf', EDGE: 'Werewolf',
  LB: 'Wight', ILB: 'Wight', OLB: 'Wight', MLB: 'Wight',
  CB: 'Ghoul', DB: 'Ghoul',
  S: 'Wight', SAF: 'Wight', FS: 'Ghoul', SS: 'Wight', NB: 'Ghoul',
  default: 'Zombie',
};

const RACE_TO_MAP: Readonly<Record<BbRace, RaceMapping>> = {
  Skaven: SKAVEN_MAP,
  WoodElf: WOODELF_MAP,
  Orc: ORC_MAP,
  Human: HUMAN_MAP,
  Norse: NORSE_MAP,
  Dwarf: DWARF_MAP,
  Khorne: KHORNE_MAP,
  Necromantic: NECROMANTIC_MAP,
};

function normalizeNflPosition(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Mappe une position NFL vers la position BB equivalente pour une race
 * donnee. La race vient de l'equipe du joueur (Q5 race fixe par equipe).
 *
 * Si la position n'est pas reconnue, retourne le `default` de la race
 * (typiquement Lineman / Blocker / Zombie / Bloodseeker selon la race).
 *
 * @param nflPosition - Code NFL (insensible a la casse, trim auto)
 * @param race - Race BB de l'equipe du joueur
 */
export function getBbPosition(nflPosition: string, race: BbRace): BbPosition {
  const mapping = RACE_TO_MAP[race];
  const normalized = normalizeNflPosition(nflPosition);
  const direct = (mapping as Record<string, BbPosition | undefined>)[normalized];
  return direct ?? mapping.default;
}

/**
 * Retourne le role haut-niveau d'un poste BB (lineman / specialist / bigGuy).
 */
export function getBbPositionRole(position: BbPosition): BbPositionRole {
  return POSITION_ROLE[position];
}

/**
 * Archetype fin d'un poste NFL (source de verite des caps de composition).
 * Insensible a la casse / au trim. Poste inconnu -> `lineman` (filler safe :
 * un poste non reconnu ne doit jamais consommer un slot premium plafonne).
 */
export function getArchetypeFromNflPosition(nflPosition: string): CompositionArchetype {
  const normalized = normalizeNflPosition(nflPosition);
  const direct = (NFL_POSITION_ARCHETYPE as Record<string, CompositionArchetype | undefined>)[normalized];
  return direct ?? 'lineman';
}

/**
 * Fallback best-effort : archetype derive du poste BB quand le poste NFL
 * d'origine n'est pas disponible (ex: vieux snapshots de lineup sans
 * `nflPosition`). Plus grossier que `getArchetypeFromNflPosition` car le
 * poste BB perd l'info offense/defense : les specialistes ambigus sont
 * routes vers `frontSeven` par defaut. Preferer le poste NFL quand il existe.
 */
export function getArchetypeFromBbPosition(position: BbPosition): CompositionArchetype {
  switch (position) {
    case 'Thrower':
      return 'passer';
    case 'Catcher':
    case 'Ghoul':
      return 'receiver';
    case 'Runner':
    case 'GutterRunner':
    case 'Werewolf':
      return 'rusher';
    case 'Lineman':
    case 'Blocker':
    case 'Zombie':
    case 'Bloodseeker':
    case 'Goblin':
      return 'lineman';
    case 'RatOgre':
    case 'Treeman':
    case 'Troll':
    case 'Ogre':
    case 'Yhetee':
    case 'Deathroller':
    case 'Bloodthirster':
    case 'FleshGolem':
      return 'bigGuy';
    case 'Blitzer':
    case 'StormVermin':
    case 'BlackOrc':
    case 'Wardancer':
    case 'Berserker':
    case 'Ulfwerener':
    case 'Wight':
    case 'Trollslayer':
    case 'Khorngor':
    case 'Bloodspawn':
      return 'frontSeven';
    default: {
      const _exhaustive: never = position;
      void _exhaustive;
      return 'lineman';
    }
  }
}

/**
 * Retourne tous les postes BB disponibles pour une race donnee.
 * Utile pour les UIs de roster builder.
 */
export function getBbPositionsForRace(race: BbRace): readonly BbPosition[] {
  const mapping = RACE_TO_MAP[race];
  const seen = new Set<BbPosition>();
  seen.add(mapping.default);
  for (const [, pos] of Object.entries(mapping)) {
    if (typeof pos === 'string') seen.add(pos);
  }
  return Object.freeze([...seen]);
}
