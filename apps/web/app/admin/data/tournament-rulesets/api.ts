/**
 * Helpers HTTP locaux des pages admin « Règlements de tournoi ».
 * Convention /admin/data/* : fetch direct sur API_BASE + token localStorage
 * (cf. pages voisines rosters). Les routes /admin/tournament-rulesets
 * répondent en enveloppe ApiResponse ({ success, data }) → unwrap ici.
 */

import { API_BASE } from "../../../auth-client";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return { Authorization: token ? `Bearer ${token}` : "" };
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string })?.error || `Erreur ${res.status}`,
    );
  }
  const envelope = json as { success?: boolean; data?: T };
  return (envelope.data ?? (json as T)) as T;
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  return unwrap<T>(res);
}

export async function sendJSON<T>(
  method: "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(res);
}

/** Règles par roster telles qu'éditées / envoyées à l'API admin. */
export interface RosterRuleValue {
  goldBudget: number;
  sppBudget: number;
  skillStacking: "none" | "one_player" | "two_players";
  starPlayersAllowed: boolean;
}

export interface TaxBracketValue {
  /** null = tranche ouverte (∞). */
  maxTotalCostK: number | null;
  spp: number;
}

export interface InducementValue {
  slug: string;
  cost: number;
  max?: number;
  noteFr?: string;
}

/** Corps create/update de l'API admin (le slug est immuable en édition). */
export interface TournamentRulesetFormValues {
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
  rosterRules: Record<string, RosterRuleValue>;
  skillCosts: {
    firstPrimary: number;
    firstSecondary: number;
    secondPrimary: number;
    secondSecondary: number;
    eliteSurcharge: number;
  };
  eliteSkills: string[];
  bannedStarPlayers: string[];
  starPlayerSppTax: TaxBracketValue[];
  allowedInducements: InducementValue[];
  scoring: { win: number; draw: number; loss: number; concession: number };
}

/** Détail renvoyé par GET /admin/tournament-rulesets/:id. */
export interface TournamentRulesetDetail extends TournamentRulesetFormValues {
  id: string;
  archived: boolean;
  archivedAt: string | null;
}

export interface TournamentRulesetSummary {
  id: string | null;
  slug: string;
  nameFr: string;
  shortLabel: string;
  version: string;
  edition: string;
  format: string;
  resurrection: boolean;
  archived: boolean;
  source: "db" | "static";
}

export const FORM_DEFAULTS: TournamentRulesetFormValues = {
  slug: "",
  nameFr: "",
  nameEn: "",
  shortLabel: "",
  version: "V1",
  edition: "season_3",
  format: "bb11",
  descriptionFr: "",
  resurrection: true,
  minRegularPlayersBeforeStars: 11,
  rosterRules: {},
  skillCosts: {
    firstPrimary: 6,
    firstSecondary: 10,
    secondPrimary: 8,
    secondSecondary: 12,
    eliteSurcharge: 2,
  },
  eliteSkills: [],
  bannedStarPlayers: [],
  starPlayerSppTax: [],
  allowedInducements: [],
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};
