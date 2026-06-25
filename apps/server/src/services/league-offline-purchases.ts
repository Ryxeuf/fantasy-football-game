/**
 * Workstream ligue offline — materialisation des ACHATS post-match en
 * mutation reelle du roster (reversible).
 *
 * Contexte : la feuille de match (`LeagueMatchSheet.purchasesHome/Away`)
 * saisit des achats `[{ kind, name, cost, position?, staff? }]`. Le DEBIT
 * de tresorerie est deja applique par `recordOfflineLeagueResult` (via
 * `treasuryDebit`). Ce module se charge de l'autre moitie : creer
 * reellement l'element achete (joueur / relance / staff) sur l'equipe,
 * SANS re-debiter, en memorisant exactement ce qui a ete cree pour
 * permettre une reversion exacte (cf. `league-offline-edit`).
 *
 * Reutilise la logique existante :
 *  - `getRosterFromDb` pour les positions/stats d'un joueur recrute ;
 *  - `resolveStaffConfigBySlug` pour les plafonds (relances/staff) ;
 *  - `updateTeamValues` pour le recalcul TV apres mutation.
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { getRosterFromDb } from "../utils/roster-helpers";
import { updateTeamValues } from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  DEFAULT_RULESET,
  type AllowedRoster,
  type Ruleset,
  type GameFormat,
  isGameFormat,
} from "@bb/game-engine";
import { serverLog } from "../utils/server-log";

export type OfflinePurchaseKind = "player" | "reroll" | "staff" | "other";
export type OfflineStaffKind =
  | "assistant"
  | "cheerleader"
  | "apothecary"
  | "dedicated_fan";

export interface OfflinePurchaseInput {
  readonly kind: OfflinePurchaseKind;
  readonly name: string;
  readonly cost: number;
  /** Pour `kind:'player'` : slug de position du roster (sinon resolu par cout). */
  readonly position?: string | null;
  /** Pour `kind:'staff'` : sous-type de staff (sinon resolu par `name`). */
  readonly staff?: OfflineStaffKind | null;
  /** Numero de maillot force (sinon plus petit numero libre). */
  readonly number?: number | null;
}

/**
 * Trace exacte des mutations appliquees a UNE equipe par les achats, pour
 * permettre la reversion (supprimer les joueurs crees, decrementer les
 * compteurs des deltas exacts).
 */
export interface OfflineRosterMutationSide {
  readonly createdPlayerIds: readonly string[];
  readonly rerollsAdded: number;
  readonly assistantsAdded: number;
  readonly cheerleadersAdded: number;
  readonly apothecaryAdded: boolean;
  readonly dedicatedFansAdded: number;
}

export interface OfflineRosterMutations {
  readonly home: OfflineRosterMutationSide;
  readonly away: OfflineRosterMutationSide;
}

export const EMPTY_MUTATION_SIDE: OfflineRosterMutationSide = {
  createdPlayerIds: [],
  rerollsAdded: 0,
  assistantsAdded: 0,
  cheerleadersAdded: 0,
  apothecaryAdded: false,
  dedicatedFansAdded: 0,
};

/** Vrai si une cote a au moins une mutation a memoriser / reverser. */
export function sideHasMutation(s: OfflineRosterMutationSide): boolean {
  return (
    s.createdPlayerIds.length > 0 ||
    s.rerollsAdded !== 0 ||
    s.assistantsAdded !== 0 ||
    s.cheerleadersAdded !== 0 ||
    s.apothecaryAdded ||
    s.dedicatedFansAdded !== 0
  );
}

export function hasAnyMutation(m: OfflineRosterMutations): boolean {
  return sideHasMutation(m.home) || sideHasMutation(m.away);
}

/**
 * Parse tolerant (array PG / string sqlite) d'une liste d'achats vers
 * `OfflinePurchaseInput[]`. Ignore les entrees illisibles. Conserve les
 * champs optionnels `position`/`staff`/`number` quand presents.
 */
export function parsePurchases(raw: unknown): OfflinePurchaseInput[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const KINDS = new Set(["player", "reroll", "staff", "other"]);
  const STAFF = new Set([
    "assistant",
    "cheerleader",
    "apothecary",
    "dedicated_fan",
  ]);
  const out: OfflinePurchaseInput[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!KINDS.has(kind)) continue;
    const cost =
      typeof o.cost === "number" && Number.isFinite(o.cost)
        ? Math.max(0, Math.floor(o.cost))
        : 0;
    const position =
      typeof o.position === "string" && o.position.length > 0
        ? o.position
        : null;
    const staff =
      typeof o.staff === "string" && STAFF.has(o.staff)
        ? (o.staff as OfflineStaffKind)
        : null;
    const number =
      typeof o.number === "number" && Number.isFinite(o.number)
        ? Math.floor(o.number)
        : null;
    out.push({
      kind: kind as OfflinePurchaseKind,
      name: typeof o.name === "string" ? o.name : "",
      cost,
      position,
      staff,
      number,
    });
  }
  return out;
}

