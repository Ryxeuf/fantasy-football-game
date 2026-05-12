/**
 * Sprint Q lot Q.D.1 — Service pour les mini-ligues de pronostics
 * privees.
 *
 * Responsabilites :
 *  - Creer une ligue (avec generation joinCode unique)
 *  - Rejoindre via code
 *  - Lister les membres et calculer le leaderboard
 *  - Submit / update un pick (upsert tant que match scheduled)
 *  - Settle les picks au completion d'un match (set result/correct)
 *
 * Modeles utilises : ProPredictionLeague, ProPredictionLeagueMember,
 * ProPredictionPick. Erreurs typees via `PredictionLeagueError`.
 */

import { prisma } from "../prisma";

export type PredictionLeagueErrorCode =
  | "LEAGUE_NOT_FOUND"
  | "MATCH_NOT_FOUND"
  | "JOIN_CODE_INVALID"
  | "NOT_MEMBER"
  | "ALREADY_MEMBER"
  | "MATCH_LOCKED"
  | "INVALID_SELECTION"
  | "INVALID_INPUT"
  | "OWNER_CANNOT_LEAVE";

export class PredictionLeagueError extends Error {
  constructor(
    public readonly code: PredictionLeagueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PredictionLeagueError";
  }
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
const JOIN_CODE_LENGTH = 8;
const MAX_GENERATION_RETRIES = 5;

export function generateJoinCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[Math.floor(rng() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export type PickSelection = "home" | "draw" | "away";

export function isValidSelection(s: string): s is PickSelection {
  return s === "home" || s === "draw" || s === "away";
}

/** Determine le resultat d'un match a partir de ses scores. */
export function computeMatchResult(
  scoreHome: number,
  scoreAway: number,
): PickSelection {
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  return "draw";
}

export interface CreateLeagueInput {
  readonly name: string;
  readonly ownerId: string;
  readonly isPrivate?: boolean;
}

export interface CreateLeagueResult {
  readonly leagueId: string;
  readonly joinCode: string;
}

/**
 * Cree une ligue + auto-ajoute le owner comme membre.
 *
 * Le `joinCode` est genere automatiquement et garanti unique. En cas
 * de collision (extremement rare avec 32^8 ≈ 1.1e12 combinaisons),
 * on retry jusqu'a 5 fois avant d'echouer.
 */
export async function createLeague(
  input: CreateLeagueInput,
): Promise<CreateLeagueResult> {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 50) {
    throw new PredictionLeagueError(
      "INVALID_INPUT",
      "Le nom de la ligue doit faire entre 3 et 50 caracteres",
    );
  }

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await prisma.proPredictionLeague.findUnique({
      where: { joinCode },
      select: { id: true },
    });
    if (existing) continue;

    const created = await prisma.proPredictionLeague.create({
      data: {
        name,
        ownerId: input.ownerId,
        joinCode,
        isPrivate: input.isPrivate ?? true,
        members: {
          create: { userId: input.ownerId },
        },
      },
      select: { id: true, joinCode: true },
    });
    return { leagueId: created.id, joinCode: created.joinCode };
  }

  throw new PredictionLeagueError(
    "INVALID_INPUT",
    "Impossible de generer un code unique, reessayez",
  );
}

export interface JoinLeagueResult {
  readonly leagueId: string;
  readonly leagueName: string;
}

/** Rejoint une ligue via son joinCode. Idempotent si deja membre. */
export async function joinLeagueByCode(
  joinCode: string,
  userId: string,
): Promise<JoinLeagueResult> {
  const normalized = joinCode.trim().toUpperCase();
  if (normalized.length !== JOIN_CODE_LENGTH) {
    throw new PredictionLeagueError(
      "JOIN_CODE_INVALID",
      "Code invalide",
    );
  }
  const league = await prisma.proPredictionLeague.findUnique({
    where: { joinCode: normalized },
    select: { id: true, name: true },
  });
  if (!league) {
    throw new PredictionLeagueError("JOIN_CODE_INVALID", "Code introuvable");
  }
  const existing = await prisma.proPredictionLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.proPredictionLeagueMember.create({
      data: { leagueId: league.id, userId },
    });
  }
  return { leagueId: league.id, leagueName: league.name };
}

/** Verifie qu'un user est membre d'une ligue. Throws sinon. */
export async function assertMember(
  leagueId: string,
  userId: string,
): Promise<void> {
  const membership = await prisma.proPredictionLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new PredictionLeagueError(
      "NOT_MEMBER",
      "Vous n'etes pas membre de cette ligue",
    );
  }
}

export interface SubmitPickInput {
  readonly leagueId: string;
  readonly userId: string;
  readonly matchId: string;
  readonly selection: string;
}

/**
 * Submit ou update un pick. Le match doit etre `scheduled` (pas
 * encore commence) ; toute autre statut renvoie MATCH_LOCKED.
 *
 * Verifie aussi que l'utilisateur est membre de la ligue.
 */
