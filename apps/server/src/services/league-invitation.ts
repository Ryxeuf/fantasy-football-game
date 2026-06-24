/**
 * Lot A — Invitations de ligue.
 *
 * Le commissaire (createur de la ligue) ou un admin peut inviter un
 * coach a rejoindre une saison. Trois modes :
 *
 *  1. Invitation ciblee userId : restreinte au user invite.
 *  2. Invitation ciblee email : le user devra creer un compte avec
 *     cet email puis ouvrir le lien (v1 : pas d'envoi mail, juste un
 *     lien shareable).
 *  3. Invitation publique : aucun ciblage, n'importe quel user
 *     connecte peut accepter (utilisable pour partage discord).
 *
 * Le `code` est un token URL-safe genere par crypto.randomBytes(16),
 * unique en base et impossible a brute-forcer. Les invitations
 * expirent apres `expiresInDays` jours (default 14).
 *
 * Les hooks de transition d'etat :
 *   - createInvitation : refuse si saison terminee / annulee.
 *   - acceptInvitation : appelle `addParticipant` apres avoir verifie
 *     le couple coach/team.
 *   - declineInvitation / cancelInvitation : transitions terminales.
 *
 * Pas d'I/O autre que prisma. Service pur (testable via mock).
 */

import { randomBytes } from "crypto";
import { prisma } from "../prisma";
import { addParticipant } from "./league";
import { notifyInvitedCoach } from "./league-invitation-notify";

export type LeagueInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

/**
 * Statuts de saison acceptant de nouvelles inscriptions. Source de vérité
 * partagée (alignée sur `addParticipant` dans `league.ts`). On ne rejoint
 * pas une ligue directement : on s'inscrit dans une de ses saisons ouvertes.
 */
export const SEASON_OPEN_STATUSES = ["draft", "scheduled"] as const;

/**
 * Liste les saisons d'une ligue acceptant les inscriptions (draft/scheduled),
 * triées par numéro croissant. Sert à résoudre la saison cible d'une
 * invitation league-wide (sans `seasonId`).
 */
export async function listOpenSeasonsForLeague(leagueId: string) {
  return prisma.leagueSeason.findMany({
    where: { leagueId, status: { in: [...SEASON_OPEN_STATUSES] } },
    select: { id: true, name: true, seasonNumber: true, status: true },
    orderBy: { seasonNumber: "asc" },
  });
}

export class LeagueInvitationError extends Error {
  constructor(
    public readonly code:
      | "league_not_found"
      | "season_not_found"
      | "season_closed"
      | "no_open_season"
      | "season_choice_required"
      | "invitation_not_found"
      | "invitation_already_consumed"
      | "invitation_expired"
      | "invitation_not_for_user"
      | "team_not_found"
      | "team_not_owned_by_user"
      | "team_already_registered"
      | "league_full"
      | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "LeagueInvitationError";
  }
}

export interface CreateInvitationInput {
  leagueId: string;
  inviterUserId: string;
  seasonId?: string | null;
  inviteeUserId?: string | null;
  inviteeEmail?: string | null;
  inviteeTeamId?: string | null;
  message?: string | null;
  expiresInDays?: number;
  /**
   * Origine web absolue pour construire le lien de rejoindre dans l'e-mail
   * (`${baseUrl}/leagues/invitations/${code}`). Dérivée de la requête côté
   * route. Optionnelle : sans elle, l'e-mail retombe sur le code brut.
   */
  baseUrl?: string | null;
}

const DEFAULT_EXPIRES_DAYS = 14;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 90;

/**
 * Genere un code d'invitation URL-safe (base64url) de longueur ~22.
 * Espace de cle ~128 bits : non brute-forcable a l'echelle web.
 */
export function generateInvitationCode(): string {
  return randomBytes(16).toString("base64url");
}

function clampExpiresDays(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_EXPIRES_DAYS;
  }
  return Math.min(MAX_EXPIRES_DAYS, Math.max(MIN_EXPIRES_DAYS, Math.floor(raw)));
}