/** Devine le sous-type de staff a partir du libelle saisi (fallback). */
function inferStaffKind(name: string): OfflineStaffKind | null {
  const n = name.toLowerCase();
  if (/apoth/.test(n)) return "apothecary";
  if (/cheer|pom|majorette/.test(n)) return "cheerleader";
  if (/fan|supporter|public/.test(n)) return "dedicated_fan";
  if (/assist|coach|entra|staff|soigneur/.test(n)) return "assistant";
  return null;
}

interface TeamCounters {
  rerolls: number;
  assistants: number;
  cheerleaders: number;
  apothecary: boolean;
  dedicatedFans: number;
  roster: string;
  ruleset: string;
  format: string;
  players: Array<{ number: number; dead: boolean }>;
}

/** Plus petit numero de maillot libre (1..16) parmi les joueurs vivants. */
function nextFreeNumber(
  used: ReadonlySet<number>,
  forced: number | null,
): number {
  if (forced && forced > 0 && !used.has(forced)) return forced;
  for (let n = 1; n <= 16; n++) {
    if (!used.has(n)) return n;
  }
  // Au-dela de 16 : poursuit pour rester defensif (la regle BB cape a 16,
  // mais on ne veut pas boucler a l'infini si la saisie est aberrante).
  let n = 17;
  while (used.has(n)) n++;
  return n;
}

/**
 * Applique les achats d'une equipe : creation de joueurs + increments de
 * compteurs (plafonnes), puis recalcul TV. Retourne la trace exacte des
 * mutations. Aucun debit de tresorerie (deja applique en amont).
 */
export async function applyOfflinePurchasesForTeam(
  teamId: string,
  purchases: readonly OfflinePurchaseInput[],
): Promise<OfflineRosterMutationSide> {
  if (purchases.length === 0) return EMPTY_MUTATION_SIDE;

  const team = (await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      rerolls: true,
      assistants: true,
      cheerleaders: true,
      apothecary: true,
      dedicatedFans: true,
      roster: true,
      ruleset: true,
      format: true,
      players: { select: { number: true, dead: true } },
    },
  })) as TeamCounters | null;
  if (!team) return EMPTY_MUTATION_SIDE;

  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : "bb11";
  const staff = await resolveStaffConfigBySlug(team.roster, ruleset, format);

  // Compteurs cibles (clampes aux plafonds). On capture l'etat courant pour
  // calculer le delta REELLEMENT applique (reversion exacte).
  let rerolls = team.rerolls;
  let assistants = team.assistants;
  let cheerleaders = team.cheerleaders;
  let dedicatedFans = team.dedicatedFans;
  let apothecary = team.apothecary;
  let apothecaryAdded = false;

  const usedNumbers = new Set<number>(
    team.players.filter((p) => !p.dead).map((p) => p.number),
  );
  let aliveCount = team.players.filter((p) => !p.dead).length;

  const rosterData = await getRosterFromDb(
    team.roster as AllowedRoster,
    "fr",
    ruleset,
  );

  const createdPlayerIds: string[] = [];

  for (const p of purchases) {
    switch (p.kind) {
      case "reroll":
        if (rerolls < staff.maxRerolls) rerolls += 1;
        break;
      case "staff": {
        const sub = p.staff ?? inferStaffKind(p.name);
        if (sub === "assistant") {
          if (assistants < staff.maxAssistants) assistants += 1;
        } else if (sub === "cheerleader") {
          if (cheerleaders < staff.maxCheerleaders) cheerleaders += 1;
        } else if (sub === "apothecary") {
          if (!apothecary && staff.apothecaryAllowed) {
            apothecary = true;
            apothecaryAdded = true;
          }
        } else if (sub === "dedicated_fan") {
          if (dedicatedFans < 6) dedicatedFans += 1;
        } else {
          serverLog.warn(
            `[league-offline-purchases] staff non resolu (name="${p.name}") team=${teamId} — ignore`,
          );
        }
        break;
      }
      case "player": {
        if (!rosterData) {
          serverLog.warn(
            `[league-offline-purchases] roster introuvable (${team.roster}) — joueur non cree`,
          );
          break;
        }
        if (aliveCount >= 16) {
          serverLog.warn(
            `[league-offline-purchases] 16 joueurs vivants atteints team=${teamId} — joueur "${p.name}" non cree`,
          );
          break;
        }
        const position = resolvePosition(rosterData.positions, p);
        if (!position) {
          serverLog.warn(
            `[league-offline-purchases] position non resolue (name="${p.name}", cost=${p.cost}) team=${teamId} — joueur non cree`,
          );
          break;
        }
        const number = nextFreeNumber(usedNumbers, p.number ?? null);
        usedNumbers.add(number);
        const created = await prisma.teamPlayer.create({
          data: {
            teamId,
            name: (p.name || position.displayName).trim().slice(0, 120),
            position: position.slug,
            number,
            ma: position.ma,
            st: position.st,
            ag: position.ag,
            pa: position.pa,
            av: position.av,
            skills: position.skills,
          },
          select: { id: true },
        });
        createdPlayerIds.push(created.id);
        aliveCount += 1;
        break;
      }
      case "other":
      default:
        break;
    }
  }

  const rerollsAdded = rerolls - team.rerolls;
  const assistantsAdded = assistants - team.assistants;
  const cheerleadersAdded = cheerleaders - team.cheerleaders;
  const dedicatedFansAdded = dedicatedFans - team.dedicatedFans;

  if (
    rerollsAdded ||
    assistantsAdded ||
    cheerleadersAdded ||
    dedicatedFansAdded ||
    apothecaryAdded
  ) {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        rerolls,
        assistants,
        cheerleaders,
        dedicatedFans,
        apothecary,
      },
    });
  }

  const mutation: OfflineRosterMutationSide = {
    createdPlayerIds,
    rerollsAdded,
    assistantsAdded,
    cheerleadersAdded,
    apothecaryAdded,
    dedicatedFansAdded,
  };

  if (sideHasMutation(mutation)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as unknown as PrismaClient, teamId);
  }
  return mutation;
}

