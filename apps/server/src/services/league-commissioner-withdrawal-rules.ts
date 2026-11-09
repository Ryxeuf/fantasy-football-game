/**
 * Retrait d'une équipe d'une saison de LIGUE par son commissaire, en cours
 * de saison — règles PURES.
 *
 * Avant, seul un admin pouvait forcer ce retrait, et il ne faisait que
 * basculer le statut : les rencontres restantes de l'équipe restaient « à
 * jouer » contre une équipe qui n'existe plus pour la ligue. Ici, le retrait
 * TRAITE ces rencontres, au choix du commissaire :
 *
 *  - `forfeit` : chaque rencontre restante est perdue par forfait par
 *    l'équipe retirée (l'adversaire marque, et avance en play-off) ;
 *  - `cancel`  : chaque rencontre restante de saison régulière est annulée
 *    (personne ne marque).
 *
 * Une rencontre de BRACKET est toujours perdue par forfait : l'annuler ne
 * qualifierait personne et bloquerait le tableau. Un PLACEHOLDER (`home ===
 * away`, l'équipe retirée est le seul qualifié connu) n'a pas d'adversaire à
 * déclarer vainqueur : il est laissé tel quel et signalé, le commissaire le
 * règle par « Remplacer une équipe » dans le bracket.
 *
 * Une rencontre ENGAGÉE (feuille soumise, en correction, brouillon saisi,
 * match lancé) bloque le retrait : le commissaire la traite d'abord — un
 * forfait écrasant une feuille saisie perdrait le match réellement joué.
 */

import {
  isPlaceholderPairing,
  isPlayoffPairingEngaged,
  type PlayoffPairingState,
} from "./league-playoff-edit-rules";

export type RemainingPairingsPolicy = "forfeit" | "cancel";

export type CommissionerWithdrawalRefusal =
  | "forbidden"
  | "participant_not_found"
  | "season_completed"
  | "already_withdrawn"
  | "pairing_engaged";

/** Une rencontre ENCORE OUVERTE de l'équipe retirée. */
export interface WithdrawalPairing extends PlayoffPairingState {
  readonly roundId: string;
  /** Tour de bracket (`kind=playoff` OU `bracketSlot`). */
  readonly isBracket: boolean;
}

export interface CommissionerWithdrawalInput {
  readonly isCommissioner: boolean;
  readonly isAdmin: boolean;
  readonly seasonId: string;
  readonly seasonStatus: string;
  /** null = inscription introuvable. */
  readonly participant: {
    readonly id: string;
    readonly seasonId: string;
    readonly status: string;
  } | null;
  readonly remaining: RemainingPairingsPolicy;
  /** Rencontres `scheduled` / `in_progress` de l'équipe dans la saison. */
  readonly openPairings: readonly WithdrawalPairing[];
}

export interface CommissionerWithdrawalPlan {
  /** `side` = côté de l'équipe RETIRÉE (celui qui déclare forfait). */
  readonly forfeit: ReadonlyArray<{
    readonly pairingId: string;
    readonly side: "home" | "away";
  }>;
  readonly cancel: ReadonlyArray<{
    readonly pairingId: string;
    readonly roundId: string;
  }>;
  /** Placeholders de bracket laissés au commissaire. */
  readonly placeholders: readonly string[];
}

export type CommissionerWithdrawalDecision =
  | { readonly ok: true; readonly plan: CommissionerWithdrawalPlan }
  | {
      readonly ok: false;
      readonly code: CommissionerWithdrawalRefusal;
      readonly message: string;
      readonly engagedPairingIds?: readonly string[];
    };

export function decideCommissionerWithdrawal(
  input: CommissionerWithdrawalInput,
): CommissionerWithdrawalDecision {
  if (!input.isCommissioner && !input.isAdmin) {
    return {
      ok: false,
      code: "forbidden",
      message:
        "Seul le commissaire de la ligue (ou un admin) peut retirer une équipe",
    };
  }
  const participant = input.participant;
  if (!participant || participant.seasonId !== input.seasonId) {
    return {
      ok: false,
      code: "participant_not_found",
      message: "Équipe introuvable dans cette saison",
    };
  }
  if (input.seasonStatus === "completed") {
    return {
      ok: false,
      code: "season_completed",
      message: "Saison clôturée : plus aucune équipe ne peut en être retirée",
    };
  }
  if (participant.status === "withdrawn") {
    return {
      ok: false,
      code: "already_withdrawn",
      message: "Cette équipe est déjà retirée de la saison",
    };
  }

  const engaged = input.openPairings
    .filter(isPlayoffPairingEngaged)
    .map((p) => p.id);
  if (engaged.length > 0) {
    return {
      ok: false,
      code: "pairing_engaged",
      message:
        "Une rencontre de l'équipe est en cours de saisie (feuille soumise ou commencée) : validez-la, invalidez-la ou déclarez le forfait avant de retirer l'équipe",
      engagedPairingIds: engaged,
    };
  }

  const forfeit: Array<{ pairingId: string; side: "home" | "away" }> = [];
  const cancel: Array<{ pairingId: string; roundId: string }> = [];
  const placeholders: string[] = [];
  for (const p of input.openPairings) {
    if (p.isBracket && isPlaceholderPairing(p)) {
      placeholders.push(p.id);
      continue;
    }
    const side: "home" | "away" =
      p.homeParticipantId === participant.id ? "home" : "away";
    if (p.isBracket || input.remaining === "forfeit") {
      forfeit.push({ pairingId: p.id, side });
    } else {
      cancel.push({ pairingId: p.id, roundId: p.roundId });
    }
  }
  return { ok: true, plan: { forfeit, cancel, placeholders } };
}
