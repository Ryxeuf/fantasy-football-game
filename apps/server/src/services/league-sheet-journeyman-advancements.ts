/**
 * Évolution d'un JOURNALIER stagée sur la feuille de match.
 *
 * Un journalier n'a pas de ligne TeamPlayer : son évolution ne passe pas par
 * `applyAdvancementChoice` (qui re-vérifie tout pour un joueur du roster).
 * Elle est matérialisée à l'étape 4 — EMBAUCHES — s'il est recruté
 * (`buildJourneymanHire`), et perdue avec lui sinon. Ce module porte ce que
 * `applyAdvancementChoice` faisait pour les autres :
 *
 *  - `verifyJourneymanAdvancement` : MÊME contrat — compétence déjà
 *    possédée refusée, tirage `random-primary` re-dérivé (seed feuille +
 *    journalier + poste + catégorie) et compétence exigée parmi les deux
 *    candidats, catégorie Principale du poste, accès au pool du poste pour
 *    un choix libre, compétence exclue de la sélection refusée. Sans ça, un
 *    coach pouvait s'offrir n'importe quelle Principale au tarif du hasard.
 *  - `traceJourneymanAdvancements` : le résultat de chaque entrée
 *    (`applied` / `cost` / `skipReason`), réécrit sur la feuille avec celui
 *    des joueurs du roster. Les entrées de journaliers étaient auparavant
 *    PERDUES à la validation (la liste réécrite ne portait que le roster) ou
 *    laissées « en attente » à jamais.
 *
 * Les vérifications restent SOUPLES là où la base ne dit rien (accès non
 * renseigné, catalogue injoignable) — comme pour un joueur du roster.
 */

import {
  isRandomSkillCategory,
  rollRandomPrimaryCandidates,
} from "@bb/game-engine";
import {
  isJourneymanId,
  journeymanRandomPrimarySeed,
  journeymanSkillAccess,
  splitSkillCsv,
  type JourneymanSourcePosition,
  type SheetJourneyman,
} from "./league-sheet-journeymen";
import type { StagedAdvancement } from "./league-sheet-advancements";
import { resolveRandomPrimaryPool } from "./random-primary-pool";
import {
  checkSkillAccess,
  getSkillSelectionInfo,
  parseAccessCsv,
  type SkillCategoryCode,
} from "./skill-access";
import { serverLog } from "../utils/server-log";

/** Raisons de refus d'une évolution de journalier (mêmes codes que le roster). */
export type JourneymanAdvancementSkipReason =
  | "journeyman-not-found"
  | "missing-skill"
  | "skill-already-owned"
  | "missing-category"
  | "invalid-category"
  | "category-not-primary"
  | "random-not-in-candidates"
  | "skill-excluded-from-selection"
  | "skill-not-in-pool";

export type JourneymanAdvancementCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: JourneymanAdvancementSkipReason };

/**
 * Vérifie une évolution stagée pour un journalier (même contrat que
 * `applyAdvancementChoice` pour un joueur du roster).
 */
