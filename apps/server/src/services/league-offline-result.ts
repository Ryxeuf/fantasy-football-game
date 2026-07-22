/**
 * Workstream ligue offline — saisie manuelle d'un resultat de match joue
 * hors-ligne (tabletop), facon regles officielles BB / sites type
 * mordorbihan.
 *
 * Option (b) : on materialise un Match "offline" synthetique depuis le
 * pairing (mode `offline`, status `completed`, sans game-engine) puis on
 * REUTILISE tout le pipeline existant `recordLeagueMatchResult` :
 *  - compteurs LeagueParticipant (W/D/L, points, TD, CAS) + ELO saisonnier,
 *  - pairing -> `played`, completion round/saison/playoffs,
 *  - sequence post-match (pendingChoices de level-up) via le matchId.
 *
 * Stats PAR JOUEUR (TD/CAS/MVP/passes/interceptions) appliquees AVANT
 * `recordLeagueMatchResult` (SPP + totaux carriere + matchesPlayed). Comme le
 * SPP est persiste avant, la sequence post-match voit le SPP a jour et propose
 * les bons level-up.
 *
 * Economie (winnings -> treasury, dedicated fans clampes 1-6) et blessures
 * durables (mng/niggling/-carac/dead) sont aussi appliquees a la main.
 *
 * `missNextMatch` : les matchs offline ne passent pas par le game-engine qui,
 * en online, efface ce flag au demarrage du match suivant. On le purge donc
 * ici (`clearServedSuspensions`) pour les joueurs des 2 equipes avant de
 * re-poser les suspensions issues des blessures de CE match.
 *
 * Idempotence : un pairing terminal ou un match deja compte est ignore.
 */

import { prisma } from "../prisma";
import {
  applyCharacteristicReduction,
  isAtCharacteristicReductionFloor,
  type CharacteristicKind,
  type PlayerStats,
} from "@bb/game-engine";
import { recordLeagueMatchResult } from "./league-match-result";
import {
  calculatePlayerSPP,
  loadLeagueSPPContext,
  type PlayerMatchStats,
} from "./spp-tracking";
import {
  applyOfflinePurchasesForTeam,
  hasAnyMutation,
  EMPTY_MUTATION_SIDE,
  type OfflinePurchaseInput,
  type OfflineRosterMutations,
} from "./league-offline-purchases";
import { updateTeamValues } from "../utils/team-values";
import { serverLog } from "../utils/server-log";
import { OFFLINE_MATCH_MODE } from "./match-modes";
import { canFirePlayer } from "./team-captain";

/** Mode pose sur le Match synthetique pour le distinguer des matchs joues. */
export { OFFLINE_MATCH_MODE };

export interface OfflinePlayerStatInput {
  readonly teamPlayerId: string;
  readonly touchdowns?: number;
  readonly casualties?: number;
  readonly completions?: number;
  readonly interceptions?: number;
  readonly mvp?: boolean;
}

/**
 * Resultat de blessure durable BB applique a un joueur :
 *  - `mng`      : Seriously Hurt -> rate le prochain match.
 *  - `niggling` : Serious Injury -> +1 niggling (+ MNG).
 *  - `ma/st/ag/pa/av` : Lasting Injury -> -1 carac correspondante (+ MNG).
 *  - `dead`     : joueur tue.
 */
export type OfflineInjuryType =
  | "mng"
  | "niggling"
  | "ma"
  | "st"
  | "ag"
  | "pa"
  | "av"
  | "dead";

export interface OfflineInjuryInput {
  readonly teamPlayerId: string;
  readonly type: OfflineInjuryType;
}

