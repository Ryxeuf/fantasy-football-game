/**
 * S27.8.26 — Module dedie aux 2 handlers de selection / detail
 * extraits depuis `routes/team.ts`. Cinquieme slice du refactor
 * monolith team.ts.
 *
 * Endpoints couverts :
 *  - `POST /team/choose` — `handleChooseTeam` : choisit une equipe
 *    pour un match `pending`. Transactional avec gates : pas deja
 *    choisi pour ce match, pas deja prise par l'autre coach. Catch
 *    P2002 -> 409 selon la cible.
 *  - `GET /team/:id` — `handleGetTeamDetail` : detail d'une equipe
 *    avec players, starPlayers enrichis, current match selection,
 *    et statistiques aggregees sur les `localMatch` (pending /
 *    waiting / inProgress / completed / cancelled, wins / draws /
 *    losses, touchdowns for / against / diff).
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `getStarPlayerBySlug` from `@bb/game-engine`, `serverLog`. Aucun
 * cycle vers `team.ts`.
 *
 * Apres extraction, `team.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par `team.test.ts`.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { isGameFormat, type Ruleset } from '@bb/game-engine';
import { getStarPlayerBySlugDb } from '../utils/star-player-repository';
import { resolveStaffConfigBySlug } from '../services/roster-staff-config';
import { buildTeamBudgetSummary } from '../services/team-budget-summary';
import { getTeamSpecialRules } from '../services/team-special-rules';
import { serverLog } from '../utils/server-log';
import {
  isAdminRequest,
  teamAccessWhere,
} from '../services/team-edit-access';

/**
 * S27.8.26 — `POST /team/choose`
 *
 * Selectionne une equipe pour un match. Verifie :
 * - le match existe et est en `pending`
 * - le user n'a pas deja choisi (409)
 * - l'equipe n'est pas deja prise (409)
 * Transactional. Catch P2002 selon le champ unique en conflit.
 */
