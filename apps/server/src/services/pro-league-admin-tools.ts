/**
 * Service admin tools — wrappers backend pour les CLI sim-engine
 * (Lot 4.F).
 *
 * Pourquoi
 * --------
 * `pnpm sim:compare-versions` (PR #722) et `pnpm sim:diff-replays`
 * (PR #725) sont des CLIs utiles aux developpeurs locaux, mais le
 * release manager / admin operationnel n'a pas toujours acces au
 * shell. Ce service expose les memes capacites via des routes admin
 * authentifiees pour pouvoir piloter depuis le navigateur.
 *
 * - `runVersionComparison({ baseRaw, headRaw })` : valide les 2 JSON
 *   baselines via `parseBenchBaseline` (Zod) puis delegue a
 *   `compareBaselines`. Erreur typee `INVALID_BASELINE` si schema KO.
 * - `runReplayDiff({ matchIdA, matchIdB })` : lit les 2 replays de la
 *   DB via `Replay.payload`, decompresse, runne `diffReplayEvents`.
 *   Renvoie aussi les metadonnees match (engineVer, scores) pour
 *   contextualiser le diff cote UI.
 *
 * Pure cote logique, I/O cote replay diff (lecture DB + decompression).
 */

import {
  compareBaselines,
  decompressEvents,
  diffReplayEvents,
  parseBenchBaseline,
  type MatchEvent,
  type ReplayDiffResult,
  type VersionComparisonResult,
} from "@bb/sim-engine";

import { prisma } from "../prisma";

export type AdminToolsErrorCode =
  | "INVALID_BASELINE"
  | "INVALID_INPUT"
  | "MATCH_NOT_FOUND"
  | "REPLAY_NOT_FOUND";

export class AdminToolsError extends Error {
  constructor(
    public readonly code: AdminToolsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminToolsError";
  }
}

export interface RunVersionComparisonInput {
  readonly baseRaw: unknown;
  readonly headRaw: unknown;
  readonly warnThreshold?: number;
  readonly criticalThreshold?: number;
}

export function runVersionComparison(
  input: RunVersionComparisonInput,
): VersionComparisonResult {
  let base, head;
  try {
    base = parseBenchBaseline(input.baseRaw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new AdminToolsError(
      "INVALID_BASELINE",
      `INVALID_BASELINE: base — ${msg}`,
    );
  }
  try {
    head = parseBenchBaseline(input.headRaw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new AdminToolsError(
      "INVALID_BASELINE",
      `INVALID_BASELINE: head — ${msg}`,
    );
  }
  return compareBaselines(base, head, {
    warnThreshold: input.warnThreshold,
    criticalThreshold: input.criticalThreshold,
  });
}

export interface RunReplayDiffInput {
  readonly matchIdA: string;
  readonly matchIdB: string;
  readonly maxDivergences?: number;
}

export interface MatchMeta {
  readonly id: string;
  readonly engineVer: string | null;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
}

export interface RunReplayDiffResult {
  readonly matchA: MatchMeta;
  readonly matchB: MatchMeta;
  readonly diff: ReplayDiffResult;
}

async function loadMatchAndReplay(
  matchId: string,
): Promise<{ match: MatchMeta; events: readonly MatchEvent[] }> {
  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { id: true, engineVer: true, scoreHome: true, scoreAway: true },
  })) as MatchMeta | null;
  if (!match) {
    throw new AdminToolsError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  const replay = (await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true },
  })) as { payload: Buffer } | null;
  if (!replay) {
    throw new AdminToolsError(
      "REPLAY_NOT_FOUND",
      `Replay manquant pour match '${matchId}'`,
    );
  }
  const events = (await decompressEvents(replay.payload)) as readonly MatchEvent[];
  return { match, events };
}

export async function runReplayDiff(
  input: RunReplayDiffInput,
): Promise<RunReplayDiffResult> {
  if (input.matchIdA === input.matchIdB) {
    throw new AdminToolsError(
      "INVALID_INPUT",
      "matchIdA et matchIdB doivent etre distincts",
    );
  }
  const a = await loadMatchAndReplay(input.matchIdA);
  const b = await loadMatchAndReplay(input.matchIdB);
  const diff = diffReplayEvents(a.events, b.events, {
    maxDivergences: input.maxDivergences,
  });
  return { matchA: a.match, matchB: b.match, diff };
}
