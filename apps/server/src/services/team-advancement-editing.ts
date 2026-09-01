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
 *  - l'équipe ne doit pas être ENTRÉE EN JEU (`isTeamBuildLocked` faux). Le
 *    gel de composition (`isTeamRosterFrozen`) tombe dès l'inscription à une
 *    ligue : s'en servir ici condamnait un coach inscrit des semaines avant
 *    le premier match à recréer son équipe pour défaire un achat. C'est
 *    l'ouverture d'une feuille de match (ou l'entrée en jeu) qui fige ;
 *  - le pool ne peut pas descendre sous ce qui est déjà dépensé, et NI le
 *    pool NI le budget d'or ne se règlent quand une coupe ou un règlement de
 *    tournoi publie leur valeur : les afficher modifiables laissait croire
 *    qu'on pouvait s'offrir des PSP hors barème d'un tournoi officiel ;
 *  - le barème PSP est celui du **règlement de tournoi** de l'équipe quand
 *    elle en a un, sinon le barème standard BB2025 ;
 *  - une amélioration annulée rend ses PSP à sa source de financement et
 *    défait son effet (compétence retirée, caractéristique rendue).
 */

import { prisma } from '../prisma';
import {
  applyCharacteristicReduction,
  getNextAdvancementPspCost,
  type AdvancementSchedule,
  getTournamentRosterRules,
  maxTwoSkillPlayers,
  parseAdvancements,
  poolSpentForTeam,
  resolveTournamentEliteSkills,
  standardPspCost,
  tournamentSkillCost,
  type AdvancementType,
  type CharacteristicKind,
  type FallbackPspCost,
  type PlayerAdvancement,
  type Ruleset,
  type TournamentRulesetDefinition,
} from '@bb/game-engine';
import { getTournamentRulesetDefinition } from './tournament-ruleset-repository';
import { getEliteSkillSlugs } from './elite-skills';
import {
  isTeamBuildLocked,
  TEAM_BUILD_LOCKED_MESSAGE,
} from './team-lock-status';
import { updateTeamValues } from '../utils/team-values';
import {
  buildTeamBudgetSummary,
  syncDraftTreasury,
} from './team-budget-summary';
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
  | 'budget-locked'
  | 'budget-below-spent'
  | 'budget-out-of-range'
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

/**
 * Qui impose une valeur de construction. `null` = personne, le coach la règle.
 *
 * Deux sources seulement, et elles ne se cumulent pas dans l'affichage : la
 * coupe (qui accorde un pool de départ) et le règlement de tournoi (qui
 * publie un budget d'or ET un budget de compétences par roster).
 */
export type BuildSettingLock = 'cup' | 'tournament' | null;

/** État du pool de PSP et du budget de construction d'une équipe. */
export interface TeamPspPoolState {
  readonly pool: number;
  readonly spent: number;
  readonly remaining: number;
  /** Le pool est imposé (coupe ou règlement) : non modifiable par le coach. */
  readonly locked: boolean;
  readonly lockedBy: BuildSettingLock;
  /** Slug du règlement de tournoi de l'équipe (null = barème standard). */
  readonly tournamentRuleset: string | null;
  /** Budget de construction, en kpo (`Team.initialBudget`). */
  readonly initialBudget: number;
  /** Le budget d'or est imposé (coupe ou règlement). */
  readonly budgetLocked: boolean;
  readonly budgetLockedBy: BuildSettingLock;
  /**
   * L'équipe est ENTRÉE EN JEU : plus aucun achat de construction, quelles
   * que soient les deux serrures ci-dessus. Relatif à l'appelant (un admin
   * le voit toujours à `false`, comme `frozen` sur `/available-positions`).
   */
  readonly buildLocked: boolean;
}

/** Bornes du budget de construction réglable à la main (miroir du builder). */
export const MIN_INITIAL_BUDGET_K = 100;
export const MAX_INITIAL_BUDGET_K = 2000;

interface TeamRow {
  readonly id: string;
  readonly roster: string;
  readonly ruleset: string | null;
  readonly startingPspPool: number;
  readonly initialBudget: number;
  readonly tournamentRuleset: string | null;
}

/**
 * Qui édite. `isAdmin` reprend la posture de `services/team-edit-access` :
 * un admin agit sur n'importe quelle équipe et n'est pas soumis au gel.
 */
export interface AdvancementEditingOptions {
  readonly isAdmin?: boolean;
}

async function loadOwnedTeam(
  teamId: string,
  ownerId: string,
  isAdmin = false,
): Promise<TeamRow> {
  const team = await prisma.team.findFirst({
    where: isAdmin
      ? { id: teamId, deletedAt: null }
      : { id: teamId, ownerId, deletedAt: null },
    select: {
      id: true,
      roster: true,
      ruleset: true,
      startingPspPool: true,
      initialBudget: true,
      tournamentRuleset: true,
    },
  });
  if (!team) {
    throw new TeamAdvancementError('team-not-found', 'Équipe introuvable');
  }
  return team as TeamRow;
}

/**
 * Barème de repli pour les améliorations écrites AVANT que le coût payé ne
 * soit persisté (`pspCost`).
 *
 * `prisma/migrations/` est gitignoré (prod = `db push`) : ces enregistrements
 * ne peuvent pas être backfillés, le rattrapage se fait donc à la lecture.
 * Sous un règlement de tournoi, c'est SON barème qu'il faut re-appliquer —
 * le barème standard sous-comptait le pool (Ogres NAF WC 2027 : 54 affichés
 * pour 66 réellement dépensés, donc 12 PSP fantômes réputés disponibles).
 */
export async function fallbackPspCostForTeam(
  tournamentRuleset: string | null,
  ruleset: string | null,
): Promise<FallbackPspCost> {
  const pack = await packForTeam(tournamentRuleset);
  if (!pack) return standardPspCost;
  const elite = await eliteSkillsForPack(pack, ruleset);
  return (adv, index) => {
    if (adv.type !== 'primary' && adv.type !== 'secondary') {
      return standardPspCost(adv, index);
    }
    return tournamentSkillCost(
      pack,
      index,
      adv.type,
      (adv as { skillSlug?: string }).skillSlug,
      elite,
    );
  };
}

/** PSP déjà prélevés sur le pool par l'ensemble des joueurs de l'équipe. */
export async function poolSpentForTeamId(
  teamId: string,
  fallbackCost?: FallbackPspCost,
): Promise<number> {
  const players = await prisma.teamPlayer.findMany({
    where: { teamId },
    select: { advancements: true },
  });
  return poolSpentForTeam(
    players.map((p: { advancements: unknown }) => parseAdvancements(p.advancements)),
    fallbackCost,
  );
}

/**
 * Une coupe accorde-t-elle son pool de départ à cette équipe ? Elle fige
 * alors pool ET budget : le coach ne doit pas pouvoir se les ré-attribuer.
 */
async function isCupParticipant(teamId: string): Promise<boolean> {
  const participation = await prisma.cupParticipant.findFirst({
    where: { teamId },
    select: { id: true },
  });
  return Boolean(participation);
}

/**
 * Le règlement de tournoi de l'équipe publie-t-il un budget d'or ET un
 * budget de compétences POUR SON ROSTER ?
 *
 * `TournamentRosterRules` déclare les deux d'un bloc (`goldBudget`,
 * `sppBudget`) : un règlement qui accepte le roster impose donc les deux.
 * Un roster absent de `rosterRules` est interdit par le règlement — il ne
 * lui impose rien, la construction retombe sur les valeurs libres.
 */
async function isImposedByTournament(team: TeamRow): Promise<boolean> {
  const pack = await packForTeam(team.tournamentRuleset);
  if (!pack) return false;
  return Boolean(getTournamentRosterRules(pack, team.roster));
}

/** Qui impose les valeurs de construction de cette équipe (coupe > règlement). */
async function resolveBuildLock(team: TeamRow): Promise<BuildSettingLock> {
  if (await isCupParticipant(team.id)) return 'cup';
  if (await isImposedByTournament(team)) return 'tournament';
  return null;
}

/** Message de refus quand une valeur de construction est imposée. */
function lockedMessage(by: Exclude<BuildSettingLock, null>, what: string): string {
  return by === 'cup'
    ? `${what} de cette équipe est imposé par une coupe`
    : `${what} de cette équipe est imposé par son règlement de tournoi`;
}

/** État courant du pool et du budget, pour l'affichage de l'éditeur. */
export async function getTeamPspPoolState(
  teamId: string,
  ownerId: string,
  options: AdvancementEditingOptions = {},
): Promise<TeamPspPoolState> {
  const team = await loadOwnedTeam(teamId, ownerId, options.isAdmin);
  const [spent, lockedBy, buildLocked] = await Promise.all([
    poolSpentForTeamId(
      teamId,
      await fallbackPspCostForTeam(team.tournamentRuleset, team.ruleset),
    ),
    resolveBuildLock(team),
    options.isAdmin ? Promise.resolve(false) : isTeamBuildLocked(teamId),
  ]);
  return {
    pool: team.startingPspPool,
    spent,
    remaining: Math.max(0, team.startingPspPool - spent),
    locked: lockedBy !== null,
    lockedBy,
    tournamentRuleset: team.tournamentRuleset,
    initialBudget: team.initialBudget,
    budgetLocked: lockedBy !== null,
    budgetLockedBy: lockedBy,
    buildLocked,
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
  options: AdvancementEditingOptions = {},
): Promise<TeamPspPoolState> {
  const team = await loadOwnedTeam(teamId, ownerId, options.isAdmin);

  if (!Number.isInteger(pool) || pool < 0 || pool > MAX_STARTING_PSP_POOL) {
    throw new TeamAdvancementError(
      'pool-out-of-range',
      `Le pool de PSP doit être un entier entre 0 et ${MAX_STARTING_PSP_POOL}`,
    );
  }
  if (!options.isAdmin && (await isTeamBuildLocked(teamId))) {
    throw new TeamAdvancementError('team-frozen', TEAM_BUILD_LOCKED_MESSAGE);
  }
  const lockedBy = await resolveBuildLock(team);
  if (lockedBy) {
    throw new TeamAdvancementError(
      'pool-locked',
      lockedMessage(lockedBy, 'Le pool de PSP'),
    );
  }

  const spent = await poolSpentForTeamId(
    teamId,
    await fallbackPspCostForTeam(team.tournamentRuleset, team.ruleset),
  );
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
    lockedBy: null,
    tournamentRuleset: team.tournamentRuleset,
    initialBudget: team.initialBudget,
    budgetLocked: false,
    budgetLockedBy: null,
    buildLocked: false,
  };
}

/**
 * Règle le budget d'or de construction (`Team.initialBudget`, en kpo).
 *
 * Même posture que le pool : réglable tant que personne ne l'impose, figé dès
 * qu'une coupe ou un règlement de tournoi publie sa valeur. Refuse de
 * descendre sous ce qui est déjà engagé (joueurs + staff + Star Players) —
 * `PUT /team/:id/roster` refuserait de toute façon la sauvegarde suivante, et
 * l'équipe se retrouverait coincée en « budget dépassé ».
 */
export async function setInitialBudget(
  teamId: string,
  ownerId: string,
  budgetK: number,
  options: AdvancementEditingOptions = {},
): Promise<TeamPspPoolState> {
  const team = await loadOwnedTeam(teamId, ownerId, options.isAdmin);

  if (
    !Number.isInteger(budgetK) ||
    budgetK < MIN_INITIAL_BUDGET_K ||
    budgetK > MAX_INITIAL_BUDGET_K
  ) {
    throw new TeamAdvancementError(
      'budget-out-of-range',
      `Le budget doit être un entier entre ${MIN_INITIAL_BUDGET_K} et ${MAX_INITIAL_BUDGET_K} kpo`,
    );
  }
  if (!options.isAdmin && (await isTeamBuildLocked(teamId))) {
    throw new TeamAdvancementError('team-frozen', TEAM_BUILD_LOCKED_MESSAGE);
  }
  const lockedBy = await resolveBuildLock(team);
  if (lockedBy) {
    throw new TeamAdvancementError(
      'budget-locked',
      lockedMessage(lockedBy, "Le budget d'or"),
    );
  }

  const spentPo = await committedGoldForTeam(teamId);
  if (budgetK * 1000 < spentPo) {
    const spentK = Math.ceil(spentPo / 1000);
    throw new TeamAdvancementError(
      'budget-below-spent',
      `${spentK}k po sont déjà engagés : retire des joueurs ou du staff avant de descendre le budget à ${budgetK}k`,
      { spentK, requested: budgetK },
    );
  }

  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const before = await captureTeamState(auditDb, teamId);

  await prisma.team.update({
    where: { id: teamId },
    data: { initialBudget: budgetK },
  });

  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: 'team.budget.update',
    before,
    details: { initialBudget: budgetK, committed: spentPo },
  });

  // Le reliquat du budget est la trésorerie d'une équipe en brouillon : sans
  // ce recalcul, remonter le budget n'aurait crédité personne.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await syncDraftTreasury(prisma as any, teamId);

  return getTeamPspPoolState(teamId, ownerId, options);
}

