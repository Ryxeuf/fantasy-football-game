/**
 * S27.8.22 — Module dedie aux 4 handlers de lecture seule extraits
 * depuis `routes/team.ts`. Premier slice du refactor monolith team.ts
 * (2414 lignes a l'origine).
 *
 * Endpoints couverts :
 *  - `GET /team/name-generator` — `handleGenerateTeamName` :
 *    generateur de nom (utilitaire pur, pas d'auth, pas de DB).
 *  - `GET /team/available` — `handleListAvailableTeams` : liste des
 *    equipes du user qui ne sont pas engagees dans un match
 *    `pending`/`active` (filtrable par ruleset).
 *  - `GET /team/mine` — `handleListMyTeams` : listing pagine des
 *    equipes du user (avec total + meta).
 *  - `GET /team/rosters/:id` — `handleGetRoster` : lookup d'un roster
 *    par slug. 404 si slug inconnu ou si non trouve en base.
 *
 * Les 4 handlers sont thematiquement coheressents (lecture seule,
 * sans mutation) et n'ont aucune dependance vers les autres handlers
 * de `team.ts` (build, update, players, star-players, purchase).
 *
 * Apres extraction, `team.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration
 * (`team.test.ts`).
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import type { Ruleset } from '@bb/game-engine';
import { resolveRuleset, isValidRuleset } from '../utils/ruleset-helpers';
import { getRosterFromDb } from '../utils/roster-helpers';
import { parsePagination, buildApiMeta } from '../utils/pagination';
import { generateTeamName } from '../services/team-name-generator';
import { isAllowedTeamRoster } from '../constants/allowed-teams';

/**
 * S27.8.22 — `GET /team/name-generator`
 *
 * Generateur de nom utilitaire (pur, sans auth ni DB). Lit `roster`
 * et `seed` depuis la query, defaut roster = "generic". Delegue a
 * `services/team-name-generator.generateTeamName`.
 */
export function handleGenerateTeamName(
  req: AuthenticatedRequest,
  res: Response,
): void {
  const roster =
    typeof req.query.roster === 'string' && req.query.roster.length > 0
      ? req.query.roster
      : 'generic';
  const seed =
    typeof req.query.seed === 'string' && req.query.seed.length > 0
      ? req.query.seed
      : undefined;
  const name = generateTeamName(roster, seed ? { seed } : {});
  sendSuccess(res, { name, roster });
}

/**
 * S25.5o / S27.8.22 — `GET /team/available`
 *
 * Liste les equipes du user qui ne sont engagees dans aucun match
 * `pending`/`active`. Filtrable par `ruleset` (S2/S3) via la query.
 * Reponse minimale : `{ id, name, roster, ruleset, createdAt }`.
 */
export async function handleListAvailableTeams(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const requestedRuleset = req.query.ruleset as string | undefined;
  const filterRuleset = isValidRuleset(requestedRuleset)
    ? (requestedRuleset as Ruleset)
    : undefined;
  const teams = await prisma.team.findMany({
    where: {
      ownerId: req.user!.id,
      deletedAt: null,
      ...(filterRuleset && { ruleset: filterRuleset }),
      selections: {
        none: {
          match: { status: { in: ['pending', 'active'] } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      roster: true,
      ruleset: true,
      format: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, { teams });
}

/**
 * S25.5p / S27.8.22 — `GET /team/mine`
 *
 * Listing pagine des equipes du user (avec total + meta). Filtrable
 * par `ruleset`. Pagination via `parsePagination` (limit + offset).
 */
export async function handleListMyTeams(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const requestedRuleset = req.query.ruleset as string | undefined;
  const filterRuleset = isValidRuleset(requestedRuleset)
    ? (requestedRuleset as Ruleset)
    : undefined;
  const { limit, offset } = parsePagination(
    req.query as Record<string, unknown>,
  );
  const where = {
    ownerId: req.user!.id,
    deletedAt: null,
    ...(filterRuleset && { ruleset: filterRuleset }),
  };
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      select: {
        id: true,
        name: true,
        roster: true,
        ruleset: true,
        format: true,
        createdAt: true,
        currentValue: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.team.count({ where }),
  ]);
  sendSuccess(res, { teams, meta: buildApiMeta({ total, limit, offset }) });
}

/**
 * S25.5n / S27.8.22 — `GET /team/rosters/:id`
 *
 * Lookup d'un roster par slug. 404 si slug inconnu (pas dans
 * `ALLOWED_TEAMS`) ou si non trouve en base. Resolution du ruleset
 * via `resolveRuleset` (defaut S2/S3 selon config).
 */
export async function handleGetRoster(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!isAllowedTeamRoster(id)) {
    sendError(res, 'Roster inconnu', 404);
    return;
  }
  const ruleset = resolveRuleset(req.query.ruleset as string | undefined);

  const roster = await getRosterFromDb(id, 'fr', ruleset);
  if (!roster) {
    sendError(res, 'Roster non trouve en base de donnees', 404);
    return;
  }

  sendSuccess(res, { roster, ruleset });
}
