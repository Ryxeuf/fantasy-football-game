/**
 * Administration des thèmes de dés.
 *
 *  - CATALOGUE : libellés, prix, mise en vente et ordre de chaque thème
 *    (table `DiceTheme`, « base d'abord » — le slug et les visuels restent un
 *    contrat de code, cf. `dice-theme-repository`), avec ses statistiques
 *    (possesseurs, achats, cadeaux, coachs qui l'ont choisi, recette).
 *  - COACHS : solde de Crowns, thèmes acquis (cadeau / révocation avec
 *    remboursement optionnel) et thème choisi.
 *
 * Les Crowns elles-mêmes s'ajustent par la route existante
 * `PATCH /admin/wallets/:userId/balance` (journal `ADMIN_ADJUST`).
 * Agrégats en `groupBy` (jamais de N+1).
 */

import { prisma } from "../prisma";
import { creditInTx, ensureWalletExists, getBalance, getRecentTransactions, type ProTransactionEntry } from "./pro-wallet";
import {
  DEFAULT_DICE_THEME_ID,
  DICE_THEME_CATALOGUE,
  diceThemeSelectionRefusal,
  effectiveDiceThemeId,
  findDiceTheme,
  isFreeDiceTheme,
  ownedDiceThemeIds,
  type DiceThemeCatalogueEntry,
} from "./dice-theme-catalogue";
import {
  entryToRow,
  invalidateDiceThemeCache,
  loadDiceThemeCatalogue,
} from "./dice-theme-repository";
import { DICE_THEME_TX_REF_PREFIX, loadOwnedPaidThemeIds } from "./dice-theme-preference";

export type DiceThemeAdminErrorCode =
  | "unknown-theme"
  | "default-theme-locked"
  | "user-not-found"
  | "theme-already-owned"
  | "theme-not-acquired"
  | "theme-not-owned";

export class DiceThemeAdminError extends Error {
  constructor(
    public readonly code: DiceThemeAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DiceThemeAdminError";
  }
}

const MESSAGES: Record<DiceThemeAdminErrorCode, string> = {
  "unknown-theme": "Thème de dés inconnu",
  "default-theme-locked": "Le thème par défaut reste gratuit et en service",
  "user-not-found": "Utilisateur introuvable",
  "theme-already-owned": "Ce coach possède déjà ce thème",
  "theme-not-acquired": "Ce coach n'a pas acquis ce thème",
  "theme-not-owned": "Ce coach ne possède pas ce thème",
};

function adminError(code: DiceThemeAdminErrorCode): DiceThemeAdminError {
  return new DiceThemeAdminError(code, MESSAGES[code]);
}

/* ── Catalogue ───────────────────────────────────────────────────────── */

export interface DiceThemeStats {
  /** Coachs qui possèdent le thème par acquisition (achat ou cadeau). */
  readonly owners: number;
  readonly purchases: number;
  readonly gifts: number;
  /** Coachs dont la préférence STOCKÉE est ce thème. */
  readonly selectedBy: number;
  /** Crowns encaissées par les achats encore en place. */
  readonly revenueCrowns: number;
}

export interface AdminDiceThemeView extends DiceThemeCatalogueEntry {
  readonly isDefault: boolean;
  /** Faux = pas encore de ligne en base (le catalogue compilé est servi). */
  readonly inDatabase: boolean;
  /** Valeurs du catalogue compilé (réinitialisation). */
  readonly compiled: Pick<DiceThemeCatalogueEntry, "priceCrowns" | "enabled" | "name">;
  readonly stats: DiceThemeStats;
}

const EMPTY_STATS: DiceThemeStats = {
  owners: 0,
  purchases: 0,
  gifts: 0,
  selectedBy: 0,
  revenueCrowns: 0,
};

interface AcquisitionAggregate {
  themeId: string;
  source: string;
  _count: { _all: number };
  _sum: { priceCrowns: number | null };
}

interface SelectionAggregate {
  diceTheme: string | null;
  _count: { _all: number };
}

