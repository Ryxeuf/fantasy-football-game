/**
 * Service NFL Fantasy Draft Session V2 — encheres secretes asynchrones,
 * MPG-style.
 *
 * Une session de mercato = fenetre temporelle pendant laquelle les
 * coachs posent des bids caches sur des joueurs. A la deadline, la
 * resolution :
 *   - pour chaque player, trouve le bid le plus haut
 *   - tiebreaker = roster size asc, puis budgetRemaining asc (le coach
 *     le moins servi/le plus pauvre gagne en cas d'egalite stricte)
 *   - winner = roster updated (acquiredVia="mercato", tvCost=amount)
 *     + budget decremente du amount gagnant
 *   - losers = bid status="lost", budget non impacte (pas de decrement
 *     puisque non remporte)
 *
 * Le prix de base d'un player = sa cote indexee sur le total SPP
 * d'une saison de reference (computeBasePrice).
 *
 * Pas de confusion avec `nfl-fantasy-mercato.ts` qui gere les rerolls
 * et inducements en cours de saison (phase 2.F, conserve son nom).
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export type NflFantasyDraftSessionErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_OPEN"
  | "SESSION_ALREADY_RESOLVED"
  | "LEAGUE_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_NOT_IN_LEAGUE"
  | "PLAYER_NOT_FOUND"
  | "PLAYER_ALREADY_ON_ROSTER"
  | "BID_AMOUNT_BELOW_BASE_PRICE"
  | "BID_AMOUNT_EXCEEDS_BUDGET"
  | "BID_NOT_FOUND"
  | "FORBIDDEN_NOT_OWNER";

export class NflFantasyDraftSessionError extends Error {
  constructor(
    public readonly code: NflFantasyDraftSessionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyDraftSessionError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Pure helpers (testables sans DB)
// ────────────────────────────────────────────────────────────────────

/**
 * Calcule le prix de base d'un joueur d'apres ses stats SPP saison.
 *
 * Formule V2 :
 *   basePrice = clamp( round(totalSpp * 5), 50, 1500 )
 *
 * - Un joueur sans stats (rookie, 0 SPP) coute 50 TV (plancher).
 * - Un joueur a 100 SPP coute 500 TV (mid-tier).
 * - Un joueur a 300+ SPP coute 1500 TV (cap a ~30% du budget par
 *   defaut 5000 TV : evite qu'un seul coach claim 1 super-star + 10
 *   rookies sans tension).
 *
 * Pur, deterministe, testable.
 */
export function computeBasePrice(totalSpp: number): number {
  const raw = Math.round(totalSpp * 5);
  return Math.min(1500, Math.max(50, raw));
}

export interface BidInput {
  readonly bidId: string;
  readonly entryId: string;
  readonly playerId: string;
  readonly amount: number;
}

export interface EntryInput {
  readonly entryId: string;
  readonly rosterSize: number;
  readonly budgetRemaining: number;
}

export interface ResolutionOutcome {
  readonly playerId: string;
  readonly winnerBidId: string;
  readonly winnerEntryId: string;
  readonly winnerAmount: number;
  /** IDs des bids perdants pour ce player (a marquer "lost"). */
  readonly loserBidIds: ReadonlyArray<string>;
}

/**
 * Resolution pure d'une session : prend la liste des bids pending +
 * l'etat des entries, retourne pour chaque player convoite l'outcome.
 *
 * Tri tiebreaker (ordre, asc) :
 *   1. amount desc (le plus haut bid gagne)
 *   2. rosterSize asc (le coach le moins servi gagne en cas d'egalite)
 *   3. budgetRemaining asc (le coach le plus pauvre gagne sinon)
 *   4. entryId asc (deterministe pour les tests)
 */
