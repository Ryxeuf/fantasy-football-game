/**
 * Garde-fou de reversion des ACHATS — état de RÉFÉRENCE des joueurs créés.
 *
 * `offlinePurchasesConsumed` refuse la reversion d'un résultat si un joueur
 * créé par les achats de ce match a été « consommé » depuis : il a joué un
 * match ULTÉRIEUR, gagné des PSP, progressé, ou est mort — le supprimer
 * laisserait une autre feuille référencer un joueur disparu.
 *
 * Le contrôle se faisait contre ZÉRO. Or un journalier ou un mort relevé
 * recruté à l'étape EMBAUCHES est créé AVEC 1 match joué, les PSP et
 * l'évolution DU MATCH (retour testeur du 2026-09-19 : « Reversion
 * impossible: purchase-consumed » sur une feuille dont le Zombie relevé
 * venait d'être recruté — la feuille devenait définitive). Le point de
 * comparaison est donc l'état À LA CRÉATION :
 *
 *  - STOCKÉ dans la trace des mutations (`createdPlayers`) pour toute feuille
 *    validée depuis ce module ;
 *  - REDÉRIVÉ des achats du snapshot pour les feuilles antérieures (aucun
 *    backfill possible : l'état vit dans un JSON, `db push` en prod) — un
 *    recrutement porte `spp` / `advancements` et vaut 1 match joué, un achat
 *    de joueur ordinaire part de zéro ;
 *  - ZÉRO à défaut (comportement historique, conservateur : on préfère
 *    refuser une reversion que supprimer un joueur qu'un autre match utilise).
 *
 * Module PUR : aucune lecture Prisma, testable seul.
 */

import type {
  OfflinePurchaseInput,
  OfflinePurchaseKind,
} from "./league-offline-purchases";

/** Compteurs d'un joueur créé, tels qu'ils sont comparés par le garde-fou. */
export interface PurchasedPlayerCounters {
  readonly spp: number;
  readonly matchesPlayed: number;
  /** NOMBRE d'avancements (la colonne JSON n'est pas comparée telle quelle). */
  readonly advancements: number;
}

/** État à la création d'un joueur créé par les achats d'un match. */
export interface CreatedPlayerBaseline extends PurchasedPlayerCounters {
  readonly id: string;
}

/** Ligne `TeamPlayer` relue par le garde-fou. */
export interface PurchasedPlayerRow extends PurchasedPlayerCounters {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly dead: boolean;
}

export const ZERO_COUNTERS: PurchasedPlayerCounters = {
  spp: 0,
  matchesPlayed: 0,
  advancements: 0,
};

/** Compte tolérant des avancements (array natif PG / string JSON sqlite). */
export function advancementsCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/** Achats qui CRÉENT une ligne `TeamPlayer` (dans l'ordre de la saisie). */
export function purchaseCreatesPlayer(kind: OfflinePurchaseKind): boolean {
  return kind === "player" || kind === "journeyman" || kind === "raised_dead";
}

/**
 * Recrutement d'un joueur de FEUILLE (journalier, mort relevé) : il a joué
 * ce match et arrive avec ses PSP et son évolution.
 */
export function purchaseIsSheetPlayerHire(kind: OfflinePurchaseKind): boolean {
  return kind === "journeyman" || kind === "raised_dead";
}

/**
 * État à la création qu'un achat produit — le miroir exact de ce que
 * `applyOfflinePurchasesForTeam` écrit : un recrutement de journalier ou de
 * mort relevé porte `spp`, `advancements` et 1 match joué ; un joueur acheté
 * part de zéro.
 */
export function baselineForPurchase(
  purchase: Pick<OfflinePurchaseInput, "kind" | "spp" | "advancements">,
): PurchasedPlayerCounters {
  if (!purchaseIsSheetPlayerHire(purchase.kind)) return ZERO_COUNTERS;
  return {
    spp: Math.max(0, purchase.spp ?? 0),
    matchesPlayed: 1,
    advancements: advancementsCount(purchase.advancements ?? "[]"),
  };
}

/** Nom tel qu'il est écrit sur la ligne créée (`(p.name || poste).trim().slice(0, 120)`). */
function purchaseName(purchase: OfflinePurchaseInput): string {
  return (purchase.name ?? "").trim().slice(0, 120);
}

