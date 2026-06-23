/**
 * L2.B.2 — Sprint Ligues v2 PR4 : sequence post-match Jeu en Ligue.
 *
 * Hook execute apres `recordLeagueMatchResult` quand recorded=true. Le
 * Match engine (`move-processor.ts`) a deja :
 *   - applique les SPP gagnes (`persistMatchSPP`)
 *   - applique les permanent / lasting injuries (`persistPermanentInjuries`)
 *   - applique winnings -> Team.treasury
 *   - applique dedicatedFansChange -> Team.dedicatedFans
 *
 * Cette sequence post-match orchestre les seules choses *additionnelles*
 * que le Jeu en Ligue impose :
 *   1. Persister un snapshot des deltas (treasury / fan factor) pour
 *      tracabilite.
 *   2. Identifier les joueurs eligibles a un avancement (SPP >= cout
 *      du prochain advancement le moins cher) et stocker leurs IDs
 *      dans `pendingChoices`.
 *   3. Passer la sequence a status="awaiting_choices" s'il y a des
 *      choix a faire, sinon "completed" directement.
 *
 * Idempotence : 1 sequence par matchId (contrainte unique). Si la
 * sequence existe deja, on la renvoie sans recalculer.
 *
 * L'application effective des choix de level-up se fait via les
 * endpoints de L2.B.3 (`POST /team/:teamId/players/:playerId/advancement`),
 * qui appelle `applyAdvancementChoice` ci-dessous.
 */

import { prisma } from "../prisma";
import {
  getNextAdvancementPspCost,
  type AdvancementType,
  type CharacteristicKind,
  type PlayerAdvancement,
  surchargeForAdvancement,
  applyCharacteristicImprovement,
} from "@bb/game-engine";
import { serverLog } from "../utils/server-log";
import { categoryCodeForSkill, checkSkillAccess } from "./skill-access";

/**
 * Cout SPP du prochain avancement le moins cher (random-primary @ N+1)
 * pour un joueur ayant deja pris N avancements.
 */
function cheapestNextAdvancementCost(advancementsTaken: number): number {
  return getNextAdvancementPspCost(advancementsTaken, "random-primary");
}

export interface PendingChoice {
  /** TeamPlayer.id en DB. */
  readonly teamPlayerId: string;
  /** Nom du joueur (pour affichage UI sans extra fetch). */
  readonly playerName: string;
  /** SPP cumules apres le match. */
  readonly spp: number;
  /** Nombre d'avancements deja pris. */
  readonly advancementsTaken: number;
  /** Cout du prochain advancement le moins cher (random primary). */
  readonly nextAdvancementCost: number;
}

interface SequencePersistedFields {
  treasuryDeltaA: number;
  treasuryDeltaB: number;
  fanFactorDeltaA: number;
  fanFactorDeltaB: number;
  pendingChoices: PendingChoice[];
}

export type RunPostMatchSequenceOutcome =
  | {
      readonly created: true;
      readonly sequenceId: string;
      readonly matchId: string;
      readonly seasonId: string;
      readonly status: "awaiting_choices" | "completed";
      readonly pendingChoices: PendingChoice[];
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "match-missing"
        | "not-a-league-match"
        | "match-not-scored"
        | "already-exists";
      readonly sequenceId?: string;
    };

export interface RunPostMatchSequenceInput {
  readonly matchId: string;
  /**
   * Snapshot a persister (winnings + fanFactorChange) si le caller en
   * dispose. Sinon on lit la DB pour determiner les compteurs (mais
   * sans delta — on stocke 0 car l'info est perdue une fois appliquee).
   */
  readonly winningsSnapshot?: { teamA: number; teamB: number };
  readonly fanFactorSnapshot?: { teamA: number; teamB: number };
}

/**
 * Cree (idempotent) la sequence post-match d'un match de ligue.
 *
 * Pre-requis :
 *  - Match.leagueScoredAt != null (le score a ete reporte au classement)
 *  - Match.leagueSeasonId != null
 *
 * Sinon on skip avec une raison parlante. Pas d'effet de bord.
 */
