/**
 * Lot 4 « évolution persistée » — ADAPTATION BORNÉE ET EXPLIQUÉE du coach.
 *
 * Entre deux matchs, le profil tactique d'un coach bouge selon ce que ses
 * drives ont donné : une stratégie qui marque est renforcée (ses paramètres
 * d'influence montent), une stratégie qui coûte des turnovers ou encaisse
 * est atténuée. Trois garde-fous rendent l'évolution lisible et sûre :
 *
 *  1. **Bornée** : chaque paramètre reste dans `[ancre − bande, ancre + bande]`
 *     (l'ancre est le profil de race d'origine, ou celui posé par l'admin).
 *     Aucun self-play, aucune descente de gradient : un pas de taille fixe
 *     par match, proportionnel à la moyenne mobile des résultats.
 *  2. **Expliquée** : chaque changement porte sa RAISON en français
 *     (« `stall` rapporte sur 5 drives (EMA +0,42) → `stallTendency` +2 »),
 *     pour la console admin et la Gazette.
 *  3. **Rappel vers l'ancre** : sans signal, le profil revient lentement vers
 *     son ancre, pour qu'une série noire passagère ne fige pas un style.
 *
 * Tout est pur : le serveur lit la mémoire en base, appelle
 * `adaptCoachProfile`, et persiste le résultat.
 */

import type { TeamId } from '@bb/game-engine';

import {
  TACTICAL_PROFILE_PARAMETERS,
  type TacticalParameter,
  type TacticalProfile,
} from '../tactics/tactical-profile';

import type { CoachStrategyId } from './drive-plan';

/** Issue d'un drive, du point de vue de l'équipe qui a joué la stratégie. */
export type DriveOutcome =
  /** L'équipe a marqué. */
  | 'td'
  /** L'adversaire a marqué pendant ce drive. */
  | 'conceded'
  /** Le drive s'est terminé avec la mi-temps (ou le match) sans score. */
  | 'half-end';

export interface DriveRecord {
  readonly team: TeamId;
  readonly half: number;
  /** Stratégie dominante du drive (la plus de tours joués). */
  readonly strategy: CoachStrategyId;
  /** L'équipe avait-elle le ballon pendant ce drive ? */
  readonly possession: boolean;
  readonly outcome: DriveOutcome;
  /** Turnovers subis par l'équipe pendant le drive. */
  readonly turnovers: number;
  /** Tours joués par l'équipe pendant le drive. */
  readonly turns: number;
}

/** Rapport du coach en fin de match : un enregistrement par drive et par équipe. */
export interface CoachMatchReport {
  readonly drives: readonly DriveRecord[];
}

export interface StrategyMemory {
  /** Moyenne mobile exponentielle de la récompense (dans [−1, 1]). */
  readonly ema: number;
  /** Nombre de drives observés avec cette stratégie. */
  readonly samples: number;
}

export interface CoachMemory {
  readonly strategies: Readonly<Partial<Record<CoachStrategyId, StrategyMemory>>>;
}

export const EMPTY_COACH_MEMORY: CoachMemory = Object.freeze({ strategies: {} });

/**
 * Paramètres qu'une stratégie « tire » quand elle réussit (+1) ou pousse
 * quand elle échoue (−1). Une stratégie qui marche renforce les paramètres
 * qui la rendent probable ; une stratégie qui échoue les relâche.
 */
export const STRATEGY_INFLUENCE: Readonly<Record<CoachStrategyId, Readonly<Partial<Record<TacticalParameter, 1 | -1>>>>> = {
  'cage-build': { cageAffinity: 1, patience: 1, pace: -1 },
  breakaway: { breakawayInstinct: 1, pace: 1, gfiTolerance: 1, riskAppetite: 1 },
  'defensive-screen': { screenAffinity: 1, pressingDefense: -1 },
  'blitz-train': { blitzPriority: 1, bashIndex: 1 },
  stall: { stallTendency: 1, patience: 1 },
  'foul-fest': { foulFrequency: 1 },
  'two-turn-score': { pace: 1, passingFrequency: 1, riskAppetite: 1 },
  'safe-hold': { patience: 1, riskAppetite: -1, gfiTolerance: -1 },
  'mark-receivers': { pressingDefense: 1, screenAffinity: -1 },
};

export interface AdaptationOptions {
  /** Lissage de la moyenne mobile (défaut 0,2). */
  readonly alpha?: number;
  /** Pas maximal par paramètre et par match (défaut 2 points). */
  readonly learningRate?: number;
  /** Demi-largeur de la bande autour de l'ancre (défaut 15 points). */
  readonly band?: number;
  /** Fraction de l'écart à l'ancre résorbée chaque match sans signal (défaut 0,05). */
  readonly recall?: number;
  /** Drives minimum avant qu'une stratégie influence le profil (défaut 3). */
  readonly minSamples?: number;
}

export interface ProfileChange {
  readonly parameter: TacticalParameter;
  readonly before: number;
  readonly after: number;
  /** Explication lisible, en français. */
  readonly reason: string;
}

