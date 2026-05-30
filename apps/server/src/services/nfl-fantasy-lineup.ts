/**
 * Service NFL Fantasy Lineup — Phase 2.D.
 *
 * Gestion du lineup hebdo d'une entry :
 *
 *   getLineup       fetch lineup + starters d'une (entry, week)
 *   setLineup       upsert lineup avec starters + captain/vice
 *   lockLineups     bulk lock toutes les lineups d'une week (cron kickoff)
 *   isLineupLocked  helper read-only
 *
 * Regles V1 :
 *   - Tous les starters doivent etre dans le NflFantasyRoster de l'entry
 *   - Pas de doublons playerId dans les starters
 *   - captainId et viceCaptainId doivent etre dans les starters et
 *     differents l'un de l'autre
 *   - 11 starters obligatoires (taille validee mais configurable via opts)
 *   - Le lineup ne peut etre modifie une fois `lockedAt` set
 *
 * Cote phase 2.E, `settleNflFantasyWeek` lit ces lineups + leurs
 * starters pour calculer le SPP par matchup.
 */

import type { NflFantasyLineup, NflFantasyLineupStarter } from "@prisma/client";
import {
  checkComposition,
  coercePlayStyle,
  getArchetypeFromBbPosition,
  getArchetypeFromNflPosition,
  isPlayStyle,
  PLAY_STYLES,
  type BbPosition,
  type CompositionArchetype,
  type PlayStyle,
} from "@bb/nfl-mapper";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyLineupErrorCode =
  | "ENTRY_NOT_FOUND"
  | "LINEUP_LOCKED"
  | "INVALID_STARTERS"
  | "PLAYER_NOT_ON_ROSTER"
  | "DUPLICATE_PLAYER"
  | "CAPTAIN_NOT_IN_STARTERS"
  | "VICE_NOT_IN_STARTERS"
  | "CAPTAIN_EQUALS_VICE"
  | "INVALID_LINEUP_SIZE"
  | "NO_PREVIOUS_LINEUP"
  | "ROSTER_TOO_DIVERGENT"
  | "COMPOSITION_CAP_EXCEEDED"
  | "WEEK_NOT_FOUND";