/** Or déjà engagé (embauches + staff + Star Players), en po. */
async function committedGoldForTeam(teamId: string): Promise<number> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: true, starPlayers: true },
  });
  if (!team) return 0;
  const summary = await buildTeamBudgetSummary(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    team as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (team as any).players,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (team as any).starPlayers,
  );
  return summary.totalSpent;
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
  // Lot 6.2 — barème de l'ÉDITION de l'équipe quand le règlement n'impose
  // pas le sien. Absent ⇒ barème compilé (comportement d'avant le lot).
  schedule?: AdvancementSchedule,
  /**
   * Compétences Élite retenues par le règlement, résolues par
   * `eliteSkillsForPack`.
   *
   * OBLIGATOIRE pour facturer le surcoût Élite : omis, `tournamentSkillCost`
   * retombe sur la liste publiée par le règlement — vide pour le pack NAF
   * WC 2027, qui facture pourtant un surcoût Élite. Le build passait bien
   * cette liste, pas l'achat d'après-création : la MÊME compétence coûtait
   * 8 PSP à la construction et 6 le lendemain.
   */
  eliteSkills?: ReadonlySet<string>,
): number {
  if (pack && (type === 'primary' || type === 'secondary')) {
    return tournamentSkillCost(pack, alreadyTaken, type, skillSlug, eliteSkills);
  }
  return getNextAdvancementPspCost(alreadyTaken, type, schedule);
}

