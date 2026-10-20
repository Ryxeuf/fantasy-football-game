/**
 * Retrait d'une équipe inscrite (PUR) : qui voit le bouton, et ce que dit la
 * confirmation. Miroir de la décision serveur (`services/cup-team-removal`) —
 * le serveur reste juge, l'écran ne fait que ne pas proposer l'impossible.
 *
 * - le propriétaire retire SON équipe tant que les inscriptions sont ouvertes ;
 * - le commissaire (ou un admin) retire n'importe quelle équipe tant que la
 *   coupe n'est ni terminée ni archivée.
 */

export interface ParticipantRemovalInput {
  readonly isCommissioner: boolean;
  readonly isAdmin: boolean;
  readonly isMyTeam: boolean;
  readonly status: string;
  readonly validated: boolean;
}

export interface ParticipantRemovalAction {
  readonly label: string;
  /** Retrait par un tiers : le coach sera prévenu. */
  readonly byCommissioner: boolean;
}

const CLOSED_STATUSES: ReadonlySet<string> = new Set(["terminee", "archivee"]);

export function participantRemovalAction(
  input: ParticipantRemovalInput,
): ParticipantRemovalAction | null {
  if (CLOSED_STATUSES.has(input.status)) return null;
  const label = input.isMyTeam ? "Retirer mon équipe" : "Retirer";
  if (input.isCommissioner || input.isAdmin) {
    return { label, byCommissioner: !input.isMyTeam };
  }
  if (input.isMyTeam && input.status === "ouverte" && !input.validated) {
    return { label, byCommissioner: false };
  }
  return null;
}

/** Texte de la confirmation : nomme l'équipe, et son coach si c'est un tiers. */
export function participantRemovalConfirm(input: {
  readonly teamName: string;
  readonly coachName: string;
  readonly byCommissioner: boolean;
  /** Des rondes existent : les résultats déjà joués restent acquis. */
  readonly cupStarted: boolean;
}): string {
  const who = input.byCommissioner
    ? `l'équipe « ${input.teamName} » de ${input.coachName}`
    : `votre équipe « ${input.teamName} »`;
  const lines = [`Retirer ${who} de la coupe ?`];
  if (input.cupStarted) {
    lines.push(
      "Ses matchs déjà joués restent au classement ; elle ne sera plus appariée aux rondes suivantes.",
    );
  }
  if (input.byCommissioner) {
    lines.push("Le coach sera prévenu par une notification.");
  }
  return lines.join("\n\n");
}
