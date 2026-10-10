/**
 * Contexte d'achat de coups de pouce À LA CONSTRUCTION d'une équipe.
 *
 * Un coup de pouce ne s'achète au build que dans deux cas :
 *  - l'équipe est construite pour une coupe en mode `build` (Flow B, clone) ;
 *  - l'équipe est construite sous un règlement de tournoi, qui place ses
 *    coups de pouce sur le budget d'or de la création.
 * Partout ailleurs, c'est l'avant-match qui les vend.
 *
 * Une seule résolution, partagée par le catalogue servi au builder
 * (`GET /team/build-inducements`) et par la validation du build
 * (`POST /team/build`) : les deux ne doivent jamais diverger sur « est-ce
 * permis ici, et dans quelle liste ? ».
 */

import type { TournamentRulesetDefinition } from "@bb/game-engine";
import { prisma } from "../prisma";
import { getTournamentRulesetDefinition } from "./tournament-ruleset-repository";
import {
  parseCupAllowedInducements,
  resolveCupInducementMode,
  type CupInducementMode,
} from "./cup-inducement-mode";

export interface BuildInducementContext {
  /** Le build peut-il porter des coups de pouce ? */
  readonly allowed: boolean;
  /** Règlement de tournoi effectif (celui de la coupe prime). */
  readonly pack: TournamentRulesetDefinition | null;
  /** Liste autorisée par la coupe (`null` = tout le catalogue à prix fixe). */
  readonly allowlist: string[] | null;
  /** Mode de la coupe visée (`null` hors coupe). */
  readonly cupMode: CupInducementMode | null;
}

export type BuildInducementContextResult =
  | { readonly ok: true; readonly context: BuildInducementContext }
  | { readonly ok: false; readonly error: "cup_not_found" | "unknown_ruleset" };

/** Données d'une coupe utiles au contexte (déjà chargées par l'appelant). */
export interface CupForBuildInducements {
  readonly format: string;
  readonly tournamentRuleset?: string | null;
  readonly inducementMode?: unknown;
  readonly allowedInducements?: unknown;
}

/**
 * Contexte PUR à partir d'une coupe déjà chargée (ou d'aucune) et du
 * règlement déjà résolu.
 */
export function buildInducementContextFrom(input: {
  readonly cup: CupForBuildInducements | null;
  readonly pack: TournamentRulesetDefinition | null;
}): BuildInducementContext {
  const { cup, pack } = input;
  if (cup) {
    const cupMode = resolveCupInducementMode(cup.inducementMode, {
      hasTournamentRuleset: Boolean(pack),
      format: cup.format,
    });
    return {
      allowed: cupMode === "build",
      pack,
      allowlist: parseCupAllowedInducements(cup.allowedInducements),
      cupMode,
    };
  }
  return { allowed: Boolean(pack), pack, allowlist: null, cupMode: null };
}

/**
 * Résout le contexte d'un build à partir de la coupe visée (`cupId`) et/ou
 * du règlement demandé. Le règlement de la coupe prime sur celui demandé,
 * comme dans `POST /team/build`.
 */
export async function resolveBuildInducementContext(input: {
  readonly cupId?: string | null;
  readonly tournamentRuleset?: string | null;
}): Promise<BuildInducementContextResult> {
  let cup: CupForBuildInducements | null = null;
  if (input.cupId) {
    cup = (await prisma.cup.findUnique({
      where: { id: input.cupId },
      select: {
        format: true,
        tournamentRuleset: true,
        inducementMode: true,
        allowedInducements: true,
      },
    })) as CupForBuildInducements | null;
    if (!cup) return { ok: false, error: "cup_not_found" };
  }
  const packSlug = cup ? (cup.tournamentRuleset ?? null) : input.tournamentRuleset;
  let pack: TournamentRulesetDefinition | null = null;
  if (packSlug) {
    pack = await getTournamentRulesetDefinition(packSlug);
    if (!pack) return { ok: false, error: "unknown_ruleset" };
  }
  return { ok: true, context: buildInducementContextFrom({ cup, pack }) };
}