export function resolveSessionBids(opts: {
  bids: ReadonlyArray<BidInput>;
  entries: ReadonlyArray<EntryInput>;
}): ResolutionOutcome[] {
  const entryById = new Map<string, EntryInput>();
  for (const e of opts.entries) entryById.set(e.entryId, e);

  const bidsByPlayer = new Map<string, BidInput[]>();
  for (const b of opts.bids) {
    const arr = bidsByPlayer.get(b.playerId) ?? [];
    arr.push(b);
    bidsByPlayer.set(b.playerId, arr);
  }

  const outcomes: ResolutionOutcome[] = [];
  for (const [, bids] of bidsByPlayer) {
    const sorted = [...bids].sort((a, b) => {
      if (a.amount !== b.amount) return b.amount - a.amount;
      const ea = entryById.get(a.entryId);
      const eb = entryById.get(b.entryId);
      const rosterA = ea?.rosterSize ?? Number.MAX_SAFE_INTEGER;
      const rosterB = eb?.rosterSize ?? Number.MAX_SAFE_INTEGER;
      if (rosterA !== rosterB) return rosterA - rosterB;
      const budgetA = ea?.budgetRemaining ?? Number.MAX_SAFE_INTEGER;
      const budgetB = eb?.budgetRemaining ?? Number.MAX_SAFE_INTEGER;
      if (budgetA !== budgetB) return budgetA - budgetB;
      return a.entryId < b.entryId ? -1 : 1;
    });
    const winner = sorted[0];
    const losers = sorted.slice(1).map((b) => b.bidId);
    outcomes.push({
      playerId: winner.playerId,
      winnerBidId: winner.bidId,
      winnerEntryId: winner.entryId,
      winnerAmount: winner.amount,
      loserBidIds: losers,
    });
  }

  // Tri deterministe pour les tests
  return outcomes.sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
}

// ────────────────────────────────────────────────────────────────────
// Services DB
// ────────────────────────────────────────────────────────────────────

export interface CreateSessionOpts {
  readonly leagueId: string;
  readonly opensAt: Date;
  readonly closesAt: Date;
}

export async function createDraftSession(
  opts: CreateSessionOpts,
): Promise<{
  id: string;
  sessionNumber: number;
  opensAt: Date;
  closesAt: Date;
}> {
  if (opts.closesAt.getTime() <= opts.opensAt.getTime()) {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_OPEN",
      "closesAt doit etre strictement apres opensAt",
    );
  }
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: opts.leagueId },
  });
  if (!league) {
    throw new NflFantasyDraftSessionError(
      "LEAGUE_NOT_FOUND",
      `League ${opts.leagueId} introuvable`,
    );
  }
  const last = await prisma.nflFantasyDraftSession.findFirst({
    where: { leagueId: opts.leagueId },
    orderBy: { sessionNumber: "desc" },
  });
  const sessionNumber = (last?.sessionNumber ?? 0) + 1;
  const session = await prisma.nflFantasyDraftSession.create({
    data: {
      leagueId: opts.leagueId,
      sessionNumber,
      opensAt: opts.opensAt,
      closesAt: opts.closesAt,
      status: "open",
    },
  });
  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    opensAt: session.opensAt,
    closesAt: session.closesAt,
  };
}

export interface PlaceBidOpts {
  readonly sessionId: string;
  readonly entryId: string;
  readonly playerId: string;
  readonly amount: number;
}

