/**
 * Joueurs de feuille RECRUTÉS : id synthétique → joueur réel.
 *
 * Un journalier (`journeyman-<side>-<n>`) ou un mort relevé
 * (`raised-<side>-1`) joue le match SANS exister au roster : le journal de
 * la feuille le cite par son id synthétique. Recruté en fin de match, il
 * devient un `TeamPlayer` neuf (`applyOfflinePurchasesForTeam`) — mais les
 * évènements, eux, gardent l'id synthétique. Tout lecteur qui classe des
 * `TeamPlayer` à partir du journal perdait donc ce qu'il avait fait pendant
 * le match (retour testeur : l'interception d'un journalier recruté comptait
 * pour son équipe, pas pour lui).
 *
 * La correspondance se lit dans le snapshot de validation
 * (`Match.offlineResultInput`) : les achats (`input.purchasesHome/Away`,
 * avec `journeymanId`) et les joueurs créés (`rosterMutations.<side>
 * .createdPlayerIds`), dans le même ordre. Les achats créateurs étant joués
 * dans l'ordre et un achat sauté (liste à 16, poste irrésoluble) ne créant
 * rien, l'alignement n'est CERTAIN que si chaque achat créateur a produit
 * une ligne — même règle que `deriveCreatedPlayerBaselines`. Sinon : aucune
 * correspondance pour ce côté (on ne devine pas).
 *
 * Module PUR.
 */

import { purchaseCreatesPlayer } from "./league-offline-purchase-baseline";
import type { OfflinePurchaseKind } from "./league-offline-purchases";

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

interface CreatorPurchase {
  readonly journeymanId: string | null;
}

/** Achats qui créent un joueur, dans l'ordre de la saisie. */
function creatorPurchases(raw: unknown): CreatorPurchase[] | null {
  const list = parseJson(raw);
  if (!Array.isArray(list)) return null;
  const out: CreatorPurchase[] = [];
  for (const entry of list) {
    const o = asRecord(entry);
    if (!o || typeof o.kind !== "string") continue;
    if (!purchaseCreatesPlayer(o.kind as OfflinePurchaseKind)) continue;
    out.push({
      journeymanId:
        typeof o.journeymanId === "string" && o.journeymanId.length > 0
          ? o.journeymanId
          : null,
    });
  }
  return out;
}

function createdPlayerIds(rawSide: unknown): string[] | null {
  const side = asRecord(rawSide);
  if (!side || !Array.isArray(side.createdPlayerIds)) return null;
  const ids = side.createdPlayerIds;
  return ids.every((id) => typeof id === "string") ? (ids as string[]) : null;
}

/**
 * Correspondance « id synthétique de feuille → id du `TeamPlayer` créé par
 * son recrutement », lue dans le snapshot de validation d'une rencontre.
 * Vide si le snapshot est absent, illisible, ou si rien n'a été recruté.
 */
export function hiredSheetPlayerIdsFromOfflineSnapshot(
  raw: unknown,
): Map<string, string> {
  const out = new Map<string, string>();
  const snapshot = asRecord(parseJson(raw));
  if (!snapshot) return out;
  const input = asRecord(snapshot.input);
  const mutations = asRecord(snapshot.rosterMutations);
  if (!input || !mutations) return out;

  const sides = [
    { purchases: input.purchasesHome, mutation: mutations.home },
    { purchases: input.purchasesAway, mutation: mutations.away },
  ];
  for (const side of sides) {
    const creators = creatorPurchases(side.purchases);
    const created = createdPlayerIds(side.mutation);
    if (!creators || !created || creators.length !== created.length) continue;
    creators.forEach((purchase, i) => {
      if (purchase.journeymanId) out.set(purchase.journeymanId, created[i]);
    });
  }
  return out;
}

/** Id à créditer : le joueur recruté s'il existe, l'id tel quel sinon. */
export function resolveHiredSheetPlayerId(
  id: string | null | undefined,
  hired: ReadonlyMap<string, string> | undefined,
): string | null {
  if (!id) return null;
  return hired?.get(id) ?? id;
}
