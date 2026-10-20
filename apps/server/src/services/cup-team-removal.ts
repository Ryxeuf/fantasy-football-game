/**
 * Retrait d'une équipe d'une coupe — par son propriétaire, par le
 * commissaire de la coupe ou par un administrateur.
 *
 * Le commissaire n'avait AUCUN moyen de retirer une équipe : la route
 * `unregister` n'acceptait que le propriétaire (ou un admin), et seulement
 * tant que les inscriptions étaient ouvertes. Une mauvaise inscription ou un
 * coach qui abandonne en cours de coupe imposaient de passer par un admin.
 *
 * Le retrait SUPPRIME l'inscription (`CupParticipant`), il ne pose pas de
 * statut : un « retiré » à filtrer aurait dû être appris par chaque lecture
 * des inscrits (rondes, poules, bracket, pronostics, verrou d'équipe…).
 * La suppression est sûre en cours de coupe parce que :
 *   - les rencontres référencent l'ÉQUIPE, pas l'inscription : l'historique
 *     des rondes (et l'anti-rematch suisse) reste intact ;
 *   - le classement est DÉRIVÉ des matchs joués : l'équipe y reste avec ses
 *     résultats, ceux de ses adversaires sont conservés ;
 *   - les générateurs de ronde partent des inscrits : elle n'est plus
 *     appariée.
 *
 * Une rencontre OUVERTE de l'équipe bloque le retrait : la régler (forfait
 * sur la feuille ou annulation) est un choix du commissaire — l'adversaire
 * gagne-t-il ou non ? — que le code ne doit pas faire à sa place.
 */

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import { serverLog } from "../utils/server-log";

export type CupTeamRemovalErrorCode =
  | "cup_not_found"
  | "not_registered"
  | "forbidden"
  | "registrations_closed"
  | "cup_closed"
  | "team_has_open_pairing";

export class CupTeamRemovalError extends Error {
  constructor(
    public readonly code: CupTeamRemovalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupTeamRemovalError";
  }
}

/** Statut HTTP d'un refus de retrait. */
export function cupTeamRemovalStatus(code: CupTeamRemovalErrorCode): number {
  switch (code) {
    case "cup_not_found":
      return 404;
    case "forbidden":
      return 403;
    case "cup_closed":
    case "team_has_open_pairing":
      return 409;
    default:
      return 400;
  }
}

/** Statuts d'une rencontre encore ouverte (miroir de `cup-rounds`). */
const OPEN_PAIRING_STATUSES = ["scheduled", "in_progress"] as const;

/** Statuts d'une coupe qu'on ne touche plus. */
const CLOSED_CUP_STATUSES: ReadonlySet<string> = new Set([
  "terminee",
  "archivee",
]);

export interface CupTeamRemovalFacts {
  /** L'acteur est le créateur de la coupe. */
  readonly isCommissioner: boolean;
  readonly isAdmin: boolean;
  /** L'acteur possède l'équipe visée. */
  readonly isOwner: boolean;
  /** Bypass admin du statut de la coupe (jamais de la rencontre ouverte). */
  readonly force: boolean;
  readonly cupStatus: string;
  /** Inscriptions closes (`Cup.validated`). */
  readonly validated: boolean;
  /** Rencontres de ronde encore ouvertes de l'équipe dans la coupe. */
  readonly openPairings: number;
}

export type CupTeamRemovalDecision =
  | { readonly ok: true; readonly byCommissioner: boolean }
  | {
      readonly ok: false;
      readonly code: CupTeamRemovalErrorCode;
      readonly message: string;
    };

/**
 * Décide (PUR) si l'acteur peut retirer l'équipe. Un propriétaire qui est
 * aussi le commissaire a les droits du commissaire.
 *
 * | Acteur              | Ouverte | Close / en cours | Terminée / archivée |
 * |---------------------|---------|------------------|---------------------|
 * | Propriétaire        | oui     | non              | non                 |
 * | Commissaire / admin | oui     | oui              | non                 |
 * | Admin + `force`     | oui     | oui              | oui                 |
 *
 * Une rencontre ouverte refuse dans TOUS les cas.
 */
