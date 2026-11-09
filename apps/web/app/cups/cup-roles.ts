import type { ViewerRoles } from "../lib/competition-scope";

/**
 * Rôles d'une carte de coupe, LUS dans `viewerRoles` (servi par `GET /cup`).
 * Avant, la page les reconstruisait par `/auth/me` + `/team/mine`. Sans le
 * champ (API antérieure), seul « créateur » se déduit encore de l'id du
 * lecteur ; la participation reste inconnue (pas de badge).
 */
export function cupRolesFromApi(
  cup: { creatorId: string; viewerRoles?: ViewerRoles | null },
  viewerId: string | null,
): { isCreator: boolean; hasTeamParticipating: boolean } {
  if (cup.viewerRoles) {
    return {
      isCreator: cup.viewerRoles.commissioner,
      hasTeamParticipating: cup.viewerRoles.participant === "active",
    };
  }
  return {
    isCreator: !!viewerId && cup.creatorId === viewerId,
    hasTeamParticipating: false,
  };
}
