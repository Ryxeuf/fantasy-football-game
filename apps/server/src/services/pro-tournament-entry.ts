/**
 * Service tournois Pro League — Sprint P (Lot P.B.2).
 *
 * **Sink Crowns** : un user paie un entry fee (100 Crowns par defaut,
 * configurable par tournoi) pour s'inscrire. Sert a equilibrer
 * l'inflation introduite par les daily bonus + paris gagnes.
 *
 * Idempotent : un user ne peut s'inscrire qu'une fois par tournoi
 * (`unique[tournamentId, userId]`). Re-appel renvoie l'entry existante
 * sans nouveau debit.
 *
 * Atomique : debit wallet + insert entry + tx history dans la meme
 * `$transaction`. Si l'insert echoue (unique violation, etc.), le
 * debit est rollback.
 *
 * Status workflow : seul `open` autorise les inscriptions. Les autres
 * (`closed`, `in_progress`, `completed`) renvoient
 * `TOURNAMENT_CLOSED`. `maxEntries` (si set) cap le nombre d'entries
 * — au-dela, le service renvoie `TOURNAMENT_FULL` sans changer le
 * status (l'admin decide quand fermer manuellement).
 */

import { prisma } from "../prisma";
import { InsufficientFundsError, getOrCreateWallet } from "./pro-wallet";

export const DEFAULT_ENTRY_FEE_CROWNS = 100;

export type TournamentErrorCode =
  | "TOURNAMENT_NOT_FOUND"
  | "TOURNAMENT_CLOSED"
  | "TOURNAMENT_FULL";

export class TournamentError extends Error {
  constructor(
    public readonly code: TournamentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TournamentError";
  }
}

export interface EnterTournamentOutcome {
  /** True si une nouvelle entry a ete creee (et fee debite). */
  readonly granted: boolean;
  readonly entryId: string;
  readonly tournamentId: string;
  readonly paidCrowns: number;
  /** Solde apres operation. */
  readonly balance: number;
  readonly createdAt: string;
}

/**
 * Inscrit `userId` au tournoi `tournamentId`. Idempotent.
 *
 * @throws {TournamentError} TOURNAMENT_NOT_FOUND si l'id n'existe pas.
 * @throws {TournamentError} TOURNAMENT_CLOSED si status != "open".
 * @throws {TournamentError} TOURNAMENT_FULL si maxEntries atteint.
 * @throws {InsufficientFundsError} si solde < fee.
 */
export async function enterTournament(
  userId: string,
  tournamentId: string,
): Promise<EnterTournamentOutcome> {
  const tournament = await prisma.proTournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      entryFeeCrowns: true,
      maxEntries: true,
      status: true,
    },
  });
  if (!tournament) {
    throw new TournamentError(
      "TOURNAMENT_NOT_FOUND",
      `Tournoi '${tournamentId}' introuvable.`,
    );
  }
  if ((tournament.status as string) !== "open") {
    throw new TournamentError(
      "TOURNAMENT_CLOSED",
      "Les inscriptions a ce tournoi sont fermees.",
    );
  }

  // Verification idempotence (court-circuit avant transaction debit).
  const existing = await prisma.proTournamentEntry.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true, paidCrowns: true, createdAt: true },
  });
  if (existing) {
    const w = await getOrCreateWallet(userId);
    return {
      granted: false,
      entryId: existing.id as string,
      tournamentId,
      paidCrowns: existing.paidCrowns as number,
      balance: w.crowns,
      createdAt: (existing.createdAt as Date).toISOString(),
    };
  }

  // Verification cap maxEntries (best-effort hors transaction ; un
  // race condition peut creer une entry de plus, considere acceptable
  // pour ce sink).
  const maxEntries = tournament.maxEntries as number | null;
  if (maxEntries !== null && maxEntries !== undefined) {
    const currentCount = await prisma.proTournamentEntry.count({
      where: { tournamentId },
    });
    if (currentCount >= maxEntries) {
      throw new TournamentError(
        "TOURNAMENT_FULL",
        `Tournoi complet (${maxEntries} inscrits).`,
      );
    }
  }

  await getOrCreateWallet(userId);

  const fee = tournament.entryFeeCrowns as number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await prisma.$transaction(async (tx: any) => {
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    if (current < fee) {
      throw new InsufficientFundsError(current, fee);
    }
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current - fee },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type: "SINK",
        amount: -fee,
        ref: `tournament-entry:${tournamentId}`,
      },
    });
    const created = await tx.proTournamentEntry.create({
      data: {
        tournamentId,
        userId,
        paidCrowns: fee,
      },
      select: { id: true, createdAt: true },
    });
    return {
      entryId: created.id as string,
      createdAt: (created.createdAt as Date).toISOString(),
      balance: updated.crowns as number,
    };
  })) as { entryId: string; createdAt: string; balance: number };

  return {
    granted: true,
    entryId: result.entryId,
    tournamentId,
    paidCrowns: fee,
    balance: result.balance,
    createdAt: result.createdAt,
  };
}

export interface TournamentSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly entryFeeCrowns: number;
  readonly maxEntries: number | null;
  readonly status: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly entriesCount: number;
  readonly createdAt: string;
}

/**
 * Liste les tournois ouverts (`status='open'`) avec count d'entries.
 * Trie par createdAt desc.
 */
export async function listOpenTournaments(): Promise<TournamentSummary[]> {
  const rows = await prisma.proTournament.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      entryFeeCrowns: true,
      maxEntries: true,
      status: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows as any[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    entryFeeCrowns: r.entryFeeCrowns as number,
    maxEntries: (r.maxEntries as number | null) ?? null,
    status: r.status as string,
    startsAt: r.startsAt ? (r.startsAt as Date).toISOString() : null,
    endsAt: r.endsAt ? (r.endsAt as Date).toISOString() : null,
    entriesCount: (r._count?.entries as number | undefined) ?? 0,
    createdAt: (r.createdAt as Date).toISOString(),
  }));
}

export interface CreateTournamentInput {
  readonly slug: string;
  readonly name: string;
  readonly description?: string | null;
  readonly entryFeeCrowns?: number;
  readonly maxEntries?: number | null;
  readonly startsAt?: Date | null;
  readonly endsAt?: Date | null;
}

/**
 * Cree un nouveau tournoi (admin). Status par defaut `open`. Throw si
 * `slug` deja utilise (unique constraint).
 */
export async function createTournament(
  input: CreateTournamentInput,
): Promise<{ id: string; slug: string }> {
  const created = await prisma.proTournament.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      entryFeeCrowns: input.entryFeeCrowns ?? DEFAULT_ENTRY_FEE_CROWNS,
      maxEntries: input.maxEntries ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    },
    select: { id: true, slug: true },
  });
  return { id: created.id as string, slug: created.slug as string };
}