export interface RecordOfflineResultInput {
  readonly pairingId: string;
  /** TD inscrits par l'equipe a domicile. */
  readonly scoreHome: number;
  /** TD inscrits par l'equipe a l'exterieur. */
  readonly scoreAway: number;
  /** Casualties infligees par l'equipe a domicile. */
  readonly casualtiesHome: number;
  /** Casualties infligees par l'equipe a l'exterieur. */
  readonly casualtiesAway: number;
  /** Stats par joueur (optionnel) -> SPP + totaux carriere + level-up. */
  readonly playerStats?: readonly OfflinePlayerStatInput[];
  /** Gain de tresorerie (or) optionnel par equipe (incremente treasury). */
  readonly winningsHome?: number;
  readonly winningsAway?: number;
  /**
   * Depense de tresorerie (or) optionnelle par equipe : somme des coups de
   * pouce (inducements), erreurs couteuses et achats post-match. Decremente
   * la treasury. Le net applique = winnings - treasuryDebit.
   */
  readonly treasuryDebitHome?: number;
  readonly treasuryDebitAway?: number;
  /** Variation de dedicated fans (clampe 1-6) optionnelle par equipe. */
  readonly dedicatedFansDeltaHome?: number;
  readonly dedicatedFansDeltaAway?: number;
  /** Bonus au classement (points) accorde par le commissaire, par equipe. */
  readonly rankingBonusHome?: number;
  readonly rankingBonusAway?: number;
  /** SPP bonus "accorde par Nuffle" par joueur (en plus du SPP des stats). */
  readonly sppBonus?: readonly OfflineSppBonusInput[];
  /** Blessures durables par joueur (optionnel). */
  readonly injuries?: readonly OfflineInjuryInput[];
  /**
   * Achats post-match a MATERIALISER sur le roster (joueurs/relances/staff).
   * Le DEBIT de tresorerie associe est deja porte par `treasuryDebit*` ;
   * ces listes ne servent qu'a creer reellement les elements (reversible).
   */
  readonly purchasesHome?: readonly OfflinePurchaseInput[];
  readonly purchasesAway?: readonly OfflinePurchaseInput[];
  /**
   * Licenciements de fin de match : `teamPlayerId[]` (des 2 equipes). Les
   * joueurs sont retires du roster actif (`firedAt`) — conserves en base
   * (historique) et reversibles a l'invalidation.
   */
  readonly firedPlayerIds?: readonly string[];
}

export interface OfflineSppBonusInput {
  readonly teamPlayerId: string;
  readonly spp: number;
}

export type OfflineResultWinner = "home" | "away" | "draw";

export type RecordOfflineResultOutcome =
  | {
      readonly recorded: true;
      readonly pairingId: string;
      readonly matchId: string;
      readonly winner: OfflineResultWinner;
      readonly sppPlayersUpdated: number;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "pairing-missing"
        | "pairing-not-terminal-eligible"
        | "match-already-scored"
        | "participant-missing"
        | "record-failed";
    };

const NON_TERMINAL = new Set(["scheduled", "in_progress"]);

interface PairingForOffline {
  id: string;
  status: string;
  match: { id: string; leagueScoredAt: Date | null } | null;
  round: { id: string; seasonId: string };
  homeParticipant: {
    id: string;
    teamId: string;
    team: {
      ownerId: string;
      name: string;
      roster: string;
      dedicatedFans: number;
    };
  } | null;
  awayParticipant: {
    id: string;
    teamId: string;
    team: {
      ownerId: string;
      name: string;
      roster: string;
      dedicatedFans: number;
    };
  } | null;
}

/**
 * Snapshot persiste sur `Match.offlineResultInput` : la saisie brute
 * (normalisee — valeurs optionnelles resolues) + les pre-valeurs necessaires
 * a la REVERSION exacte (dedicatedFans avant clamp). Consomme par
 * `league-offline-edit` pour annuler puis re-appliquer une saisie.
 */
