/**
 * Invitations de coupe (miroir simplifié de `league-invitation.ts`, sans
 * saison). Trois modes : coach ciblé (`inviteeUserId`), e-mail (`inviteeEmail`)
 * ou lien public (`code` seul).
 *
 * Service à I/O = prisma uniquement. Erreurs typées via `CupInvitationError`.
 * Le rattachement d'équipe délègue à `registerTeamToCup` (garde-fous budget/
 * PSP/engagement centralisés).
 */

import { randomBytes } from "crypto";
import { prisma } from "../prisma";
import { notifyInvitedCoach } from "./cup-invitation-notify";
import {
  registerTeamToCup,
  CupRegistrationError,
} from "./cup-registration";
import { serverLog } from "../utils/server-log";

export type CupInvitationErrorCode =
  | "not_found"
  | "cup_not_found"
  | "cup_closed"
  | "expired"
  | "already_consumed"
  | "not_for_user"
  | "forbidden"
  | "already_registered"
  | "already_engaged"
  | "budget_exceeded"
  | "psp_exceeded"
  | "registration_failed"
  | "invalid_state";

export class CupInvitationError extends Error {
  constructor(
    public readonly code: CupInvitationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupInvitationError";
  }
}

/** Token URL-safe partageable (~128 bits). */
export function generateInvitationCode(): string {
  return randomBytes(16).toString("base64url");
}

function clampExpiresDays(days?: number): number {
  if (!days || !Number.isFinite(days)) return 14;
  return Math.min(90, Math.max(1, Math.floor(days)));
}

function computeExpiresAt(days: number, now: Date): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface CreateCupInvitationInput {
  cupId: string;
  inviterUserId: string;
  inviteeUserId?: string | null;
  inviteeEmail?: string | null;
  inviteeTeamId?: string | null;
  message?: string | null;
  expiresInDays?: number;
  baseUrl?: string | null;
}

async function assertCupOpen(cupId: string): Promise<{ id: string; name: string }> {
  const cup = await prisma.cup.findUnique({
    where: { id: cupId },
    select: { id: true, name: true, status: true, validated: true },
  });
  if (!cup) throw new CupInvitationError("cup_not_found", "Coupe introuvable");
  if (cup.status !== "ouverte" || cup.validated) {
    throw new CupInvitationError("cup_closed", "Cette coupe est fermée aux inscriptions");
  }
  return { id: cup.id, name: cup.name };
}

/**
 * Crée une invitation. Idempotence souple : si une invitation `pending`
 * non expirée existe déjà pour (cupId, inviteeUserId), on la retourne.
 */
export async function createCupInvitation(input: CreateCupInvitationInput) {
  const now = new Date();
  const cup = await assertCupOpen(input.cupId);

  if (input.inviteeUserId) {
    const existing = await prisma.cupInvitation.findFirst({
      where: {
        cupId: input.cupId,
        inviteeUserId: input.inviteeUserId,
        status: "pending",
        expiresAt: { gt: now },
      },
    });
    if (existing) return existing;
  }

  const invitation = await prisma.cupInvitation.create({
    data: {
      cupId: input.cupId,
      inviterUserId: input.inviterUserId,
      inviteeUserId: input.inviteeUserId ?? null,
      inviteeEmail: input.inviteeEmail ?? null,
      inviteeTeamId: input.inviteeTeamId ?? null,
      message: input.message ?? null,
      code: generateInvitationCode(),
      status: "pending",
      expiresAt: computeExpiresAt(clampExpiresDays(input.expiresInDays), now),
    },
  });

  // Notification : effet secondaire non bloquant.
  try {
    await notifyInvitedCoach({
      invitation,
      cupName: cup.name,
      baseUrl: input.baseUrl,
    });
  } catch (e) {
    serverLog.error("[cup-invitation] notify failed", e);
  }

  return invitation;
}

/** Info publique d'une invitation (page d'acceptation). */
export async function getCupInvitationByCode(code: string) {
  const invitation = await prisma.cupInvitation.findUnique({
    where: { code },
    include: {
      cup: {
        select: {
          id: true,
          name: true,
          ruleset: true,
          format: true,
          status: true,
          validated: true,
          isPublic: true,
        },
      },
      inviter: { select: { id: true, coachName: true } },
    },
  });
  if (!invitation) throw new CupInvitationError("not_found", "Invitation introuvable");
  return invitation;
}