export async function submitPick(input: SubmitPickInput): Promise<{
  pickId: string;
  selection: PickSelection;
  isUpdate: boolean;
}> {
  if (!isValidSelection(input.selection)) {
    throw new PredictionLeagueError(
      "INVALID_SELECTION",
      "selection doit etre 'home', 'draw' ou 'away'",
    );
  }
  await assertMember(input.leagueId, input.userId);

  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: input.matchId },
    select: { id: true, status: true },
  });
  if (!match) {
    throw new PredictionLeagueError(
      "MATCH_NOT_FOUND",
      "Match introuvable",
    );
  }
  if (match.status !== "scheduled") {
    throw new PredictionLeagueError(
      "MATCH_LOCKED",
      "Match deja commence ou termine — picks fermes",
    );
  }

  const existing = await prisma.proPredictionPick.findUnique({
    where: {
      leagueId_userId_matchId: {
        leagueId: input.leagueId,
        userId: input.userId,
        matchId: input.matchId,
      },
    },
    select: { id: true },
  });

  const upserted = await prisma.proPredictionPick.upsert({
    where: {
      leagueId_userId_matchId: {
        leagueId: input.leagueId,
        userId: input.userId,
        matchId: input.matchId,
      },
    },
    update: { selection: input.selection },
    create: {
      leagueId: input.leagueId,
      userId: input.userId,
      matchId: input.matchId,
      selection: input.selection,
    },
    select: { id: true, selection: true },
  });

  return {
    pickId: upserted.id,
    selection: upserted.selection as PickSelection,
    isUpdate: existing !== null,
  };
}

export interface LeaderboardEntry {
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly totalPicks: number;
  readonly correctPicks: number;
  readonly accuracy: number;
}

/**
 * Calcule le leaderboard d'une ligue. Pour chaque membre :
 *  - totalPicks = nombre de picks settle (correct != null)
 *  - correctPicks = nombre de picks settle ET correct=true
 *  - accuracy = correctPicks / totalPicks (0 si totalPicks=0)
 *
 * Trie par correctPicks desc, puis accuracy desc, puis nom asc.
 */
export async function getLeagueLeaderboard(
  leagueId: string,
): Promise<LeaderboardEntry[]> {
  const members = (await prisma.proPredictionLeagueMember.findMany({
    where: { leagueId },
    select: {
      userId: true,
      user: { select: { name: true, email: true } },
    },
  })) as Array<{
    userId: string;
    user: { name: string | null; email: string };
  }>;

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.userId);
  const picks = (await prisma.proPredictionPick.findMany({
    where: {
      leagueId,
      userId: { in: memberIds },
      correct: { not: null },
    },
    select: { userId: true, correct: true },
  })) as Array<{ userId: string; correct: boolean | null }>;

  const stats = new Map<string, { total: number; correct: number }>();
  for (const m of members) {
    stats.set(m.userId, { total: 0, correct: 0 });
  }
  for (const p of picks) {
    const s = stats.get(p.userId);
    if (!s) continue;
    s.total += 1;
    if (p.correct === true) s.correct += 1;
  }

  const entries: LeaderboardEntry[] = members.map((m) => {
    const s = stats.get(m.userId) ?? { total: 0, correct: 0 };
    const accuracy = s.total > 0 ? s.correct / s.total : 0;
    return {
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      totalPicks: s.total,
      correctPicks: s.correct,
      accuracy,
    };
  });

  entries.sort((a, b) => {
    if (b.correctPicks !== a.correctPicks) {
      return b.correctPicks - a.correctPicks;
    }
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const nameA = a.userName ?? a.userEmail;
    const nameB = b.userName ?? b.userEmail;
    return nameA.localeCompare(nameB);
  });

  return entries;
}

export interface SettlePicksInput {
  readonly matchId: string;
  /** Resultat du match ("home" | "draw" | "away"). Au point d'integration,
   *  c'est typiquement `match.outcome` qui est deja calcule. Pour les
   *  consommateurs qui n'ont que les scores, utiliser `computeMatchResult`
   *  pour obtenir cette valeur. */
  readonly result: PickSelection;
}

export interface SettlePicksResult {
  readonly matchId: string;
  readonly result: PickSelection;
  readonly picksSettled: number;
  readonly correctPicks: number;
}

/**
 * Settle tous les picks d'un match : set `result` et `correct` sur
 * chaque ProPredictionPick referencant ce match. Idempotent (re-appel
 * met juste a jour avec les memes valeurs).
 */
export async function settlePicksForMatch(
  input: SettlePicksInput,
): Promise<SettlePicksResult> {
  const picks = (await prisma.proPredictionPick.findMany({
    where: { matchId: input.matchId },
    select: { id: true, selection: true },
  })) as Array<{ id: string; selection: string }>;

  let correctPicks = 0;
  for (const pick of picks) {
    const isCorrect = pick.selection === input.result;
    if (isCorrect) correctPicks += 1;
    await prisma.proPredictionPick.update({
      where: { id: pick.id },
      data: { result: input.result, correct: isCorrect },
    });
  }

  return {
    matchId: input.matchId,
    result: input.result,
    picksSettled: picks.length,
    correctPicks,
  };
}
