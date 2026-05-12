/**
 * Sprint Q lot Q.B.3 — Service fan predictions thread.
 *
 * Mecaniques :
 *  - createOrUpdatePrediction : upsert tant que match.status='scheduled'.
 *  - listPredictions : public (newest-first).
 *  - settlePredictions : appele au completion match. Pour chaque
 *    prediction non-scored, applique l'heuristique scoring (pur) et
 *    persiste `score` + `scoredAt`.
 *  - getSeerLeaderboard : top users par count 'perfect' sur 7j.
 *
 * Heuristique pure (testable sans I/O) :
 *   - winnerMatched : body mentionne (case-insensitive) home OR away
 *     team (slug ou name) ET outcome matche le contexte (mentionne
 *     l'equipe winner du match).
 *   - scoreMatched : body contient "X-Y" ou "X to Y" exact ou ±0
 *     vs scoreHome/scoreAway reels.
 *   - score = 'perfect' si les deux ; 'winner' si seulement winner ;
 *     'wrong' sinon.
 */

import { prisma } from "../prisma";

export const MAX_BODY_LENGTH = 200;
export const MIN_BODY_LENGTH = 3;
export const SEER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PredictionErrorCode =
  | "MATCH_NOT_FOUND"
  | "MATCH_LOCKED"
  | "BODY_EMPTY"
  | "BODY_TOO_LONG"
  | "NOT_OWNER"
  | "PREDICTION_NOT_FOUND";

export class PredictionError extends Error {
  constructor(
    public readonly code: PredictionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PredictionError";
  }
}

export type PredictionScore = "perfect" | "winner" | "wrong";

export interface PredictionContext {
  readonly homeTeamSlug: string;
  readonly homeTeamName: string;
  readonly awayTeamSlug: string;
  readonly awayTeamName: string;
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly outcome: "home" | "away" | "draw";
}

function normalizeBody(body: string): string {
  return body.toLowerCase();
}

function bodyMentions(body: string, terms: ReadonlyArray<string>): boolean {
  const normalized = normalizeBody(body);
  return terms.some((term) => {
    const t = term.toLowerCase().trim();
    if (t.length === 0) return false;
    return normalized.includes(t);
  });
}

interface ParsedScore {
  readonly first: number;
  readonly second: number;
}

/**
 * Extract un score numerique du body. Cherche "X-Y", "X to Y",
 * "X vs Y", "X td Y", etc. Retourne le premier match trouve.
 */
export function parseScoreFromBody(body: string): ParsedScore | null {
  const normalized = normalizeBody(body);
  // Pattern: 1+ digit, separator (- _ / : "to" "vs" "td(s)" "a"),
  // 1+ digit.
  const regex =
    /\b(\d{1,2})\s*(?:-|–|—|to|vs|\/|:|tds?|a)\s*(\d{1,2})\b/iu;
  const m = normalized.match(regex);
  if (!m) return null;
  const first = Number.parseInt(m[1], 10);
  const second = Number.parseInt(m[2], 10);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    first < 0 ||
    second < 0 ||
    first > 20 ||
    second > 20
  ) {
    return null;
  }
  return { first, second };
}

/** Determine la team gagnante du context. Renvoie le couple slug/name
 *  ou null pour un nul. */
function winnerTeamTerms(
  ctx: PredictionContext,
): ReadonlyArray<string> | null {
  if (ctx.outcome === "draw") return null;
  if (ctx.outcome === "home") return [ctx.homeTeamSlug, ctx.homeTeamName];
  return [ctx.awayTeamSlug, ctx.awayTeamName];
}

/**
 * Score une prediction. 100% pure. Heuristique :
 *  - Mention de l'equipe gagnante (slug ou name) → winnerMatched.
 *    Pour un match nul, on accepte si body contient "draw" / "nul"
 *    / "egalite".
 *  - Score X-Y match exactement scoreHome-scoreAway (ou inverse si
 *    le user a ecrit dans l'ordre away-home, on tente les 2).
 *  - perfect = winnerMatched && scoreMatched
 *  - winner  = winnerMatched only
 *  - wrong   = neither
 */