/** Agrégats par thème : deux `groupBy`, quel que soit le nombre de thèmes. */
async function loadDiceThemeStats(): Promise<Map<string, DiceThemeStats>> {
  const [acquisitions, selections]: [AcquisitionAggregate[], SelectionAggregate[]] = await Promise.all([
    prisma.userDiceTheme.groupBy({
      by: ["themeId", "source"],
      _count: { _all: true },
      _sum: { priceCrowns: true },
    }),
    prisma.user.groupBy({
      by: ["diceTheme"],
      where: { diceTheme: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const stats = new Map<string, DiceThemeStats>();
  const get = (id: string) => stats.get(id) ?? EMPTY_STATS;
  for (const a of acquisitions) {
    const prev = get(a.themeId);
    const count = a._count._all;
    stats.set(a.themeId, {
      ...prev,
      owners: prev.owners + count,
      purchases: prev.purchases + (a.source === "purchase" ? count : 0),
      gifts: prev.gifts + (a.source === "purchase" ? 0 : count),
      revenueCrowns: prev.revenueCrowns + (a.source === "purchase" ? a._sum.priceCrowns ?? 0 : 0),
    });
  }
  for (const s of selections) {
    if (!s.diceTheme) continue;
    stats.set(s.diceTheme, { ...get(s.diceTheme), selectedBy: s._count._all });
  }
  return stats;
}

export async function listDiceThemesForAdmin(): Promise<AdminDiceThemeView[]> {
  const [catalogue, rows, stats] = await Promise.all([
    loadDiceThemeCatalogue(),
    prisma.diceTheme.findMany({ select: { slug: true } }),
    loadDiceThemeStats(),
  ]);
  const inDb = new Set((rows as Array<{ slug: string }>).map((r) => r.slug));
  return catalogue.map((entry) => {
    const compiled = findDiceTheme(entry.id, DICE_THEME_CATALOGUE)!;
    return {
      ...entry,
      isDefault: entry.id === DEFAULT_DICE_THEME_ID,
      inDatabase: inDb.has(entry.id),
      compiled: {
        priceCrowns: compiled.priceCrowns,
        enabled: compiled.enabled,
        name: compiled.name,
      },
      stats: stats.get(entry.id) ?? EMPTY_STATS,
    };
  });
}

export interface DiceThemePatch {
  readonly nameFr?: string;
  readonly nameEn?: string;
  readonly descriptionFr?: string | null;
  readonly descriptionEn?: string | null;
  readonly priceCrowns?: number | null;
  readonly enabled?: boolean;
  readonly sortOrder?: number;
}

function compiledEntryOrThrow(slug: string): DiceThemeCatalogueEntry {
  const compiled = findDiceTheme(slug, DICE_THEME_CATALOGUE);
  if (!compiled) throw adminError("unknown-theme");
  return compiled;
}

async function findAdminView(slug: string): Promise<AdminDiceThemeView> {
  const view = (await listDiceThemesForAdmin()).find((t) => t.id === slug);
  if (!view) throw adminError("unknown-theme");
  return view;
}

/**
 * Édite une entrée du catalogue (ligne créée depuis le compilé si absente).
 * Le défaut reste gratuit et en service : sans lui, un coach sans achat
 * n'aurait plus de dé à dessiner.
 */
export async function updateDiceTheme(
  slug: string,
  patch: DiceThemePatch,
): Promise<{ before: AdminDiceThemeView; after: AdminDiceThemeView }> {
  const compiled = compiledEntryOrThrow(slug);
  if (
    slug === DEFAULT_DICE_THEME_ID &&
    ((patch.priceCrowns !== undefined && patch.priceCrowns !== null) ||
      patch.enabled === false)
  ) {
    throw adminError("default-theme-locked");
  }
  const before = await findAdminView(slug);
  await prisma.diceTheme.upsert({
    where: { slug },
    create: { slug, ...entryToRow(compiled), ...patch },
    update: patch,
  });
  invalidateDiceThemeCache();
  return { before, after: await findAdminView(slug) };
}

/** Réinitialise une entrée depuis le catalogue compilé. */
export async function resetDiceTheme(
  slug: string,
): Promise<{ before: AdminDiceThemeView; after: AdminDiceThemeView }> {
  const compiled = compiledEntryOrThrow(slug);
  const before = await findAdminView(slug);
  const data = entryToRow(compiled);
  await prisma.diceTheme.upsert({
    where: { slug },
    create: { slug, ...data },
    update: data,
  });
  invalidateDiceThemeCache();
  return { before, after: await findAdminView(slug) };
}

/* ── Coachs ──────────────────────────────────────────────────────────── */

export interface CoachCosmeticsRow {
  readonly id: string;
  readonly email: string;
  readonly coachName: string;
  readonly crowns: number;
  readonly acquiredThemes: number;
  /** Préférence STOCKÉE (`null` = jamais choisi). */
  readonly diceTheme: string | null;
}

export interface CoachCosmeticsPage {
  readonly items: readonly CoachCosmeticsRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

interface CoachRow {
  id: string;
  email: string;
  coachName: string;
  diceTheme: string | null;
  proWallet: { crowns: number } | null;
  _count: { diceThemes: number };
}

export async function listCoachCosmetics(query: {
  readonly search?: string;
  readonly page: number;
  readonly limit: number;
}): Promise<CoachCosmeticsPage> {
  const search = query.search?.trim();
  const searchMode = process.env.TEST_SQLITE === "1" ? {} : { mode: "insensitive" as const };
  const where = search
    ? {
        OR: [
          { email: { contains: search, ...searchMode } },
          { coachName: { contains: search, ...searchMode } },
        ],
      }
    : {};
  const [total, users]: [number, CoachRow[]] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        email: true,
        coachName: true,
        diceTheme: true,
        proWallet: { select: { crowns: true } },
        _count: { select: { diceThemes: true } },
      },
    }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      coachName: u.coachName,
      crowns: u.proWallet?.crowns ?? 0,
      acquiredThemes: u._count.diceThemes,
      diceTheme: u.diceTheme,
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export interface CoachThemeAcquisition {
  readonly themeId: string;
  readonly source: string;
  readonly priceCrowns: number | null;
  readonly grantedById: string | null;
  readonly createdAt: string;
  /** Faux si le thème a disparu du catalogue (ligne conservée, sans rendu). */
  readonly known: boolean;
}

export interface CoachCosmeticsDetail {
  readonly user: { readonly id: string; readonly email: string; readonly coachName: string };
  readonly crowns: number;
  readonly storedThemeId: string | null;
  readonly effectiveThemeId: string;
  readonly acquisitions: readonly CoachThemeAcquisition[];
  /** Tout le catalogue, avec la possession du coach (cadeau / choix). */
  readonly themes: ReadonlyArray<{
    readonly id: string;
    readonly name: { readonly fr: string; readonly en: string };
    readonly collection: string;
    readonly priceCrowns: number | null;
    readonly enabled: boolean;
    readonly owned: boolean;
    readonly free: boolean;
  }>;
  readonly transactions: readonly ProTransactionEntry[];
}

interface AcquisitionRow {
  themeId: string;
  source: string;
  priceCrowns: number | null;
  grantedById: string | null;
  createdAt: Date;
}

export async function getCoachCosmetics(userId: string): Promise<CoachCosmeticsDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, coachName: true, diceTheme: true },
  });
  if (!user) throw adminError("user-not-found");
  const [acquisitions, catalogue, crowns, transactions]: [
    AcquisitionRow[],
    Awaited<ReturnType<typeof loadDiceThemeCatalogue>>,
    number,
    ProTransactionEntry[],
  ] = await Promise.all([
    prisma.userDiceTheme.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { themeId: true, source: true, priceCrowns: true, grantedById: true, createdAt: true },
    }),
    loadDiceThemeCatalogue(),
    getBalance(userId),
    getRecentTransactions(userId, 20),
  ]);
  const ownedPaid = acquisitions.map((a) => a.themeId);
  const owned = new Set(ownedDiceThemeIds(ownedPaid, catalogue));
  return {
    user: { id: user.id, email: user.email, coachName: user.coachName },
    crowns,
    storedThemeId: user.diceTheme,
    effectiveThemeId: effectiveDiceThemeId(user.diceTheme, ownedPaid, catalogue),
    acquisitions: acquisitions.map((a) => ({
      themeId: a.themeId,
      source: a.source,
      priceCrowns: a.priceCrowns,
      grantedById: a.grantedById,
      createdAt: a.createdAt.toISOString(),
      known: catalogue.some((t) => t.id === a.themeId),
    })),
    themes: catalogue.map((t) => ({
      id: t.id,
      name: t.name,
      collection: t.collection,
      priceCrowns: t.priceCrowns,
      enabled: t.enabled,
      owned: owned.has(t.id),
      free: isFreeDiceTheme(t),
    })),
    transactions,
  };
}

