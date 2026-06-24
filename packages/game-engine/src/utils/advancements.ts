/**
 * Utilitaires d'avancement des joueurs (coûts SPP/PEP et surcoûts VE).
 *
 * Mis à jour pour Blood Bowl 2025 (Saison 3). Changements clés vs S2 :
 *  - La compétence secondaire choisie est moins chère (10 au lieu de 12
 *    pour le 1er avancement, et toute la courbe baisse).
 *  - L'amélioration de caractéristique devient un type d'avancement
 *    achetable, sur une colonne unique et moins chère qu'en S2.
 *  - La « secondaire au hasard » n'existe plus en S3 (retirée de la
 *    table des choix). On conserve toutefois une compat lecture pour
 *    les joueurs dont les données contiennent déjà ce type.
 *
 * Source de la table S3 : https://mordorbihan.fr/fr/bloodbowl/2025/rules/spp
 */

export type AdvancementType =
  | 'primary'
  | 'secondary'
  | 'random-primary'
  | 'characteristic';

/** Caractéristiques améliorables via une amélioration de caractéristique. */
export type CharacteristicKind = 'ma' | 'st' | 'ag' | 'pa' | 'av';

// Tableau des coûts en SPP par numéro d'avancement (1..6).
// Index 0 non utilisé pour aligner l'indice avec le numéro d'avancement.
// Table officielle Blood Bowl 2025 (Saison 3).
const SPP_COST_TABLE = {
  'primary': [0, 6, 8, 12, 16, 20, 30],            // Choisir une principale (inchangé S2→S3)
  'secondary': [0, 10, 12, 16, 20, 24, 34],        // Choisir une secondaire (S3 : 10 au lieu de 12)
  'random-primary': [0, 3, 4, 6, 8, 10, 15],       // Principale au hasard (inchangé)
  'characteristic': [0, 14, 16, 20, 24, 28, 38],   // Amélioration de caractéristique (S3, moins cher)
} as const;

// Surcoûts de valeur joueur par compétence (po). La caractéristique a un
// surcoût par stat (cf CHARACTERISTIC_VALUE_INCREASE).
export const SURCHARGE_PER_ADVANCEMENT = {
  primary: 20000,          // +20k po - compétence principale choisie
  secondary: 40000,        // +40k po - compétence secondaire choisie
  // A6 — en S3 le hasard se joue en « 2 jets, on choisit » : une principale
  // au hasard augmente donc la VE COMME une choisie (+20k). Seul son coût SPP
  // reste moindre (3 vs 6).
  'random-primary': 20000, // +20k po - compétence principale au hasard (S3)
} as const;

/**
 * Surcoût VE (po) par amélioration de caractéristique en S3.
 * +1 AV est le moins cher, +1 ST le plus cher.
 */
export const CHARACTERISTIC_VALUE_INCREASE: Record<CharacteristicKind, number> = {
  av: 10000, // +1 AV
  ma: 20000, // +1 MA
  pa: 20000, // +1 PA
  ag: 30000, // +1 AG
  st: 60000, // +1 ST
};

/**
 * Compat lecture : types d'avancement retirés en S3 mais qui peuvent
 * subsister dans des données joueur déjà stockées (avancements pris
 * sous les règles S2). On garde leur surcoût VE pour ne pas casser le
 * calcul de la valeur d'équipe. Ces types ne sont plus proposables.
 */
const LEGACY_SURCHARGE_PER_ADVANCEMENT: Record<string, number> = {
  'random-secondary': 20000, // +20k po - secondaire au hasard (S2, supprimée en S3)
};

/**
 * Retourne le coût en SPP pour le prochain avancement donné le nombre
 * d'avancements déjà acquis.
 * @param alreadyTaken nombre d'avancements déjà pris (0..6)
 * @param type type d'avancement
 */
export function getNextAdvancementPspCost(alreadyTaken: number, type: AdvancementType): number {
  const next = Math.min(Math.max(alreadyTaken + 1, 1), 6);
  return SPP_COST_TABLE[type][next];
}

