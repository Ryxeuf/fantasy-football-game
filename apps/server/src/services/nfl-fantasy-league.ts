/**
 * Service NFL Fantasy League — Phase 2.C.
 *
 * CRUD des leagues + gestion des entries (membres) :
 *
 *   createLeague    cree une league avec son proprietaire en entry #1
 *   getLeague       fetch league + entries
 *   listLeagues     leagues d'un user (ou il a une entry)
 *   joinLeague      rejoint via leagueId OU inviteCode
 *   leaveLeague     quitte (membre non-owner) ; en status "draft"
 *   updateLeague    nom/type/size (owner uniquement, status "draft")
 *   deleteLeague    supprime (owner, status "draft" uniquement)
 *
 * Toutes les operations sont synchrones cote Prisma (pas de queue) et
 * respectent les decisions produit :
 *   - Q1 snake draft par defaut
 *   - Q2 size par defaut 10, range 2-16
 *   - Q6 silos separes : userId est un string sans FK explicite vers
 *     User (evite de toucher au modele existant)
 *   - Q7 freemium : pas de gating premium en V1
 *
 * Pattern erreur typee (cf. CLAUDE.md) : NflFantasyLeagueError avec
 * code enum string, mapping HTTP cote routes Phase 2.G.
 */

import type { NflFantasyEntry, NflFantasyLeague } from "@prisma/client";

import { prisma } from "../prisma";
import {
  assertCycleJoinable,
  getNextJoinableCycle,
} from "./nfl-fantasy-season-cycle";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyLeagueErrorCode =
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "ALREADY_JOINED"
  | "FULL"
  | "INVALID_STATUS"
  | "OWNER_CANNOT_LEAVE"
  | "SEASON_NOT_FOUND"
  | "INVALID_INVITE"
  | "INVALID_NAME"
  | "INVALID_TEAM_NAME"
  | "INVALID_SIZE"
  | "TEAM_NAME_TAKEN";

export class NflFantasyLeagueError extends Error {
  constructor(
    public readonly code: NflFantasyLeagueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyLeagueError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Constantes / validation
// ────────────────────────────────────────────────────────────────────

const NAME_MIN = 3;
const NAME_MAX = 50;
const TEAM_NAME_MIN = 3;
const TEAM_NAME_MAX = 50;
export const LEAGUE_SIZE_MIN = 2;
export const LEAGUE_SIZE_MAX = 16;
export const DEFAULT_LEAGUE_SIZE = 10;

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1
const INVITE_LENGTH = 8;

/**
 * Genere un code d'invitation court (8 chars upper alphanum, sans
 * caracteres ambigus). Non determine, mais l'unicite est ensuite
 * garantie par la contrainte DB + retries en cas de collision.
 */
export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < INVITE_LENGTH; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

function validateName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    throw new NflFantasyLeagueError(
      "INVALID_NAME",
      `Nom de league doit faire ${NAME_MIN}-${NAME_MAX} caracteres`,
    );
  }
  return trimmed;
}

function validateTeamName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < TEAM_NAME_MIN || trimmed.length > TEAM_NAME_MAX) {
    throw new NflFantasyLeagueError(
      "INVALID_TEAM_NAME",
      `Nom d'equipe doit faire ${TEAM_NAME_MIN}-${TEAM_NAME_MAX} caracteres`,
    );
  }
  return trimmed;
}

function validateSize(size: number): number {
  if (
    !Number.isInteger(size) ||
    size < LEAGUE_SIZE_MIN ||
    size > LEAGUE_SIZE_MAX
  ) {
    throw new NflFantasyLeagueError(
      "INVALID_SIZE",
      `Taille league doit etre un entier entre ${LEAGUE_SIZE_MIN} et ${LEAGUE_SIZE_MAX}`,
    );
  }
  return size;
}

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export interface CreateLeagueOpts {
  readonly ownerId: string;
  readonly name: string;
  readonly teamName: string;
  readonly seasonId: string;
  readonly size?: number;
  readonly type?: "public" | "private";
  readonly draftMode?: "snake" | "auction" | "free";
  /** V2 mercato : budget initial par coach. Range [1000, 20000], defaut 5000. */
  readonly draftBudget?: number;
  /**
   * Cycle de saison sur lequel adosser le championnat. Optionnel :
   * si omis, le service applique le snap-to-next-window (premier
   * cycle non encore demarre). Si fourni, le cycle doit etre encore
   * "upcoming" sinon NflFantasyCycleError CYCLE_ALREADY_STARTED.
   */
  readonly cycleId?: string;
}

