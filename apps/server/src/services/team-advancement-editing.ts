/**
 * Édition avancée d'une équipe DÉJÀ créée : pool de PSP de construction et
 * améliorations achetables/annulables hors match.
 *
 * Jusqu'ici, le pool de PSP (`Team.startingPspPool`) ne se réglait qu'au
 * builder et les compétences achetées à la création étaient définitives :
 * la fiche d'édition ne proposait que des avancements payés sur les SPP du
 * joueur — nuls tant qu'il n'a pas joué. Un coach qui s'était trompé de
 * compétence devait recréer son équipe.
 *
 * Règles portées ici :
 *  - l'équipe doit être libre (`isTeamRosterFrozen` faux) : dès qu'elle est
 *    engagée en ligue, coupe ou match, son roster est figé ;
 *  - le pool ne peut pas descendre sous ce qui est déjà dépensé, ni être
 *    touché quand une coupe l'a imposé ;
 *  - le barème PSP est celui du **règlement de tournoi** de l'équipe quand
 *    elle en a un, sinon le barème standard BB2025 ;
 *  - une amélioration annulée rend ses PSP à sa source de financement et
 *    défait son effet (compétence retirée, caractéristique rendue).
 */

import { prisma } from '../prisma';
import {
  applyCharacteristicReduction,
  getNextAdvancementPspCost,
  getTournamentRosterRules,
  getTournamentRuleset,
  maxTwoSkillPlayers,
  parseAdvancements,
  poolSpentForTeam,
  tournamentSkillCost,
  type AdvancementType,
  type CharacteristicKind,
  type PlayerAdvancement,
  type TournamentRulesetDefinition,
} from '@bb/game-engine';
import { isTeamRosterFrozen } from './team-lock-status';
import { updateTeamValues } from '../utils/team-values';
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from './team-audit';

/** Borne haute du pool réglable à la main (miroir du builder). */
export const MAX_STARTING_PSP_POOL = 200;

export type TeamAdvancementErrorCode =
  | 'team-not-found'
  | 'team-frozen'
  | 'pool-locked'
  | 'pool-below-spent'
  | 'pool-out-of-range'
  | 'player-not-found'
  | 'advancement-not-found'
  | 'tournament-rules';

/** Erreur typée : la route mappe le `code` vers un status HTTP. */
export class TeamAdvancementError extends Error {
  constructor(
    public readonly code: TeamAdvancementErrorCode,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'TeamAdvancementError';
  }
}

/** État du pool de PSP de construction d'une équipe. */
export interface TeamPspPoolState {
  readonly pool: number;
  readonly spent: number;
  readonly remaining: number;
  /** Le pool est imposé par une coupe : non modifiable par le coach. */
  readonly locked: boolean;
  /** Slug du règlement de tournoi de l'équipe (null = barème standard). */
  readonly tournamentRuleset: string | null;
}

interface TeamRow {
  readonly id: string;
  readonly roster: string;
  readonly startingPspPool: number;
  readonly tournamentRuleset: string | null;
}

async function loadOwnedTeam(teamId: string, ownerId: string): Promise<TeamRow> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId, deletedAt: null },
    select: {
      id: true,
      roster: true,
      startingPspPool: true,
      tournamentRuleset: true,
    },
  });
  if (!team) {
    throw new TeamAdvancementError('team-not-found', 'Équipe introuvable');
  }
  return team as TeamRow;
}

/** PSP déjà prélevés sur le pool par l'ensemble des joueurs de l'équipe. */
export async function poolSpentForTeamId(teamId: string): Promise<number> {
  const players = await prisma.teamPlayer.findMany({
    where: { teamId },
    select: { advancements: true },
  });
  return poolSpentForTeam(
    players.map((p: { advancements: unknown }) => parseAdvancements(p.advancements)),
  );
}

/**
 * Le pool est-il verrouillé ? Une coupe qui accorde des PSP de départ fige
 * la valeur : le coach ne doit pas pouvoir se la ré-attribuer à volonté.
 */
async function isPoolLocked(teamId: string): Promise<boolean> {
  const participation = await prisma.cupParticipant.findFirst({
    where: { teamId },
    select: { id: true },
  });
  return Boolean(participation);
}

/** État courant du pool, pour l'affichage de l'éditeur. */
export async function getTeamPspPoolState(
  teamId: string,
  ownerId: string,
): Promise<TeamPspPoolState> {
  const team = await loadOwnedTeam(teamId, ownerId);
  const spent = await poolSpentForTeamId(teamId);
  return {
    pool: team.startingPspPool,
    spent,
    remaining: Math.max(0, team.startingPspPool - spent),
    locked: await isPoolLocked(teamId),
    tournamentRuleset: team.tournamentRuleset,
  };
}