export function decideCupTeamRemoval(
  facts: CupTeamRemovalFacts,
): CupTeamRemovalDecision {
  const byCommissioner = facts.isCommissioner || facts.isAdmin;
  if (!byCommissioner && !facts.isOwner) {
    return {
      ok: false,
      code: "forbidden",
      message:
        "Seul le commissaire de la coupe (ou le propriétaire de l'équipe) peut la retirer",
    };
  }
  const bypassStatus = facts.isAdmin && facts.force;
  if (!bypassStatus && CLOSED_CUP_STATUSES.has(facts.cupStatus)) {
    return {
      ok: false,
      code: "cup_closed",
      message: "Coupe terminée : ses équipes ne se retirent plus",
    };
  }
  const registrationsOpen = facts.cupStatus === "ouverte" && !facts.validated;
  if (!byCommissioner && !registrationsOpen) {
    return {
      ok: false,
      code: "registrations_closed",
      message:
        "Les inscriptions sont closes : seul le commissaire peut encore retirer une équipe",
    };
  }
  if (facts.openPairings > 0) {
    return {
      ok: false,
      code: "team_has_open_pairing",
      message:
        "Cette équipe a une rencontre en cours : réglez-la d'abord (forfait sur la feuille de match ou annulation de la rencontre)",
    };
  }
  return { ok: true, byCommissioner };
}

export interface RemoveTeamFromCupInput {
  readonly cupId: string;
  readonly teamId: string;
  readonly actor: { readonly userId: string; readonly isAdmin: boolean };
  readonly force?: boolean;
}

export interface RemoveTeamFromCupResult {
  readonly removed: true;
  readonly teamId: string;
  /** Retrait fait par un tiers (commissaire / admin), pas par le coach. */
  readonly byCommissioner: boolean;
}

/**
 * Retire l'équipe de la coupe. Lève `CupTeamRemovalError` en cas de refus.
 * Le coach est notifié quand un TIERS retire son équipe (best-effort : un
 * échec de notification ne défait pas un retrait déjà fait).
 */
export async function removeTeamFromCup(
  input: RemoveTeamFromCupInput,
): Promise<RemoveTeamFromCupResult> {
  const cup = (await prisma.cup.findUnique({
    where: { id: input.cupId },
    select: {
      id: true,
      name: true,
      creatorId: true,
      status: true,
      validated: true,
    },
  })) as {
    id: string;
    name: string;
    creatorId: string;
    status: string;
    validated: boolean;
  } | null;
  if (!cup) {
    throw new CupTeamRemovalError("cup_not_found", "Coupe introuvable");
  }

  const participant = (await prisma.cupParticipant.findUnique({
    where: { cupId_teamId: { cupId: cup.id, teamId: input.teamId } },
    select: { id: true, team: { select: { name: true, ownerId: true } } },
  })) as {
    id: string;
    team: { name: string; ownerId: string } | null;
  } | null;
  if (!participant) {
    throw new CupTeamRemovalError(
      "not_registered",
      "Cette équipe n'est pas inscrite à cette coupe",
    );
  }

  const openPairings = await prisma.cupPairing.count({
    where: {
      round: { cupId: cup.id },
      status: { in: [...OPEN_PAIRING_STATUSES] },
      OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
    },
  });

  const ownerId = participant.team?.ownerId ?? null;
  const decision = decideCupTeamRemoval({
    isCommissioner: cup.creatorId === input.actor.userId,
    isAdmin: input.actor.isAdmin,
    isOwner: ownerId === input.actor.userId,
    force: input.force === true,
    cupStatus: cup.status,
    validated: cup.validated,
    openPairings,
  });
  if (!decision.ok) {
    throw new CupTeamRemovalError(decision.code, decision.message);
  }

  await prisma.cupParticipant.delete({ where: { id: participant.id } });
  serverLog.info(
    `[cup-team-removal] cup=${cup.id} team=${input.teamId} by=${input.actor.userId}`,
  );

  // Le coach apprend le retrait de SON équipe quand ce n'est pas lui qui
  // l'a fait. `createInAppNotification` ne lève jamais.
  if (ownerId && ownerId !== input.actor.userId) {
    await createInAppNotification({
      userId: ownerId,
      kind: "cup.team_removed",
      title: "Équipe retirée d'une coupe",
      body: `« ${participant.team?.name ?? "Votre équipe"} » a été retirée de la coupe « ${cup.name} » par son commissaire.`,
      url: `/cups/${cup.id}`,
      meta: { cupId: cup.id, teamId: input.teamId },
    });
  }

  return {
    removed: true,
    teamId: input.teamId,
    byCommissioner: decision.byCommissioner,
  };
}