export const DRAFT_BUDGET_MIN = 1000;
export const DRAFT_BUDGET_MAX = 20_000;
export const DRAFT_BUDGET_DEFAULT = 5000;

function validateDraftBudget(raw: number | undefined): number {
  const v = raw ?? DRAFT_BUDGET_DEFAULT;
  if (!Number.isInteger(v) || v < DRAFT_BUDGET_MIN || v > DRAFT_BUDGET_MAX) {
    throw new NflFantasyLeagueError(
      "INVALID_SIZE",
      `draftBudget doit etre un entier entre ${DRAFT_BUDGET_MIN} et ${DRAFT_BUDGET_MAX} (recu : ${v})`,
    );
  }
  return v;
}

export interface JoinLeagueOpts {
  readonly userId: string;
  readonly teamName: string;
  /** Soit leagueId (public), soit inviteCode (private). Exactement un. */
  readonly leagueId?: string;
  readonly inviteCode?: string;
}

export interface UpdateLeagueOpts {
  readonly leagueId: string;
  readonly userId: string;
  readonly name?: string;
  readonly type?: "public" | "private";
  readonly size?: number;
}

export interface LeagueWithEntries extends NflFantasyLeague {
  entries: NflFantasyEntry[];
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

async function findLeagueOrThrow(leagueId: string): Promise<NflFantasyLeague> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: leagueId },
  });
  if (!league) {
    throw new NflFantasyLeagueError(
      "NOT_FOUND",
      `League ${leagueId} introuvable`,
    );
  }
  return league;
}

function assertOwner(league: NflFantasyLeague, userId: string): void {
  if (league.ownerId !== userId) {
    throw new NflFantasyLeagueError(
      "NOT_OWNER",
      `User ${userId} n'est pas owner de la league ${league.id}`,
    );
  }
}

function assertStatus(
  league: NflFantasyLeague,
  expected: "draft" | "in_progress" | "completed",
): void {
  if (league.status !== expected) {
    throw new NflFantasyLeagueError(
      "INVALID_STATUS",
      `Operation requise en status '${expected}', league actuellement '${league.status}'`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// CRUD
// ────────────────────────────────────────────────────────────────────

/**
 * Cree une league + l'entry du proprietaire. Status initial "draft".
 *
 * - size default 10 (Q2), range 2-16
 * - type default "private" (Q1 invite-only)
 * - draftMode default "snake" (Q1)
 * - inviteCode genere si type="private", null sinon
 *
 * @throws NflFantasyLeagueError SEASON_NOT_FOUND si seasonId invalide
 * @throws NflFantasyLeagueError INVALID_NAME / INVALID_SIZE / INVALID_TEAM_NAME
 */
export async function createLeague(
  opts: CreateLeagueOpts,
): Promise<LeagueWithEntries> {
  const name = validateName(opts.name);
  const teamName = validateTeamName(opts.teamName);
  const size = validateSize(opts.size ?? DEFAULT_LEAGUE_SIZE);
  const type = opts.type ?? "private";
  const draftMode = opts.draftMode ?? "auction";
  const draftBudget = validateDraftBudget(opts.draftBudget);

  const season = await prisma.nflSeason.findUnique({
    where: { id: opts.seasonId },
  });
  if (!season) {
    throw new NflFantasyLeagueError(
      "SEASON_NOT_FOUND",
      `NflSeason ${opts.seasonId} introuvable`,
    );
  }

  // Cycle : si fourni, valider qu'il est encore joignable ; sinon
  // snap-to-next-window. Throws NflFantasyCycleError, propage tel
  // quel pour mapping HTTP cote route.
  const cycle = opts.cycleId
    ? await assertCycleJoinable(opts.cycleId)
    : await getNextJoinableCycle(opts.seasonId);

  const inviteCode = type === "private" ? generateInviteCode() : null;

  return prisma.nflFantasyLeague.create({
    data: {
      name,
      ownerId: opts.ownerId,
      size,
      type,
      draftMode,
      seasonId: opts.seasonId,
      cycleId: cycle.id,
      inviteCode,
      draftBudget,
      entries: {
        create: {
          userId: opts.ownerId,
          teamName,
          budgetRemaining: draftBudget,
        },
      },
    },
    include: { entries: true },
  });
}

/**
 * Fetch une league + ses entries. Throws NOT_FOUND si absente.
 */
export async function getLeague(leagueId: string): Promise<LeagueWithEntries> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      entries: { orderBy: { joinedAt: "asc" } },
      cycle: true,
    },
  });
  if (!league) {
    throw new NflFantasyLeagueError(
      "NOT_FOUND",
      `League ${leagueId} introuvable`,
    );
  }
  return league;
}

