/**
 * Inscription d'une équipe à une coupe (logique métier centralisée).
 *
 * Extrait de `POST /cup/:id/register` pour être réutilisé par l'acceptation
 * d'invitation (`cup-invitation.ts`). Applique tous les garde-fous : coupe
 * ouverte, équipe possédée, ruleset/format concordants, non déjà inscrite,
 * règle « une équipe = une seule compétition active », contraintes de budget/
 * PSP (si la coupe est ajustée), puis capture le snapshot et crée le
 * `CupParticipant`.
 */

import { prisma } from '../prisma';
import {
  parseNumberMap,
  resolveCupBudget,
  resolveCupStartingPsp,
  teamAdvancementsPspCost,
  type CupRulesConfig,
} from './cup-rules';
import { captureRosterSnapshot } from './cup-roster-snapshot';
import { getTeamEngagement } from './team-competition-status';

export type CupRegistrationErrorCode =
  | 'cup_not_found'
  | 'cup_closed'
  | 'team_not_found'
  | 'ruleset_mismatch'
  | 'format_mismatch'
  | 'already_registered'
  | 'already_engaged'
  | 'budget_exceeded'
  | 'psp_exceeded';

export class CupRegistrationError extends Error {
  constructor(
    public readonly code: CupRegistrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CupRegistrationError';
  }
}

export interface RegisterTeamToCupResult {
  readonly participantId: string;
  readonly pspPoolGranted: number;
}

/**
 * Inscrit l'équipe `teamId` (possédée par `userId`) à la coupe `cupId`.
 * Lève `CupRegistrationError` en cas de refus. Retourne l'id du participant créé.
 */
export async function registerTeamToCup(input: {
  cupId: string;
  teamId: string;
  userId: string;
}): Promise<RegisterTeamToCupResult> {
  const { cupId, teamId, userId } = input;

  const cup = await prisma.cup.findUnique({
    where: { id: cupId },
    include: { participants: { select: { teamId: true } } },
  });
  if (!cup) {
    throw new CupRegistrationError('cup_not_found', 'Coupe introuvable');
  }
  if (cup.status !== 'ouverte' || cup.validated) {
    throw new CupRegistrationError('cup_closed', 'Cette coupe est fermée aux inscriptions');
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
  });
  if (!team) {
    throw new CupRegistrationError(
      'team_not_found',
      "Équipe introuvable ou vous n'en êtes pas le propriétaire",
    );
  }
  if (team.ruleset !== cup.ruleset) {
    throw new CupRegistrationError(
      'ruleset_mismatch',
      'Cette équipe utilise un ruleset différent de la coupe',
    );
  }
  if (team.format !== cup.format) {
    throw new CupRegistrationError(
      'format_mismatch',
      'Cette équipe utilise un format différent de la coupe',
    );
  }
  if (cup.participants.some((p: { teamId: string }) => p.teamId === teamId)) {
    throw new CupRegistrationError(
      'already_registered',
      'Cette équipe est déjà inscrite à cette coupe',
    );
  }

  const engagement = await getTeamEngagement(teamId, { excludeCupId: cupId });
  if (engagement.engaged) {
    throw new CupRegistrationError(
      'already_engaged',
      `Cette équipe est déjà engagée dans ${
        engagement.name ?? 'une autre compétition'
      } et n'est pas disponible`,
    );
  }

  // Contraintes de composition (uniquement si la coupe les définit).
  const cupRules = cup as unknown as CupRulesConfig;
  let pspPoolGranted = 0;
  const rosterDef = await prisma.roster.findFirst({
    where: { slug: team.roster, ruleset: cup.ruleset },
    select: { tier: true, budget: true },
  });
  if (rosterDef) {
    const rosterForRules = {
      slug: team.roster,
      tier: rosterDef.tier,
      budget: rosterDef.budget,
    };
    const hasBudgetRules =
      Object.keys(parseNumberMap(cupRules.tierBudgets)).length > 0 ||
      Object.keys(parseNumberMap(cupRules.rosterBudgetOverrides)).length > 0;
    const hasPspRules =
      Object.keys(parseNumberMap(cupRules.tierStartingPsp)).length > 0 ||
      Object.keys(parseNumberMap(cupRules.rosterStartingPspOverrides)).length > 0;

    if (hasBudgetRules) {
      const budgetKpo = resolveCupBudget(cupRules, rosterForRules);
      if (team.teamValue > budgetKpo * 1000) {
        const teamValueKpo = Math.round(team.teamValue / 1000);
        throw new CupRegistrationError(
          'budget_exceeded',
          `Cette équipe (VE ${teamValueKpo}k) dépasse le budget autorisé pour cette coupe (${budgetKpo}k)`,
        );
      }
    }
    if (hasPspRules) {
      pspPoolGranted = resolveCupStartingPsp(cupRules, rosterForRules);
      const players = await prisma.teamPlayer.findMany({
        where: { teamId, firedAt: null },
        select: { advancements: true },
      });
      const spent = teamAdvancementsPspCost(players);
      if (spent > pspPoolGranted) {
        throw new CupRegistrationError(
          'psp_exceeded',
          `Cette équipe a dépensé ${spent} PSP d'améliorations, au-delà du pool autorisé (${pspPoolGranted}) pour cette coupe`,
        );
      }
    }
  }

  const snapshot = await captureRosterSnapshot(teamId);
  const participant = await prisma.cupParticipant.create({
    data: {
      cupId,
      teamId,
      pspPoolGranted,
      rosterSnapshot: snapshot ? JSON.stringify(snapshot) : null,
    },
    select: { id: true },
  });

  return { participantId: participant.id, pspPoolGranted };
}