/**
 * Compétences Élite qu'un règlement facture : sa propre liste s'il en
 * publie une, sinon celles de l'édition (`Skill.isElite`). Miroir exact de
 * la résolution faite au build (`handleBuildTeam`).
 */
export async function eliteSkillsForPack(
  pack: TournamentRulesetDefinition | null,
  ruleset: string | null,
): Promise<ReadonlySet<string> | undefined> {
  if (!pack) return undefined;
  return resolveTournamentEliteSkills(pack, [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(await getEliteSkillSlugs(prisma as any, (ruleset as Ruleset) ?? undefined)),
  ]);
}

/**
 * Règlement de tournoi de l'équipe, résolu depuis le slug persisté.
 *
 * Passe par le repository (BASE d'abord, registre du moteur en repli) et non
 * par `getTournamentRuleset` du moteur : sinon le barème PSP, la taxe Élite et
 * le quota de cumul sont arbitrés sur la version compilée du règlement, en
 * ignorant les éditions faites dans la console admin (C3 de l'audit).
 */
export async function packForTeam(
  tournamentRuleset: string | null,
): Promise<TournamentRulesetDefinition | null> {
  return getTournamentRulesetDefinition(tournamentRuleset);
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
  readonly isAdmin?: boolean;
}): Promise<RemoveAdvancementResult> {
  const { teamId, ownerId, playerId, index, isAdmin = false } = params;
  await loadOwnedTeam(teamId, ownerId, isAdmin);

  if (!isAdmin && (await isTeamBuildLocked(teamId))) {
    throw new TeamAdvancementError('team-frozen', TEAM_BUILD_LOCKED_MESSAGE);
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
