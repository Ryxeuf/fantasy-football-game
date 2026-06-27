/**
 * Suppression d'equipes / de joueurs par le commissaire AVANT le
 * demarrage de la saison.
 *
 * Besoin metier : un commissaire doit pouvoir corriger une erreur
 * d'inscription (mauvaise equipe inscrite, joueur en trop sur un
 * roster) tant que rien n'a encore ete joue. Une fois qu'une equipe a
 * participe a un match (pairing engage : en cours, joue ou forfait),
 * la suppression est interdite — il faut passer par la procedure de
 * forfait (`league-forfeit.ts`) qui preserve l'historique.
 *
 * Garde-fous :
 *   - L'autorisation (commissaire de la ligue) est verifiee cote route
 *     via `ensureLeagueCommissioner`.
 *   - On verifie que la team appartient bien a la ligue ciblee
 *     (anti-vector cross-ligue, comme dans `commissioner-team-edit`).
 *   - On refuse si l'equipe a deja participe a un match dans la ligue.
 *   - Suppression d'equipe : uniquement quand la saison est `draft` ou
 *     `scheduled` (pre-demarrage). On supprime le `LeagueParticipant`
 *     (hard delete) ; aucun pairing ne le reference encore a ce stade.
 *   - Suppression de joueur : hard delete du `TeamPlayer` (aucune FK
 *     entrante ne le reference, et le pre-saison garantit l'absence de
 *     stats de match).
 *
 * Chaque suppression est tracee dans `AuditLog` via `appendAudit`
 * (reutilise depuis `commissioner-team-edit`).
 */

import { prisma } from "../prisma";
import { appendAudit } from "./commissioner-team-edit";

export type CommissionerRemovalErrorCode =
  | "season_not_found"
  | "team_not_found"
  | "team_not_in_league"
  | "coach_not_in_league"
  | "player_not_found"
  | "player_not_in_team"
  | "season_started"
  | "team_has_played";

export class CommissionerRemovalError extends Error {
  constructor(
    public readonly code: CommissionerRemovalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommissionerRemovalError";
  }
}

/** Statuts de saison permettant la suppression d'une equipe (pre-demarrage). */
const REMOVABLE_SEASON_STATUSES = new Set(["draft", "scheduled"]);

/**
 * Statuts de pairing considerant qu'une equipe a "participe" a un
 * match : un pairing engage (match cree, joue ou resolu par forfait).
 * Un pairing simplement `scheduled` ou `cancelled` ne compte pas.
 */
const ENGAGED_PAIRING_STATUSES = [
  "in_progress",
  "played",
  "forfeit_home",
  "forfeit_away",
];

/**
 * True si l'equipe a deja participe a au moins un match (pairing
 * engage) dans une saison de la ligue ciblee.
 */
export async function hasTeamPlayedInLeague(
  leagueId: string,
  teamId: string,
): Promise<boolean> {
  const engaged = await prisma.leaguePairing.findFirst({
    where: {
      status: { in: ENGAGED_PAIRING_STATUSES },
      round: { season: { leagueId } },
      OR: [{ homeParticipant: { teamId } }, { awayParticipant: { teamId } }],
    },
    select: { id: true },
  });
  return engaged !== null;
}

export interface RemoveTeamInput {
  leagueId: string;
  seasonId: string;
  teamId: string;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Retire definitivement une equipe d'une saison (hard delete du
 * participant). Autorise uniquement avant le demarrage de la saison
 * et si l'equipe n'a participe a aucun match.
 */
export async function removeTeamFromLeague(input: RemoveTeamInput) {
  const season = await prisma.leagueSeason.findFirst({
    where: { id: input.seasonId, leagueId: input.leagueId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new CommissionerRemovalError(
      "season_not_found",
      "Saison introuvable dans cette ligue",
    );
  }

  const participant = await prisma.leagueParticipant.findUnique({
    where: {
      seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId },
    },
    select: { id: true, team: { select: { name: true } } },
  });
  if (!participant) {
    throw new CommissionerRemovalError(
      "team_not_in_league",
      "Cette equipe n'est pas inscrite sur cette saison",
    );
  }

  if (!REMOVABLE_SEASON_STATUSES.has(season.status)) {
    throw new CommissionerRemovalError(
      "season_started",
      "Saison demarree : utilisez la procedure de forfait pour retirer une equipe",
    );
  }

  if (await hasTeamPlayedInLeague(input.leagueId, input.teamId)) {
    throw new CommissionerRemovalError(
      "team_has_played",
      "Impossible de supprimer : l'equipe a deja participe a un match",
    );
  }

  await prisma.leagueParticipant.delete({ where: { id: participant.id } });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    action: "remove_team",
    beforeState: {
      seasonId: input.seasonId,
      teamName: participant.team?.name ?? null,
    },
    afterState: null,
    reason: input.reason ?? null,
  });

  return { removed: true as const, teamId: input.teamId };
}

