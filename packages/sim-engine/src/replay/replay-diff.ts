/**
 * Replay diff tool (Lot 4.B.2).
 *
 * Pourquoi
 * --------
 * Le cross-version baseline comparator (Lot 4.B.1) compare des stats
 * agregees (tdMean, winrate, etc.) entre deux engineVer. Quand un
 * pairing diverge "globalement", la question naturelle est "OU
 * exactement diverge la simulation ?". Un diff event-par-event sur
 * deux replays produits avec le meme seed permet de pointer
 * precisement le tour ou le coup ou la divergence est apparue.
 *
 * Workflow recommande :
 *   git checkout v0.15.0
 *   pnpm sim:replay --seed=42 --teamA=... --teamB=... --json > /tmp/replay-0.15.json
 *   git checkout v0.16.0
 *   pnpm sim:replay --seed=42 --teamA=... --teamB=... --json > /tmp/replay-0.16.json
 *   pnpm sim:diff-replays --a /tmp/replay-0.15.json --b /tmp/replay-0.16.json
 *
 * Architecture
 * ------------
 * - `diffReplayEvents(a, b, options)` (pure) : aligne les events par
 *   index, detecte mismatch (type / displayAtMs / meta) et longueurs
 *   asymetriques. Borne via `maxDivergences` pour eviter un OOM si
 *   les deux replays divergent totalement (ex: seed mismatch).
 * - `formatReplayDiffReport(result, options)` (pure) : rendu text
 *   avec en-tete summary + premieres divergences listees.
 *
 * Limitations MVP
 * ---------------
 * - Comparaison index-aligned (pas LCS). Si une seule action est
 *   inseree dans B, toute la suite est marquee comme mismatch. Pour
 *   un alignment plus tolerant, brancher un algorithme Myers diff
 *   plus tard. En pratique sur les replays sim-engine seedes, les
 *   divergences sont rares et localisees.
 * - Meta deep equality via JSON.stringify avec keys triees. Pas
 *   robuste si meta contient des fonctions ou des cycles, mais
 *   MatchEvent.meta est always serializable (record string -> JSON
 *   primitives).
 */

import type { MatchEvent } from '../types';

export type ReplayDivergenceKind = 'mismatch' | 'missing_a' | 'missing_b';

export interface ReplayDivergence {
  readonly index: number;
  readonly kind: ReplayDivergenceKind;
  readonly a: MatchEvent | null;
  readonly b: MatchEvent | null;
}

export interface ReplayDiffSummary {
  readonly totalA: number;
  readonly totalB: number;
  readonly matchedCount: number;
  readonly divergenceCount: number;
  readonly firstDivergenceIndex: number | null;
}

export interface ReplayDiffResult {
  readonly divergences: readonly ReplayDivergence[];
  readonly summary: ReplayDiffSummary;
}

export interface DiffReplayEventsOptions {
  /**
   * Cap le nombre de divergences stockees pour eviter une RAM
   * spike si les deux replays divergent totalement (ex: seed
   * different). Le `summary.divergenceCount` reste exact.
   */
  readonly maxDivergences?: number;
}

const DEFAULT_MAX_DIVERGENCES = 200;

/**
 * Compare deux events par valeur. type + displayAtMs + meta deep
 * equality (JSON canonical pour ignorer l'ordre des cles).
 */
function eventsEqual(a: MatchEvent, b: MatchEvent): boolean {
  if (a.type !== b.type) return false;
  if (a.displayAtMs !== b.displayAtMs) return false;
  return canonicalJson(a.meta) === canonicalJson(b.meta);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value, replacerSortedKeys);
}

function replacerSortedKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = obj[k];
        return acc;
      }, {});
  }
  return value;
}

export function diffReplayEvents(
  a: readonly MatchEvent[],
  b: readonly MatchEvent[],
  options: DiffReplayEventsOptions = {},
): ReplayDiffResult {
  const maxDivergences = options.maxDivergences ?? DEFAULT_MAX_DIVERGENCES;
  const divergences: ReplayDivergence[] = [];
  let divergenceCount = 0;
  let matchedCount = 0;
  let firstDivergenceIndex: number | null = null;
  const longest = Math.max(a.length, b.length);

  const pushDiv = (div: ReplayDivergence): void => {
    divergenceCount += 1;
    if (firstDivergenceIndex === null) firstDivergenceIndex = div.index;
    if (divergences.length < maxDivergences) {
      divergences.push(div);
    }
  };

  for (let i = 0; i < longest; i += 1) {
    const ea = i < a.length ? a[i] : null;
    const eb = i < b.length ? b[i] : null;
    if (ea && eb) {
      if (eventsEqual(ea, eb)) {
        matchedCount += 1;
      } else {
        pushDiv({ index: i, kind: 'mismatch', a: ea, b: eb });
      }
    } else if (!ea && eb) {
      pushDiv({ index: i, kind: 'missing_a', a: null, b: eb });
    } else if (ea && !eb) {
      pushDiv({ index: i, kind: 'missing_b', a: ea, b: null });
    }
  }

  return {
    divergences,
    summary: {
      totalA: a.length,
      totalB: b.length,
      matchedCount,
      divergenceCount,
      firstDivergenceIndex,
    },
  };
}

export interface FormatReplayDiffReportOptions {
  readonly maxLinesShown?: number;
}

const DEFAULT_MAX_LINES_SHOWN = 20;

function describeEvent(e: MatchEvent | null): string {
  if (!e) return '(none)';
  const metaSummary = canonicalJson(e.meta).slice(0, 80);
  return `${e.type} @${e.displayAtMs}ms ${metaSummary}`;
}

export function formatReplayDiffReport(
  result: ReplayDiffResult,
  options: FormatReplayDiffReportOptions = {},
): string {
  const max = options.maxLinesShown ?? DEFAULT_MAX_LINES_SHOWN;
  const { summary, divergences } = result;
  const lines: string[] = [
    '=== Replay diff ===',
    `  totalA=${summary.totalA}  totalB=${summary.totalB}  matched=${summary.matchedCount}  divergences=${summary.divergenceCount}  firstDivergenceIndex=${summary.firstDivergenceIndex ?? 'none'}`,
    '',
  ];
  if (divergences.length === 0) {
    lines.push('  (no divergence)');
    return lines.join('\n');
  }
  const visible = divergences.slice(0, max);
  for (const d of visible) {
    lines.push(
      `  index=${d.index}  ${d.kind}\n    a: ${describeEvent(d.a)}\n    b: ${describeEvent(d.b)}`,
    );
  }
  if (divergences.length > max) {
    lines.push(`  ... (${divergences.length - max} more)`);
  } else if (summary.divergenceCount > divergences.length) {
    lines.push(
      `  ... (${summary.divergenceCount - divergences.length} more — capped by maxDivergences)`,
    );
  }
  return lines.join('\n');
}