export class NflFantasyLineupError extends Error {
  constructor(
    public readonly code: NflFantasyLineupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyLineupError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

export const DEFAULT_STARTERS_COUNT = 11;
export const CAPTAIN_MULTIPLIER = 1.5; // Q3
export const VICE_CAPTAIN_MULTIPLIER = 1.2; // Q3

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export interface LineupStarterInput {
  readonly playerId: string;
  readonly bbPosition: string;
}

export interface SetLineupOpts {
  readonly entryId: string;
  readonly weekId: string;
  readonly starters: ReadonlyArray<LineupStarterInput>;
  readonly captainId: string | null;
  readonly viceCaptainId?: string | null;
  /**
   * Override de la taille requise. Default 11. Permet aux tests / V2
   * variantes (ex: 9 vs 13) de modifier sans changer le service.
   */
  readonly startersCount?: number;
}

export interface LineupWithStarters extends NflFantasyLineup {
  starters: NflFantasyLineupStarter[];
}

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

/**
 * Verifie la coherence captain/vice/starters. Pur, ne touche pas la DB.
 * @throws NflFantasyLineupError
 */
export function validateLineupStructure(opts: {
  starters: ReadonlyArray<LineupStarterInput>;
  captainId: string | null;
  viceCaptainId?: string | null;
  startersCount?: number;
}): void {
  const expectedSize = opts.startersCount ?? DEFAULT_STARTERS_COUNT;
  if (opts.starters.length !== expectedSize) {
    throw new NflFantasyLineupError(
      "INVALID_LINEUP_SIZE",
      `Lineup doit contenir exactement ${expectedSize} starters (recu ${opts.starters.length})`,
    );
  }

  const ids = new Set<string>();
  for (const s of opts.starters) {
    if (!s.playerId || !s.bbPosition) {
      throw new NflFantasyLineupError(
        "INVALID_STARTERS",
        "Chaque starter requiert playerId + bbPosition",
      );
    }
    if (ids.has(s.playerId)) {
      throw new NflFantasyLineupError(
        "DUPLICATE_PLAYER",
        `Player ${s.playerId} present plusieurs fois dans le lineup`,
      );
    }
    ids.add(s.playerId);
  }

  if (opts.captainId !== null && !ids.has(opts.captainId)) {
    throw new NflFantasyLineupError(
      "CAPTAIN_NOT_IN_STARTERS",
      `Captain ${opts.captainId} doit etre dans les starters`,
    );
  }

  if (
    opts.viceCaptainId != null &&
    opts.viceCaptainId !== "" &&
    !ids.has(opts.viceCaptainId)
  ) {
    throw new NflFantasyLineupError(
      "VICE_NOT_IN_STARTERS",
      `Vice-captain ${opts.viceCaptainId} doit etre dans les starters`,
    );
  }

  if (
    opts.captainId !== null &&
    opts.viceCaptainId != null &&
    opts.viceCaptainId !== "" &&
    opts.captainId === opts.viceCaptainId
  ) {
    throw new NflFantasyLineupError(
      "CAPTAIN_EQUALS_VICE",
      "Captain et vice-captain doivent etre differents",
    );
  }
}

/** Libelles FR des archetypes pour des messages d'erreur lisibles. */
const ARCHETYPE_LABELS: Readonly<Record<CompositionArchetype, string>> = {
  passer: "passeurs (QB)",
  rusher: "coureurs (RB)",
  receiver: "receveurs (WR/TE)",
  lineman: "linemen",
  frontSeven: "defenseurs (front 7)",
  secondary: "defenseurs (secondary)",
  bigGuy: "big guys (DT/NT)",
};

/**
 * Resout l'archetype de composition d'un starter.
 *
 * Priorite au **poste NFL** (universel, race-agnostique) : un RB reste un
 * `rusher` que sa race le mappe en Blitzer, Ulfwerener ou Bloodspawn. On
 * retombe sur le poste BB seulement si le poste NFL est inconnu (vieux
 * snapshots sans nflPosition en base).
 */
function resolveArchetype(
  nflPosition: string | null | undefined,
  bbPosition: string,
): CompositionArchetype {
  if (nflPosition && nflPosition.trim() !== "") {
    return getArchetypeFromNflPosition(nflPosition);
  }
  return getArchetypeFromBbPosition(bbPosition as BbPosition);
}

/**
 * Verifie que la composition du lineup respecte les plafonds du style de
 * jeu de l'entry. Pur (pas d'I/O) : le caller fournit deja l'archetype
 * resolu de chaque starter.
 *
 * Plafonds = max only sur les postes premium ; les fillers (lineman,
 * defense) sont illimites → ne bloque jamais la faisabilite des 11.
 *
 * @throws NflFantasyLineupError(COMPOSITION_CAP_EXCEEDED) si un cap saute.
 */
export function validateComposition(opts: {
  archetypes: readonly CompositionArchetype[];
  playStyle: PlayStyle;
}): void {
  const violations = checkComposition(opts.archetypes, opts.playStyle);
  if (violations.length === 0) return;

  const detail = violations
    .map((v) => `${ARCHETYPE_LABELS[v.archetype]} : ${v.count}/${v.cap} max`)
    .join(", ");
  throw new NflFantasyLineupError(
    "COMPOSITION_CAP_EXCEEDED",
    `Composition invalide pour le style "${opts.playStyle}" — ${detail}`,
  );
}

// ────────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────────

/**
 * Fetch lineup + starters d'une (entry, week). Retourne null si pas
 * encore cree (lineup hebdo libre tant qu'aucun setLineup).
 */
export async function getLineup(opts: {
  entryId: string;
  weekId: string;
}): Promise<LineupWithStarters | null> {
  return prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    include: { starters: true },
  });
}