/**
 * Règle le pool de PSP de construction. Refuse de descendre sous les PSP
 * déjà dépensés : il faudrait sinon deviner quelles améliorations annuler.
 */
export async function setStartingPspPool(
  teamId: string,
  ownerId: string,
  pool: number,
): Promise<TeamPspPoolState> {
  const team = await loadOwnedTeam(teamId, ownerId);

  if (!Number.isInteger(pool) || pool < 0 || pool > MAX_STARTING_PSP_POOL) {
    throw new TeamAdvancementError(
      'pool-out-of-range',
      `Le pool de PSP doit être un entier entre 0 et ${MAX_STARTING_PSP_POOL}`,
    );
  }
  if (await isTeamRosterFrozen(teamId)) {
    throw new TeamAdvancementError(
      'team-frozen',
      "Cette équipe est engagée en compétition : son pool de PSP est figé",
    );
  }
  if (await isPoolLocked(teamId)) {
    throw new TeamAdvancementError(
      'pool-locked',
      'Le pool de PSP de cette équipe est imposé par une coupe',
    );
  }

  const spent = await poolSpentForTeamId(teamId);
  if (pool < spent) {
    throw new TeamAdvancementError(
      'pool-below-spent',
      `${spent} PSP sont déjà dépensés : annule des compétences avant de descendre le pool à ${pool}`,
      { spent, requested: pool },
    );
  }

  const poolAuditDb = prisma as unknown as TeamAuditPrismaLike;
  const poolAuditBefore = await captureTeamState(poolAuditDb, teamId);

  await prisma.team.update({
    where: { id: teamId },
    data: { startingPspPool: pool },
  });

  await safeRecordTeamAudit(poolAuditDb, {
    teamId,
    action: 'team.psp-pool.update',
    before: poolAuditBefore,
    details: { pool, spent, remaining: pool - spent },
  });

  return {
    pool,
    spent,
    remaining: pool - spent,
    locked: false,
    tournamentRuleset: team.tournamentRuleset,
  };
}

/**
 * Barème PSP applicable à cette équipe : celui du règlement de tournoi
 * retenu à la création s'il y en a un, sinon le barème standard BB2025.
 * Un règlement n'a de barème que pour les compétences au choix ; les
 * autres types (aléatoire, caractéristique) qu'il interdit de toute façon
 * retombent sur le barème standard.
 */
export function advancementCostFor(
  pack: TournamentRulesetDefinition | null,
  alreadyTaken: number,
  type: AdvancementType,
  skillSlug?: string,
): number {
  if (pack && (type === 'primary' || type === 'secondary')) {
    return tournamentSkillCost(pack, alreadyTaken, type, skillSlug);
  }
  return getNextAdvancementPspCost(alreadyTaken, type);
}

/** Règlement de tournoi de l'équipe, résolu depuis le slug persisté. */
export function packForTeam(
  tournamentRuleset: string | null,
): TournamentRulesetDefinition | null {
  return getTournamentRuleset(tournamentRuleset);
}

/**
 * Le règlement autorise-t-il CETTE amélioration de plus ? Vérifie le type
 * (un règlement n'ouvre que les compétences au choix) et le quota de
 * joueurs autorisés à cumuler 2 compétences, en comptant l'équipe entière.
 * Lève une `TeamAdvancementError('tournament-rules')` sinon.
 */
export async function assertTournamentAllowsAdvancement(params: {
  readonly teamId: string;
  readonly roster: string;
  readonly playerId: string;
  readonly pack: TournamentRulesetDefinition | null;
  readonly type: AdvancementType;
}): Promise<void> {
  const { teamId, roster, playerId, pack, type } = params;
  if (!pack) return;

  const rules = getTournamentRosterRules(pack, roster);
  if (!rules) {
    throw new TeamAdvancementError(
      'tournament-rules',
      `Le règlement « ${pack.nameFr} » n'autorise pas le roster ${roster}`,
    );
  }
  if (type !== 'primary' && type !== 'secondary') {
    throw new TeamAdvancementError(
      'tournament-rules',
      "Ce règlement n'autorise que des compétences au choix : améliorations aléatoires et de caractéristique interdites",
    );
  }

  const players = await prisma.teamPlayer.findMany({
    where: { teamId },
    select: { id: true, advancements: true },
  });

  let doubled = 0;
  for (const p of players) {
    const taken =
      parseAdvancements(p.advancements).length + (p.id === playerId ? 1 : 0);
    if (p.id === playerId && taken > 2) {
      throw new TeamAdvancementError(
        'tournament-rules',
        'Un joueur ne peut pas cumuler plus de 2 compétences sous ce règlement',
      );
    }
    if (taken >= 2) doubled += 1;
  }

  const maxDoubled = maxTwoSkillPlayers(rules.skillStacking);
  if (doubled > maxDoubled) {
    throw new TeamAdvancementError(
      'tournament-rules',
      maxDoubled === 0
        ? 'Ce roster ne peut pas cumuler 2 compétences sur un même joueur'
        : `Ce roster ne peut cumuler 2 compétences que sur ${maxDoubled} joueur${maxDoubled > 1 ? 's' : ''} maximum`,
    );
  }
}