async function assertUserExists(userId: string): Promise<{ diceTheme: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { diceTheme: true } });
  if (!user) throw adminError("user-not-found");
  return user;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Offre un thème à un coach (acquisition `admin_grant`, sans débit). */
export async function grantDiceTheme(
  userId: string,
  themeId: string,
  adminId: string,
): Promise<CoachCosmeticsDetail> {
  await assertUserExists(userId);
  const catalogue = await loadDiceThemeCatalogue();
  if (!findDiceTheme(themeId, catalogue)) throw adminError("unknown-theme");
  if (themeId === DEFAULT_DICE_THEME_ID) throw adminError("theme-already-owned");
  try {
    await prisma.userDiceTheme.create({
      data: { userId, themeId, source: "admin_grant", priceCrowns: null, grantedById: adminId },
    });
  } catch (e: unknown) {
    if (isUniqueViolation(e)) throw adminError("theme-already-owned");
    throw e;
  }
  return getCoachCosmetics(userId);
}

/**
 * Retire un thème acquis. `refund` recrédite le prix d'un ACHAT
 * (`ADMIN_REFUND`, réf. `dice-theme:<id>`) dans la même transaction. Si le
 * coach l'avait choisi et ne le possède plus, sa préférence est remise au
 * défaut.
 */
