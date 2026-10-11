/**
 * `GET /team/build-inducements` — catalogue des coups de pouce achetables
 * À LA CONSTRUCTION d'une équipe, prix et plafonds résolus par le serveur
 * (le builder n'a aucun calcul de prix propre).
 *
 * Hors contexte autorisé (ni coupe en mode `build`, ni règlement de
 * tournoi), la liste est vide et `allowed` vaut `false` : le builder masque
 * alors sa section.
 */

import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { resolveRuleset } from "../utils/ruleset-helpers";
import { serverLog } from "../utils/server-log";
import type { BuildInducementsQuery } from "../schemas/team.schemas";
import { resolveBuildInducementContext } from "../services/build-inducement-context";
import {
  buildInducementCatalogue,
  type InducementOption,
} from "../services/inducement-options";
import type { CupInducementMode } from "../services/cup-inducement-mode";

export interface BuildInducementsResponse {
  readonly allowed: boolean;
  /** Mode de la coupe visée (`null` hors coupe). */
  readonly cupMode: CupInducementMode | null;
  readonly inducements: readonly InducementOption[];
}

/** Slugs d'une liste CSV (vides et doublons écartés). */
export function parseSlugCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ];
}

export async function handleGetBuildInducements(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> {
  const query = req.query as unknown as BuildInducementsQuery;
  try {
    const resolved = await resolveBuildInducementContext({
      cupId: query.cupId,
      tournamentRuleset: query.tournamentRuleset,
    });
    if (!resolved.ok) {
      return resolved.error === "cup_not_found"
        ? sendError(res, "Coupe introuvable", 404)
        : sendError(res, "Règlement de tournoi inconnu", 400);
    }
    const { context } = resolved;
    if (!context.allowed) {
      return sendSuccess<BuildInducementsResponse>(res, {
        allowed: false,
        cupMode: context.cupMode,
        inducements: [],
      });
    }
    const inducements = await buildInducementCatalogue({
      roster: query.roster,
      ruleset: resolveRuleset(context.pack?.edition ?? query.ruleset),
      regionalLeague: query.regionalLeague ?? null,
      pack: context.pack,
      allowlist: context.allowlist,
      hiredStarSlugs: parseSlugCsv(query.stars),
    });
    return sendSuccess<BuildInducementsResponse>(res, {
      allowed: true,
      cupMode: context.cupMode,
      inducements,
    });
  } catch (e: unknown) {
    serverLog.error("[team] catalogue de coups de pouce du build:", e);
    return sendError(res, "Erreur serveur", 500);
  }
}