/**
 * Upsert le lineup d'une (entry, week).
 *
 *   - Valide structure (taille, doublons, captain/vice presents)
 *   - Verifie que tous les starters sont sur le roster de l'entry
 *   - Refuse si lineup deja locked
 *   - Remplace integralement les starters (atomique via transaction)
 *
 * @throws NflFantasyLineupError pour toutes les violations
 */
export async function setLineup(
  opts: SetLineupOpts,
): Promise<LineupWithStarters> {
  validateLineupStructure(opts);

  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: opts.entryId },
  });
  if (!entry) {
    throw new NflFantasyLineupError(
      "ENTRY_NOT_FOUND",
      `Entry ${opts.entryId} introuvable`,
    );
  }

  const existing = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
  });
  if (existing?.lockedAt) {
    throw new NflFantasyLineupError(
      "LINEUP_LOCKED",
      `Lineup (entry ${opts.entryId}, week ${opts.weekId}) deja locked au ${existing.lockedAt.toISOString()}`,
    );
  }

  // Verifie que tous les starters sont sur le roster
  const rosterRows: ReadonlyArray<{ playerId: string }> =
    await prisma.nflFantasyRoster.findMany({
      where: {
        entryId: opts.entryId,
        playerId: { in: opts.starters.map((s) => s.playerId) },
      },
      select: { playerId: true },
    });
  const onRoster = new Set(rosterRows.map((r) => r.playerId));
  for (const s of opts.starters) {
    if (!onRoster.has(s.playerId)) {
      throw new NflFantasyLineupError(
        "PLAYER_NOT_ON_ROSTER",
        `Player ${s.playerId} pas sur le roster de l'entry ${opts.entryId}`,
      );
    }
  }

  // Validation composition : plafonds par archetype selon le style de jeu
  // de l'entry. On resout l'archetype via le poste NFL d'origine (universel)
  // en chargeant les NflPlayer correspondants. Fallback poste BB si absent.
  const players: ReadonlyArray<{ id: string; nflPosition: string | null }> =
    await prisma.nflPlayer.findMany({
      where: { id: { in: opts.starters.map((s) => s.playerId) } },
      select: { id: true, nflPosition: true },
    });
  const nflPosById = new Map(players.map((p) => [p.id, p.nflPosition]));
  const archetypes = opts.starters.map((s) =>
    resolveArchetype(nflPosById.get(s.playerId), s.bbPosition),
  );
  validateComposition({
    archetypes,
    playStyle: coercePlayStyle(entry.playStyle),
  });

  // Upsert atomique du lineup + remplacement des starters
  const lineupId = existing?.id;
  const startersData = opts.starters.map((s) => ({
    playerId: s.playerId,
    bbPosition: s.bbPosition,
    isCaptain: opts.captainId === s.playerId,
    isViceCaptain:
      opts.viceCaptainId != null && opts.viceCaptainId === s.playerId,
  }));

  if (lineupId) {
    await prisma.$transaction([
      prisma.nflFantasyLineupStarter.deleteMany({ where: { lineupId } }),
      prisma.nflFantasyLineup.update({
        where: { id: lineupId },
        data: {
          captainId: opts.captainId,
          viceCaptainId: opts.viceCaptainId ?? null,
        },
      }),
      prisma.nflFantasyLineupStarter.createMany({
        data: startersData.map((s) => ({ ...s, lineupId })),
      }),
    ]);
  } else {
    await prisma.nflFantasyLineup.create({
      data: {
        entryId: opts.entryId,
        weekId: opts.weekId,
        captainId: opts.captainId,
        viceCaptainId: opts.viceCaptainId ?? null,
        starters: { create: startersData },
      },
    });
  }

  const out = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    include: { starters: true },
  });
  if (!out) {
    // Devrait etre impossible (on vient de l'upsert), mais Prisma type
    // exige le null check.
    throw new NflFantasyLineupError(
      "ENTRY_NOT_FOUND",
      "lineup upsert incoherent",
    );
  }
  return out;
}

/**
 * Lock toutes les lineups d'une week qui ne sont pas encore lockees.
 * Idempotent (les lineups deja lockees restent inchangees).
 *
 * Appelle typiquement par le cron Sunday 17:00 ET (kickoff games).
 */
