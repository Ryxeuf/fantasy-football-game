/**
 * Bornes drift par race (Lot 4.A.3).
 *
 * Pourquoi
 * --------
 * Le drift watcher de Lot 2.A.5 + 4.A signale les drifts relatives
 * (>10% / >25% vs FUMBBL_REFERENCE) avec un seuil flat. Mais en BB,
 * certaines races ont des winrates intrinsequement bas (Halfling,
 * Goblin, Snotling : 25-35%) ou hauts (Wood Elf, Chaos Dwarf : 55-65%).
 *
 * Une drift de 10% sur un winrate Halfling reference 30% -> observed
 * 33% : pas grave. Meme drift en absolu sur Wood Elf 60% -> observed
 * 66% : pas grave non plus. Mais Halfling > 45% ou Wood Elf < 40% =
 * anomalie BB-rules-violente independamment de la drift relative.
 *
 * Cette table definit des bornes absolues par race et metrique. Sert
 * en complement (pas remplacement) du drift watcher : un sample peut
 * rester dans la tolerance ±10% mais sortir des bornes BB-realistes.
 *
 * Architecture
 * ------------
 * - `RACE_DRIFT_BOUNDS` : table par race -> { winRate, tdMean,
 *   casualtyMean : { min?, max? } } optionnels.
 * - `detectRaceBoundAlerts(samples, options)` : pure, retourne
 *   les alertes critical pour les samples hors-bornes.
 * - Branche dans `pro-league-engine-drift-watcher.runDriftTick` a
 *   cote de `detectDriftAlerts` existant. Les deux sources d'alertes
 *   alimentent la meme jauge `nuffle_engine_drift_alerts_count`.
 *
 * Tradeoffs
 * ---------
 * Bornes choisies large pour ne signaler que des anomalies vraiment
 * suspectes (>5σ pour les races scewees connues). Tuner si on
 * observe des faux positifs / faux negatifs en prod.
 */

import type {
  DriftMetric,
  DriftSample,
} from "./pro-league-engine-drift-watcher";

export interface RaceBoundRange {
  readonly min?: number;
  readonly max?: number;
}

export interface RaceDriftBounds {
  readonly winRate?: RaceBoundRange;
  readonly tdMean?: RaceBoundRange;
  readonly casualtyMean?: RaceBoundRange;
}

/**
 * Bornes absolues par race. Ne defini que les races connues pour
 * etre extreme bas (Halfling, Goblin, Snotling) ou extreme haut
 * (Wood Elf, Chaos Dwarf, Dwarf, Lizardmen). Les autres races
 * tombent en no-op (fallback sur le drift watcher classique).
 *
 * Sources : FUMBBL stats long-term + Blood Bowl tier list communaute.
 * Bornes elargies de ±10pp vs reference pour ne signaler que les
 * vraies anomalies.
 */
export const RACE_DRIFT_BOUNDS: Record<string, RaceDriftBounds> = {
  // Tier 4 (faibles, doivent perdre la majorite)
  Halfling: {
    winRate: { max: 0.45 },
    tdMean: { max: 2.5 },
  },
  Goblin: {
    winRate: { max: 0.45 },
    tdMean: { max: 2.5 },
  },
  Snotling: {
    winRate: { max: 0.4 },
    tdMean: { max: 2.0 },
  },
  Ogre: {
    winRate: { max: 0.5 },
  },
  // Tier 1 (forts, doivent dominer mais pas crusher)
  "Wood Elf": {
    winRate: { min: 0.45, max: 0.7 },
    tdMean: { min: 1.8 },
  },
  "Chaos Dwarf": {
    winRate: { min: 0.45, max: 0.7 },
  },
  Dwarf: {
    winRate: { min: 0.45, max: 0.7 },
  },
  Lizardmen: {
    winRate: { min: 0.45, max: 0.7 },
  },
  Amazon: {
    winRate: { min: 0.45, max: 0.65 },
  },
};

/** Direction de la borne franchie (utile pour debug humain). */
export type RaceBoundDirection = "above_max" | "below_min";

export interface RaceBoundAlert {
  readonly severity: "critical";
  readonly race: string;
  readonly seasonId: string;
  readonly metric: DriftMetric;
  readonly direction: RaceBoundDirection;
  readonly observed: number;
  readonly bound: number;
  readonly samples: number;
}

export interface DetectRaceBoundAlertsOptions {
  /**
   * Pas d'alerte sous ce nombre de samples (variance trop forte
   * pour conclure). Default 5, aligne sur le drift watcher.
   */
  readonly minMatches?: number;
  /** Override de la table de bornes (utile pour les tests). */
  readonly bounds?: Record<string, RaceDriftBounds>;
}

const DEFAULT_MIN_MATCHES = 5;

function readMetric(
  bounds: RaceDriftBounds,
  metric: DriftMetric,
): RaceBoundRange | undefined {
  switch (metric) {
    case "winRate":
      return bounds.winRate;
    case "tdMean":
      return bounds.tdMean;
    case "casualtyMean":
      return bounds.casualtyMean;
    default:
      return undefined;
  }
}

/**
 * Pure : retourne les alertes critical pour les samples hors-bornes.
 * Les samples sans bornes definies pour leur race -> no-op (fallback
 * sur le drift watcher classique).
 */
export function detectRaceBoundAlerts(
  samples: readonly DriftSample[],
  options: DetectRaceBoundAlertsOptions = {},
): RaceBoundAlert[] {
  const minMatches = options.minMatches ?? DEFAULT_MIN_MATCHES;
  const bounds = options.bounds ?? RACE_DRIFT_BOUNDS;
  const alerts: RaceBoundAlert[] = [];
  for (const s of samples) {
    if (s.samples < minMatches) continue;
    const raceBounds = bounds[s.race];
    if (!raceBounds) continue;
    const range = readMetric(raceBounds, s.metric);
    if (!range) continue;
    if (range.max !== undefined && s.observed > range.max) {
      alerts.push({
        severity: "critical",
        race: s.race,
        seasonId: s.seasonId,
        metric: s.metric,
        direction: "above_max",
        observed: s.observed,
        bound: range.max,
        samples: s.samples,
      });
      continue;
    }
    if (range.min !== undefined && s.observed < range.min) {
      alerts.push({
        severity: "critical",
        race: s.race,
        seasonId: s.seasonId,
        metric: s.metric,
        direction: "below_min",
        observed: s.observed,
        bound: range.min,
        samples: s.samples,
      });
    }
  }
  return alerts;
}