export async function revokeDiceTheme(
  userId: string,
  themeId: string,
  options: { readonly refund: boolean },
): Promise<{ detail: CoachCosmeticsDetail; refunded: number }> {
  const user = await assertUserExists(userId);
  const row = await prisma.userDiceTheme.findUnique({
    where: { userId_themeId: { userId, themeId } },
    select: { id: true, source: true, priceCrowns: true },
  });
  if (!row) throw adminError("theme-not-acquired");

  const refunded =
    options.refund && row.source === "purchase" && (row.priceCrowns ?? 0) > 0
      ? (row.priceCrowns as number)
      : 0;
  const [catalogue, ownedPaid] = await Promise.all([
    loadDiceThemeCatalogue(),
    loadOwnedPaidThemeIds(userId),
  ]);
  const stillOwned = ownedDiceThemeIds(
    ownedPaid.filter((id) => id !== themeId),
    catalogue,
  ).includes(themeId);
  const resetSelection = user.diceTheme === themeId && !stillOwned;

  if (refunded > 0) await ensureWalletExists(userId);
  await prisma.$transaction(async (tx: typeof prisma) => {
    // `deleteMany` + compte : une révocation concurrente (double clic, deux
    // admins) trouve la ligne déjà partie => 404 métier, et la transaction
    // annule le remboursement — jamais de double remboursement ni de 500.
    const { count } = await tx.userDiceTheme.deleteMany({ where: { id: row.id } });
    if (count !== 1) throw adminError("theme-not-acquired");
    if (refunded > 0) {
      await creditInTx(tx, userId, refunded, "ADMIN_REFUND", `${DICE_THEME_TX_REF_PREFIX}${themeId}`);
    }
    if (resetSelection) {
      await tx.user.update({ where: { id: userId }, data: { diceTheme: null } });
    }
  });
  return { detail: await getCoachCosmetics(userId), refunded };
}

/** Choisit le thème d'un coach (`null` = retour au défaut). Il doit le posséder. */
export async function setCoachDiceTheme(
  userId: string,
  themeId: string | null,
): Promise<CoachCosmeticsDetail> {
  await assertUserExists(userId);
  if (themeId !== null) {
    const [catalogue, ownedPaid] = await Promise.all([
      loadDiceThemeCatalogue(),
      loadOwnedPaidThemeIds(userId),
    ]);
    const refusal = diceThemeSelectionRefusal(themeId, ownedPaid, catalogue);
    if (refusal === "unknown-theme") throw adminError("unknown-theme");
    if (refusal === "theme-not-owned") throw adminError("theme-not-owned");
  }
  await prisma.user.update({ where: { id: userId }, data: { diceTheme: themeId } });
  return getCoachCosmetics(userId);
}
