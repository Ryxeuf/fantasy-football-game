/**
 * Achats d'après-match relus depuis la feuille (`purchasesHome/Away`).
 * Extrait de `page.tsx` : Next.js interdit tout export non-conventionnel
 * dans un fichier page, et la logique pure doit rester testable.
 *
 * Le parse doit CONSERVER le type de chaque achat : il ne reconnaissait que
 * relance / staff / dépense diverse et ramenait tout le reste à « Joueur »
 * — en perdant `journeymanId`. Un recrutement de journalier relu après
 * rechargement redevenait donc un achat de joueur sans poste, et tout
 * nouvel enregistrement de la fin de match le réécrivait ainsi. Même
 * exigence pour le mort relevé (`raised_dead`, Maîtres de la Non-vie).
 */

import type { Purchase } from "./_components/MatchSheetPanels";

const KINDS: ReadonlySet<Purchase["kind"]> = new Set<Purchase["kind"]>([
  "player",
  "reroll",
  "staff",
  "other",
  "journeyman",
  "raised_dead",
]);

const STAFF: ReadonlySet<NonNullable<Purchase["staff"]>> = new Set<
  NonNullable<Purchase["staff"]>
>(["assistant", "cheerleader", "apothecary", "dedicated_fan"]);

function parseArray(raw: unknown): Record<string, unknown>[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(arr)
    ? arr.filter(
        (e): e is Record<string, unknown> => !!e && typeof e === "object",
      )
    : [];
}

/** Parse tolérant (array natif PG / chaîne JSON du miroir sqlite). */
export function parsePurchases(raw: unknown): Purchase[] {
  return parseArray(raw).map((i) => ({
    kind: KINDS.has(i.kind as Purchase["kind"])
      ? (i.kind as Purchase["kind"])
      : "player",
    name: typeof i.name === "string" ? i.name : "",
    cost: typeof i.cost === "number" ? i.cost : 0,
    position: typeof i.position === "string" ? i.position : undefined,
    staff: STAFF.has(i.staff as NonNullable<Purchase["staff"]>)
      ? (i.staff as Purchase["staff"])
      : undefined,
    journeymanId:
      typeof i.journeymanId === "string" && i.journeymanId.length > 0
        ? i.journeymanId
        : undefined,
  }));
}