export async function verifyJourneymanAdvancement(input: {
  readonly sheetId: string;
  readonly ruleset: string;
  readonly journeyman: SheetJourneyman;
  readonly entry: StagedAdvancement;
  /** Postes du roster lus en base (accès Principale/Secondaire). */
  readonly positions?: readonly JourneymanSourcePosition[] | null;
}): Promise<JourneymanAdvancementCheck> {
  const { entry, journeyman } = input;
  // Caractéristique : `stat` + `d8` sont validés par le schéma à la saisie ;
  // pas de pool de compétences à contrôler.
  if (entry.type === "characteristic") return { ok: true };
  if (!entry.skillSlug) return { ok: false, reason: "missing-skill" };
  const owned = splitSkillCsv(journeyman.skills);
  if (owned.includes(entry.skillSlug)) {
    return { ok: false, reason: "skill-already-owned" };
  }
  const access = journeymanSkillAccess(journeyman.position, input.positions);

  if (entry.type === "random-primary") {
    if (!entry.category) return { ok: false, reason: "missing-category" };
    if (!isRandomSkillCategory(entry.category)) {
      return { ok: false, reason: "invalid-category" };
    }
    const category = entry.category;
    if (access.primary != null && !parseAccessCsv(access.primary).has(category)) {
      return { ok: false, reason: "category-not-primary" };
    }
    // MÊMES seed et pool que l'endpoint de tirage : les deux candidats
    // proposés sont exactement ceux re-dérivés ici.
    const candidates = rollRandomPrimaryCandidates({
      category,
      ownedSlugs: owned,
      seed: journeymanRandomPrimarySeed(input.sheetId, journeyman, category),
      pool: await resolveRandomPrimaryPool(category, input.ruleset),
    });
    if (!candidates.includes(entry.skillSlug)) {
      return { ok: false, reason: "random-not-in-candidates" };
    }
    return { ok: true };
  }

  // Choix libre (Principale / Secondaire) : la compétence doit appartenir
  // au pool du poste pour ce type — quand l'accès est renseigné.
  let info: {
    categoryCode: SkillCategoryCode | null;
    excludedFromSelection: boolean;
  };
  try {
    info = await getSkillSelectionInfo(entry.skillSlug, input.ruleset);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-sheet-journeyman-advancements] catalogue de compétences injoignable (${entry.skillSlug}) : ${msg}`,
    );
    return { ok: true };
  }
  if (info.excludedFromSelection) {
    return { ok: false, reason: "skill-excluded-from-selection" };
  }
  const check = checkSkillAccess({
    type: entry.type,
    skillCode: info.categoryCode,
    primarySkills: access.primary,
    secondarySkills: access.secondary,
  });
  if (check === "out-of-pool") return { ok: false, reason: "skill-not-in-pool" };
  return { ok: true };
}

/** Revue des entrées stagées d'un côté : ce qui passe au recrutement, et pourquoi le reste est écarté. */
export interface JourneymanAdvancementReview {
  /**
   * Entrées à transmettre au recrutement : joueurs du roster tels quels
   * (vérifiés par `applyAdvancementChoice`) + journaliers vérifiés.
   */
  readonly staged: readonly StagedAdvancement[];
  /** Journaliers dont l'entrée est écartée, avec la raison. */
  readonly refused: ReadonlyMap<string, JourneymanAdvancementSkipReason>;
}

/**
 * Vérifie toutes les entrées de journaliers d'un côté. Tolérant : une entrée
 * refusée est écartée (et tracée), jamais bloquante pour la validation.
 */
export async function reviewJourneymanAdvancements(input: {
  readonly sheetId: string;
  readonly ruleset: string;
  readonly journeymen: readonly SheetJourneyman[];
  readonly positions?: readonly JourneymanSourcePosition[] | null;
  readonly staged: readonly StagedAdvancement[];
}): Promise<JourneymanAdvancementReview> {
  const byId = new Map(input.journeymen.map((j) => [j.id, j]));
  const refused = new Map<string, JourneymanAdvancementSkipReason>();
  const staged: StagedAdvancement[] = [];
  for (const entry of input.staged) {
    if (!isJourneymanId(entry.playerId)) {
      staged.push(entry);
      continue;
    }
    const journeyman = byId.get(entry.playerId);
    const check: JourneymanAdvancementCheck = journeyman
      ? await verifyJourneymanAdvancement({
          sheetId: input.sheetId,
          ruleset: input.ruleset,
          journeyman,
          entry,
          positions: input.positions,
        })
      : { ok: false, reason: "journeyman-not-found" };
    if (check.ok) {
      staged.push(entry);
      continue;
    }
    refused.set(entry.playerId, check.reason);
    serverLog.info(
      `[league-sheet-journeyman-advancements] skip journeyman=${entry.playerId} type=${entry.type}: ${check.reason}`,
    );
  }
  return { staged, refused };
}

/** Ce que le recrutement a fait de l'évolution stagée d'un journalier recruté. */
export interface JourneymanHireTrace {
  /** L'évolution a été prise (PSP du match suffisants) et matérialisée. */
  readonly advancementTaken: boolean;
  /** Coût PSP du 1er palier pour le type stagé. */
  readonly pspCost: number;
}

/** Entrée débarrassée de ses marqueurs d'application (prête à être ré-évaluée). */
export function clearAdvancementTrace(entry: StagedAdvancement): StagedAdvancement {
  return { ...entry, applied: undefined, cost: undefined, skipReason: undefined };
}

/**
 * Résultat (pur) de chaque entrée de journalier après la séquence de fin de
 * match : refusée à la revue, non recrutée, PSP insuffisants, ou appliquée.
 */
export function traceJourneymanAdvancements(input: {
  readonly staged: readonly StagedAdvancement[];
  readonly review: JourneymanAdvancementReview;
  /** Journaliers recrutés qui avaient une entrée stagée, par id. */
  readonly hires: ReadonlyMap<string, JourneymanHireTrace>;
}): Map<string, StagedAdvancement> {
  const out = new Map<string, StagedAdvancement>();
  for (const entry of input.staged) {
    if (!isJourneymanId(entry.playerId)) continue;
    const refusal = input.review.refused.get(entry.playerId);
    if (refusal) {
      out.set(entry.playerId, {
        ...clearAdvancementTrace(entry),
        applied: false,
        skipReason: refusal,
      });
      continue;
    }
    const hire = input.hires.get(entry.playerId);
    if (!hire) {
      out.set(entry.playerId, {
        ...clearAdvancementTrace(entry),
        applied: false,
        skipReason: "journeyman-not-hired",
      });
      continue;
    }
    out.set(
      entry.playerId,
      hire.advancementTaken
        ? { ...clearAdvancementTrace(entry), applied: true, cost: hire.pspCost }
        : {
            ...clearAdvancementTrace(entry),
            applied: false,
            skipReason: "insufficient-spp",
          },
    );
  }
  return out;
}

/**
 * Liste réécrite sur la feuille à la validation, dans l'ORDRE de la saisie :
 * chaque entrée prend sa version enrichie (roster : `applyStagedAdvancements`,
 * journalier : `traceJourneymanAdvancements`), sinon reste telle quelle.
 */
export function mergeAdvancementTraces(
  staged: readonly StagedAdvancement[],
  rosterApplied: readonly StagedAdvancement[] | undefined,
  journeymen: ReadonlyMap<string, StagedAdvancement>,
): StagedAdvancement[] {
  const roster = new Map((rosterApplied ?? []).map((e) => [e.playerId, e]));
  return staged.map(
    (e) => journeymen.get(e.playerId) ?? roster.get(e.playerId) ?? e,
  );
}