/** Forme minimale d'un avancement nécessaire au calcul de son surcoût VE. */
export interface AdvancementSurchargeInput {
  /** Type d'avancement (AdvancementType courant ou type S2 legacy). */
  readonly type: string;
  /** Caractéristique ciblée (uniquement pour type='characteristic'). */
  readonly stat?: CharacteristicKind;
}

/** Surcoût VE (po) d'un avancement unique, tolérant aux types legacy. */
export function surchargeForAdvancement(adv: AdvancementSurchargeInput): number {
  if (adv.type === 'characteristic') {
    return adv.stat ? CHARACTERISTIC_VALUE_INCREASE[adv.stat] : 0;
  }
  if (adv.type in SURCHARGE_PER_ADVANCEMENT) {
    return SURCHARGE_PER_ADVANCEMENT[
      adv.type as keyof typeof SURCHARGE_PER_ADVANCEMENT
    ];
  }
  return LEGACY_SURCHARGE_PER_ADVANCEMENT[adv.type] ?? 0;
}

/**
 * Calcule le surcoût total en po d'un ensemble d'avancements pris.
 * Accepte la forme objet `{ type, stat? }` (incl. caractéristiques) et
 * reste tolérant aux types legacy stockés.
 */
export function calculateAdvancementsSurcharge(
  advancements: ReadonlyArray<AdvancementSurchargeInput>,
): number {
  return advancements.reduce((sum, a) => sum + surchargeForAdvancement(a), 0);
}

/**
 * Calcule la valeur courante d'un joueur = coût de base + surcoûts.
 * @param baseCostPo coût de base en po (ex: 85000)
 * @param advancements avancements pris
 */
export function calculatePlayerCurrentValue(
  baseCostPo: number,
  advancements: ReadonlyArray<AdvancementSurchargeInput>,
): number {
  return baseCostPo + calculateAdvancementsSurcharge(advancements);
}

export interface PlayerAdvancement {
  /** slug de la compétence ajoutée. Absent pour une amélioration de caractéristique. */
  skillSlug?: string;
  type: AdvancementType;
  /** Caractéristique améliorée (uniquement pour type='characteristic'). */
  stat?: CharacteristicKind;
  /** Résultat du D8 tiré (uniquement pour type='characteristic'). Traçabilité. */
  d8?: number;
  isRandom: boolean;            // true si c'était un tirage aléatoire
  at: number;                   // timestamp ms
}

/**
 * Nombre maximum d'améliorations d'une même caractéristique sur la
 * carrière d'un joueur (règle BB2025, p.37 : « on ne peut jamais
 * améliorer plus de deux fois une Caractéristique »).
 */
export const MAX_CHARACTERISTIC_IMPROVEMENTS = 2;

/**
 * Valeur « la meilleure atteignable » par amélioration (BB2025 p.37).
 * MA/ST/AV s'améliorent vers le haut (cap = maximum). AG/PA sont des
 * cibles « X+ » où plus bas = meilleur ⇒ s'améliorent vers le bas
 * (cap = 1, la meilleure cible). Au-delà, l'amélioration est interdite.
 *
 *   M (MA)  : 1..9   ST (F) : 1..5   AR (AV) : 3+..11+
 *   AG      : 6+..1+ CP (PA): 6+..1+
 */
export const CHARACTERISTIC_IMPROVE_LIMIT: Record<CharacteristicKind, number> = {
  ma: 9,  // maximum
  st: 5,  // maximum (Force)
  av: 11, // meilleure armure (cible la plus haute)
  ag: 1,  // meilleure cible (la plus basse)
  pa: 1,  // meilleure cible (la plus basse)
};

/**
 * Tableau D8 d'amélioration de caractéristique (BB2025). Pour un jet
 * donné, retourne les caractéristiques améliorables au choix du coach.
 * La Force (ST) n'est accessible que sur un 8 (« au choix »).
 */
export function characteristicOptionsForRoll(
  d8: number,
): readonly CharacteristicKind[] {
  switch (d8) {
    case 1:
      return ['av'];
    case 2:
      return ['av', 'pa'];
    case 3:
    case 4:
      return ['av', 'ma', 'pa'];
    case 5:
      return ['ma', 'pa'];
    case 6:
      return ['ag', 'pa'];
    case 7:
      return ['ag', 'ma'];
    case 8:
      return ['ma', 'st', 'ag', 'pa', 'av'];
    default:
      return [];
  }
}