function mapRegistrationError(e: CupRegistrationError): CupInvitationError {
  switch (e.code) {
    case "cup_not_found":
      return new CupInvitationError("cup_not_found", e.message);
    case "cup_closed":
      return new CupInvitationError("cup_closed", e.message);
    case "already_registered":
      return new CupInvitationError("already_registered", e.message);
    case "already_engaged":
      return new CupInvitationError("already_engaged", e.message);
    case "budget_exceeded":
      return new CupInvitationError("budget_exceeded", e.message);
    case "psp_exceeded":
      return new CupInvitationError("psp_exceeded", e.message);
    default:
      return new CupInvitationError("registration_failed", e.message);
  }
}

/**
 * Accepte une invitation : inscrit l'équipe choisie via `registerTeamToCup`,
 * puis marque l'invitation `accepted`.
 */
export async function acceptCupInvitation(input: {
  code: string;
  userId: string;
  teamId: string;
}) {
  const now = new Date();
  const invitation = await prisma.cupInvitation.findUnique({
    where: { code: input.code },
  });
  if (!invitation) throw new CupInvitationError("not_found", "Invitation introuvable");

  if (invitation.status !== "pending") {
    throw new CupInvitationError("already_consumed", "Cette invitation n'est plus disponible");
  }
  if (invitation.expiresAt <= now) {
    // Marquage paresseux.
    await prisma.cupInvitation
      .update({ where: { id: invitation.id }, data: { status: "expired" } })
      .catch(() => {});
    throw new CupInvitationError("expired", "Cette invitation a expiré");
  }
  if (invitation.inviteeUserId && invitation.inviteeUserId !== input.userId) {
    throw new CupInvitationError(
      "not_for_user",
      "Cette invitation est réservée à un autre coach",
    );
  }

  let participantId: string;
  try {
    const res = await registerTeamToCup({
      cupId: invitation.cupId,
      teamId: input.teamId,
      userId: input.userId,
    });
    participantId = res.participantId;
  } catch (e) {
    if (e instanceof CupRegistrationError) throw mapRegistrationError(e);
    throw e;
  }

  return prisma.cupInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "accepted",
      acceptedAt: now,
      acceptedParticipantId: participantId,
      // Fige le coach accepteur (utile pour un lien public).
      inviteeUserId: invitation.inviteeUserId ?? input.userId,
    },
  });
}

export async function declineCupInvitation(input: { code: string; userId: string }) {
  const invitation = await prisma.cupInvitation.findUnique({
    where: { code: input.code },
  });
  if (!invitation) throw new CupInvitationError("not_found", "Invitation introuvable");
  if (invitation.status !== "pending") {
    throw new CupInvitationError("already_consumed", "Cette invitation n'est plus disponible");
  }
  if (invitation.inviteeUserId && invitation.inviteeUserId !== input.userId) {
    throw new CupInvitationError(
      "not_for_user",
      "Cette invitation est réservée à un autre coach",
    );
  }
  return prisma.cupInvitation.update({
    where: { id: invitation.id },
    data: { status: "declined", declinedAt: new Date() },
  });
}

export async function cancelCupInvitation(input: {
  invitationId: string;
  byUserId: string;
  isAdmin: boolean;
}) {
  const invitation = await prisma.cupInvitation.findUnique({
    where: { id: input.invitationId },
    include: { cup: { select: { creatorId: true } } },
  });
  if (!invitation) throw new CupInvitationError("not_found", "Invitation introuvable");
  const isOwner =
    invitation.inviterUserId === input.byUserId ||
    invitation.cup.creatorId === input.byUserId;
  if (!isOwner && !input.isAdmin) {
    throw new CupInvitationError("forbidden", "Action non autorisée");
  }
  if (invitation.status !== "pending") {
    throw new CupInvitationError("invalid_state", "Cette invitation n'est plus en attente");
  }
  return prisma.cupInvitation.update({
    where: { id: invitation.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
}

/** Invitations d'une coupe (vue commissaire). */
export async function listCupInvitations(cupId: string) {
  return prisma.cupInvitation.findMany({
    where: { cupId },
    orderBy: { createdAt: "desc" },
    include: {
      invitee: { select: { id: true, coachName: true } },
    },
  });
}

/** Invitations `pending` reçues par un coach (ciblées sur lui). */
export async function listPendingCupInvitationsForUser(userId: string) {
  const now = new Date();
  return prisma.cupInvitation.findMany({
    where: {
      inviteeUserId: userId,
      status: "pending",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    include: {
      cup: { select: { id: true, name: true, ruleset: true, format: true } },
      inviter: { select: { id: true, coachName: true } },
    },
  });
}

/** Housekeeping idempotent : passe les invitations pending expirées en expired. */
export async function expireOldCupInvitations(): Promise<number> {
  const res = await prisma.cupInvitation.updateMany({
    where: { status: "pending", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
  return res.count;
}