/**
 * Vrai si la ligne créée PEUT provenir de cet achat : même poste quand
 * l'achat en désigne un, même nom quand l'achat en porte un. Un achat sans
 * nom ni poste (« auto ») est compatible avec toute ligne.
 */
function purchaseMatchesRow(
  purchase: OfflinePurchaseInput,
  row: Pick<PurchasedPlayerRow, "name" | "position">,
): boolean {
  if (purchase.position && purchase.position !== row.position) return false;
  const name = purchaseName(purchase);
  return name.length === 0 || name === row.name;
}

/**
 * Feuilles ANTÉRIEURES à la trace `createdPlayers` : redérive l'état à la
 * création des joueurs créés depuis les achats du snapshot.
 *
 * `applyOfflinePurchasesForTeam` crée les joueurs DANS L'ORDRE des achats qui
 * en créent un, en sautant ceux qu'il n'a pas pu créer (liste à 16, poste
 * irrésoluble). La correspondance n'est donc certaine que lorsque rien n'a
 * été sauté — autant de lignes créées que d'achats créateurs : chaque ligne
 * est alors alignée sur son achat, et vérifiée (poste, nom). Dans tout autre
 * cas, ou pour une paire incohérente, aucune référence n'est produite : le
 * garde-fou retombe sur zéro, le comportement historique.
 */
export function deriveCreatedPlayerBaselines(
  createdPlayerIds: readonly string[],
  purchases: readonly OfflinePurchaseInput[],
  rowsById: ReadonlyMap<string, Pick<PurchasedPlayerRow, "name" | "position">>,
): Map<string, PurchasedPlayerCounters> {
  const out = new Map<string, PurchasedPlayerCounters>();
  const creators = purchases.filter((p) => purchaseCreatesPlayer(p.kind));
  if (creators.length !== createdPlayerIds.length) return out;
  createdPlayerIds.forEach((id, i) => {
    const row = rowsById.get(id);
    const purchase = creators[i];
    if (!row || !purchase || !purchaseMatchesRow(purchase, row)) return;
    out.set(id, baselineForPurchase(purchase));
  });
  return out;
}

/**
 * État de référence de chaque joueur créé d'un côté : la trace stockée
 * d'abord, la redérivation depuis les achats ensuite, zéro à défaut.
 */
export function resolveCreatedPlayerBaselines(input: {
  readonly createdPlayerIds: readonly string[];
  readonly createdPlayers?: readonly CreatedPlayerBaseline[];
  readonly purchases: readonly OfflinePurchaseInput[];
  readonly rowsById: ReadonlyMap<
    string,
    Pick<PurchasedPlayerRow, "name" | "position">
  >;
}): Map<string, PurchasedPlayerCounters> {
  const stored = new Map<string, PurchasedPlayerCounters>(
    (input.createdPlayers ?? []).map((b) => [
      b.id,
      {
        spp: b.spp,
        matchesPlayed: b.matchesPlayed,
        advancements: b.advancements,
      },
    ]),
  );
  const missing = input.createdPlayerIds.filter((id) => !stored.has(id));
  if (missing.length === 0) return stored;
  // Redérivation sur la liste COMPLÈTE (l'alignement se fait sur l'ordre des
  // achats), puis on ne retient que ce que la trace ne couvrait pas.
  const derived = deriveCreatedPlayerBaselines(
    input.createdPlayerIds,
    input.purchases,
    input.rowsById,
  );
  for (const id of missing) {
    const b = derived.get(id);
    if (b) stored.set(id, b);
  }
  return stored;
}

/**
 * Vrai si le joueur a été « consommé » DEPUIS sa création : un match de plus,
 * des PSP de plus, un avancement de plus, ou sa mort. Une valeur INFÉRIEURE à
 * la référence (PSP dépensés) n'est pas un usage à elle seule — l'avancement
 * qui l'explique est compté à part.
 */
export function purchasedPlayerConsumed(
  row: Pick<
    PurchasedPlayerRow,
    "spp" | "matchesPlayed" | "dead" | "advancements"
  >,
  baseline: PurchasedPlayerCounters = ZERO_COUNTERS,
): boolean {
  return (
    row.dead ||
    row.matchesPlayed > baseline.matchesPlayed ||
    row.spp > baseline.spp ||
    row.advancements > baseline.advancements
  );
}