/**
 * Liste les championnats PUBLICS rejoignables (status='draft',
 * type='public', non-pleins, et ou l'user n'est pas deja membre).
 *
 * Trie par date de creation desc (les plus recents en haut). Paginee
 * cote serveur a 50 par defaut pour eviter de tout dump si on grossit.
 *
 * @returns liste enrichie avec entriesCount et isJoinable
 */
export async function listPublicLeagues(opts: {
  userId: string;
  limit?: number;
}): Promise<
  Array<
    NflFantasyLeague & {
      entriesCount: number;
      isJoinable: boolean;
    }
  >
> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const rows = await prisma.nflFantasyLeague.findMany({
    where: {
      type: "public",
      status: "draft",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      entries: { select: { id: true, userId: true } },
      cycle: { select: { id: true, label: true, startWeek: true, endWeek: true, cycleType: true } },
    },
  });
  type Row = (typeof rows)[number];
  type EntryRow = Row["entries"][number];
  return rows.map((lg: Row) => {
    const entriesCount = lg.entries.length;
    const userInLeague = lg.entries.some(
      (e: EntryRow) => e.userId === opts.userId,
    );
    const isJoinable = entriesCount < lg.size && !userInLeague;
    // On retourne la league sans le tableau entries verbose, juste
    // l'aggregat. Cote-API on n'expose pas les userIds (privacy).
    const { entries: _entries, ...rest } = lg;
    return {
      ...rest,
      entriesCount,
      isJoinable,
    };
  });
}

/**
 * Liste les leagues ou l'utilisateur a une entry, triees par
 * date de creation desc. Optionnellement filtre par status.
 */
export async function listLeaguesForUser(
  userId: string,
  filters: { status?: "draft" | "in_progress" | "completed" } = {},
): Promise<NflFantasyLeague[]> {
  return prisma.nflFantasyLeague.findMany({
    where: {
      entries: { some: { userId } },
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      cycle: { select: { id: true, label: true, startWeek: true, endWeek: true, cycleType: true } },
    },
  });
}

/**
 * Rejoint une league via son id (public) ou son inviteCode (private).
 * Verifie status='draft', taille, pas deja membre, teamName unique.
 *
 * @throws NOT_FOUND si league introuvable
 * @throws INVALID_INVITE si ni id ni code fourni / code invalide
 * @throws INVALID_STATUS si pas en draft
 * @throws ALREADY_JOINED si user deja dans la league
 * @throws FULL si entries.count >= size
 * @throws TEAM_NAME_TAKEN si une entry porte deja ce teamName
 */
export async function joinLeague(opts: JoinLeagueOpts): Promise<NflFantasyEntry> {
  const teamName = validateTeamName(opts.teamName);
  if (!opts.leagueId && !opts.inviteCode) {
    throw new NflFantasyLeagueError(
      "INVALID_INVITE",
      "leagueId ou inviteCode requis",
    );
  }

  const league = opts.leagueId
    ? await prisma.nflFantasyLeague.findUnique({ where: { id: opts.leagueId } })
    : await prisma.nflFantasyLeague.findUnique({
        where: { inviteCode: opts.inviteCode! },
      });

  if (!league) {
    throw new NflFantasyLeagueError(
      opts.inviteCode ? "INVALID_INVITE" : "NOT_FOUND",
      opts.inviteCode
        ? `Invite code ${opts.inviteCode} invalide`
        : `League ${opts.leagueId} introuvable`,
    );
  }

  assertStatus(league, "draft");

  const existing = await prisma.nflFantasyEntry.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: opts.userId } },
  });
  if (existing) {
    throw new NflFantasyLeagueError(
      "ALREADY_JOINED",
      `User ${opts.userId} deja membre de la league ${league.id}`,
    );
  }

  const count = await prisma.nflFantasyEntry.count({
    where: { leagueId: league.id },
  });
  if (count >= league.size) {
    throw new NflFantasyLeagueError(
      "FULL",
      `League ${league.id} pleine (${count}/${league.size})`,
    );
  }

  try {
    return await prisma.nflFantasyEntry.create({
      data: {
        leagueId: league.id,
        userId: opts.userId,
        teamName,
        budgetRemaining: league.draftBudget,
      },
    });
  } catch (e) {
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (
      err.code === "P2002" &&
      err.meta?.target?.some((t) => t === "teamName" || t.includes("teamName"))
    ) {
      throw new NflFantasyLeagueError(
        "TEAM_NAME_TAKEN",
        `TeamName "${teamName}" deja utilise dans la league ${league.id}`,
      );
    }
    throw e;
  }
}