export interface LockLineupsResult {
  /** Nb de lineups passees a lockedAt par l'updateMany. */
  readonly locked: number;
  /** Nb de defaults crees pour les entries qui n'avaient rien (fallback). */
  readonly defaultsCreated: number;
  /** Nb d'entries dont le roster < 11 -> impossible de creer un default. */
  readonly defaultsTooSmall: number;
}

export async function lockLineups(weekId: string): Promise<LockLineupsResult> {
  // 1. Fallback : pour chaque entry des leagues in_progress qui n'a
  //    PAS encore configure de lineup pour cette semaine, generer
  //    un default (top 11 par cote). Evite qu'un coach distrait se
  //    retrouve avec 0 SPP sur la semaine. Import dynamique pour
  //    casser la dependance circulaire (bot-lineup importe ce module).
  const { ensureDefaultLineupsForWeek } = await import(
    "./nfl-fantasy-bot-lineup"
  );
  const ensured = await ensureDefaultLineupsForWeek(weekId);

  // 2. Lock l'ensemble des lineups non-lockees de la week (les
  //    defaults qu'on vient de creer ET les choix manuels).
  const now = new Date();
  const result = await prisma.nflFantasyLineup.updateMany({
    where: { weekId, lockedAt: null },
    data: { lockedAt: now },
  });
  return {
    locked: result.count,
    defaultsCreated: ensured.defaultsCreated,
    defaultsTooSmall: ensured.defaultsTooSmall,
  };
}

/**
 * Change le style de jeu d'une entry.
 *
 * Modifiable tant qu'aucun lineup de l'entry n'est encore locked sur une
 * week non settlee : on autorise le changement si l'entry n'a pas de
 * lineup `lockedAt != null && totalSpp == null` (= semaine en cours
 * verrouillee mais pas encore resolue). Au-dela, le style est fige pour
 * cette semaine pour eviter de contourner les caps apres le lock.
 *
 * Note : ce garde-fou est volontairement souple — les caps eux-memes sont
 * re-valides a chaque setLineup, donc un changement de style ne peut jamais
 * produire un lineup deja persiste non conforme.
 *
 * @throws NflFantasyLineupError(ENTRY_NOT_FOUND | INVALID_STARTERS | LINEUP_LOCKED)
 */
export async function updateEntryPlayStyle(opts: {
  entryId: string;
  playStyle: string;
}): Promise<{ id: string; playStyle: PlayStyle }> {
  if (!isPlayStyle(opts.playStyle)) {
    throw new NflFantasyLineupError(
      "INVALID_STARTERS",
      `Style de jeu inconnu : "${opts.playStyle}" (attendu : ${PLAY_STYLES.join(", ")})`,
    );
  }

  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: opts.entryId },
    select: { id: true },
  });
  if (!entry) {
    throw new NflFantasyLineupError(
      "ENTRY_NOT_FOUND",
      `Entry ${opts.entryId} introuvable`,
    );
  }

  // Garde-fou : refuse si une semaine en cours est lockee mais pas settlee.
  const lockedPending = await prisma.nflFantasyLineup.findFirst({
    where: { entryId: opts.entryId, lockedAt: { not: null }, totalSpp: null },
    select: { id: true },
  });
  if (lockedPending) {
    throw new NflFantasyLineupError(
      "LINEUP_LOCKED",
      "Style de jeu non modifiable : une semaine verrouillee est en attente de resolution",
    );
  }

  const updated = await prisma.nflFantasyEntry.update({
    where: { id: opts.entryId },
    data: { playStyle: opts.playStyle },
    select: { id: true, playStyle: true },
  });
  return { id: updated.id, playStyle: coercePlayStyle(updated.playStyle) };
}

/**
 * Helper read-only.
 */
export async function isLineupLocked(opts: {
  entryId: string;
  weekId: string;
}): Promise<boolean> {
  const lineup = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    select: { lockedAt: true },
  });
  return lineup?.lockedAt != null;
}
