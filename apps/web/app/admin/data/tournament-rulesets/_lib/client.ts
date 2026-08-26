"use client";

/**
 * Client des routes admin « règlements de tournoi ».
 *
 * Particularité : le serveur renvoie, en cas de refus, la liste des champs
 * fautifs (`issues[] = { path, message }`) produite par le parser Zod. On la
 * remonte telle quelle pour que l'éditeur affiche chaque message EN REGARD du
 * champ concerné — la validation n'est pas dupliquée côté client, elle est
 * simplement rendue.
 */

import { API_BASE } from "../../../../auth-client";

/** Un champ refusé par le parser. `path` = chemin pointé de la définition. */
export interface DefinitionIssue {
  readonly path: string;
  readonly message: string;
}

/** Erreur d'API portant, quand elle existe, la liste des champs fautifs. */
export class RulesetApiError extends Error {
  constructor(
    message: string,
    readonly issues: readonly DefinitionIssue[] = [],
    readonly status = 0,
  ) {
    super(message);
    this.name = "RulesetApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/admin/data/tournament-rulesets${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: token ? `Bearer ${token}` : "",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: DefinitionIssue[];
  };
  if (!res.ok) {
    throw new RulesetApiError(
      body.error || `Erreur ${res.status}`,
      body.issues ?? [],
      res.status,
    );
  }
  return body as T;
}

/** Ligne de la liste admin. */
export interface RulesetSummary {
  slug: string;
  enabled: boolean;
  /** `db` = édité en base ; `engine` = encore servi par le registre du code. */
  source: "db" | "engine";
  nameFr: string;
  shortLabel: string;
  version: string;
  edition: string;
  format: string;
  rosterCount: number;
}

/** Définition éditable (forme sérialisée : borne de taxe ouverte = `null`). */
export interface EditableDefinition {
  slug: string;
  nameFr: string;
  nameEn: string;
  shortLabel: string;
  version: string;
  edition: "season_2" | "season_3";
  format: "bb11" | "sevens";
  descriptionFr: string;
  resurrection: boolean;
  minRegularPlayersBeforeStars: number;
  rosterRules: Record<
    string,
    {
      goldBudget: number;
      sppBudget: number;
      skillStacking: "none" | "one_player" | "two_players";
      starPlayersAllowed: boolean;
    }
  >;
  skillCosts: {
    firstPrimary: number;
    firstSecondary: number;
    secondPrimary: number;
    secondSecondary: number;
    eliteSurcharge: number;
  };
  eliteSkills: string[];
  bannedStarPlayers: string[];
  starPlayerSppTax: Array<{ maxTotalCostK: number | null; spp: number }>;
  allowedInducements: Array<{
    slug: string;
    cost: number;
    max?: number;
    noteFr?: string;
  }>;
  scoring: { win: number; draw: number; loss: number; concession: number };
  regionalLeagueChoice?: boolean;
}

export interface RulesetDetail {
  slug: string;
  enabled: boolean;
  source: "db" | "engine";
  definition: EditableDefinition;
}

export function listRulesets(): Promise<{ rulesets: RulesetSummary[] }> {
  return request("/");
}

export function getRuleset(slug: string): Promise<RulesetDetail> {
  return request(`/${encodeURIComponent(slug)}`);
}

/** Validation à blanc : même vérité que l'enregistrement, sans écrire. */
export function validateRuleset(
  definition: EditableDefinition,
): Promise<{ valid: true; slug: string }> {
  return request("/validate", {
    method: "POST",
    body: JSON.stringify({ definition }),
  });
}

export function createRuleset(
  definition: EditableDefinition,
  enabled: boolean,
): Promise<{ slug: string }> {
  return request("/", {
    method: "POST",
    body: JSON.stringify({ definition, enabled }),
  });
}

export function updateRuleset(
  slug: string,
  definition: EditableDefinition,
  enabled: boolean,
): Promise<{ slug: string }> {
  return request(`/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify({ definition, enabled }),
  });
}

export function resetRuleset(slug: string): Promise<{ slug: string }> {
  return request(`/${encodeURIComponent(slug)}/reset`, { method: "POST" });
}

export function deleteRuleset(slug: string): Promise<{ slug: string }> {
  return request(`/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

/** Indexe les erreurs par chemin pour un affichage au pied de chaque champ. */
export function issuesByPath(
  issues: readonly DefinitionIssue[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const issue of issues) {
    if (!map.has(issue.path)) map.set(issue.path, issue.message);
  }
  return map;
}