/**
 * Crée une invitation pour la ligue donnee. Verifie :
 *   - la ligue existe et l'inviter est createur OU admin (a verifier
 *     cote route via `requireLeagueCreator` ou middleware admin).
 *   - la saison (si fournie) appartient bien a la ligue et n'est pas
 *     "completed" (sinon refus).
 *   - le couple (leagueId, inviteeUserId, seasonId, status=pending)
 *     n'existe pas deja (idempotence souple : on retourne l'existant).
 */
export async function createInvitation(input: CreateInvitationInput) {
  const expiresInDays = clampExpiresDays(input.expiresInDays);

  const league = await prisma.league.findUnique({
    where: { id: input.leagueId },
    select: { id: true, status: true, name: true },
  });
  if (!league) {
    throw new LeagueInvitationError(
      "league_not_found",
      `Ligue introuvable: ${input.leagueId}`,
    );
  }

  if (input.seasonId) {
    const season = await prisma.leagueSeason.findUnique({
      where: { id: input.seasonId },
      select: { id: true, leagueId: true, status: true },
    });
    if (!season || season.leagueId !== input.leagueId) {
      throw new LeagueInvitationError(
        "season_not_found",
        "Saison introuvable ou n'appartenant pas a cette ligue",
      );
    }
    if (season.status === "completed") {
      throw new LeagueInvitationError(
        "season_closed",
        "Saison terminee : impossible d'inviter de nouveaux participants",
      );
    }
  } else {
    // Invitation league-wide (sans saison ciblée) : on ne rejoint une ligue
    // qu'à travers une de ses saisons. Bloquer l'envoi si aucune saison n'est
    // ouverte aux inscriptions — sinon l'invité recevrait un lien menant à
    // une impasse. Le commissaire doit d'abord créer une saison.
    const openSeasons = await listOpenSeasonsForLeague(input.leagueId);
    if (openSeasons.length === 0) {
      throw new LeagueInvitationError(
        "no_open_season",
        "La ligue n'a pas de saison ouverte aux inscriptions. " +
          "Crée d'abord une saison avant d'inviter des coachs.",
      );
    }
  }

  // Idempotence : si une invitation pending existe deja pour ce
  // couple (league, season, invitee), on la retourne au lieu d'en
  // creer une 2e.
  if (input.inviteeUserId) {
    const existing = await prisma.leagueInvitation.findFirst({
      where: {
        leagueId: input.leagueId,
        seasonId: input.seasonId ?? null,
        inviteeUserId: input.inviteeUserId,
        status: "pending",
      },
    });
    if (existing && existing.expiresAt > new Date()) {
      return existing;
    }
  }

  const code = generateInvitationCode();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const created = await prisma.leagueInvitation.create({
    data: {
      leagueId: input.leagueId,
      seasonId: input.seasonId ?? null,
      inviterUserId: input.inviterUserId,
      inviteeUserId: input.inviteeUserId ?? null,
      inviteeEmail: input.inviteeEmail ?? null,
      inviteeTeamId: input.inviteeTeamId ?? null,
      message: input.message ?? null,
      status: "pending",
      code,
      expiresAt,
    },
  });

  // A2 — notifie le coach invité (push + e-mail). Effet secondaire : son
  // échec ne doit pas casser la création. `notifyInvitedCoach` est déjà
  // tolérant en interne (try/catch + serverLog) ; ce try/catch est une
  // ceinture+bretelles supplémentaire. Le chemin de déduplication (retour
  // d'une invitation pending existante, plus haut) ne passe PAS ici, donc
  // on ne renotifie pas une invitation déjà émise.
  try {
    await notifyInvitedCoach({
      invitation: created,
      leagueName: league.name,
      baseUrl: input.baseUrl,
    });
  } catch {
    // Toute exception inattendue est absorbée : la création reste valide.
  }

  return created;
}

export interface AcceptInvitationInput {
  code: string;
  /** L'user authentifie qui accepte (peut differer de l'inviteeUserId). */
  userId: string;
  /** L'equipe a inscrire. */
  teamId: string;
  /** SeasonId explicite quand l'invitation est league-wide (pas seasonId). */
  seasonId?: string;
}