export interface RemoveAdvancementResult {
  readonly player: unknown;
  readonly refunded: number;
  readonly refundedTo: 'pool' | 'player';
  readonly removed: PlayerAdvancement;
}

/**
 * Annule la N-ième amélioration d'un joueur et défait son effet :
 *  - compétence => retirée de `skills` ;
 *  - caractéristique => rendue (`applyCharacteristicReduction`).
 *
 * Les PSP retournent à leur source : le pool d'équipe (rien à écrire, le
 * dépensé est recalculé depuis les avancements restants) ou les SPP du
 * joueur.
 */
export async function removePlayerAdvancement(params: {
  readonly teamId: string;
  readonly ownerId: string;
  readonly playerId: string;
  readonly index: number;
}): Promise<RemoveAdvancementResult> {
  const { teamId, ownerId, playerId, index } = params;
  await loadOwnedTeam(teamId, ownerId);

  if (await isTeamRosterFrozen(teamId)) {
    throw new TeamAdvancementError(
      'team-frozen',
      "Cette équipe est engagée en compétition : ses joueurs sont figés",
    );
  }

  const player = await prisma.teamPlayer.findFirst({
    where: { id: playerId, teamId },
    select: {
      id: true,
      skills: true,
      advancements: true,
      spp: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
    },
  });
  if (!player) {
    throw new TeamAdvancementError('player-not-found', 'Joueur introuvable');
  }

  const advancements = parseAdvancements(player.advancements) as PlayerAdvancement[];
  if (index < 0 || index >= advancements.length) {
    throw new TeamAdvancementError(
      'advancement-not-found',
      'Amélioration introuvable sur ce joueur',
    );
  }

  const removed = advancements[index];
  // Le coût rendu est celui payé (persisté) ; à défaut, celui du barème
  // standard au rang occupé — même règle que la comptabilité du pool.
  const refunded = advancementRefund(removed, index);
  const refundedTo: 'pool' | 'player' =
    removed.fundedBy === 'player' ? 'player' : 'pool';

  const remaining = advancements.filter((_, i) => i !== index);

  const data: Record<string, unknown> = {
    advancements: JSON.stringify(remaining),
  };

  if (removed.type === 'characteristic' && removed.stat) {
    const reduced = applyCharacteristicReduction(
      {
        ma: player.ma,
        st: player.st,
        ag: player.ag,
        pa: player.pa,
        av: player.av,
      },
      removed.stat as CharacteristicKind,
    );
    data.ma = reduced.ma;
    data.st = reduced.st;
    data.ag = reduced.ag;
    data.pa = reduced.pa;
    data.av = reduced.av;
  } else if (removed.skillSlug) {
    // Retire UNE occurrence du slug : les compétences de base du poste
    // restent, seule celle acquise par cette amélioration part.
    const skills = (player.skills ?? '').split(',').filter(Boolean);
    const at = skills.lastIndexOf(removed.skillSlug);
    if (at >= 0) skills.splice(at, 1);
    data.skills = skills.join(',');
  }

  if (refundedTo === 'player') {
    data.spp = { increment: refunded };
  }

  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const auditBefore = await captureTeamState(auditDb, teamId);

  await prisma.teamPlayer.update({ where: { id: playerId }, data });

  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: 'team.player.advancement.remove',
    entity: 'TeamPlayer',
    entityId: playerId,
    before: auditBefore,
    details: { removed, index, refunded, refundedTo },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateTeamValues(prisma as any, teamId);

  const updated = await prisma.teamPlayer.findUnique({ where: { id: playerId } });
  return { player: updated, refunded, refundedTo, removed };
}

/** Barème standard, utilisé quand l'amélioration ne porte pas son coût. */
const STANDARD_PSP_COSTS: Readonly<Record<string, readonly number[]>> = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [10, 12, 16, 20, 24, 34],
  'random-primary': [3, 4, 6, 8, 10, 15],
  characteristic: [14, 16, 20, 24, 28, 38],
};

function advancementRefund(adv: PlayerAdvancement, index: number): number {
  if (typeof adv.pspCost === 'number' && Number.isFinite(adv.pspCost)) {
    return Math.max(0, adv.pspCost);
  }
  const table = STANDARD_PSP_COSTS[adv.type];
  if (!table) return 0;
  return table[Math.min(Math.max(index, 0), table.length - 1)];
}