export async function runPostMatchLeagueSequence(
  input: RunPostMatchSequenceInput,
): Promise<RunPostMatchSequenceOutcome> {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    select: {
      id: true,
      leagueSeasonId: true,
      leagueScoredAt: true,
      leaguePostMatchSequence: { select: { id: true, status: true } },
      teamSelections: {
        orderBy: { createdAt: "asc" },
        select: { teamId: true },
      },
    },
  });

  if (!match) {
    return { skipped: true, reason: "match-missing" };
  }
  if (!match.leagueSeasonId) {
    return { skipped: true, reason: "not-a-league-match" };
  }
  if (!match.leagueScoredAt) {
    return { skipped: true, reason: "match-not-scored" };
  }
  if (match.leaguePostMatchSequence) {
    return {
      skipped: true,
      reason: "already-exists",
      sequenceId: match.leaguePostMatchSequence.id,
    };
  }

  const teamAId = match.teamSelections[0]?.teamId ?? null;
  const teamBId = match.teamSelections[1]?.teamId ?? null;

  // Build pendingChoices for each team.
  const pendingChoices: PendingChoice[] = [];
  if (teamAId) {
    pendingChoices.push(...(await collectPendingChoices(teamAId)));
  }
  if (teamBId) {
    pendingChoices.push(...(await collectPendingChoices(teamBId)));
  }

  const persisted: SequencePersistedFields = {
    treasuryDeltaA: input.winningsSnapshot?.teamA ?? 0,
    treasuryDeltaB: input.winningsSnapshot?.teamB ?? 0,
    fanFactorDeltaA: input.fanFactorSnapshot?.teamA ?? 0,
    fanFactorDeltaB: input.fanFactorSnapshot?.teamB ?? 0,
    pendingChoices,
  };

  const status: "awaiting_choices" | "completed" =
    persisted.pendingChoices.length > 0 ? "awaiting_choices" : "completed";

  const created = await prisma.leaguePostMatchSequence.create({
    data: {
      matchId: match.id,
      seasonId: match.leagueSeasonId,
      status,
      winningsApplied: true,
      lastingInjuriesApplied: true,
      advancementsResolved: status === "completed",
      treasuryDeltaA: persisted.treasuryDeltaA,
      treasuryDeltaB: persisted.treasuryDeltaB,
      fanFactorDeltaA: persisted.fanFactorDeltaA,
      fanFactorDeltaB: persisted.fanFactorDeltaB,
      pendingChoices: JSON.stringify(persisted.pendingChoices),
      completedAt: status === "completed" ? new Date() : null,
    },
    select: { id: true, status: true },
  });

  serverLog.info(
    `[post-match-league] match=${match.id} status=${created.status} pendingChoices=${persisted.pendingChoices.length}`,
  );

  return {
    created: true,
    sequenceId: created.id,
    matchId: match.id,
    seasonId: match.leagueSeasonId,
    status: created.status as "awaiting_choices" | "completed",
    pendingChoices: persisted.pendingChoices,
  };
}

/**
 * Liste les joueurs d'une equipe eligibles a un avancement.
 * Eligibilite : (spp - cost_of_advancements_already_taken) >= cheapest_next.
 *
 * En pratique on simplifie : on lit `spp` et le nombre d'avancements
 * deja pris (parse JSON `advancements`). Si `spp >= cheapestNextCost`,
 * eligible. La verification fine du cout par type est faite au moment
 * du choix (`applyAdvancementChoice`).
 *
 * Note : on ignore les joueurs morts (`dead=true`) et ceux qui ne
 * doivent pas jouer le prochain match (`missNextMatch=true`) -- ils
 * peuvent prendre une amelioration, mais ils servent leur match-out
 * separement (cf L2.B.7).
 */
async function collectPendingChoices(
  teamId: string,
): Promise<PendingChoice[]> {
  const players = await prisma.teamPlayer.findMany({
    where: { teamId, dead: false },
    select: {
      id: true,
      name: true,
      spp: true,
      advancements: true,
    },
  });

  const choices: PendingChoice[] = [];
  for (const player of players) {
    const advancementsTaken = countAdvancements(player.advancements);
    if (advancementsTaken >= 6) {
      // Cap BB : 6 advancements max.
      continue;
    }
    const cheapest = cheapestNextAdvancementCost(advancementsTaken);
    if (player.spp >= cheapest) {
      choices.push({
        teamPlayerId: player.id,
        playerName: player.name,
        spp: player.spp,
        advancementsTaken,
        nextAdvancementCost: cheapest,
      });
    }
  }
  return choices;
}

function countAdvancements(advancementsJson: string): number {
  try {
    const parsed: unknown = JSON.parse(advancementsJson);
    if (Array.isArray(parsed)) return parsed.length;
    return 0;
  } catch {
    return 0;
  }
}

function parseAdvancements(advancementsJson: string): PlayerAdvancement[] {
  try {
    const parsed: unknown = JSON.parse(advancementsJson);
    if (Array.isArray(parsed)) {
      return parsed as PlayerAdvancement[];
    }
    return [];
  } catch {
    return [];
  }
}

