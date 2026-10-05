/**
 * Admin des Couronnes (Crowns) et des wallets.
 *
 * Les Crowns n'ont qu'un support : `ProWallet` (solde) + `ProTransaction`
 * (journal append-only). Un coach SANS wallet a un solde de 0 partout
 * (`getBalance`), et le wallet se crée silencieusement au premier crédit —
 * l'absence de wallet n'était donc visible nulle part. Ce module la rend
 * visible (liste filtrable « avec / sans wallet ») et la corrige (création
 * unitaire ou en masse), en plus de la vue d'ensemble de la monnaie
 * (masse en circulation, flux par type, journal global).
 *
 * Créer un wallet n'écrit AUCUNE transaction : un wallet neuf vaut 0, et un
 * crédit passe par l'ajustement existant (`ADMIN_ADJUST`, raison visible du
 * coach).
 */

import { prisma } from "../prisma";
import { CROWNS_FLAG } from "./featureFlags";
import type { AdminWalletListQuery, AdminCrownsLedgerQuery, WalletStatusFilter } from "../schemas/crowns-admin.schemas";

export type CrownsAdminErrorCode = "user-not-found";

export class CrownsAdminError extends Error {
  constructor(
    public readonly code: CrownsAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CrownsAdminError";
  }
}

/** Taille d'un lot de création en masse, et plafond de lots par appel. */
export const CREATE_MISSING_BATCH = 500;
export const CREATE_MISSING_MAX_BATCHES = 20;

function prismaCode(e: unknown): unknown {
  return typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
}

function isUniqueViolation(e: unknown): boolean {
  return prismaCode(e) === "P2002";
}

/** P2003 : la clé étrangère `userId` ne vise plus personne (compte supprimé). */
function isForeignKeyViolation(e: unknown): boolean {
  return prismaCode(e) === "P2003";
}

function searchWhere(search: string | undefined): Record<string, unknown> {
  const s = search?.trim();
  if (!s) return {};
  const mode = process.env.TEST_SQLITE === "1" ? {} : { mode: "insensitive" as const };
  return {
    OR: [{ email: { contains: s, ...mode } }, { coachName: { contains: s, ...mode } }],
  };
}

/** Filtre Prisma `User` d'un statut de wallet (PUR). */
export function walletStatusWhere(status: WalletStatusFilter): Record<string, unknown> {
  switch (status) {
    case "with":
      return { proWallet: { isNot: null } };
    case "without":
      return { proWallet: { is: null } };
    default:
      return {};
  }
}

/* ── Wallets ─────────────────────────────────────────────────────────── */

export interface AdminWalletSummary {
  readonly crowns: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly transactions: number;
}

export interface AdminWalletRow {
  readonly id: string;
  readonly email: string;
  readonly coachName: string;
  readonly createdAt: string;
  /** `null` = le coach n'a pas de wallet. */
  readonly wallet: AdminWalletSummary | null;
}

export interface AdminWalletPage {
  readonly items: readonly AdminWalletRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  /** Compteurs sur la recherche courante, indépendants du filtre de statut. */
  readonly counts: { readonly all: number; readonly with: number; readonly without: number };
}

interface WalletUserRow {
  id: string;
  email: string;
  coachName: string;
  createdAt: Date;
  proWallet: {
    crowns: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { transactions: number };
  } | null;
}

export async function listCoachWallets(query: AdminWalletListQuery): Promise<AdminWalletPage> {
  const base = searchWhere(query.search);
  const where = { ...base, ...walletStatusWhere(query.status) };
  const [total, all, withWallet, users]: [number, number, number, WalletUserRow[]] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, ...walletStatusWhere("with") } }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        email: true,
        coachName: true,
        createdAt: true,
        proWallet: {
          select: {
            crowns: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { transactions: true } },
          },
        },
      },
    }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      coachName: u.coachName,
      createdAt: u.createdAt.toISOString(),
      wallet: u.proWallet
        ? {
            crowns: u.proWallet.crowns,
            createdAt: u.proWallet.createdAt.toISOString(),
            updatedAt: u.proWallet.updatedAt.toISOString(),
            transactions: u.proWallet._count.transactions,
          }
        : null,
    })),
    total,
    page: query.page,
    limit: query.limit,
    counts: { all, with: withWallet, without: all - withWallet },
  };
}

export interface CreateWalletResult {
  /** Faux si le wallet existait déjà (appel idempotent). */
  readonly created: boolean;
  readonly wallet: { readonly userId: string; readonly crowns: number; readonly createdAt: string };
}