interface RosterPositionLite {
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
}

/**
 * Resout la position d'un joueur achete : slug explicite prioritaire,
 * sinon match unique par cout (`cost*1000`). Ambiguite / absence -> null.
 */
function resolvePosition(
  positions: readonly RosterPositionLite[],
  p: OfflinePurchaseInput,
): RosterPositionLite | null {
  if (p.position) {
    const bySlug = positions.find((x) => x.slug === p.position);
    if (bySlug) return bySlug;
  }
  if (p.cost > 0) {
    const byCost = positions.filter((x) => x.cost * 1000 === p.cost);
    if (byCost.length === 1) return byCost[0];
  }
  return null;
}

/**
 * Garde-fou de reversion : refuse si un joueur cree a deja "consomme" le
 * resultat (a joue un match ulterieur, gagne du SPP, progresse ou est mort).
 * Meme esprit que le garde-fou `advancement-consumed`.
 */
export async function offlinePurchasesConsumed(
  m: OfflineRosterMutations,
): Promise<boolean> {
  const ids = [...m.home.createdPlayerIds, ...m.away.createdPlayerIds];
  if (ids.length === 0) return false;
  const players = (await prisma.teamPlayer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      spp: true,
      matchesPlayed: true,
      dead: true,
      advancements: true,
    },
  })) as Array<{
    id: string;
    spp: number;
    matchesPlayed: number;
    dead: boolean;
    advancements: unknown;
  }>;
  return players.some(
    (pl) =>
      pl.spp > 0 ||
      pl.matchesPlayed > 0 ||
      pl.dead ||
      advancementsLength(pl.advancements) > 0,
  );
}

function advancementsLength(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Construit les ops Prisma de reversion des achats d'une equipe : suppression
 * des joueurs crees + decrement des compteurs (des deltas exacts memorises).
 * Le recalcul TV est laisse au caller (apres la transaction). Idempotent si
 * les joueurs ont deja disparu (deleteMany).
 */
export function buildPurchaseReverseOps(
  teamId: string,
  m: OfflineRosterMutationSide,
): Promise<unknown>[] {
  const ops: Promise<unknown>[] = [];
  if (m.createdPlayerIds.length > 0) {
    ops.push(
      prisma.teamPlayer.deleteMany({
        where: { id: { in: [...m.createdPlayerIds] } },
      }),
    );
  }
  const counterData: Record<string, unknown> = {};
  if (m.rerollsAdded) counterData.rerolls = { decrement: m.rerollsAdded };
  if (m.assistantsAdded)
    counterData.assistants = { decrement: m.assistantsAdded };
  if (m.cheerleadersAdded)
    counterData.cheerleaders = { decrement: m.cheerleadersAdded };
  if (m.dedicatedFansAdded)
    counterData.dedicatedFans = { decrement: m.dedicatedFansAdded };
  if (m.apothecaryAdded) counterData.apothecary = false;
  if (Object.keys(counterData).length > 0) {
    ops.push(prisma.team.update({ where: { id: teamId }, data: counterData }));
  }
  return ops;
}
