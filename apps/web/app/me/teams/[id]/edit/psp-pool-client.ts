/**
 * Client HTTP + libellés du pool de PSP de construction, côté édition
 * d'équipe.
 *
 * Le pool (`Team.startingPspPool`) est ce qui finance les compétences
 * achetées hors match. Tant que l'équipe est libre, c'est lui qu'on dépense
 * en priorité — les SPP d'un joueur qui n'a jamais joué valent 0.
 */

import { apiRequest } from "../../../../lib/api-client";

export interface TeamPspPoolState {
  readonly pool: number;
  readonly spent: number;
  readonly remaining: number;
  /** Pool imposé par une coupe : non modifiable par le coach. */
  readonly locked: boolean;
  /** Règlement de tournoi retenu à la création (null = barème standard). */
  readonly tournamentRuleset: string | null;
}

export interface PlayerAdvancementView {
  readonly type: string;
  readonly skillSlug?: string;
  readonly stat?: string;
  readonly pspCost?: number;
  readonly fundedBy?: "pool" | "player";
  readonly isRandom?: boolean;
}

/** Borne haute du pool, miroir du builder et du schéma serveur. */
export const MAX_STARTING_PSP_POOL = 200;

export async function fetchPspPool(teamId: string): Promise<TeamPspPoolState> {
  return apiRequest<TeamPspPoolState>(`/team/${teamId}/psp-pool`);
}

export async function savePspPool(
  teamId: string,
  startingPspPool: number,
): Promise<TeamPspPoolState> {
  return apiRequest<TeamPspPoolState>(`/team/${teamId}/psp-pool`, {
    method: "PUT",
    body: JSON.stringify({ startingPspPool }),
  });
}

export interface RemoveAdvancementResponse {
  readonly player: { skills: string; advancements: string; spp: number };
  readonly refunded: number;
  readonly refundedTo: "pool" | "player";
}

export async function removeAdvancement(
  teamId: string,
  playerId: string,
  index: number,
): Promise<RemoveAdvancementResponse> {
  return apiRequest<RemoveAdvancementResponse>(
    `/team/${teamId}/players/${playerId}/advancements/${index}`,
    { method: "DELETE" },
  );
}

/** Parse la colonne `advancements` (chaîne JSON) de façon tolérante. */
export function parsePlayerAdvancements(raw: unknown): PlayerAdvancementView[] {
  const parsed: unknown =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a): a is PlayerAdvancementView =>
      typeof a === "object" && a !== null && typeof a.type === "string",
  );
}

const TYPE_LABELS: Readonly<Record<string, string>> = {
  primary: "Principale",
  secondary: "Secondaire",
  "random-primary": "Principale au hasard",
  characteristic: "Caractéristique",
};

const STAT_LABELS: Readonly<Record<string, string>> = {
  ma: "MA",
  st: "ST",
  ag: "AG",
  pa: "PA",
  av: "AV",
};

/** Libellé court d'une amélioration (type + cible), pour la puce d'annulation. */
export function advancementLabel(
  adv: PlayerAdvancementView,
  skillName?: string,
): string {
  const kind = TYPE_LABELS[adv.type] ?? adv.type;
  if (adv.type === "characteristic") {
    return `${kind} +1 ${STAT_LABELS[adv.stat ?? ""] ?? adv.stat ?? ""}`.trim();
  }
  const target = skillName ?? adv.skillSlug ?? "";
  return target ? `${target} (${kind})` : kind;
}

/**
 * Financement d'un achat à `cost` PSP : le pool d'abord, les SPP du joueur
 * ensuite. Miroir EXACT de la règle serveur, pour que l'UI n'affiche jamais
 * un bouton que l'API refuserait.
 */
export function fundingFor(
  cost: number,
  poolRemaining: number,
  playerSpp: number,
): { readonly source: "pool" | "player"; readonly affordable: boolean } {
  if (poolRemaining >= cost) return { source: "pool", affordable: true };
  return { source: "player", affordable: playerSpp >= cost };
}