export async function placeBid(opts: PlaceBidOpts): Promise<{ id: string }> {
  const session = await prisma.nflFantasyDraftSession.findUnique({
    where: { id: opts.sessionId },
  });
  if (!session) {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_FOUND",
      `Session ${opts.sessionId} introuvable`,
    );
  }
  if (session.status !== "open") {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_OPEN",
      `Session ${opts.sessionId} n'est pas ouverte (status: ${session.status})`,
    );
  }
  if (session.closesAt.getTime() <= Date.now()) {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_OPEN",
      "La fenetre d'encheres est fermee",
    );
  }

  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: opts.entryId },
  });
  if (!entry) {
    throw new NflFantasyDraftSessionError(
      "ENTRY_NOT_FOUND",
      `Entry ${opts.entryId} introuvable`,
    );
  }
  if (entry.leagueId !== session.leagueId) {
    throw new NflFantasyDraftSessionError(
      "ENTRY_NOT_IN_LEAGUE",
      "L'entry n'appartient pas a la league de cette session",
    );
  }

  const player = await prisma.nflPlayer.findUnique({
    where: { id: opts.playerId },
    select: { id: true },
  });
  if (!player) {
    throw new NflFantasyDraftSessionError(
      "PLAYER_NOT_FOUND",
      `Player ${opts.playerId} introuvable`,
    );
  }

  const existingRoster = await prisma.nflFantasyRoster.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
  });
  if (existingRoster) {
    throw new NflFantasyDraftSessionError(
      "PLAYER_ALREADY_ON_ROSTER",
      `Player ${opts.playerId} deja sur ton roster`,
    );
  }

  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: session.leagueId },
    select: { seasonId: true },
  });
  const basePrice = await computeBasePriceForPlayer({
    playerId: opts.playerId,
    seasonId: league?.seasonId ?? "2025",
  });
  if (opts.amount < basePrice) {
    throw new NflFantasyDraftSessionError(
      "BID_AMOUNT_BELOW_BASE_PRICE",
      `Bid ${opts.amount} < prix de base ${basePrice}`,
    );
  }

  // Strategie : on autorise overbooking (somme bids > budget) car a la
  // resolution un coach ne gagne pas tous les bids. Mais on bloque si
  // amount seul depasse le budget restant.
  if (opts.amount > entry.budgetRemaining) {
    throw new NflFantasyDraftSessionError(
      "BID_AMOUNT_EXCEEDS_BUDGET",
      `Bid ${opts.amount} > budget restant ${entry.budgetRemaining}`,
    );
  }

  const upserted = await prisma.nflFantasyDraftBid.upsert({
    where: {
      sessionId_entryId_playerId: {
        sessionId: opts.sessionId,
        entryId: opts.entryId,
        playerId: opts.playerId,
      },
    },
    create: {
      sessionId: opts.sessionId,
      entryId: opts.entryId,
      playerId: opts.playerId,
      amount: opts.amount,
      status: "pending",
    },
    update: {
      amount: opts.amount,
      status: "pending",
    },
    select: { id: true },
  });
  return upserted;
}

export interface CancelBidOpts {
  readonly sessionId: string;
  readonly entryId: string;
  readonly playerId: string;
}

export async function cancelBid(opts: CancelBidOpts): Promise<void> {
  const session = await prisma.nflFantasyDraftSession.findUnique({
    where: { id: opts.sessionId },
    select: { status: true, closesAt: true },
  });
  if (!session) {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_FOUND",
      `Session ${opts.sessionId} introuvable`,
    );
  }
  if (session.status !== "open") {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_OPEN",
      `Session deja ${session.status}`,
    );
  }
  const bid = await prisma.nflFantasyDraftBid.findUnique({
    where: {
      sessionId_entryId_playerId: {
        sessionId: opts.sessionId,
        entryId: opts.entryId,
        playerId: opts.playerId,
      },
    },
  });
  if (!bid) {
    throw new NflFantasyDraftSessionError(
      "BID_NOT_FOUND",
      "Aucun bid actif a annuler",
    );
  }
  await prisma.nflFantasyDraftBid.delete({ where: { id: bid.id } });
}

/**
 * Liste les bids d'une entry (cache aux autres coachs). Permet a un
 * coach de voir ses encheres en cours.
 */
export async function listBidsForEntry(opts: {
  sessionId: string;
  entryId: string;
}): Promise<
  Array<{ id: string; playerId: string; amount: number; status: string }>
> {
  const bids = await prisma.nflFantasyDraftBid.findMany({
    where: { sessionId: opts.sessionId, entryId: opts.entryId },
    select: { id: true, playerId: true, amount: true, status: true },
    orderBy: { amount: "desc" },
  });
  return bids;
}

export interface ResolveResult {
  readonly sessionId: string;
  readonly resolvedAt: Date;
  readonly outcomes: ResolutionOutcome[];
}

/**
 * Resout une session : applique le tiebreaker, ajoute les joueurs aux
 * rosters gagnants, decremente leurs budgets, marque les bids
 * pending -> won/lost.
 */
