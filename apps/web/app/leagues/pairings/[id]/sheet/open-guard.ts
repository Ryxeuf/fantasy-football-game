/**
 * Refus d'ouverture d'une feuille de match : une rencontre d'une journée
 * antérieure, pour l'une des deux équipes, n'est pas encore close.
 *
 * Le serveur répond `409` avec `code: "previous_match_pending"` et la liste
 * des rencontres bloquantes (`details.blocking`), plus `details.canForce`
 * quand le viewer est commissaire (journée reportée). Module PUR : il ne
 * fait que lire le refus pour que l'écran puisse le montrer et y répondre.
 */
import { ApiClientError } from "../../../../lib/api-client";

export const PREVIOUS_MATCH_PENDING = "previous_match_pending";

export interface BlockingPairingView {
  readonly pairingId: string;
  readonly label: string;
}

export interface SheetOpenBlock {
  readonly message: string;
  readonly blocking: readonly BlockingPairingView[];
  readonly canForce: boolean;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/**
 * Le refus d'ouverture porté par `error`, ou `null` si c'est une autre
 * erreur (affichée telle quelle par l'écran).
 */
export function sheetOpenBlockFromError(error: unknown): SheetOpenBlock | null {
  if (!(error instanceof ApiClientError)) return null;
  if (error.code !== PREVIOUS_MATCH_PENDING) return null;
  const details = error.details ?? {};
  const raw = Array.isArray(details.blocking) ? details.blocking : [];
  const blocking: BlockingPairingView[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const pairingId = asString(e.pairingId);
    if (!pairingId) continue;
    const round = asString(e.roundLabel) ?? "Rencontre précédente";
    const home = asString(e.homeTeamName);
    const away = asString(e.awayTeamName);
    blocking.push({
      pairingId,
      label: home && away ? `${round} : ${home} – ${away}` : round,
    });
  }
  return {
    message: error.message,
    blocking,
    canForce: details.canForce === true,
  };
}