export function scorePrediction(
  body: string,
  ctx: PredictionContext,
): PredictionScore {
  const winnerTerms = winnerTeamTerms(ctx);
  const drawTerms = ["draw", "nul", "egalite", "égalité"];
  const winnerMatched =
    winnerTerms !== null
      ? bodyMentions(body, winnerTerms)
      : bodyMentions(body, drawTerms);

  const parsed = parseScoreFromBody(body);
  const scoreMatched =
    parsed !== null &&
    ((parsed.first === ctx.scoreHome && parsed.second === ctx.scoreAway) ||
      (parsed.first === ctx.scoreAway && parsed.second === ctx.scoreHome));

  if (winnerMatched && scoreMatched) return "perfect";
  if (winnerMatched) return "winner";
  return "wrong";
}

function validateBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < MIN_BODY_LENGTH) {
    throw new PredictionError(
      "BODY_EMPTY",
      `Prediction trop courte (min ${MIN_BODY_LENGTH} chars)`,
    );
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw new PredictionError(
      "BODY_TOO_LONG",
      `Prediction depasse ${MAX_BODY_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

export interface PredictionView {
  readonly id: string;
  readonly matchId: string;
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly body: string;
  readonly score: PredictionScore | null;
  readonly createdAt: string;
  readonly scoredAt: string | null;
}

interface PredictionRow {
  id: string;
  matchId: string;
  userId: string;
  body: string;
  score: string | null;
  scoredAt: Date | null;
  createdAt: Date;
  user: { name: string | null; email: string };
}

function toView(row: PredictionRow): PredictionView {
  return {
    id: row.id,
    matchId: row.matchId,
    userId: row.userId,
    userName: row.user.name,
    userEmail: row.user.email,
    body: row.body,
    score: (row.score as PredictionScore | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    scoredAt: row.scoredAt ? row.scoredAt.toISOString() : null,
  };
}

export interface CreateOrUpdateInput {
  readonly matchId: string;
  readonly userId: string;
  readonly body: string;
}

export interface CreateOrUpdateResult {
  readonly prediction: PredictionView;
  readonly isUpdate: boolean;
}

export async function createOrUpdatePrediction(
  input: CreateOrUpdateInput,
): Promise<CreateOrUpdateResult> {
  const trimmed = validateBody(input.body);

  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: input.matchId },
    select: { id: true, status: true },
  })) as { id: string; status: string } | null;
  if (!match) {
    throw new PredictionError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${input.matchId}' introuvable`,
    );
  }
  if (match.status !== "scheduled") {
    throw new PredictionError(
      "MATCH_LOCKED",
      "Predictions fermees : le match a deja commence ou est termine",
    );
  }

  const existing = (await prisma.proMatchPrediction.findUnique({
    where: {
      matchId_userId: { matchId: input.matchId, userId: input.userId },
    },
    select: { id: true },
  })) as { id: string } | null;

  const upserted = (await prisma.proMatchPrediction.upsert({
    where: {
      matchId_userId: { matchId: input.matchId, userId: input.userId },
    },
    update: { body: trimmed },
    create: {
      matchId: input.matchId,
      userId: input.userId,
      body: trimmed,
    },
    select: {
      id: true,
      matchId: true,
      userId: true,
      body: true,
      score: true,
      scoredAt: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as PredictionRow;

  return { prediction: toView(upserted), isUpdate: existing !== null };
}

export async function listPredictions(
  matchId: string,
  limit: number = 50,
): Promise<readonly PredictionView[]> {
  const cap = Math.min(200, Math.max(1, limit));
  const rows = (await prisma.proMatchPrediction.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    take: cap,
    select: {
      id: true,
      matchId: true,
      userId: true,
      body: true,
      score: true,
      scoredAt: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as PredictionRow[];

  return rows.map(toView);
}

/**
 * Settle toutes les predictions non-scored d'un match. Idempotent :
 * les predictions deja scored sont skip.
 *
 * Pour chaque prediction, applique scorePrediction(body, ctx). Persist
 * en batch via Promise.all.
 */
export interface SettlePredictionsInput {
  readonly matchId: string;
  readonly ctx: PredictionContext;
}

export interface SettlePredictionsResult {
  readonly matchId: string;
  readonly settled: number;
  readonly perfect: number;
  readonly winner: number;
  readonly wrong: number;
}

export async function settlePredictions(
  input: SettlePredictionsInput,
): Promise<SettlePredictionsResult> {
  const pending = (await prisma.proMatchPrediction.findMany({
    where: { matchId: input.matchId, score: null },
    select: { id: true, body: true },
  })) as Array<{ id: string; body: string }>;

  if (pending.length === 0) {
    return {
      matchId: input.matchId,
      settled: 0,
      perfect: 0,
      winner: 0,
      wrong: 0,
    };
  }

  const now = new Date();
  let perfect = 0;
  let winner = 0;
  let wrong = 0;

  for (const p of pending) {
    const score = scorePrediction(p.body, input.ctx);
    if (score === "perfect") perfect += 1;
    else if (score === "winner") winner += 1;
    else wrong += 1;

    await prisma.proMatchPrediction.update({
      where: { id: p.id },
      data: { score, scoredAt: now },
    });
  }

  return {
    matchId: input.matchId,
    settled: pending.length,
    perfect,
    winner,
    wrong,
  };
}

export interface SeerLeaderboardEntry {
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly perfectCount: number;
  readonly winnerCount: number;
  readonly totalScored: number;
}

/**
 * Top "Seers" sur les 7 derniers jours : compte de predictions 'perfect'
 * descendant. Tie-break par 'winner' count, puis nom.
 */
export async function getSeerLeaderboard(
  limit: number = 10,
): Promise<readonly SeerLeaderboardEntry[]> {
  const sinceAt = new Date(Date.now() - SEER_WINDOW_MS);
  const rows = (await prisma.proMatchPrediction.findMany({
    where: {
      score: { not: null },
      scoredAt: { gte: sinceAt },
    },
    select: {
      userId: true,
      score: true,
      user: { select: { name: true, email: true } },
    },
  })) as Array<{
    userId: string;
    score: string | null;
    user: { name: string | null; email: string };
  }>;

  if (rows.length === 0) return [];

  const byUser = new Map<
    string,
    {
      userName: string | null;
      userEmail: string;
      perfect: number;
      winner: number;
      wrong: number;
    }
  >();
  for (const r of rows) {
    if (!byUser.has(r.userId)) {
      byUser.set(r.userId, {
        userName: r.user.name,
        userEmail: r.user.email,
        perfect: 0,
        winner: 0,
        wrong: 0,
      });
    }
    const b = byUser.get(r.userId)!;
    if (r.score === "perfect") b.perfect += 1;
    else if (r.score === "winner") b.winner += 1;
    else b.wrong += 1;
  }

  const entries: SeerLeaderboardEntry[] = [];
  for (const [userId, b] of byUser) {
    entries.push({
      userId,
      userName: b.userName,
      userEmail: b.userEmail,
      perfectCount: b.perfect,
      winnerCount: b.winner,
      totalScored: b.perfect + b.winner + b.wrong,
    });
  }
  entries.sort((a, b) => {
    if (b.perfectCount !== a.perfectCount) {
      return b.perfectCount - a.perfectCount;
    }
    if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
    const nA = a.userName ?? a.userEmail;
    const nB = b.userName ?? b.userEmail;
    return nA.localeCompare(nB);
  });

  return entries.slice(0, Math.max(1, limit));
}

/** Soft delete d'une prediction par son auteur. */
export async function deletePrediction(
  matchId: string,
  userId: string,
): Promise<void> {
  const existing = (await prisma.proMatchPrediction.findUnique({
    where: { matchId_userId: { matchId, userId } },
    select: { id: true },
  })) as { id: string } | null;
  if (!existing) {
    throw new PredictionError(
      "PREDICTION_NOT_FOUND",
      "Aucune prediction a supprimer",
    );
  }
  await prisma.proMatchPrediction.delete({ where: { id: existing.id } });
}