export async function resolveSession(sessionId: string): Promise<ResolveResult> {
  const session = await prisma.nflFantasyDraftSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new NflFantasyDraftSessionError(
      "SESSION_NOT_FOUND",
      `Session ${sessionId} introuvable`,
    );
  }
  if (session.status === "resolved") {
    throw new NflFantasyDraftSessionError(
      "SESSION_ALREADY_RESOLVED",
      `Session ${sessionId} deja resolue`,
    );
  }

  const [bids, entries] = await Promise.all([
    prisma.nflFantasyDraftBid.findMany({
      where: { sessionId, status: "pending" },
    }),
    prisma.nflFantasyEntry.findMany({
      where: { leagueId: session.leagueId },
      include: { roster: { select: { playerId: true } } },
    }),
  ]);

  type EntryWithRoster = (typeof entries)[number];
  type BidRow = (typeof bids)[number];

  const outcomes = resolveSessionBids({
    bids: bids.map((b: BidRow) => ({
      bidId: b.id,
      entryId: b.entryId,
      playerId: b.playerId,
      amount: b.amount,
    })),
    entries: entries.map((e: EntryWithRoster) => ({
      entryId: e.id,
      rosterSize: e.roster.length,
      budgetRemaining: e.budgetRemaining,
    })),
  });

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const o of outcomes) {
    ops.push(
      prisma.nflFantasyDraftBid.update({
        where: { id: o.winnerBidId },
        data: { status: "won" },
      }),
    );
    for (const lid of o.loserBidIds) {
      ops.push(
        prisma.nflFantasyDraftBid.update({
          where: { id: lid },
          data: { status: "lost" },
        }),
      );
    }
    ops.push(
      prisma.nflFantasyRoster.create({
        data: {
          entryId: o.winnerEntryId,
          playerId: o.playerId,
          acquiredVia: "mercato",
          tvCost: o.winnerAmount,
        },
      }),
    );
    ops.push(
      prisma.nflFantasyEntry.update({
        where: { id: o.winnerEntryId },
        data: {
          budgetRemaining: { decrement: o.winnerAmount },
          totalTV: { increment: o.winnerAmount },
        },
      }),
    );
  }
  const resolvedAt = new Date();
  ops.push(
    prisma.nflFantasyDraftSession.update({
      where: { id: sessionId },
      data: { status: "resolved", resolvedAt },
    }),
  );

  await prisma.$transaction(ops);

  return { sessionId, resolvedAt, outcomes };
}

/**
 * Calcule le prix de base d'un player donne pour une saison donnee.
 * Utilise par les routes UI pour afficher "prix de base actuel" aux
 * coachs avant qu'ils bid.
 */
export async function computeBasePriceForPlayer(opts: {
  playerId: string;
  seasonId: string;
}): Promise<number> {
  const stats = await prisma.nflGameStat.findMany({
    where: {
      playerId: opts.playerId,
      game: { seasonId: opts.seasonId },
    },
    select: { computedSpp: true },
  });
  type StatRow = (typeof stats)[number];
  const totalSpp = stats.reduce(
    (acc: number, s: StatRow) => acc + (s.computedSpp ?? 0),
    0,
  );
  return computeBasePrice(totalSpp);
}

/**
 * Helper batch : prix de base pour une liste de players. Utile pour
 * peupler le catalogue UI sans N+1.
 */
export async function computeBasePricesForPlayers(opts: {
  playerIds: ReadonlyArray<string>;
  seasonId: string;
}): Promise<Map<string, number>> {
  if (opts.playerIds.length === 0) return new Map();
  const stats = await prisma.nflGameStat.groupBy({
    by: ["playerId"],
    where: {
      playerId: { in: [...opts.playerIds] },
      game: { seasonId: opts.seasonId },
    },
    _sum: { computedSpp: true },
  });
  type StatGroup = (typeof stats)[number];
  const result = new Map<string, number>();
  for (const pid of opts.playerIds) result.set(pid, computeBasePrice(0));
  for (const s of stats) {
    const total = s._sum.computedSpp ?? 0;
    result.set(s.playerId, computeBasePrice(total));
  }
  return result;
}