/**
 * Accepte une invitation : inscrit l'equipe a la saison via
 * `addParticipant`, met l'invitation a "accepted".
 *
 * Garde-fou :
 *   - L'invitation doit exister, etre "pending" et non expiree.
 *   - Si `inviteeUserId` est defini, l'user qui accepte doit
 *     correspondre.
 *   - L'equipe doit appartenir a l'user qui accepte.
 *   - La saison est determinee par : `input.seasonId` > `invitation.seasonId`.
 */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const invitation = await prisma.leagueInvitation.findUnique({
    where: { code: input.code },
  });
  if (!invitation) {
    throw new LeagueInvitationError(
      "invitation_not_found",
      "Invitation introuvable",
    );
  }
  if (invitation.status !== "pending") {
    throw new LeagueInvitationError(
      "invitation_already_consumed",
      `Invitation deja ${invitation.status}`,
    );
  }
  if (invitation.expiresAt <= new Date()) {
    // Marquage paresseux : on bascule en "expired" a l'usage.
    await prisma.leagueInvitation.update({
      where: { id: invitation.id },
      data: { status: "expired" },
    });
    throw new LeagueInvitationError(
      "invitation_expired",
      "Invitation expiree",
    );
  }
  if (
    invitation.inviteeUserId !== null &&
    invitation.inviteeUserId !== input.userId
  ) {
    throw new LeagueInvitationError(
      "invitation_not_for_user",
      "Cette invitation ne vous est pas adressee",
    );
  }

  // Résolution de la saison cible. Trois cas, dans l'ordre :
  //   1. `input.seasonId` (choix de l'invité) → validé : DOIT appartenir à la
  //      ligue de l'invitation (sinon détournement vers une autre ligue).
  //   2. `invitation.seasonId` (saison déjà ciblée à la création, déjà
  //      validée) → utilisé tel quel.
  //   3. Aucun (invitation league-wide) → auto-résolution parmi les saisons
  //      ouvertes : 0 → no_open_season, 1 → auto, N → season_choice_required.
  let seasonId: string;
  if (input.seasonId) {
    const season = await prisma.leagueSeason.findUnique({
      where: { id: input.seasonId },
      select: { leagueId: true },
    });
    if (!season || season.leagueId !== invitation.leagueId) {
      throw new LeagueInvitationError(
        "season_not_found",
        "Saison introuvable ou n'appartenant pas a cette ligue",
      );
    }
    seasonId = input.seasonId;
  } else if (invitation.seasonId) {
    seasonId = invitation.seasonId;
  } else {
    const openSeasons = await listOpenSeasonsForLeague(invitation.leagueId);
    if (openSeasons.length === 0) {
      throw new LeagueInvitationError(
        "no_open_season",
        "La ligue n'a pas encore de saison ouverte aux inscriptions. " +
          "Demande au commissaire d'en créer une.",
      );
    }
    if (openSeasons.length > 1) {
      throw new LeagueInvitationError(
        "season_choice_required",
        "Plusieurs saisons sont ouvertes : précisez laquelle rejoindre.",
      );
    }
    seasonId = openSeasons[0].id;
  }

  // Verifie l'ownership de l'equipe.
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, ownerId: true },
  });
  if (!team) {
    throw new LeagueInvitationError(
      "team_not_found",
      "Equipe introuvable",
    );
  }
  if (team.ownerId !== input.userId) {
    throw new LeagueInvitationError(
      "team_not_owned_by_user",
      "Vous ne pouvez inscrire que vos propres equipes",
    );
  }

  // Inscription effective. addParticipant remontera ses propres
  // erreurs (saison cloturee, dej inscrite, plein, etc.) — on les
  // remap ici en codes typees.
  let participant;
  try {
    participant = await addParticipant({ seasonId, teamId: input.teamId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (/deja inscrit|already/i.test(msg)) {
      throw new LeagueInvitationError(
        "team_already_registered",
        "Cette equipe est deja inscrite sur la saison",
      );
    }
    if (/maximum|max|complet/i.test(msg)) {
      throw new LeagueInvitationError(
        "league_full",
        "La saison a atteint son nombre maximum d'inscrits",
      );
    }
    if (/draft|scheduled|in_progress|completed/i.test(msg)) {
      throw new LeagueInvitationError(
        "season_closed",
        "Saison fermee aux inscriptions",
      );
    }
    throw e;
  }

  const updated = await prisma.leagueInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
      acceptedParticipantId:
        (participant as { id?: string } | null)?.id ?? null,
    },
  });
  return { invitation: updated, participant };
}

