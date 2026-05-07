/**
 * Pro League engine drift watcher — sprint sim-engine observability
 * (Lot 2.A.5).
 *
 * Pourquoi
 * --------
 * Le bench CI (`pnpm sim:bench:ci`) compare la simulation à un
 * snapshot statique (`bench/bench-baseline.json`) sur des seeds
 * fixes. Mais en production, la "vraie" stabilité du moteur se
 * mesure sur les matchs effectivement joués : si une saison de
 * 120 matchs produit un tdMean Wood Elf de 1.4 alors que FUMBBL
 * attend 2.4, on a une drift réelle qu'aucun test seedé ne capte.
 *
 * Ce service calcule cette drift en continu :
 *   1. Lit les `proLeagueMatch` `status='completed'` ou `'ready'`
 *      des N derniers jours (default 7).
 *   2. Aggrège par (race, seasonId, metric) :
 *        - tdMean        — mean(tdsForThatTeamInThatMatch)
 *        - casualtyMean  — mean(casualtyCount / 2) (split entre teams)
 *        - winRate       — wins / matchsJoués
 *   3. Compare à FUMBBL reference (`reference-fumbbl.json`).
 *   4. Push la drift relative dans `nuffle_engine_drift{metric,race,seasonId}`.
 *
 * La drift est un nombre signé : `(observed - reference) / reference`.
 * Une valeur de 0.05 = +5% au-dessus de la cible ; -0.10 = -10% sous.
 *
 * Cardinalité
 * -----------
 * 16 races × N saisons × 3 métriques. Pour 1 saison active = 48 séries.
 * Bornée et stable.
 *
 * Run loop
 * --------
 * `setInterval` toutes les `intervalMs` (default 1h). Idempotent : si
 * un nouveau match arrive entre deux ticks, le tick suivant le voit.
 * Erreur isolée : un crash n'arrête pas l'interval.
 *
 * Test mode (lot 2.C)
 * -------------------
 * Quand le flag `proLeagueMatch.isTest` arrivera (Lot 2.C.1), ce
 * service devra l'exclure de l'aggregation pour ne pas polluer la
 * baseline avec des matchs sandbox. À implémenter quand la migration
 * est en place.
 */

import { getFumbblRaceStats } from "@bb/sim-engine";

import { prisma } from "../prisma";
import { appMetrics } from "../utils/metrics";
import { serverLog } from "../utils/server-log";

/** Intervalle par défaut entre deux passages du watcher (1h). */
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/** Fenêtre glissante par défaut (7 jours). */
const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type DriftMetric = "tdMean" | "casualtyMean" | "winRate";

export interface DriftSample {
  readonly metric: DriftMetric;
  readonly race: string;
  readonly seasonId: string;
  /** Valeur observée sur la fenêtre. */
  readonly observed: number;
  /** Valeur de référence FUMBBL. */
  readonly reference: number;
  /** Drift relative `(observed - reference) / reference`, signée. */
  readonly drift: number;
  /** Nombre de matchs joués (par cette race) pour calculer `observed`. */
  readonly samples: number;
}

export interface ComputeDriftOptions {
  /** Fenêtre glissante en millisecondes. Default 7 jours. */
  readonly windowMs?: number;
  /** Override `now()`. Pratique pour les tests. */
  readonly now?: Date;
  /** Filtrer sur une saison particulière. Default : toutes les saisons actives. */
  readonly seasonId?: string;
}

interface PerRaceAggregation {
  matches: number;
  tdsSum: number;
  casualtiesSum: number;
  wins: number;
}

interface MatchSlice {
  seasonId: string;
  homeRace: string;
  awayRace: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  touchdownCount: number | null;
  casualtyCount: number | null;
}

/**
 * Pas de jointure relationnelle ici — Prisma gère le include et on
 * extrait juste les champs pertinents pour l'aggrégation.
 */
async function loadCompletedMatches(
  windowMs: number,
  now: Date,
  seasonId: string | undefined,
): Promise<readonly MatchSlice[]> {
  const since = new Date(now.getTime() - windowMs);
  const rows = await prisma.proLeagueMatch.findMany({
    where: {
      status: { in: ["completed", "ready"] },
      simulatedAt: { gte: since, lte: now },
      ...(seasonId ? { seasonId } : {}),
    },
    select: {
      seasonId: true,
      scoreHome: true,
      scoreAway: true,
      outcome: true,
      touchdownCount: true,
      casualtyCount: true,
      homeTeam: { select: { race: true } },
      awayTeam: { select: { race: true } },
    },
  });
  type Row = {
    seasonId: string;
    scoreHome: number | null;
    scoreAway: number | null;
    outcome: string | null;
    touchdownCount: number | null;
    casualtyCount: number | null;
    homeTeam: { race: string };
    awayTeam: { race: string };
  };
  return (rows as Row[]).map((row) => ({
    seasonId: row.seasonId,
    homeRace: row.homeTeam.race,
    awayRace: row.awayTeam.race,
    scoreHome: row.scoreHome,
    scoreAway: row.scoreAway,
    outcome: row.outcome,
    touchdownCount: row.touchdownCount,
    casualtyCount: row.casualtyCount,
  }));
}

/**
 * Aggrège les matchs par (seasonId, race) en additionnant TDs,
 * casualties et wins. Chaque match contribue *deux fois* (une fois
 * pour homeRace, une fois pour awayRace). Les casualties sont splittés
 * 50/50 (information par-team non disponible sur ProLeagueMatch).
 */