export interface OfflineResultSnapshot {
  readonly input: {
    readonly scoreHome: number;
    readonly scoreAway: number;
    readonly casualtiesHome: number;
    readonly casualtiesAway: number;
    readonly playerStats: readonly OfflinePlayerStatInput[];
    readonly winningsHome: number;
    readonly winningsAway: number;
    readonly treasuryDebitHome: number;
    readonly treasuryDebitAway: number;
    readonly dedicatedFansDeltaHome: number;
    readonly dedicatedFansDeltaAway: number;
    readonly rankingBonusHome: number;
    readonly rankingBonusAway: number;
    readonly sppBonus: readonly OfflineSppBonusInput[];
    readonly injuries: readonly OfflineInjuryInput[];
    readonly purchasesHome: readonly OfflinePurchaseInput[];
    readonly purchasesAway: readonly OfflinePurchaseInput[];
    readonly firedPlayerIds: readonly string[];
  };
  readonly dedicatedFansBefore: {
    readonly home: number;
    readonly away: number;
  };
  /**
   * Trace exacte des mutations de roster appliquees par les achats (joueurs
   * crees, deltas de compteurs), renseignee APRES coup (cf.
   * `recordOfflineLeagueResult`). Optionnel pour retro-compat pre-achats.
   */
  readonly rosterMutations?: OfflineRosterMutations;
  /**
   * Licenciements REELLEMENT appliques par ce match (sous-ensemble valide de
   * `input.firedPlayerIds` : appartenance aux 2 equipes + non deja licencie).
   * Renseigne APRES coup ; reversion exacte = ces ids seulement.
   */
  readonly firedApplied?: readonly string[];
}

function buildOfflineSnapshot(
  input: RecordOfflineResultInput,
  fansBefore: { home: number; away: number },
): OfflineResultSnapshot {
  return {
    input: {
      scoreHome: input.scoreHome,
      scoreAway: input.scoreAway,
      casualtiesHome: input.casualtiesHome,
      casualtiesAway: input.casualtiesAway,
      playerStats: input.playerStats ?? [],
      winningsHome: input.winningsHome ?? 0,
      winningsAway: input.winningsAway ?? 0,
      treasuryDebitHome: input.treasuryDebitHome ?? 0,
      treasuryDebitAway: input.treasuryDebitAway ?? 0,
      dedicatedFansDeltaHome: input.dedicatedFansDeltaHome ?? 0,
      dedicatedFansDeltaAway: input.dedicatedFansDeltaAway ?? 0,
      rankingBonusHome: input.rankingBonusHome ?? 0,
      rankingBonusAway: input.rankingBonusAway ?? 0,
      sppBonus: input.sppBonus ?? [],
      injuries: input.injuries ?? [],
      purchasesHome: input.purchasesHome ?? [],
      purchasesAway: input.purchasesAway ?? [],
      firedPlayerIds: input.firedPlayerIds ?? [],
    },
    dedicatedFansBefore: { home: fansBefore.home, away: fansBefore.away },
  };
}

/**
 * Applique les licenciements de fin de match : pose `firedAt` sur les joueurs
 * vises (filtres par appartenance aux 2 equipes + non deja licencies) et
 * recalcule la TV des equipes touchees. Retourne les ids REELLEMENT licencies
 * (pour la reversion exacte).
 *
 * Regle speciale "Capitaine" : un capitaine ne peut etre licencie que s'il a
 * subi une blessure ayant reduit une de ses caracteristiques
 * (`canFirePlayer`). Les ids non conformes sont ignores (meme convention que
 * les autres ids invalides de la saisie) et traces en log.
 */