/**
 * `true` si la caractéristique `stat` est déjà à sa limite d'amélioration
 * (ou non améliorable, ex: PA « — »). On compare la valeur courante au cap
 * directionnel `CHARACTERISTIC_IMPROVE_LIMIT`.
 */
export function isAtCharacteristicLimit(
  stat: CharacteristicKind,
  value: number | null,
): boolean {
  const limit = CHARACTERISTIC_IMPROVE_LIMIT[stat];
  if (stat === 'ag' || stat === 'pa') {
    // Cibles « X+ » : on s'améliore vers le bas. PA « — » (null) non améliorable.
    if (value === null) return true;
    return value <= limit;
  }
  // MA/ST/AV : on s'améliore vers le haut.
  if (value === null) return true;
  return value >= limit;
}

/**
 * `true` si une amélioration de `stat` est autorisée pour ce joueur :
 *  - elle n'a pas déjà été améliorée 2 fois (`alreadyImprovedCount`),
 *  - et sa valeur courante n'est pas déjà à la limite.
 */
export function canImproveCharacteristic(
  stats: PlayerStats,
  stat: CharacteristicKind,
  alreadyImprovedCount: number,
): boolean {
  if (alreadyImprovedCount >= MAX_CHARACTERISTIC_IMPROVEMENTS) return false;
  const value = stat === 'pa' ? stats.pa : stats[stat];
  return !isAtCharacteristicLimit(stat, value);
}

/**
 * Vérifie si un type d'avancement est aléatoire. En S3, seul
 * `random-primary` subsiste (la secondaire au hasard a été retirée).
 */
export function isRandomAdvancement(type: AdvancementType): boolean {
  return type === 'random-primary';
}

/**
 * Convertit un type d'avancement compétence vers la catégorie d'accès
 * (primaire/secondaire). Ne doit pas être appelé pour 'characteristic'
 * (qui ne pioche pas dans un pool de compétences).
 */
export function getCategoryAccessType(type: AdvancementType): 'primary' | 'secondary' {
  if (type === 'random-primary' || type === 'primary') {
    return 'primary';
  }
  return 'secondary';
}

/** Stats d'un joueur impactées par une amélioration de caractéristique. */
export interface PlayerStats {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
}

/**
 * Applique (immutable) une amélioration de caractéristique BB2025.
 *
 * MA/ST/AV sont des valeurs où « plus haut = meilleur » → +1.
 * AG/PA sont des cibles « X+ » où « plus bas = meilleur » →
 * l'amélioration diminue la cible (-1).
 *
 * Les valeurs sont bornées par `CHARACTERISTIC_IMPROVE_LIMIT` (BB2025
 * p.37) : MA≤9, ST≤5, AV≤11, AG≥1, PA≥1. PA peut valoir `null` (« — »,
 * pas de passe) : améliorer PA dans ce cas est invalide ; le caller doit
 * le refuser en amont. Par sécurité, on laisse PA inchangé si elle est null.
 */
export function applyCharacteristicImprovement(
  stats: PlayerStats,
  stat: CharacteristicKind,
): PlayerStats {
  switch (stat) {
    case 'ma':
      return { ...stats, ma: Math.min(CHARACTERISTIC_IMPROVE_LIMIT.ma, stats.ma + 1) };
    case 'st':
      return { ...stats, st: Math.min(CHARACTERISTIC_IMPROVE_LIMIT.st, stats.st + 1) };
    case 'av':
      return { ...stats, av: Math.min(CHARACTERISTIC_IMPROVE_LIMIT.av, stats.av + 1) };
    case 'ag':
      return { ...stats, ag: Math.max(CHARACTERISTIC_IMPROVE_LIMIT.ag, stats.ag - 1) };
    case 'pa':
      return stats.pa === null
        ? stats
        : { ...stats, pa: Math.max(CHARACTERISTIC_IMPROVE_LIMIT.pa, stats.pa - 1) };
  }
}