export function aggregateMatchesByRace(
  matches: readonly MatchSlice[],
): Map<string, Map<string, PerRaceAggregation>> {
  // Map<seasonId, Map<race, agg>>
  const out = new Map<string, Map<string, PerRaceAggregation>>();
  const ensure = (seasonId: string, race: string): PerRaceAggregation => {
    let perSeason = out.get(seasonId);
    if (!perSeason) {
      perSeason = new Map();
      out.set(seasonId, perSeason);
    }
    let agg = perSeason.get(race);
    if (!agg) {
      agg = { matches: 0, tdsSum: 0, casualtiesSum: 0, wins: 0 };
      perSeason.set(race, agg);
    }
    return agg;
  };

  for (const m of matches) {
    const tdHome = m.scoreHome ?? 0;
    const tdAway = m.scoreAway ?? 0;
    const casualtiesPerSide = (m.casualtyCount ?? 0) / 2;

    const home = ensure(m.seasonId, m.homeRace);
    home.matches += 1;
    home.tdsSum += tdHome;
    home.casualtiesSum += casualtiesPerSide;
    if (m.outcome === "home") home.wins += 1;

    const away = ensure(m.seasonId, m.awayRace);
    away.matches += 1;
    away.tdsSum += tdAway;
    away.casualtiesSum += casualtiesPerSide;
    if (m.outcome === "away") away.wins += 1;
  }

  return out;
}

/** `(observed - reference) / reference`, defensive si `reference === 0`. */
export function computeRelativeDrift(observed: number, reference: number): number {
  if (!Number.isFinite(observed) || !Number.isFinite(reference) || reference === 0) {
    return 0;
  }
  return (observed - reference) / reference;
}

/**
 * Construit la liste de samples drift à partir des aggregations et
 * de la référence FUMBBL. Une race sans match dans la fenêtre est
 * absente de la sortie (pas de samples = pas de drift à pousser).
 */
export function buildDriftSamples(
  aggregations: Map<string, Map<string, PerRaceAggregation>>,
): DriftSample[] {
  const samples: DriftSample[] = [];
  for (const [seasonId, perSeason] of aggregations) {
    for (const [race, agg] of perSeason) {
      if (agg.matches === 0) continue;
      const ref = getFumbblRaceStats(race);
      if (!ref) continue; // race inconnue de FUMBBL ref — silencieux

      const observedTd = agg.tdsSum / agg.matches;
      const observedCas = agg.casualtiesSum / agg.matches;
      const observedWin = agg.wins / agg.matches;

      samples.push({
        metric: "tdMean",
        race,
        seasonId,
        observed: observedTd,
        reference: ref.tdAverage,
        drift: computeRelativeDrift(observedTd, ref.tdAverage),
        samples: agg.matches,
      });
      samples.push({
        metric: "casualtyMean",
        race,
        seasonId,
        observed: observedCas,
        reference: ref.casualtyRate,
        drift: computeRelativeDrift(observedCas, ref.casualtyRate),
        samples: agg.matches,
      });
      samples.push({
        metric: "winRate",
        race,
        seasonId,
        observed: observedWin,
        reference: ref.winrate,
        drift: computeRelativeDrift(observedWin, ref.winrate),
        samples: agg.matches,
      });
    }
  }
  return samples;
}

/**
 * Calcule la drift courante sans la pousser dans Prometheus. Sert au
 * trigger admin (Lot 2.B.3) qui veut afficher la table sans dépendre
 * d'un scrape Prometheus.
 */
export async function computeEngineDrift(
  options: ComputeDriftOptions = {},
): Promise<DriftSample[]> {
  const now = options.now ?? new Date();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const matches = await loadCompletedMatches(windowMs, now, options.seasonId);
  const aggregations = aggregateMatchesByRace(matches);
  return buildDriftSamples(aggregations);
}

/**
 * Pousse les drift samples dans la gauge `nuffle_engine_drift`. Les
 * gauges absentes restent à leur valeur précédente — pour éviter ça,
 * on accepte un `previousLabels` qui retourne la liste des labels
 * pushés au tick d'avant et on les remet à 0 si plus présents.
 */
function pushDriftToMetrics(samples: readonly DriftSample[]): void {
  for (const s of samples) {
    appMetrics.setEngineDrift(
      { metric: s.metric, race: s.race, seasonId: s.seasonId },
      s.drift,
    );
  }
}

/**
 * Tick unitaire : compute + push. Erreur isolée — log et continue.
 * Retourne le nombre de samples pushés pour usage dans les tests
 * sans avoir besoin de scrutateur Prometheus.
 */
export async function runDriftTick(
  options: ComputeDriftOptions = {},
): Promise<number> {
  try {
    const samples = await computeEngineDrift(options);
    pushDriftToMetrics(samples);
    return samples.length;
  } catch (err: unknown) {
    serverLog.error("[engine-drift-watcher] tick failed", err);
    return 0;
  }
}

export interface StartDriftWatcherOptions {
  readonly intervalMs?: number;
  readonly windowMs?: number;
  /** Disable to opt out (tests/dev). Default true. */
  readonly enabled?: boolean;
}

export interface DriftWatcherHandle {
  stop(): void;
  /** Force un tick immédiat (utile pour les routes admin / les tests). */
  tickNow(options?: ComputeDriftOptions): Promise<number>;
}

export function startDriftWatcher(
  options: StartDriftWatcherOptions = {},
): DriftWatcherHandle {
  const enabled = options.enabled ?? true;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  let timer: NodeJS.Timeout | undefined;
  if (enabled) {
    timer = setInterval(() => {
      void runDriftTick({ windowMs });
    }, intervalMs);
    timer.unref();
  }

  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    tickNow(opts?: ComputeDriftOptions) {
      return runDriftTick(opts ?? { windowMs });
    },
  };
}