async function applyOfflineFirings(
  homeTeamId: string,
  awayTeamId: string,
  firedPlayerIds: readonly string[],
): Promise<string[]> {
  if (firedPlayerIds.length === 0) return [];
  const candidates = (await prisma.teamPlayer.findMany({
    where: {
      id: { in: [...firedPlayerIds] },
      teamId: { in: [homeTeamId, awayTeamId] },
      firedAt: null,
    },
    select: {
      id: true,
      teamId: true,
      isCaptain: true,
      maReduction: true,
      stReduction: true,
      agReduction: true,
      paReduction: true,
      avReduction: true,
    },
  })) as Array<{
    id: string;
    teamId: string;
    isCaptain: boolean;
    maReduction: number;
    stReduction: number;
    agReduction: number;
    paReduction: number;
    avReduction: number;
  }>;
  const valid = candidates.filter((p) => {
    if (canFirePlayer(p)) return true;
    serverLog.warn(
      `[league-offline] licenciement refuse pour le capitaine ${p.id} : aucune blessure reduisant une caracteristique`,
    );
    return false;
  });
  if (valid.length === 0) return [];

  const ids = valid.map((p) => p.id);
  await prisma.teamPlayer.updateMany({
    where: { id: { in: ids } },
    data: { firedAt: new Date() },
  });
  // TV recompute pour les equipes touchees (les licencies quittent le roster).
  const teamIds = new Set(valid.map((p) => p.teamId));
  for (const teamId of teamIds) {
    await updateTeamValues(prisma, teamId);
  }
  return ids;
}

/**
 * Parse tolerant du snapshot stocke : objet natif (PG JSONB), string JSON
 * serialisee (sqlite mirror) ou null. Retourne null si illisible.
 */
export function parseOfflineSnapshot(
  raw: unknown,
): OfflineResultSnapshot | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.input !== "object" || o.input === null) return null;
  return obj as OfflineResultSnapshot;
}

/**
 * Applique l'economie post-match saisie a la main : winnings (treasury) et
 * variation de dedicated fans (clampe 1-6, regle BB). Tout est optionnel.
 */
async function applyOfflineEconomy(
  home: { teamId: string; dedicatedFans: number },
  away: { teamId: string; dedicatedFans: number },
  input: RecordOfflineResultInput,
): Promise<void> {
  const sides = [
    {
      teamId: home.teamId,
      fans: home.dedicatedFans,
      // Net = gains - depenses (coups de pouce + erreurs couteuses + achats).
      treasuryDelta: (input.winningsHome ?? 0) - (input.treasuryDebitHome ?? 0),
      fansDelta: input.dedicatedFansDeltaHome,
    },
    {
      teamId: away.teamId,
      fans: away.dedicatedFans,
      treasuryDelta: (input.winningsAway ?? 0) - (input.treasuryDebitAway ?? 0),
      fansDelta: input.dedicatedFansDeltaAway,
    },
  ];
  const ops: Promise<unknown>[] = [];
  for (const s of sides) {
    const data: Record<string, unknown> = {};
    if (s.treasuryDelta > 0) {
      data.treasury = { increment: s.treasuryDelta };
    } else if (s.treasuryDelta < 0) {
      data.treasury = { decrement: -s.treasuryDelta };
    }
    if (s.fansDelta && s.fansDelta !== 0) {
      const next = Math.max(1, Math.min(6, s.fans + s.fansDelta));
      if (next !== s.fans) data.dedicatedFans = next;
    }
    if (Object.keys(data).length > 0) {
      ops.push(prisma.team.update({ where: { id: s.teamId }, data }));
    }
  }
  if (ops.length > 0) await prisma.$transaction(ops);
}

/** Types de blessure qui reduisent une caracteristique (Séquelle). */
const STAT_INJURY_TYPES: ReadonlySet<OfflineInjuryType> = new Set([
  "ma",
  "st",
  "ag",
  "pa",
  "av",
]);

export function isStatInjury(
  type: OfflineInjuryType,
): type is Extract<OfflineInjuryType, CharacteristicKind> {
  return STAT_INJURY_TYPES.has(type);
}

/** Map un type de blessure offline -> update Prisma TeamPlayer. */
function injuryUpdateData(type: OfflineInjuryType): Record<string, unknown> {
  switch (type) {
    case "mng":
      return { missNextMatch: true };
    case "niggling":
      return { missNextMatch: true, nigglingInjuries: { increment: 1 } };
    case "ma":
      return { missNextMatch: true, maReduction: { increment: 1 } };
    case "st":
      return { missNextMatch: true, stReduction: { increment: 1 } };
    case "ag":
      return { missNextMatch: true, agReduction: { increment: 1 } };
    case "pa":
      return { missNextMatch: true, paReduction: { increment: 1 } };
    case "av":
      return { missNextMatch: true, avReduction: { increment: 1 } };
    case "dead":
      return { dead: true };
  }
}

