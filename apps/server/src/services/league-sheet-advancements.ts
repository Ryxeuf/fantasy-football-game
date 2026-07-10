/**
 * Évolutions de joueurs saisies sur la feuille de match (staging).
 *
 * Nouveau workflow : les évolutions font partie de la SAISIE de la
 * feuille de match — chaque coach stage les choix de ses joueurs
 * (contre son PSP projeté) puis « valide sa saisie » qui couvre le
 * match dans son ensemble (fin de match + évolutions). Rien n'est
 * appliqué aux rosters avant la validation commissaire :
 *
 *   1. staging  : PATCH post-match `advancementsHome/Away` (JSON sur
 *      LeagueMatchSheet, validé Zod + ownership côté coach) ;
 *   2. application : à `validateByCommissioner`, APRÈS l'attribution
 *      des PSP (`recordOfflineLeagueResult`), chaque entrée est
 *      appliquée via `applyAdvancementChoice` (qui re-vérifie tout :
 *      PSP disponibles, accès primaire/secondaire, candidats du tirage
 *      aléatoire, plafonds). Les entrées sont enrichies en retour
 *      ({ applied, cost } ou { applied: false, skipReason }) et
 *      réécrites sur la feuille (trace + support du reversal) ;
 *   3. reversal : à `invalidateMatchSheet`, chaque entrée appliquée
 *      est reversée (PSP remboursés, compétence/carac retirée, VE
 *      décrémentée) et les marqueurs `applied` sont nettoyés pour
 *      qu'une re-validation ré-applique proprement.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  getNextAdvancementPspCost,
  surchargeForAdvancement,
  type AdvancementType,
  type CharacteristicKind,
  type PlayerAdvancement,
} from "@bb/game-engine";
import { applyAdvancementChoice } from "./post-match-league-sequence";

/** Une évolution stagée par un coach sur la feuille de match. */
export interface StagedAdvancement {
  readonly playerId: string;
  readonly type: AdvancementType;
  readonly skillSlug?: string | null;
  readonly category?: string | null;
  readonly stat?: CharacteristicKind | null;
  readonly d8?: number | null;
  /** Enrichi à la validation : true = appliquée au roster. */
  readonly applied?: boolean;
  /** Enrichi à la validation : coût PSP effectivement débité. */
  readonly cost?: number;
  /** Enrichi à la validation si non appliquée (raison du skip). */
  readonly skipReason?: string;
}

const ADVANCEMENT_TYPES: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "random-primary",
  "characteristic",
]);

/**
 * Parser tolérant PG (array natif) / sqlite (string JSON) / null.
 * Ignore les entrées illisibles.
 */
export function parseStagedAdvancements(raw: unknown): StagedAdvancement[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: StagedAdvancement[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (typeof o.playerId !== "string" || o.playerId.length === 0) continue;
    if (typeof o.type !== "string" || !ADVANCEMENT_TYPES.has(o.type)) continue;
    out.push({
      playerId: o.playerId,
      type: o.type as AdvancementType,
      skillSlug: typeof o.skillSlug === "string" ? o.skillSlug : null,
      category: typeof o.category === "string" ? o.category : null,
      stat:
        typeof o.stat === "string"
          ? (o.stat as CharacteristicKind)
          : null,
      d8: typeof o.d8 === "number" ? o.d8 : null,
      applied: typeof o.applied === "boolean" ? o.applied : undefined,
      cost: typeof o.cost === "number" ? o.cost : undefined,
      skipReason: typeof o.skipReason === "string" ? o.skipReason : undefined,
    });
  }
  return out;
}

/**
 * Applique les évolutions stagées d'une équipe (à la validation
 * commissaire, PSP déjà attribués). Tolérant : une entrée refusée par
 * `applyAdvancementChoice` (PSP insuffisants, accès, candidats…) est
 * marquée `applied: false` + `skipReason` sans bloquer la validation.
 */
export async function applyStagedAdvancements(input: {
  teamId: string;
  entries: readonly StagedAdvancement[];
}): Promise<StagedAdvancement[]> {
  const out: StagedAdvancement[] = [];
  for (const entry of input.entries) {
    // Idempotence (re-validation après already-scored) : ne ré-applique
    // pas une entrée déjà appliquée.
    if (entry.applied === true) {
      out.push(entry);
      continue;
    }
    const result = await applyAdvancementChoice({
      teamId: input.teamId,
      playerId: entry.playerId,
      type: entry.type,
      skillSlug: entry.skillSlug ?? undefined,
      category: entry.category ?? undefined,
      stat: entry.stat ?? undefined,
      d8: entry.d8 ?? undefined,
    });
    if ("applied" in result && result.applied) {
      const cost = getNextAdvancementPspCost(
        Math.max(result.newAdvancementCount - 1, 0),
        entry.type,
      );
      out.push({ ...entry, applied: true, cost, skipReason: undefined });
    } else {
      const reason =
        "reason" in result && typeof result.reason === "string"
          ? result.reason
          : "unknown";
      serverLog.info(
        `[league-sheet-advancements] skip player=${entry.playerId} type=${entry.type}: ${reason}`,
      );
      out.push({ ...entry, applied: false, cost: undefined, skipReason: reason });
    }
  }
  return out;
}