export type ApplyAdvancementOutcome =
  | {
      readonly applied: true;
      readonly playerId: string;
      readonly newSpp: number;
      readonly newAdvancementCount: number;
      readonly addedSkill: string;
      /** Caracteristique amelioree (uniquement pour type='characteristic'). */
      readonly addedStat?: CharacteristicKind;
      readonly currentValue: number;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "player-not-found"
        | "player-not-on-team"
        | "player-dead"
        | "max-advancements-reached"
        | "insufficient-spp"
        | "skill-not-in-pool"
        | "missing-skill"
        | "missing-stat"
        | "stat-not-improvable";
      readonly required?: number;
      readonly available?: number;
    };

export interface ApplyAdvancementInput {
  readonly teamId: string;
  readonly playerId: string;
  readonly type: AdvancementType;
  /**
   * Slug de la competence ajoutee. Pour `random-primary`, le caller tire
   * au sort cote handler avant d'appeler ce service. Absent pour les
   * ameliorations de caracteristique (type='characteristic').
   */
  readonly skillSlug?: string;
  /**
   * Caracteristique a ameliorer. Obligatoire (et uniquement utilise)
   * pour type='characteristic'.
   */
  readonly stat?: CharacteristicKind;
}

/**
 * Applique un choix d'avancement : decremente SPP, ajoute la skill,
 * pousse une entree dans `advancements`, recalcule `currentValue`.
 * Idempotent vis-a-vis du SPP (si insuffisant, on skip), mais pas
 * vis-a-vis du skillSlug : appeler 2x avec le meme slug ajoute la
 * skill 2 fois (le caller doit deduper).
 */
export async function applyAdvancementChoice(
  input: ApplyAdvancementInput,
): Promise<ApplyAdvancementOutcome> {
  const player = await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      teamId: true,
      spp: true,
      skills: true,
      advancements: true,
      dead: true,
      position: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      team: { select: { roster: true, ruleset: true } },
    },
  });
  if (!player) {
    return { skipped: true, reason: "player-not-found" };
  }
  if (player.teamId !== input.teamId) {
    return { skipped: true, reason: "player-not-on-team" };
  }
  if (player.dead) {
    return { skipped: true, reason: "player-dead" };
  }

  const taken = parseAdvancements(player.advancements);
  if (taken.length >= 6) {
    return { skipped: true, reason: "max-advancements-reached" };
  }

  const cost = getNextAdvancementPspCost(taken.length, input.type);
  if (player.spp < cost) {
    return {
      skipped: true,
      reason: "insufficient-spp",
      required: cost,
      available: player.spp,
    };
  }

  // Branche caracteristique (BB2025) : pas de skill, on ameliore une stat.
  if (input.type === "characteristic") {
    const stat = input.stat;
    if (!stat) {
      return { skipped: true, reason: "missing-stat" };
    }
    // PA "—" (null) n'est pas ameliorable via une amelioration de carac.
    if (stat === "pa" && player.pa === null) {
      return { skipped: true, reason: "stat-not-improvable" };
    }
    const improved = applyCharacteristicImprovement(
      {
        ma: player.ma,
        st: player.st,
        ag: player.ag,
        pa: player.pa,
        av: player.av,
      },
      stat,
    );
    const newAdvancement: PlayerAdvancement = {
      type: "characteristic",
      stat,
      isRandom: false,
      at: Date.now(),
    };
    const updatedAdvancements = [...taken, newAdvancement];
    const surcharge = surchargeForAdvancement({ type: "characteristic", stat });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const team = await prisma.$transaction(async (tx: any) => {
      await tx.teamPlayer.update({
        where: { id: input.playerId },
        data: {
          spp: { decrement: cost },
          advancements: JSON.stringify(updatedAdvancements),
          ma: improved.ma,
          st: improved.st,
          ag: improved.ag,
          pa: improved.pa,
          av: improved.av,
        },
      });
      await tx.team.update({
        where: { id: input.teamId },
        data: { currentValue: { increment: surcharge } },
      });
      return tx.team.findUnique({
        where: { id: input.teamId },
        select: { currentValue: true },
      });
    });

    return {
      applied: true,
      playerId: input.playerId,
      newSpp: player.spp - cost,
      newAdvancementCount: updatedAdvancements.length,
      addedSkill: "",
      addedStat: stat,
      currentValue: team?.currentValue ?? 0,
    };
  }

  // Branche competence : skillSlug obligatoire.
  if (!input.skillSlug) {
    return { skipped: true, reason: "missing-skill" };
  }
  const skillSlug = input.skillSlug;

  // Validation de l'acces primaire/secondaire (souple) : la skill choisie
  // doit appartenir au pool de la position pour le type d'avancement. On ne
  // valide que si la position a des donnees d'acces renseignees (season_3) ;
  // sinon (null, ex: season_2) on skip pour rester retro-compatible.
  const ruleset = player.team?.ruleset ?? "season_3";
  const positionAccess = await prisma.position.findFirst({
    where: {
      slug: player.position,
      roster: { slug: player.team?.roster, ruleset: ruleset as never },
    },
    select: { primarySkills: true, secondarySkills: true },
  });
  if (positionAccess) {
    const skillCode = await categoryCodeForSkill(skillSlug, ruleset);
    const check = checkSkillAccess({
      type: input.type,
      skillCode,
      primarySkills: positionAccess.primarySkills,
      secondarySkills: positionAccess.secondarySkills,
    });
    if (check === "out-of-pool") {
      return { skipped: true, reason: "skill-not-in-pool" };
    }
  }

  // Pousse la nouvelle entree d'advancement (immutable - clone).
  const newAdvancement: PlayerAdvancement = {
    skillSlug,
    type: input.type,
    isRandom: input.type === "random-primary",
    at: Date.now(),
  };
  const updatedAdvancements = [...taken, newAdvancement];

  // Concatene la skill au champ skills (CSV). Si la skill est deja
  // presente, on l'ajoute quand meme — c'est au caller (handler) de
  // verifier la duplication et de tirer au sort proprement pour les
  // random.
  const updatedSkills = appendSkillCsv(player.skills, skillSlug);

  // Calcul du surcout en po pour la TV courante.
  const surcharge = surchargeForAdvancement({ type: input.type });

  // BUG fix audit round 5 (CRITICAL) : avant, les 2 updates (player.spp
  // + advancements + skills) et (team.currentValue increment by surcharge)
  // etaient executes sequentiellement hors transaction. Crash entre les
  // deux → joueur a paye le SPP et appris le skill, mais TV de l'equipe
  // non incrementee → TV stale forever (impact futurs petty cash + odds).
  // Fix : les 2 updates + le re-read final dans une seule $transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const team = await prisma.$transaction(async (tx: any) => {
    await tx.teamPlayer.update({
      where: { id: input.playerId },
      data: {
        spp: { decrement: cost },
        advancements: JSON.stringify(updatedAdvancements),
        skills: updatedSkills,
      },
    });
    // Update Team.currentValue (additif : on ne recalcule pas tout,
    // juste increment by surcharge — la baseline reste correcte tant
    // que les autres composants de currentValue ne changent pas dans
    // cette transaction).
    await tx.team.update({
      where: { id: input.teamId },
      data: { currentValue: { increment: surcharge } },
    });
    return tx.team.findUnique({
      where: { id: input.teamId },
      select: { currentValue: true },
    });
  });

  return {
    applied: true,
    playerId: input.playerId,
    newSpp: player.spp - cost,
    newAdvancementCount: updatedAdvancements.length,
    addedSkill: skillSlug,
    currentValue: team?.currentValue ?? 0,
  };
}