/**
 * A68 — construit l'update d'une blessure en appliquant AUSSI la perte de
 * caractéristique sur la fiche du joueur pour les Séquelles. Le compteur
 * `xxReduction` seul n'était consommé nulle part (ni affichages, ni
 * moteur) : la Séquelle n'avait aucun effet. Comme les avancements, la
 * caractéristique de base est désormais mutée (−1 MA/ST/AV, +1 cible
 * AG/PA), bornée par `CHARACTERISTIC_REDUCE_LIMIT` (BB2025).
 *
 * Caractéristique déjà au plancher : la Séquelle reste subie (MNG) mais
 * ne modifie NI la carac NI le compteur — le reverse (invalidation) ne
 * restaure que si le compteur a bougé, ce qui garde les deux chemins
 * symétriques. `stats` est le snapshot courant du joueur, retourné mis à
 * jour pour chaîner plusieurs blessures du même joueur dans le même match.
 */
export function buildInjuryUpdate(
  type: OfflineInjuryType,
  stats: PlayerStats,
): { data: Record<string, unknown>; nextStats: PlayerStats } {
  if (!isStatInjury(type)) {
    return { data: injuryUpdateData(type), nextStats: stats };
  }
  const stat = type as CharacteristicKind;
  const current = stat === "pa" ? stats.pa : stats[stat];
  if (isAtCharacteristicReductionFloor(stat, current)) {
    return { data: { missNextMatch: true }, nextStats: stats };
  }
  const reduced = applyCharacteristicReduction(stats, stat);
  return {
    data: {
      ...injuryUpdateData(type),
      [stat]: stat === "pa" ? reduced.pa : reduced[stat],
    },
    nextStats: reduced,
  };
}

/**
 * Purge le flag `missNextMatch` des joueurs (non morts) des 2 equipes : ils
 * viennent de disputer ce match offline, donc toute suspension anterieure est
 * consideree comme purgee.
 *
 * Mirror de `match-start.ts` cote online (qui efface `missNextMatch` au demarrage
 * du match suivant). Les matchs offline ne passant PAS par le game-engine, sans
 * ce purge un joueur suspendu en offline resterait suspendu a vie.
 *
 * IMPORTANT : a appeler AVANT `applyOfflineInjuries`, qui peut re-poser
 * `missNextMatch` pour les blessures encaissees DANS ce match (suspension du
 * match suivant).
 */
async function clearServedSuspensions(
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  await prisma.teamPlayer.updateMany({
    where: {
      teamId: { in: [homeTeamId, awayTeamId] },
      missNextMatch: true,
      dead: false,
    },
    data: { missNextMatch: false },
  });
}

/**
 * Applique les blessures durables saisies a la main. Valide que chaque
 * joueur appartient bien a l'une des deux equipes du match (securite).
 * Retourne le nombre de joueurs blesses.
 */