export interface AdaptCoachInput {
  readonly profile: TacticalProfile;
  readonly anchor: TacticalProfile;
  readonly memory: CoachMemory;
  /** Drives de l'équipe pendant le match qui vient de se jouer. */
  readonly drives: readonly DriveRecord[];
  readonly options?: AdaptationOptions;
}

export interface AdaptCoachResult {
  readonly profile: TacticalProfile;
  readonly memory: CoachMemory;
  readonly changes: readonly ProfileChange[];
}

const DEFAULTS: Required<AdaptationOptions> = {
  alpha: 0.2,
  learningRate: 2,
  band: 15,
  recall: 0.05,
  minSamples: 3,
};

/** Récompense d'un drive dans [−1, 1]. */
export function driveReward(drive: DriveRecord): number {
  let base: number;
  if (drive.outcome === 'td') base = 1;
  else if (drive.outcome === 'conceded') base = -1;
  else base = drive.possession ? -0.3 : 0.5; // attaque stérile / défense qui tient
  const turnoverPenalty = Math.min(0.4, drive.turnovers * 0.1);
  return Math.max(-1, Math.min(1, base - turnoverPenalty));
}

/** Intègre les drives d'un match dans la mémoire (EMA par stratégie). */
export function updateCoachMemory(
  memory: CoachMemory,
  drives: readonly DriveRecord[],
  alpha: number = DEFAULTS.alpha,
): CoachMemory {
  const next: Partial<Record<CoachStrategyId, StrategyMemory>> = { ...memory.strategies };
  for (const drive of drives) {
    const reward = driveReward(drive);
    const prev = next[drive.strategy];
    next[drive.strategy] = prev
      ? { ema: prev.ema + alpha * (reward - prev.ema), samples: prev.samples + 1 }
      : { ema: reward, samples: 1 };
  }
  return { strategies: next };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function formatEma(ema: number): string {
  const sign = ema >= 0 ? '+' : '−';
  return `${sign}${Math.abs(ema).toFixed(2).replace('.', ',')}`;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/**
 * Fait évoluer le profil d'un pas, borné à `ancre ± bande`, et explique
 * chaque changement. Les paramètres sans signal se rapprochent de l'ancre.
 */
export function adaptCoachProfile(input: AdaptCoachInput): AdaptCoachResult {
  const opts = { ...DEFAULTS, ...(input.options ?? {}) };
  const memory = updateCoachMemory(input.memory, input.drives, opts.alpha);

  // Poussée par paramètre : somme des influences des stratégies observées.
  const push = new Map<TacticalParameter, number>();
  const reasons = new Map<TacticalParameter, string[]>();
  const playedNow = new Set(input.drives.map((d) => d.strategy));
  for (const strategy of playedNow) {
    const mem = memory.strategies[strategy];
    if (!mem || mem.samples < opts.minSamples) continue;
    const influence = STRATEGY_INFLUENCE[strategy] ?? {};
    for (const [parameter, direction] of Object.entries(influence) as [TacticalParameter, 1 | -1][]) {
      const amount = mem.ema * direction;
      push.set(parameter, (push.get(parameter) ?? 0) + amount);
      const verdict = mem.ema >= 0 ? 'rapporte' : 'coûte';
      const list = reasons.get(parameter) ?? [];
      list.push(`« ${strategy} » ${verdict} sur ${mem.samples} drives (EMA ${formatEma(mem.ema)})`);
      reasons.set(parameter, list);
    }
  }

  const changes: ProfileChange[] = [];
  const next: Record<string, number> = { ...input.profile };
  for (const parameter of TACTICAL_PROFILE_PARAMETERS) {
    const before = input.profile[parameter];
    const anchor = input.anchor[parameter];
    const lo = clamp(anchor - opts.band, 0, 100);
    const hi = clamp(anchor + opts.band, 0, 100);
    const signal = push.get(parameter) ?? 0;
    let after: number;
    let reason: string;
    if (signal !== 0) {
      const step = Math.round(clamp(signal, -1, 1) * opts.learningRate);
      after = clamp(before + step, lo, hi);
      reason = `${(reasons.get(parameter) ?? []).join(' ; ')} → ${parameter} ${formatDelta(after - before)}`;
    } else {
      const drift = (anchor - before) * opts.recall;
      after = clamp(before + (drift > 0 ? Math.ceil(drift) : Math.floor(drift)), lo, hi);
      reason = `rappel vers l'ancre (${anchor}) → ${parameter} ${formatDelta(after - before)}`;
    }
    next[parameter] = after;
    if (after !== before) changes.push({ parameter, before, after, reason });
  }

  return { profile: next as TacticalProfile, memory, changes };
}

/** Vrai si chaque paramètre est dans la bande autour de l'ancre. */
export function isWithinBand(profile: TacticalProfile, anchor: TacticalProfile, band: number = DEFAULTS.band): boolean {
  return TACTICAL_PROFILE_PARAMETERS.every((p) => Math.abs(profile[p] - anchor[p]) <= band);
}