/** Decline une invitation pending. */
export async function declineInvitation(input: {
  code: string;
  userId: string;
}) {
  const invitation = await prisma.leagueInvitation.findUnique({
    where: { code: input.code },
  });
  if (!invitation) {
    throw new LeagueInvitationError(
      "invitation_not_found",
      "Invitation introuvable",
    );
  }
  if (invitation.status !== "pending") {
    throw new LeagueInvitationError(
      "invitation_already_consumed",
      `Invitation deja ${invitation.status}`,
    );
  }
  if (
    invitation.inviteeUserId !== null &&
    invitation.inviteeUserId !== input.userId
  ) {
    throw new LeagueInvitationError(
      "invitation_not_for_user",
      "Cette invitation ne vous est pas adressee",
    );
  }
  return prisma.leagueInvitation.update({
    where: { id: invitation.id },
    data: { status: "declined", declinedAt: new Date() },
  });
}

/** Annule une invitation pending (cote inviter / admin). */
export async function cancelInvitation(input: {
  invitationId: string;
  byUserId: string;
  isAdmin?: boolean;
}) {
  const invitation = await prisma.leagueInvitation.findUnique({
    where: { id: input.invitationId },
  });
  if (!invitation) {
    throw new LeagueInvitationError(
      "invitation_not_found",
      "Invitation introuvable",
    );
  }
  if (invitation.status !== "pending") {
    throw new LeagueInvitationError(
      "invitation_already_consumed",
      `Invitation deja ${invitation.status}`,
    );
  }
  if (!input.isAdmin && invitation.inviterUserId !== input.byUserId) {
    throw new LeagueInvitationError(
      "forbidden",
      "Seul l'inviter ou un admin peut annuler une invitation",
    );
  }
  return prisma.leagueInvitation.update({
    where: { id: invitation.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
}

/** Liste les invitations pour une ligue (optionnellement filtree par status). */
export async function listInvitationsForLeague(input: {
  leagueId: string;
  status?: LeagueInvitationStatus;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  return prisma.leagueInvitation.findMany({
    where: {
      leagueId: input.leagueId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      invitee: { select: { id: true, coachName: true } },
      inviteeTeam: { select: { id: true, name: true, roster: true } },
      season: { select: { id: true, name: true, seasonNumber: true } },
    },
  });
}

/** Liste les invitations pending pour un user (pour l'UI "Mes invitations"). */
export async function listPendingInvitationsForUser(userId: string) {
  return prisma.leagueInvitation.findMany({
    where: {
      inviteeUserId: userId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      league: { select: { id: true, name: true } },
      season: {
        select: { id: true, name: true, seasonNumber: true, status: true },
      },
      inviter: { select: { id: true, coachName: true } },
      inviteeTeam: { select: { id: true, name: true } },
    },
  });
}

/**
 * Recupere une invitation par code (vue publique du lien shareable).
 * Renvoie les meta info minimales pour permettre la decision avant
 * acceptation : ligue, saison, inviter.
 */
export async function getInvitationByCode(code: string) {
  const invitation = await prisma.leagueInvitation.findUnique({
    where: { code },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          description: true,
          ruleset: true,
          allowedRosters: true,
          status: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
          seasonNumber: true,
          status: true,
          startDate: true,
        },
      },
      inviter: { select: { id: true, coachName: true } },
      inviteeTeam: { select: { id: true, name: true, roster: true } },
    },
  });
  if (!invitation) return null;

  // Pour une invitation league-wide (sans saison), la page d'acceptation a
  // besoin des saisons ouvertes pour : afficher un message si 0, choisir si
  // plusieurs, ou laisser l'auto-résolution opérer si exactement 1.
  const availableSeasons = invitation.seasonId
    ? []
    : await listOpenSeasonsForLeague(invitation.leagueId);

  return { ...invitation, availableSeasons };
}

/**
 * Job de housekeeping : marque "expired" les invitations pending
 * dont `expiresAt` est passe. Idempotent. A appeler via cron ou
 * lazy au read.
 */
export async function expireOldInvitations(now: Date = new Date()) {
  const result = await prisma.leagueInvitation.updateMany({
    where: { status: "pending", expiresAt: { lte: now } },
    data: { status: "expired" },
  });
  return { expired: result.count };
}