export interface RemoveCoachInput {
  leagueId: string;
  seasonId: string;
  coachUserId: string;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Retire un coach d'une saison : supprime toutes ses equipes inscrites
 * sur cette saison (memes gardes que `removeTeamFromLeague` —
 * pre-demarrage + aucun match joue) et annule ses invitations en
 * attente sur la ligue (scope saison ou ligue-wide). Atomique sur les
 * participants ; l'annulation des invitations est best-effort.
 *
 * Un coach est rattache a la ligue uniquement via ses equipes
 * (`Team.ownerId`) ; il n'existe pas de table d'adhesion dediee.
 */
export async function removeCoachFromSeason(input: RemoveCoachInput) {
  const season = await prisma.leagueSeason.findFirst({
    where: { id: input.seasonId, leagueId: input.leagueId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new CommissionerRemovalError(
      "season_not_found",
      "Saison introuvable dans cette ligue",
    );
  }

  const participants = await prisma.leagueParticipant.findMany({
    where: {
      seasonId: input.seasonId,
      team: { ownerId: input.coachUserId },
    },
    select: { id: true, teamId: true, team: { select: { name: true } } },
  });
  if (participants.length === 0) {
    throw new CommissionerRemovalError(
      "coach_not_in_league",
      "Ce coach n'a aucune equipe inscrite sur cette saison",
    );
  }

  if (!REMOVABLE_SEASON_STATUSES.has(season.status)) {
    throw new CommissionerRemovalError(
      "season_started",
      "Saison demarree : utilisez la procedure de forfait pour retirer un coach",
    );
  }

  for (const p of participants) {
    if (await hasTeamPlayedInLeague(input.leagueId, p.teamId)) {
      throw new CommissionerRemovalError(
        "team_has_played",
        `Impossible de retirer le coach : l'equipe « ${
          p.team?.name ?? p.teamId
        } » a deja participe a un match`,
      );
    }
  }

  await prisma.leagueParticipant.deleteMany({
    where: { id: { in: participants.map((p) => p.id) } },
  });

  // Annulation best-effort des invitations en attente du coach sur la
  // ligue (ciblant cette saison ou ligue-wide) pour que le retrait soit
  // complet (le coach ne reapparait pas via une invitation pendante).
  let cancelledInvitations = 0;
  try {
    const res = await prisma.leagueInvitation.updateMany({
      where: {
        leagueId: input.leagueId,
        inviteeUserId: input.coachUserId,
        status: "pending",
        OR: [{ seasonId: input.seasonId }, { seasonId: null }],
      },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    cancelledInvitations = res.count;
  } catch {
    // L'echec de l'annulation des invitations ne doit pas faire echouer
    // le retrait des equipes (deja committe).
  }

  for (const p of participants) {
    await appendAudit({
      leagueId: input.leagueId,
      byCommissionerId: input.byCommissionerId,
      teamId: p.teamId,
      action: "remove_coach",
      beforeState: {
        seasonId: input.seasonId,
        coachUserId: input.coachUserId,
        teamName: p.team?.name ?? null,
      },
      afterState: null,
      reason: input.reason ?? null,
    });
  }

  return {
    removed: true as const,
    coachUserId: input.coachUserId,
    removedTeamIds: participants.map((p) => p.teamId),
    cancelledInvitations,
  };
}

export interface RemovePlayerInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  byCommissionerId: string;
  reason?: string;
}

/**
 * Supprime definitivement un joueur du roster d'une equipe (hard
 * delete). Autorise uniquement si l'equipe n'a participe a aucun match
 * dans la ligue.
 */
export async function removePlayerFromTeam(input: RemovePlayerInput) {
  const inLeague = await prisma.leagueParticipant.count({
    where: { teamId: input.teamId, season: { leagueId: input.leagueId } },
  });
  if (inLeague === 0) {
    throw new CommissionerRemovalError(
      "team_not_in_league",
      "Cette equipe n'est pas inscrite dans une saison de cette ligue",
    );
  }

  if (await hasTeamPlayedInLeague(input.leagueId, input.teamId)) {
    throw new CommissionerRemovalError(
      "team_has_played",
      "Impossible de supprimer : l'equipe a deja participe a un match",
    );
  }

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      teamId: true,
      name: true,
      position: true,
      number: true,
    },
  })) as {
    id: string;
    teamId: string;
    name: string;
    position: string;
    number: number;
  } | null;
  if (!player) {
    throw new CommissionerRemovalError(
      "player_not_found",
      `Joueur introuvable: ${input.playerId}`,
    );
  }
  if (player.teamId !== input.teamId) {
    throw new CommissionerRemovalError(
      "player_not_in_team",
      "Le joueur n'appartient pas a l'equipe specifiee",
    );
  }

  await prisma.teamPlayer.delete({ where: { id: input.playerId } });

  await appendAudit({
    leagueId: input.leagueId,
    byCommissionerId: input.byCommissionerId,
    teamId: input.teamId,
    playerId: input.playerId,
    action: "remove_player",
    beforeState: {
      name: player.name,
      position: player.position,
      number: player.number,
    },
    afterState: null,
    reason: input.reason ?? null,
  });

  return { removed: true as const, playerId: input.playerId };
}