/**
 * Crée le wallet d'un coach (solde 0, aucune transaction). Idempotent : un
 * wallet existant est renvoyé tel quel, y compris quand deux appels se
 * croisent (P2002 sur la clé `userId`).
 */
export async function createCoachWallet(userId: string): Promise<CreateWalletResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new CrownsAdminError("user-not-found", "Utilisateur introuvable");
  const select = { userId: true, crowns: true, createdAt: true } as const;
  const existing = await prisma.proWallet.findUnique({ where: { userId }, select });
  if (existing) return { created: false, wallet: toWalletView(existing) };
  try {
    const wallet = await prisma.proWallet.create({ data: { userId }, select });
    return { created: true, wallet: toWalletView(wallet) };
  } catch (e: unknown) {
    if (!isUniqueViolation(e)) throw e;
    const raced = await prisma.proWallet.findUnique({ where: { userId }, select });
    if (!raced) throw e;
    return { created: false, wallet: toWalletView(raced) };
  }
}

function toWalletView(w: { userId: string; crowns: number; createdAt: Date }): CreateWalletResult["wallet"] {
  return { userId: w.userId, crowns: w.crowns, createdAt: w.createdAt.toISOString() };
}

export interface CreateMissingWalletsResult {
  readonly created: number;
  /** Coachs encore sans wallet après l'appel (plafond de lots atteint). */
  readonly remaining: number;
}

/**
 * Crée le wallet de TOUS les coachs qui n'en ont pas, par lots. Un lot qui
 * croise une création concurrente (P2002) ou un compte supprimé entre la
 * lecture et l'écriture (P2003) est rejoué coach par coach : le lot ne doit
 * pas échouer pour un seul coach.
 * (`createMany({ skipDuplicates })` n'existe pas sur le miroir SQLite.)
 */
export async function createMissingWallets(): Promise<CreateMissingWalletsResult> {
  let created = 0;
  for (let batch = 0; batch < CREATE_MISSING_MAX_BATCHES; batch++) {
    const missing: Array<{ id: string }> = await prisma.user.findMany({
      where: walletStatusWhere("without"),
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: CREATE_MISSING_BATCH,
    });
    if (missing.length === 0) break;
    try {
      const res = await prisma.proWallet.createMany({ data: missing.map((u) => ({ userId: u.id })) });
      created += res.count as number;
    } catch (e: unknown) {
      if (!isUniqueViolation(e) && !isForeignKeyViolation(e)) throw e;
      for (const u of missing) {
        const r = await createCoachWallet(u.id).catch((err: unknown) => {
          // Compte supprimé entre la lecture et l'écriture : rien à créer.
          if (err instanceof CrownsAdminError) return null;
          throw err;
        });
        if (r?.created) created++;
      }
    }
    if (missing.length < CREATE_MISSING_BATCH) break;
  }
  const remaining = await prisma.user.count({ where: walletStatusWhere("without") });
  return { created, remaining };
}

/* ── Vue d'ensemble de la monnaie ────────────────────────────────────── */

export interface CrownsFlow {
  readonly type: string;
  readonly count: number;
  /** Somme des montants POSITIFS (Crowns créées / rendues). */
  readonly credited: number;
  /** Somme des montants NÉGATIFS, en valeur absolue (Crowns retirées). */
  readonly debited: number;
  readonly net: number;
}

export interface CrownsFlowGroupRow {
  readonly type: string;
  readonly positive: boolean;
  readonly count: number;
  readonly sum: number;
}

/**
 * Agrège des lignes `groupBy` (type × signe) en flux par type, triés par
 * volume décroissant (PUR). Le signe est porté par la ligne : un même type
 * peut créditer et débiter (`ADMIN_ADJUST`).
 */
export function summarizeCrownsFlows(rows: readonly CrownsFlowGroupRow[]): CrownsFlow[] {
  const byType = new Map<string, { count: number; credited: number; debited: number }>();
  for (const r of rows) {
    const acc = byType.get(r.type) ?? { count: 0, credited: 0, debited: 0 };
    acc.count += r.count;
    if (r.positive) acc.credited += r.sum;
    else acc.debited += Math.abs(r.sum);
    byType.set(r.type, acc);
  }
  return [...byType.entries()]
    .map(([type, a]) => ({ type, ...a, net: a.credited - a.debited }))
    .sort((a, b) => b.credited + b.debited - (a.credited + a.debited) || a.type.localeCompare(b.type));
}

