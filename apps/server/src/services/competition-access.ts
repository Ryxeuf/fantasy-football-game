/**
 * Visibilité d'une COMPÉTITION — ligue OU coupe — en une seule résolution.
 *
 * Les ligues avaient déjà la leur (`services/league-access`) ; les coupes
 * n'en avaient aucune : `GET /cup/:id` et toutes ses lectures servaient une
 * coupe privée à n'importe quel compte connecté, et les documents officiels
 * répondaient 403 (ce qui confirme l'existence de la coupe). Ce module pose
 * la règle des coupes en CALQUE de celle des ligues et sert les deux familles
 * derrière une même signature (blog, documents, feuille de match).
 *
 * Une coupe PRIVÉE n'existe que pour son commissaire (créateur), les admins,
 * les propriétaires d'une équipe inscrite (`CupParticipant`) et les coachs
 * nommés par une invitation en attente (directement, ou par une de leurs
 * équipes). Pour tout autre lecteur : INTROUVABLE (404), jamais 403.
 */

import { prisma } from "../prisma";
import {
  canViewLeagueRow,
  LEAGUE_VISIBILITY_SELECT,
  type LeagueViewer,
  type LeagueVisibilityRow,
} from "./league-access";

export type CompetitionKind = "league" | "cup";

/** Lecteur courant (même forme que pour une ligue). */
export type CompetitionViewer = LeagueViewer;

/** Les colonnes qui suffisent à trancher la visibilité d'une coupe. */
export interface CupVisibilityRow {
  readonly id: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
}

export interface CupMembership {
  readonly isParticipant: boolean;
  readonly hasPendingInvitation: boolean;
}

export const CUP_VISIBILITY_SELECT = {
  id: true,
  creatorId: true,
  isPublic: true,
} as const;

const NO_MEMBERSHIP: CupMembership = {
  isParticipant: false,
  hasPendingInvitation: false,
};

export const CUP_NOT_FOUND = "Coupe introuvable";
export const LEAGUE_NOT_FOUND = "Ligue introuvable";

/** Message d'un 404 de compétition : le même qu'un id inexistant. */
export function competitionNotFoundMessage(kind: CompetitionKind): string {
  return kind === "league" ? LEAGUE_NOT_FOUND : CUP_NOT_FOUND;
}

/**
 * Règle PURE, calque de `isLeagueVisibleTo` : une coupe publique est lisible
 * de tous ; une coupe privée de son commissaire, d'un admin, d'un inscrit ou
 * d'un invité en attente. Un visiteur anonyme ne voit jamais une coupe privée.
 */
export function isCupVisibleTo(
  cup: Pick<CupVisibilityRow, "creatorId" | "isPublic">,
  viewer: CompetitionViewer,
  membership: CupMembership,
): boolean {
  if (cup.isPublic) return true;
  if (viewer.isAdmin) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === cup.creatorId) return true;
  return membership.isParticipant || membership.hasPendingInvitation;
}

/** Une équipe du coach est-elle inscrite à la coupe ? */
export async function isCupParticipantOwner(
  userId: string,
  cupId: string,
): Promise<boolean> {
  const count = await prisma.cupParticipant.count({
    where: { cupId, team: { ownerId: userId } },
  });
  return count > 0;
}

/** Invitation en attente adressée au coach ou à une de ses équipes. */
export async function hasPendingCupInvitation(
  userId: string,
  cupId: string,
): Promise<boolean> {
  const count = await prisma.cupInvitation.count({
    where: {
      cupId,
      status: "pending",
      OR: [{ inviteeUserId: userId }, { inviteeTeam: { ownerId: userId } }],
    },
  });
  return count > 0;
}

/**
 * Tranche la visibilité d'une coupe DÉJÀ chargée ; les requêtes
 * d'appartenance ne partent que si la règle en a besoin.
 */
export async function canViewCupRow(
  cup: CupVisibilityRow,
  viewer: CompetitionViewer,
): Promise<boolean> {
  if (isCupVisibleTo(cup, viewer, NO_MEMBERSHIP)) return true;
  if (!viewer.userId) return false;
  if (await isCupParticipantOwner(viewer.userId, cup.id)) return true;
  return hasPendingCupInvitation(viewer.userId, cup.id);
}

/** Charge la coupe ; `null` si elle n'existe pas OU si le lecteur ne la voit pas. */
export async function findVisibleCup(
  cupId: string,
  viewer: CompetitionViewer,
): Promise<CupVisibilityRow | null> {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    select: CUP_VISIBILITY_SELECT,
  })) as CupVisibilityRow | null;
  if (!cup) return null;
  return (await canViewCupRow(cup, viewer)) ? cup : null;
}

/**
 * Rencontre de coupe cachée au lecteur ? Faux pour un id inconnu ou une
 * rencontre de ligue (le service tranche alors avec ses propres erreurs).
 */
export async function isCupPairingHiddenFrom(
  pairingId: string,
  viewer: CompetitionViewer,
): Promise<boolean> {
  const pairing = (await prisma.cupPairing.findUnique({
    where: { id: pairingId },
    select: { round: { select: { cup: { select: CUP_VISIBILITY_SELECT } } } },
  })) as { round: { cup: CupVisibilityRow } } | null;
  if (!pairing) return false;
  return !(await canViewCupRow(pairing.round.cup, viewer));
}

/** Compétition visible, avec ce qu'il faut pour le contrôle d'accès en aval. */
export interface VisibleCompetition {
  readonly kind: CompetitionKind;
  readonly id: string;
  readonly name: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
  /** Ligue : `archived` ; coupe : `archivee`. */
  readonly archived: boolean;
}

/**
 * Résolution commune ligue | coupe : `null` = introuvable OU invisible, les
 * deux se répondant par le même 404.
 */
export async function findVisibleCompetition(
  kind: CompetitionKind,
  competitionId: string,
  viewer: CompetitionViewer,
): Promise<VisibleCompetition | null> {
  if (kind === "league") {
    const row = (await prisma.league.findUnique({
      where: { id: competitionId },
      select: { ...LEAGUE_VISIBILITY_SELECT, name: true, status: true },
    })) as (LeagueVisibilityRow & { name: string; status: string }) | null;
    if (!row) return null;
    if (!(await canViewLeagueRow(row, viewer))) return null;
    return {
      kind,
      id: row.id,
      name: row.name,
      creatorId: row.creatorId,
      isPublic: row.isPublic,
      archived: row.status === "archived",
    };
  }
  const row = (await prisma.cup.findUnique({
    where: { id: competitionId },
    select: { ...CUP_VISIBILITY_SELECT, name: true, status: true },
  })) as (CupVisibilityRow & { name: string; status: string }) | null;
  if (!row) return null;
  if (!(await canViewCupRow(row, viewer))) return null;
  return {
    kind,
    id: row.id,
    name: row.name,
    creatorId: row.creatorId,
    isPublic: row.isPublic,
    archived: row.status === "archivee",
  };
}