async function applyOfflineInjuries(
  homeTeamId: string,
  awayTeamId: string,
  injuries: readonly OfflineInjuryInput[],
): Promise<number> {
  const ids = injuries.map((i) => i.teamPlayerId);
  const valid = (await prisma.teamPlayer.findMany({
    where: { id: { in: ids }, teamId: { in: [homeTeamId, awayTeamId] } },
    select: { id: true, ma: true, st: true, ag: true, pa: true, av: true },
  })) as Array<{
    id: string;
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
  }>;
  const statsById = new Map<string, PlayerStats>(
    valid.map((p) => [
      p.id,
      { ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av },
    ]),
  );
  const ops: Promise<unknown>[] = [];
  for (const inj of injuries) {
    const stats = statsById.get(inj.teamPlayerId);
    if (!stats) continue;
    const { data, nextStats } = buildInjuryUpdate(inj.type, stats);
    statsById.set(inj.teamPlayerId, nextStats);
    ops.push(
      prisma.teamPlayer.update({
        where: { id: inj.teamPlayerId },
        data,
      }),
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);
  return ops.length;
}

/**
 * Applique le SPP des stats joueur saisies a la main. Retourne le nombre de
 * joueurs mis a jour. Le modifier "bagarreurs brutaux" est resolu par equipe
 * via le roster (meme regle que les matchs joues).
 */
async function applyOfflinePlayerSPP(
  homeTeamId: string,
  awayTeamId: string,
  homeRoster: string,
  awayRoster: string,
  playerStats: readonly OfflinePlayerStatInput[],
): Promise<number> {
  const context = await loadLeagueSPPContext(prisma, {
    isLeagueMatch: true,
    teamARoster: homeRoster,
    teamBRoster: awayRoster,
  });
  const ids = playerStats.map((s) => s.teamPlayerId);
  const players = await prisma.teamPlayer.findMany({
    where: { id: { in: ids } },
    select: { id: true, teamId: true },
  });
  const teamById = new Map<string, string>(
    players.map((p: { id: string; teamId: string }) => [p.id, p.teamId]),
  );

  const updates: Promise<unknown>[] = [];
  for (const s of playerStats) {
    const teamId = teamById.get(s.teamPlayerId);
    if (teamId !== homeTeamId && teamId !== awayTeamId) continue;
    const modifier = teamId === homeTeamId ? context.teamA : context.teamB;
    const stats: PlayerMatchStats = {
      touchdowns: s.touchdowns ?? 0,
      casualties: s.casualties ?? 0,
      completions: s.completions ?? 0,
      interceptions: s.interceptions ?? 0,
      mvp: s.mvp ?? false,
    };
    const earned = calculatePlayerSPP(stats, modifier);
    updates.push(
      prisma.teamPlayer.update({
        where: { id: s.teamPlayerId },
        data: {
          spp: { increment: earned },
          totalTouchdowns: { increment: stats.touchdowns },
          totalCasualties: { increment: stats.casualties },
          totalCompletions: { increment: stats.completions },
          totalInterceptions: { increment: stats.interceptions },
          totalMvpAwards: { increment: stats.mvp ? 1 : 0 },
          matchesPlayed: { increment: 1 },
        },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);
  return updates.length;
}

/**
 * Applique le SPP bonus "accorde par Nuffle" : increment direct du spp des
 * joueurs vises (sans toucher aux totaux carriere). Filtre par appartenance
 * aux 2 equipes. A appeler AVANT recordLeagueMatchResult pour que la sequence
 * post-match propose les level-up correspondants.
 */
async function applySppBonus(
  homeTeamId: string,
  awayTeamId: string,
  bonuses: readonly OfflineSppBonusInput[],
): Promise<void> {
  const ids = bonuses.map((b) => b.teamPlayerId);
  const players = (await prisma.teamPlayer.findMany({
    where: { id: { in: ids }, teamId: { in: [homeTeamId, awayTeamId] } },
    select: { id: true },
  })) as Array<{ id: string }>;
  const valid = new Set(players.map((p) => p.id));
  const ops: Promise<unknown>[] = [];
  for (const b of bonuses) {
    if (!valid.has(b.teamPlayerId) || !b.spp) continue;
    ops.push(
      prisma.teamPlayer.update({
        where: { id: b.teamPlayerId },
        data: { spp: { increment: b.spp } },
      }),
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);
}

/**
 * Applique le bonus au classement (points) accorde par le commissaire :
 * increment direct des points des 2 participants. Reversible (cf.
 * league-offline-edit).
 */
async function applyRankingBonus(
  homeParticipantId: string,
  awayParticipantId: string,
  bonusHome: number,
  bonusAway: number,
): Promise<void> {
  const ops: Promise<unknown>[] = [];
  if (bonusHome)
    ops.push(
      prisma.leagueParticipant.update({
        where: { id: homeParticipantId },
        data: { points: { increment: bonusHome } },
      }),
    );
  if (bonusAway)
    ops.push(
      prisma.leagueParticipant.update({
        where: { id: awayParticipantId },
        data: { points: { increment: bonusAway } },
      }),
    );
  if (ops.length > 0) await prisma.$transaction(ops);
}

/**
 * Enregistre un resultat de match de ligue saisi a la main. Idempotent.
 */
export async function recordOfflineLeagueResult(
  input: RecordOfflineResultInput,
): Promise<RecordOfflineResultOutcome> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    include: {
      match: { select: { id: true, leagueScoredAt: true } },
      round: { select: { id: true, seasonId: true } },
      homeParticipant: {
        select: {
          id: true,
          teamId: true,
          team: {
          select: {
            ownerId: true,
            name: true,
            roster: true,
            dedicatedFans: true,
          },
        },
        },
      },
      awayParticipant: {
        select: {
          id: true,
          teamId: true,
          team: {
          select: {
            ownerId: true,
            name: true,
            roster: true,
            dedicatedFans: true,
          },
        },
        },
      },
    },
  })) as PairingForOffline | null;

  if (!pairing) return { skipped: true, reason: "pairing-missing" };
  if (!NON_TERMINAL.has(pairing.status)) {
    return { skipped: true, reason: "pairing-not-terminal-eligible" };
  }
  if (pairing.match?.leagueScoredAt) {
    return { skipped: true, reason: "match-already-scored" };
  }
  if (!pairing.homeParticipant || !pairing.awayParticipant) {
    return { skipped: true, reason: "participant-missing" };
  }

  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  // 1. Materialise un Match "offline" synthetique + TeamSelection (ordre
  //    home puis away — recordLeagueMatchResult lit selections[0]=A=home,
  //    [1]=B=away). On force `createdAt` pour garantir cet ordre.
  const ownerIds = Array.from(
    new Set([home.team.ownerId, away.team.ownerId].filter(Boolean)),
  );
  // Snapshot de la saisie brute + pre-valeurs (dedicatedFans avant clamp)
  // persiste sur le Match pour permettre la REVERSION exacte lors d'une
  // edition de resultat (cf. league-offline-edit).
  const offlineSnapshot = buildOfflineSnapshot(input, {
    home: home.team.dedicatedFans,
    away: away.team.dedicatedFans,
  });
  const base = Date.now();
  const match = await prisma.$transaction(async (tx: typeof prisma) => {
    const created = await tx.match.create({
      data: {
        status: "completed",
        mode: OFFLINE_MATCH_MODE,
        seed: `offline-league-${pairing.id}`,
        players: { connect: ownerIds.map((id) => ({ id })) },
        leagueSeasonId: pairing.round.seasonId,
        leagueRoundId: pairing.round.id,
        leaguePairingId: pairing.id,
        offlineResultInput: offlineSnapshot,
      },
      select: { id: true },
    });
    await tx.teamSelection.createMany({
      data: [
        {
          matchId: created.id,
          userId: home.team.ownerId,
          teamId: home.teamId,
          team: home.team.name,
          createdAt: new Date(base),
        },
        {
          matchId: created.id,
          userId: away.team.ownerId,
          teamId: away.teamId,
          team: away.team.name,
          createdAt: new Date(base + 1000),
        },
      ],
    });
    return created;
  });

  // 2. SPP par joueur AVANT recordLeagueMatchResult (la sequence post-match
  //    lira le SPP a jour pour proposer les level-up).
  let sppPlayersUpdated = 0;
  if (input.playerStats && input.playerStats.length > 0) {
    sppPlayersUpdated = await applyOfflinePlayerSPP(
      home.teamId,
      away.teamId,
      home.team.roster,
      away.team.roster,
      input.playerStats,
    );
  }
  // SPP bonus "accorde par Nuffle" (aussi avant la sequence post-match).
  if (input.sppBonus && input.sppBonus.length > 0) {
    await applySppBonus(home.teamId, away.teamId, input.sppBonus);
  }

  // 3. Reutilise tout le pipeline : standings + ELO + pairing played +
  //    completion saison + sequence post-match (level-up).
  const recorded = await recordLeagueMatchResult({
    matchId: match.id,
    scoreA: input.scoreHome,
    scoreB: input.scoreAway,
    casualtiesA: input.casualtiesHome,
    casualtiesB: input.casualtiesAway,
    // L'offline (saisie manuelle, systeme de confiance) n'alimente pas l'ELO
    // de ligue — non pertinent pour une ligue fermee (classement = points).
    skipSeasonElo: true,
  });

  if ("skipped" in recorded) {
    serverLog.error(
      `[league-offline-result] recordLeagueMatchResult skipped (${recorded.reason}) match=${match.id}`,
    );
    return { skipped: true, reason: "record-failed" };
  }

  // Economie post-match (winnings / dedicated fans) saisie a la main.
  await applyOfflineEconomy(
    { teamId: home.teamId, dedicatedFans: home.team.dedicatedFans },
    { teamId: away.teamId, dedicatedFans: away.team.dedicatedFans },
    input,
  );

  // Bonus au classement (points) accorde par le commissaire.
  if (input.rankingBonusHome || input.rankingBonusAway) {
    await applyRankingBonus(
      home.id,
      away.id,
      input.rankingBonusHome ?? 0,
      input.rankingBonusAway ?? 0,
    );
  }

  // Purge les suspensions purgees par ce match (joueurs des 2 equipes) AVANT
  // d'appliquer les nouvelles blessures, qui peuvent re-poser missNextMatch.
  await clearServedSuspensions(home.teamId, away.teamId);

  // Blessures durables saisies a la main.
  if (input.injuries && input.injuries.length > 0) {
    await applyOfflineInjuries(home.teamId, away.teamId, input.injuries);
  }

  // Achats post-match -> mutation reelle du roster (joueurs/relances/staff).
  // Le debit de tresorerie est deja porte par treasuryDebit (pas de
  // double-debit). On memorise la trace EXACTE des mutations dans le snapshot
  // pour la reversion (cf. league-offline-edit).
  const rosterMutations: OfflineRosterMutations = {
    home:
      input.purchasesHome && input.purchasesHome.length > 0
        ? await applyOfflinePurchasesForTeam(home.teamId, input.purchasesHome)
        : EMPTY_MUTATION_SIDE,
    away:
      input.purchasesAway && input.purchasesAway.length > 0
        ? await applyOfflinePurchasesForTeam(away.teamId, input.purchasesAway)
        : EMPTY_MUTATION_SIDE,
  };

  // Licenciements de fin de match (firedAt) -> retire du roster actif, TV
  // recalculee. Reversible via les ids reellement appliques (snapshot).
  const firedApplied = await applyOfflineFirings(
    home.teamId,
    away.teamId,
    input.firedPlayerIds ?? [],
  );

  if (hasAnyMutation(rosterMutations) || firedApplied.length > 0) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        offlineResultInput: { ...offlineSnapshot, rosterMutations, firedApplied },
      },
    });
  }

  const winner: OfflineResultWinner =
    recorded.winner === "A" ? "home" : recorded.winner === "B" ? "away" : "draw";

  serverLog.info(
    `[league-offline-result] pairing=${pairing.id} match=${match.id} ${input.scoreHome}-${input.scoreAway} winner=${winner} spp=${sppPlayersUpdated}`,
  );

  return {
    recorded: true,
    pairingId: pairing.id,
    matchId: match.id,
    winner,
    sppPlayersUpdated,
  };
}