export interface CrownsFlagStatus {
  /** Faux = la ligne n'existe pas en base : l'UI ne peut pas allumer le flag. */
  readonly exists: boolean;
  readonly enabled: boolean;
  readonly userOverrides: number;
}

export interface CrownsOverview {
  readonly supply: number;
  readonly wallets: number;
  readonly usersWithoutWallet: number;
  readonly days: number;
  readonly flows: { readonly allTime: readonly CrownsFlow[]; readonly recent: readonly CrownsFlow[] };
  readonly topHolders: ReadonlyArray<{
    readonly userId: string;
    readonly coachName: string;
    readonly email: string;
    readonly crowns: number;
  }>;
  readonly flag: CrownsFlagStatus;
}

interface FlowGroupByRow {
  type: string;
  _count: { _all: number };
  _sum: { amount: number | null };
}

async function loadFlows(since: Date | null): Promise<CrownsFlow[]> {
  const createdAt = since ? { createdAt: { gte: since } } : {};
  const [pos, neg]: [FlowGroupByRow[], FlowGroupByRow[]] = await Promise.all([
    prisma.proTransaction.groupBy({
      by: ["type"],
      where: { ...createdAt, amount: { gt: 0 } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.proTransaction.groupBy({
      by: ["type"],
      where: { ...createdAt, amount: { lt: 0 } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const toRow = (positive: boolean) => (r: FlowGroupByRow): CrownsFlowGroupRow => ({
    type: r.type,
    positive,
    count: r._count._all,
    sum: r._sum.amount ?? 0,
  });
  return summarizeCrownsFlows([...pos.map(toRow(true)), ...neg.map(toRow(false))]);
}

export async function getCrownsOverview(days: number, now: Date = new Date()): Promise<CrownsOverview> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [aggregate, usersWithoutWallet, allTime, recent, holders, flag]: [
    { _sum: { crowns: number | null }; _count: { _all: number } },
    number,
    CrownsFlow[],
    CrownsFlow[],
    Array<{ userId: string; crowns: number; user: { coachName: string; email: string } }>,
    { enabled: boolean; _count: { userOverrides: number } } | null,
  ] = await Promise.all([
    prisma.proWallet.aggregate({ _sum: { crowns: true }, _count: { _all: true } }),
    prisma.user.count({ where: walletStatusWhere("without") }),
    loadFlows(null),
    loadFlows(since),
    prisma.proWallet.findMany({
      where: { crowns: { gt: 0 } },
      orderBy: { crowns: "desc" },
      take: 10,
      select: { userId: true, crowns: true, user: { select: { coachName: true, email: true } } },
    }),
    prisma.featureFlag.findUnique({
      where: { key: CROWNS_FLAG },
      select: { enabled: true, _count: { select: { userOverrides: true } } },
    }),
  ]);
  return {
    supply: aggregate._sum.crowns ?? 0,
    wallets: aggregate._count._all,
    usersWithoutWallet,
    days,
    flows: { allTime, recent },
    topHolders: holders.map((h) => ({
      userId: h.userId,
      coachName: h.user.coachName,
      email: h.user.email,
      crowns: h.crowns,
    })),
    flag: flag
      ? { exists: true, enabled: flag.enabled, userOverrides: flag._count.userOverrides }
      : { exists: false, enabled: false, userOverrides: 0 },
  };
}

/* ── Journal global ──────────────────────────────────────────────────── */

export interface CrownsLedgerEntry {
  readonly id: string;
  readonly type: string;
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
  readonly user: { readonly id: string; readonly coachName: string; readonly email: string };
}

export interface CrownsLedgerPage {
  readonly items: readonly CrownsLedgerEntry[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  ref: string | null;
  createdAt: Date;
  wallet: { userId: string; user: { coachName: string; email: string } };
}

export async function listCrownsLedger(query: AdminCrownsLedgerQuery): Promise<CrownsLedgerPage> {
  const userFilter = searchWhere(query.search);
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(Object.keys(userFilter).length > 0 ? { wallet: { user: userFilter } } : {}),
  };
  const [total, rows]: [number, LedgerRow[]] = await Promise.all([
    prisma.proTransaction.count({ where }),
    prisma.proTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        type: true,
        amount: true,
        ref: true,
        createdAt: true,
        wallet: { select: { userId: true, user: { select: { coachName: true, email: true } } } },
      },
    }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      ref: r.ref,
      createdAt: r.createdAt.toISOString(),
      user: { id: r.wallet.userId, coachName: r.wallet.user.coachName, email: r.wallet.user.email },
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
}