function appendSkillCsv(existing: string, slug: string): string {
  const trimmed = existing.trim();
  if (trimmed.length === 0) return slug;
  return `${trimmed},${slug}`;
}

/**
 * Marque la sequence comme `completed` quand tous les pendingChoices
 * ont ete appliques. Le caller (handler advancement) appelle ce helper
 * apres chaque application reussie, pour fermer la sequence
 * automatiquement quand le coach a tout traite.
 *
 * Idempotent : si deja completed, no-op.
 */
export async function markSequenceCompletedIfDone(
  sequenceId: string,
): Promise<{ closed: boolean; status: string }> {
  const seq = await prisma.leaguePostMatchSequence.findUnique({
    where: { id: sequenceId },
    select: { id: true, status: true, pendingChoices: true },
  });
  if (!seq) return { closed: false, status: "missing" };
  if (seq.status === "completed") return { closed: false, status: seq.status };

  const choices = parsePendingChoices(seq.pendingChoices);
  // On considere une choice "encore en attente" si le joueur correspondant
  // n'a pas eu un nouvel advancement applique depuis la creation de la
  // sequence. Pour rester simple : on lit le joueur, on compare son
  // nombre d'advancements actuel vs celui au moment du snapshot. S'il
  // a augmente, la choice est resolue.
  let pending = 0;
  for (const c of choices) {
    const player = await prisma.teamPlayer.findUnique({
      where: { id: c.teamPlayerId },
      select: { advancements: true },
    });
    const currentTaken = countAdvancements(player?.advancements ?? "[]");
    if (currentTaken <= c.advancementsTaken) {
      pending += 1;
    }
  }

  if (pending === 0) {
    await prisma.leaguePostMatchSequence.update({
      where: { id: sequenceId },
      data: {
        status: "completed",
        advancementsResolved: true,
        completedAt: new Date(),
      },
    });
    return { closed: true, status: "completed" };
  }
  return { closed: false, status: seq.status };
}

function parsePendingChoices(raw: string): PendingChoice[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as PendingChoice[];
    }
    return [];
  } catch {
    return [];
  }
}

export { parsePendingChoices };
