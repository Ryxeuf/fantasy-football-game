/**
 * Service NFL Fantasy Mercato — Phase 2.F.
 *
 * Gestion des resources cote entry :
 *
 *   - Rerolls : pool depletable de N par saison (8 par defaut Q7).
 *     Source possible : starter (seed), purchased, achievement, mercato.
 *   - Inducements : 3 slots par matchup (vision 07-mechanics.md).
 *     Pas de pool : chaque consumption cree une row, le check de
 *     limite est dynamique (count rows pour le matchup).
 *
 * Hors scope V1 :
 *   - Wallet integration (gold). Les `purchase*` posent juste la
 *     ressource avec source="purchased" en attendant.
 *   - Effet SPP des bonus sur le settlement (Phase 2.E recalcule sur
 *     NflGameStat.computedSpp uniquement). Le bonus appliquera en
 *     Phase 2.F' (recompute apres settlement).
 *   - Prieres a Nuffle : phase dediee (random + seed deterministe).
 */

import type {
  NflFantasyInducement,
  NflFantasyReroll,
} from "@prisma/client";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyMercatoErrorCode =
  | "ENTRY_NOT_FOUND"
  | "REROLL_NOT_FOUND"
  | "REROLL_NOT_OWNED"
  | "REROLL_ALREADY_USED"
  | "INDUCEMENT_LIMIT_REACHED"
  | "INVALID_TYPE"
  | "INVALID_SLOT";