/** Retire UNE occurrence d'un slug d'un CSV de compétences. */
function removeSkillOnce(csv: string | null, slug: string): string {
  const parts = (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const idx = parts.lastIndexOf(slug);
  if (idx >= 0) parts.splice(idx, 1);
  return parts.join(",");
}

/** Inverse d'`applyCharacteristicImprovement` (ma/st/av +1 ; ag/pa −1). */
function reverseCharacteristic(
  stats: { ma: number; st: number; ag: number; pa: number | null; av: number },
  stat: CharacteristicKind,
): { ma: number; st: number; ag: number; pa: number | null; av: number } {
  switch (stat) {
    case "ma":
      return { ...stats, ma: stats.ma - 1 };
    case "st":
      return { ...stats, st: stats.st - 1 };
    case "av":
      return { ...stats, av: stats.av - 1 };
    case "ag":
      return { ...stats, ag: stats.ag + 1 };
    case "pa":
      return stats.pa === null ? stats : { ...stats, pa: stats.pa + 1 };
  }
}

function parsePlayerAdvancements(raw: string | null): PlayerAdvancement[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reverse les évolutions appliquées à la validation (appelé par
 * `invalidateMatchSheet` APRÈS le reverse du résultat offline).
 * Best-effort : un joueur introuvable ou une entrée sans correspondance
 * dans `advancements` est loggé et ignoré (pas de throw — la feuille
 * doit pouvoir être invalidée). Retourne les entrées nettoyées de leurs
 * marqueurs d'application (prêtes pour une re-validation).
 */
export async function reverseAppliedAdvancements(input: {
  teamId: string;
  entries: readonly StagedAdvancement[];
}): Promise<StagedAdvancement[]> {
  const out: StagedAdvancement[] = [];
  for (const entry of input.entries) {
    const cleaned: StagedAdvancement = {
      ...entry,
      applied: undefined,
      cost: undefined,
      skipReason: undefined,
    };
    out.push(cleaned);
    if (entry.applied !== true) continue;

    const player = (await prisma.teamPlayer.findUnique({
      where: { id: entry.playerId },
      select: {
        id: true,
        teamId: true,
        spp: true,
        skills: true,
        advancements: true,
        ma: true,
        st: true,
        ag: true,
        pa: true,
        av: true,
      },
    })) as {
      id: string;
      teamId: string;
      spp: number;
      skills: string | null;
      advancements: string | null;
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
    } | null;
    if (!player || player.teamId !== input.teamId) {
      serverLog.error(
        `[league-sheet-advancements] reverse: player ${entry.playerId} introuvable/hors équipe`,
      );
      continue;
    }

    const taken = parsePlayerAdvancements(player.advancements);
    // Dernière entrée correspondante (le coach a pu prendre d'autres
    // avancements APRÈS la validation : on ne retire que la nôtre).
    let idx = -1;
    for (let i = taken.length - 1; i >= 0; i--) {
      const a = taken[i];
      if (a.type !== entry.type) continue;
      if (entry.type === "characteristic") {
        if (a.stat === entry.stat) {
          idx = i;
          break;
        }
      } else if (a.skillSlug === entry.skillSlug) {
        idx = i;
        break;
      }
    }
    if (idx < 0) {
      serverLog.error(
        `[league-sheet-advancements] reverse: avancement ${entry.type}/${entry.skillSlug ?? entry.stat} introuvable pour ${entry.playerId}`,
      );
      continue;
    }

    const refund =
      typeof entry.cost === "number"
        ? entry.cost
        : getNextAdvancementPspCost(idx, entry.type);
    const surcharge = surchargeForAdvancement({
      type: entry.type,
      stat: entry.stat ?? undefined,
    });
    const updatedAdvancements = [...taken.slice(0, idx), ...taken.slice(idx + 1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {
        spp: { increment: refund },
        advancements: JSON.stringify(updatedAdvancements),
      };
      if (entry.type === "characteristic" && entry.stat) {
        const reversed = reverseCharacteristic(
          {
            ma: player.ma,
            st: player.st,
            ag: player.ag,
            pa: player.pa,
            av: player.av,
          },
          entry.stat,
        );
        data.ma = reversed.ma;
        data.st = reversed.st;
        data.ag = reversed.ag;
        data.pa = reversed.pa;
        data.av = reversed.av;
      } else if (entry.skillSlug) {
        data.skills = removeSkillOnce(player.skills, entry.skillSlug);
      }
      await tx.teamPlayer.update({ where: { id: player.id }, data });
      await tx.team.update({
        where: { id: input.teamId },
        data: { currentValue: { decrement: surcharge } },
      });
    });
  }
  return out;
}