export async function handleChooseTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { matchId, teamId } = req.body;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }
    if (match.status !== 'pending') {
      sendError(res, `Match non modifiable (statut: ${match.status})`, 400);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selection = await prisma.$transaction(async (tx: any) => {
      const existingMineTx = await tx.teamSelection.findFirst({
        where: { matchId, userId: req.user!.id },
      });
      if (existingMineTx)
        throw Object.assign(
          new Error('Vous avez deja choisi une equipe pour ce match'),
          { status: 409 },
        );

      const alreadyUsedTx = await tx.teamSelection.findFirst({
        where: { matchId, teamId },
      });
      if (alreadyUsedTx)
        throw Object.assign(
          new Error('Cette equipe est deja utilisee dans ce match'),
          { status: 409 },
        );

      return tx.teamSelection.create({
        data: {
          match: { connect: { id: matchId } },
          user: { connect: { id: req.user!.id } },
          team: teamId,
          teamRef: { connect: { id: teamId } },
        },
        include: { teamRef: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });
    sendSuccess(res, { selection }, 201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e?.status) {
      sendError(res, e.message, e.status);
      return;
    }
    if (e?.code === 'P2002') {
      sendError(
        res,
        e?.meta?.target?.includes('userId')
          ? 'Vous avez deja choisi une equipe pour ce match'
          : "Conflit d'unicite pour ce match",
        409,
      );
      return;
    }
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5ae / S27.8.26 — `GET /team/:id`
 *
 * Retourne le detail complet d'une equipe (proprietaire courant) :
 *  - players + starPlayers enrichis (catalogue via `getStarPlayerBySlug`)
 *  - currentMatch (premiere selection en cours)
 *  - localMatchStats : stats agregees sur les 500 dernieres
 *    `LocalMatch` (counts par status + bilan completed)
 */
export async function handleGetTeamDetail(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Un admin lit n'importe quelle equipe (console d'edition) ; le coach
    // reste limite aux siennes. `deletedAt` n'est PAS filtre pour l'admin :
    // consulter une equipe supprimee est justement ce qu'il vient faire.
    const admin = isAdminRequest(req);
    const team = await prisma.team.findFirst({
      where: {
        ...teamAccessWhere(req, req.params.id),
        ...(admin ? {} : { deletedAt: null }),
      },
      include: {
        players: true,
        starPlayers: true,
      },
    });
    if (!team) {
      sendError(res, 'Introuvable', 404);
      return;
    }

    const enrichedStarPlayers = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      team.starPlayers.map(async (sp: any) => {
        const starPlayerData = await getStarPlayerBySlugDb(
          sp.starPlayerSlug,
          team.ruleset as Ruleset,
        );
        return {
          id: sp.id,
          slug: sp.starPlayerSlug,
          cost: sp.cost,
          hiredAt: sp.hiredAt,
          ...starPlayerData,
        };
      }),
    );

    const selection = await prisma.teamSelection.findFirst({
      where: { teamId: team.id },
      include: { match: true },
    });

    const localMatches = await prisma.localMatch.findMany({
      where: {
        OR: [{ teamAId: team.id }, { teamBId: team.id }],
      },
      select: {
        id: true,
        status: true,
        teamAId: true,
        teamBId: true,
        scoreTeamA: true,
        scoreTeamB: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    let pending = 0;
    let waitingForPlayer = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let touchdownsFor = 0;
    let touchdownsAgainst = 0;

    for (const match of localMatches) {
      switch (match.status) {
        case 'pending':
          pending += 1;
          break;
        case 'waiting_for_player':
          waitingForPlayer += 1;
          break;
        case 'in_progress':
          inProgress += 1;
          break;
        case 'completed':
          completed += 1;
          break;
        case 'cancelled':
          cancelled += 1;
          break;
        default:
          break;
      }

      if (match.status === 'completed') {
        const isTeamA = match.teamAId === team.id;
        const myScore = isTeamA
          ? (match.scoreTeamA ?? 0)
          : (match.scoreTeamB ?? 0);
        const oppScore = isTeamA
          ? (match.scoreTeamB ?? 0)
          : (match.scoreTeamA ?? 0);

        touchdownsFor += myScore;
        touchdownsAgainst += oppScore;

        if (myScore > oppScore) {
          wins += 1;
        } else if (myScore < oppScore) {
          losses += 1;
        } else {
          draws += 1;
        }
      }
    }

    const localMatchStats = {
      total: localMatches.length,
      pending,
      waitingForPlayer,
      inProgress,
      completed,
      cancelled,
      matchesPlayed: completed,
      wins,
      draws,
      losses,
      touchdownsFor,
      touchdownsAgainst,
      touchdownDiff: touchdownsFor - touchdownsAgainst,
    };

    // Config staff résolue (DB par roster × format, sinon défaut) — permet aux
    // vues équipe d'afficher des coûts cohérents avec l'admin.
    const staffConfig = await resolveStaffConfigBySlug(
      team.roster,
      team.ruleset,
      isGameFormat(team.format) ? team.format : 'bb11',
    );

    // Règles spéciales EFFECTIVES de l'équipe : celles du roster PLUS
    // l'alignement « Favori de… » apporté par la Ligue régionale retenue
    // (Nordiques + Clash du Chaos ⇒ Favori de Khorne). La fiche d'équipe
    // ne lisait que les règles du roster et affichait donc « Aucune ».
    const specialRules = await getTeamSpecialRules(
      {
        roster: team.roster,
        ruleset: team.ruleset,
        regionalLeague: (team as { regionalLeague?: string | null })
          .regionalLeague,
      },
      req.query.lang === 'en',
    );

    // Résumé budgétaire calculé côté serveur (VE/VEA + postes de dépense).
    // Le web l'affiche tel quel : plus aucune re-dérivation du coût des
    // joueurs côté client, donc plus de divergence avec la VE.
    const budgetSummary = await buildTeamBudgetSummary(
      prisma,
      team,
      team.players,
      team.starPlayers,
    );

    // Auto-réparation : la VE/VEA stockée peut dater d'avant un changement
    // de règle (valeur des compétences Élite, fans dévoués…). On persiste
    // la valeur fraîche dès qu'elle diverge, pour que la fiche d'équipe, la
    // feuille de match et le matchmaking lisent la même chose.
    if (
      team.teamValue !== budgetSummary.teamValue ||
      team.currentValue !== budgetSummary.currentValue
    ) {
      try {
        await prisma.team.update({
          where: { id: team.id },
          data: {
            teamValue: budgetSummary.teamValue,
            currentValue: budgetSummary.currentValue,
          },
        });
      } catch (e: unknown) {
        // Lecture avant tout : une écriture en échec ne doit pas priver le
        // coach de sa fiche d'équipe.
        serverLog.error('[team-detail] persistance VE/VEA fraiche', e);
      }
    }

    sendSuccess(res, {
      team: {
        ...team,
        teamValue: budgetSummary.teamValue,
        currentValue: budgetSummary.currentValue,
        starPlayers: enrichedStarPlayers,
        staffConfig,
        budgetSummary,
        specialRules,
      },
      currentMatch: selection?.match || null,
      localMatchStats,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la recuperation de l'equipe:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