export class NflFantasyMercatoError extends Error {
  constructor(
    public readonly code: NflFantasyMercatoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyMercatoError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

export const STARTING_REROLLS = 8; // vision V1 : 8 rerolls/saison
export const INDUCEMENT_SLOTS_PER_MATCHUP = 3; // vision V1 : 3 slots/match

const ALLOWED_REROLL_TYPES = new Set([
  "team_reroll",
  "skill_reroll",
  "assistant_coach",
]);
const ALLOWED_INDUCEMENT_SLOTS = new Set([
  "defensive",
  "offensive",
  "wildcard",
]);
const ALLOWED_REROLL_SOURCES = new Set([
  "starter",
  "purchased",
  "achievement",
  "mercato",
  "reward",
]);

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

async function assertEntry(entryId: string): Promise<void> {
  const e = await prisma.nflFantasyEntry.findUnique({ where: { id: entryId } });
  if (!e) {
    throw new NflFantasyMercatoError(
      "ENTRY_NOT_FOUND",
      `Entry ${entryId} introuvable`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// Rerolls
// ────────────────────────────────────────────────────────────────────

/**
 * Cree les `count` rerolls de demarrage (source="starter") pour une
 * entry. Idempotent : si des rerolls source="starter" existent deja,
 * retourne 0 (pas de creation supplementaire).
 *
 * Appel typique : au moment ou la league passe `status="in_progress"`
 * (kickoff de saison), pour chaque entry.
 */
export async function seedStartingRerolls(opts: {
  entryId: string;
  count?: number;
}): Promise<{ rerollsSeeded: number }> {
  await assertEntry(opts.entryId);
  const existing = await prisma.nflFantasyReroll.count({
    where: { entryId: opts.entryId, source: "starter" },
  });
  if (existing > 0) {
    return { rerollsSeeded: 0 };
  }
  const count = opts.count ?? STARTING_REROLLS;
  await prisma.nflFantasyReroll.createMany({
    data: Array.from({ length: count }, () => ({
      entryId: opts.entryId,
      type: "team_reroll",
      source: "starter",
    })),
  });
  return { rerollsSeeded: count };
}

/**
 * Donne un reroll a une entry (source != "starter"). Utilise par les
 * achievements, le mercato, les rewards Patron, etc.
 */
export async function grantReroll(opts: {
  entryId: string;
  source: string;
  type?: string;
}): Promise<NflFantasyReroll> {
  await assertEntry(opts.entryId);
  const type = opts.type ?? "team_reroll";
  if (!ALLOWED_REROLL_TYPES.has(type)) {
    throw new NflFantasyMercatoError(
      "INVALID_TYPE",
      `Type reroll inconnu : ${type}`,
    );
  }
  if (!ALLOWED_REROLL_SOURCES.has(opts.source)) {
    throw new NflFantasyMercatoError(
      "INVALID_TYPE",
      `Source reroll inconnue : ${opts.source}`,
    );
  }
  return prisma.nflFantasyReroll.create({
    data: { entryId: opts.entryId, type, source: opts.source },
  });
}

/**
 * Consomme un reroll : marque used=true + usedAt + contexte
 * (weekId, matchupId, appliedTo). Garde que le reroll appartient
 * a l'entry indiquee.
 */
export async function consumeReroll(opts: {
  rerollId: string;
  entryId: string;
  weekId: string;
  matchupId: string;
  appliedTo?: string;
}): Promise<NflFantasyReroll> {
  const reroll = await prisma.nflFantasyReroll.findUnique({
    where: { id: opts.rerollId },
  });
  if (!reroll) {
    throw new NflFantasyMercatoError(
      "REROLL_NOT_FOUND",
      `Reroll ${opts.rerollId} introuvable`,
    );
  }
  if (reroll.entryId !== opts.entryId) {
    throw new NflFantasyMercatoError(
      "REROLL_NOT_OWNED",
      `Reroll ${opts.rerollId} appartient a une autre entry`,
    );
  }
  if (reroll.used) {
    throw new NflFantasyMercatoError(
      "REROLL_ALREADY_USED",
      `Reroll ${opts.rerollId} deja consomme`,
    );
  }
  return prisma.nflFantasyReroll.update({
    where: { id: opts.rerollId },
    data: {
      used: true,
      usedAt: new Date(),
      weekId: opts.weekId,
      matchupId: opts.matchupId,
      appliedTo: opts.appliedTo ?? null,
    },
  });
}

/**
 * Liste les rerolls d'une entry. Filtre `used` optionnel
 * (undefined = tous, false = pool restant, true = historique).
 */
export async function listRerolls(opts: {
  entryId: string;
  used?: boolean;
}): Promise<NflFantasyReroll[]> {
  return prisma.nflFantasyReroll.findMany({
    where: {
      entryId: opts.entryId,
      ...(opts.used === undefined ? {} : { used: opts.used }),
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Compte les rerolls disponibles (non utilises).
 */
export async function countAvailableRerolls(entryId: string): Promise<number> {
  return prisma.nflFantasyReroll.count({
    where: { entryId, used: false },
  });
}

// ────────────────────────────────────────────────────────────────────
// Inducements
// ────────────────────────────────────────────────────────────────────

/**
 * Consomme un slot d'inducement pour un matchup. Garde la limite
 * `INDUCEMENT_SLOTS_PER_MATCHUP` (3 par defaut).
 */
export async function consumeInducement(opts: {
  entryId: string;
  weekId: string;
  matchupId: string;
  type: string;
  slot?: string;
  source?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<NflFantasyInducement> {
  await assertEntry(opts.entryId);

  const slot = opts.slot ?? "wildcard";
  if (!ALLOWED_INDUCEMENT_SLOTS.has(slot)) {
    throw new NflFantasyMercatoError(
      "INVALID_SLOT",
      `Slot inducement inconnu : ${slot}`,
    );
  }
  if (!opts.type || opts.type.length === 0) {
    throw new NflFantasyMercatoError(
      "INVALID_TYPE",
      "type inducement requis",
    );
  }

  const used = await prisma.nflFantasyInducement.count({
    where: {
      entryId: opts.entryId,
      weekId: opts.weekId,
      matchupId: opts.matchupId,
    },
  });
  if (used >= INDUCEMENT_SLOTS_PER_MATCHUP) {
    throw new NflFantasyMercatoError(
      "INDUCEMENT_LIMIT_REACHED",
      `${INDUCEMENT_SLOTS_PER_MATCHUP} inducements deja utilises pour ce matchup`,
    );
  }

  return prisma.nflFantasyInducement.create({
    data: {
      entryId: opts.entryId,
      type: opts.type,
      slot,
      source: opts.source ?? "purchased",
      weekId: opts.weekId,
      matchupId: opts.matchupId,
      targetId: opts.targetId ?? null,
      meta: (opts.meta as never) ?? undefined,
    },
  });
}

/**
 * Liste les inducements d'une entry. Filtres optionnels par
 * weekId et matchupId.
 */
export async function listInducements(opts: {
  entryId: string;
  weekId?: string;
  matchupId?: string;
}): Promise<NflFantasyInducement[]> {
  return prisma.nflFantasyInducement.findMany({
    where: {
      entryId: opts.entryId,
      ...(opts.weekId ? { weekId: opts.weekId } : {}),
      ...(opts.matchupId ? { matchupId: opts.matchupId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Nombre de slots inducement restants pour un matchup.
 */
export async function countRemainingInducementSlots(opts: {
  entryId: string;
  weekId: string;
  matchupId: string;
}): Promise<number> {
  const used = await prisma.nflFantasyInducement.count({
    where: {
      entryId: opts.entryId,
      weekId: opts.weekId,
      matchupId: opts.matchupId,
    },
  });
  return Math.max(0, INDUCEMENT_SLOTS_PER_MATCHUP - used);
}