/**
 * Quitte une league. L'owner ne peut pas quitter (il doit deleteLeague
 * ou transferer en V2). Operation limitee au status "draft" en V1 ;
 * une fois la saison demarree on garde l'historique.
 *
 * @throws NOT_FOUND si league absente
 * @throws OWNER_CANNOT_LEAVE si user est owner
 * @throws INVALID_STATUS si league deja in_progress / completed
 * @throws NOT_FOUND si user pas membre (avec message specifique)
 */
export async function leaveLeague(opts: {
  leagueId: string;
  userId: string;
}): Promise<void> {
  const league = await findLeagueOrThrow(opts.leagueId);

  if (league.ownerId === opts.userId) {
    throw new NflFantasyLeagueError(
      "OWNER_CANNOT_LEAVE",
      `Owner ne peut pas quitter sa league (utiliser deleteLeague ou transferer)`,
    );
  }

  assertStatus(league, "draft");

  const entry = await prisma.nflFantasyEntry.findUnique({
    where: {
      leagueId_userId: { leagueId: opts.leagueId, userId: opts.userId },
    },
  });
  if (!entry) {
    throw new NflFantasyLeagueError(
      "NOT_FOUND",
      `User ${opts.userId} n'est pas membre de la league ${opts.leagueId}`,
    );
  }

  await prisma.nflFantasyEntry.delete({ where: { id: entry.id } });
}

/**
 * Update partiel (name / type / size). Owner uniquement, status draft.
 *
 * Si type passe public<->private, regenere/efface inviteCode.
 * Si size baisse en dessous du nombre d'entries actuelles, refuse.
 *
 * @throws NOT_FOUND / NOT_OWNER / INVALID_STATUS / INVALID_SIZE
 */
export async function updateLeague(
  opts: UpdateLeagueOpts,
): Promise<NflFantasyLeague> {
  const league = await findLeagueOrThrow(opts.leagueId);
  assertOwner(league, opts.userId);
  assertStatus(league, "draft");

  const data: {
    name?: string;
    type?: string;
    size?: number;
    inviteCode?: string | null;
  } = {};

  if (opts.name !== undefined) {
    data.name = validateName(opts.name);
  }
  if (opts.size !== undefined) {
    const newSize = validateSize(opts.size);
    const currentEntries = await prisma.nflFantasyEntry.count({
      where: { leagueId: league.id },
    });
    if (newSize < currentEntries) {
      throw new NflFantasyLeagueError(
        "INVALID_SIZE",
        `Taille ${newSize} inferieure au nombre d'entries actuelles (${currentEntries})`,
      );
    }
    data.size = newSize;
  }
  if (opts.type !== undefined && opts.type !== league.type) {
    data.type = opts.type;
    data.inviteCode = opts.type === "private" ? generateInviteCode() : null;
  }

  return prisma.nflFantasyLeague.update({
    where: { id: league.id },
    data,
  });
}

/**
 * Supprime une league. Owner uniquement, status draft.
 * Cascade sur les entries via FK onDelete: Cascade.
 *
 * @throws NOT_FOUND / NOT_OWNER / INVALID_STATUS
 */
export async function deleteLeague(opts: {
  leagueId: string;
  userId: string;
}): Promise<void> {
  const league = await findLeagueOrThrow(opts.leagueId);
  assertOwner(league, opts.userId);
  assertStatus(league, "draft");

  await prisma.nflFantasyLeague.delete({ where: { id: league.id } });
}
