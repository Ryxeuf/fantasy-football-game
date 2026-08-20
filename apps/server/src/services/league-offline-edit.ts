/**
 * Workstream ligue offline — REVERSION d'un resultat saisi a la main.
 *
 * Le createur d'une ligue peut corriger une erreur de saisie. Comme la saisie
 * applique des *increments* irreversibles "a l'aveugle" (standings, SPP, eco,
 * blessures) et peut declencher des effets en aval (level-up, completion de
 * round), l'edition = **annuler la saisie puis re-saisir** (cf.
 * `editOfflineLeagueResult`, W-B3).
 *
 * Ce module fournit la brique d'annulation `reverseOfflineLeagueResult` :
 * elle relit le snapshot persiste (`Match.offlineResultInput`, W-B1), verifie
 * des **garde-fous** (refus si un effet a deja ete consomme), puis inverse
 * exactement les effets et supprime le Match synthetique.
 *
 * Garde-fous (refus de reversion) :
 *  - saison clôturee / playoffs generes (le classement final est fige) ;
 *  - un joueur a deja **consomme** un level-up issu de ce match ;
 *  - un achat post-match a deja ete **consomme**.
 *
 * Une mort EST reversible : elle n'est qu'un flag `dead:true` (la ligne
 * TeamPlayer n'est pas supprimee), donc la reversion ressuscite le joueur.
 * L'UI previent le commissaire avant de confirmer. Depuis le suivi de
 * provenance, morts et licenciements passent par `revertPlayerStatus` :
 * la reversion est REFUSEE si le statut courant du joueur a ete pose par
 * une autre source (autre match, pose manuelle posterieure).
 */

import { prisma } from "../prisma";
import {
  applyCharacteristicImprovement,
  type CharacteristicKind,
  type PlayerStats,
} from "@bb/game-engine";
import {
  parseOfflineSnapshot,
  recordOfflineLeagueResult,
  isStatInjury,
  OFFLINE_MATCH_MODE,
  type OfflineInjuryType,
  type OfflineResultSnapshot,
  type RecordOfflineResultInput,
  type RecordOfflineResultOutcome,
} from "./league-offline-result";
import {
  calculatePlayerSPP,
  loadLeagueSPPContext,
  type PlayerMatchStats,
} from "./spp-tracking";
import {
  buildPurchaseReverseOps,
  offlinePurchasesConsumed,
  sideHasMutation,
  EMPTY_MUTATION_SIDE,
  type OfflineRosterMutations,
} from "./league-offline-purchases";
import { updateTeamValues } from "../utils/team-values";
import { serverLog } from "../utils/server-log";
import { revertPlayerStatus } from "./player-status";

export type ReverseOfflineSkipReason =
  | "match-missing"
  | "not-offline-match"
  | "not-scored"
  | "snapshot-missing"
  | "pairing-missing"
  | "season-completed"
  | "playoffs-generated"
  | "advancement-consumed"
  | "purchase-consumed";

export type ReverseOfflineOutcome =
  | { readonly reversed: true; readonly matchId: string; readonly pairingId: string }
  | { readonly skipped: true; readonly reason: ReverseOfflineSkipReason };

interface PendingChoiceLite {
  readonly teamPlayerId: string;
  readonly advancementsTaken: number;
}

/** Compte tolerant des advancements d'un joueur (array PG / string sqlite). */
function advancementsCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function parsePendingChoices(raw: unknown): PendingChoiceLite[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: PendingChoiceLite[] = [];
  for (const c of arr) {
    if (
      c &&
      typeof c === "object" &&
      typeof (c as { teamPlayerId?: unknown }).teamPlayerId === "string"
    ) {
      out.push({
        teamPlayerId: (c as { teamPlayerId: string }).teamPlayerId,
        advancementsTaken:
          typeof (c as { advancementsTaken?: unknown }).advancementsTaken ===
          "number"
            ? (c as { advancementsTaken: number }).advancementsTaken
            : 0,
      });
    }
  }
  return out;
}

function winnerOf(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

interface Bareme {
  readonly winPoints: number;
  readonly drawPoints: number;
  readonly lossPoints: number;
}

function pointsFor(
  winner: "home" | "away" | "draw",
  side: "home" | "away",
  b: Bareme,
): number {
  if (winner === "draw") return b.drawPoints;
  return winner === side ? b.winPoints : b.lossPoints;
}

/** Inverse de `injuryUpdateData` : decremente les compteurs poses par ce match. */
function injuryReverseData(type: OfflineInjuryType): Record<string, unknown> {
  switch (type) {
    case "mng":
      return { missNextMatch: false };
    case "niggling":
      return { missNextMatch: false, nigglingInjuries: { decrement: 1 } };
    case "ma":
      return { missNextMatch: false, maReduction: { decrement: 1 } };
    case "st":
      return { missNextMatch: false, stReduction: { decrement: 1 } };
    case "ag":
      return { missNextMatch: false, agReduction: { decrement: 1 } };
    case "pa":
      return { missNextMatch: false, paReduction: { decrement: 1 } };
    case "av":
      return { missNextMatch: false, avReduction: { decrement: 1 } };
    case "dead":
      // Ressuscite le joueur tue par ce match (la mort est un flag, pas une
      // suppression). `missNextMatch:false` car il n'a servi aucune
      // suspension issue de cette mort.
      return { dead: false, missNextMatch: false };
  }
}

/** Etat courant d'un joueur pour reverser ses Séquelles (A68). */
interface InjuryReverseState {
  stats: PlayerStats;
  reductions: Record<CharacteristicKind, number>;
}

/**
 * A68 — inverse d'une blessure en restaurant AUSSI la caractéristique
 * pour les Séquelles (miroir de `buildInjuryUpdate`). La restauration
 * n'a lieu que si le compteur `xxReduction` est > 0 : une Séquelle
 * appliquée alors que la carac était déjà au plancher n'a modifié ni la
 * carac ni le compteur, et ne doit donc rien restaurer. `state` est
 * retourné mis à jour pour chaîner plusieurs blessures du même joueur.
 */
function buildInjuryReverse(
  type: OfflineInjuryType,
  state: InjuryReverseState,
): { data: Record<string, unknown>; nextState: InjuryReverseState } {
  if (!isStatInjury(type)) {
    return { data: injuryReverseData(type), nextState: state };
  }
  const stat = type as CharacteristicKind;
  if ((state.reductions[stat] ?? 0) <= 0) {
    return { data: { missNextMatch: false }, nextState: state };
  }
  const restored = applyCharacteristicImprovement(state.stats, stat);
  return {
    data: {
      ...injuryReverseData(type),
      [stat]: stat === "pa" ? restored.pa : restored[stat],
    },
    nextState: {
      stats: restored,
      reductions: { ...state.reductions, [stat]: state.reductions[stat] - 1 },
    },
  };
}

export interface ReverseOfflineOptions {
  /**
   * Nombre d'advancements appliques PAR LA FEUILLE DE MATCH elle-meme,
   * par joueur (entrees `applied: true` de `advancementsHome/Away`).
   * L'invalidation de la feuille les reverse juste apres ce call
   * (`reverseAppliedAdvancements`) : le garde-fou `advancement-consumed`
   * les soustrait donc du compte courant, sinon TOUTE feuille validee
   * avec une evolution stagee serait a jamais non-invalidable.
   */
  readonly sheetAppliedAdvancements?: ReadonlyMap<string, number>;
}

/**
 * Annule tous les effets d'un resultat offline et supprime le Match
 * synthetique. Idempotent quant aux garde-fous (refus si effet consomme).
 */
export async function reverseOfflineLeagueResult(
  matchId: string,
  options: ReverseOfflineOptions = {},
): Promise<ReverseOfflineOutcome> {
  const match = (await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      mode: true,
      leagueScoredAt: true,
      leaguePairingId: true,
      leagueRoundId: true,
      leagueSeasonId: true,
      offlineResultInput: true,
      leaguePostMatchSequence: { select: { pendingChoices: true } },
      leagueSeason: {
        select: {
          status: true,
          league: {
            select: {
              winPoints: true,
              drawPoints: true,
              lossPoints: true,
            },
          },
        },
      },
      leagueRound: { select: { id: true, status: true } },
    },
  })) as {
    id: string;
    mode: string;
    leagueScoredAt: Date | null;
    leaguePairingId: string | null;
    leagueRoundId: string | null;
    leagueSeasonId: string | null;
    offlineResultInput: unknown;
    leaguePostMatchSequence: { pendingChoices: unknown } | null;
    leagueSeason: {
      status: string;
      league: { winPoints: number; drawPoints: number; lossPoints: number };
    } | null;
    leagueRound: { id: string; status: string } | null;
  } | null;

  if (!match) return { skipped: true, reason: "match-missing" };
  if (match.mode !== OFFLINE_MATCH_MODE) {
    return { skipped: true, reason: "not-offline-match" };
  }
  if (!match.leagueScoredAt) return { skipped: true, reason: "not-scored" };
  if (!match.leaguePairingId || !match.leagueSeasonId || !match.leagueSeason) {
    return { skipped: true, reason: "pairing-missing" };
  }

  const snapshot = parseOfflineSnapshot(match.offlineResultInput);
  if (!snapshot) return { skipped: true, reason: "snapshot-missing" };

  // Garde-fou : saison clôturee -> classement final fige.
  if (match.leagueSeason.status === "completed") {
    return { skipped: true, reason: "season-completed" };
  }
  // Garde-fou : playoffs generes.
  const playoffRounds = await prisma.leagueRound.count({
    where: { seasonId: match.leagueSeasonId, kind: "playoff" },
  });
  if (playoffRounds > 0) {
    return { skipped: true, reason: "playoffs-generated" };
  }
  // Note : une mort EST reversible (la mort est un simple flag `dead:true`,
  // la ligne TeamPlayer n'est jamais supprimee). La reversion est deleguee a
  // `revertPlayerStatus`, qui verifie la provenance. L'UI previent le
  // commissaire que des joueurs vont etre ressuscites avant de confirmer.

  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: match.leaguePairingId },
    select: {
      id: true,
      homeParticipant: {
        select: {
          id: true,
          teamId: true,
          team: { select: { roster: true } },
        },
      },
      awayParticipant: {
        select: {
          id: true,
          teamId: true,
          team: { select: { roster: true } },
        },
      },
    },
  })) as {
    id: string;
    homeParticipant: {
      id: string;
      teamId: string;
      team: { roster: string };
    } | null;
    awayParticipant: {
      id: string;
      teamId: string;
      team: { roster: string };
    } | null;
  } | null;

  if (!pairing || !pairing.homeParticipant || !pairing.awayParticipant) {
    return { skipped: true, reason: "pairing-missing" };
  }
  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  // Garde-fou : level-up deja consomme issu de ce match. Les
  // advancements appliques par la feuille de match elle-meme (et que
  // l'invalidation va reverser dans la foulee) sont deduits du compte —
  // seul un advancement pris par un AUTRE chemin (post-match L2.B.3)
  // bloque la reversion.
  const sheetApplied =
    options.sheetAppliedAdvancements ?? new Map<string, number>();
  const choices = parsePendingChoices(
    match.leaguePostMatchSequence?.pendingChoices,
  );
  if (choices.length > 0) {
    const players = (await prisma.teamPlayer.findMany({
      where: { id: { in: choices.map((c) => c.teamPlayerId) } },
      select: { id: true, advancements: true },
    })) as Array<{ id: string; advancements: unknown }>;
    const countById = new Map<string, number>(
      players.map((p) => [p.id, advancementsCount(p.advancements)]),
    );
    const consumed = choices.some(
      (c) =>
        (countById.get(c.teamPlayerId) ?? 0) -
          (sheetApplied.get(c.teamPlayerId) ?? 0) >
        c.advancementsTaken,
    );
    if (consumed) {
      return { skipped: true, reason: "advancement-consumed" };
    }
  }

  // Garde-fou : achats consommes. Un joueur ACHETE qui a deja joue / gagne
  // du SPP / progresse / est mort ne peut pas etre supprime par la reversion
  // (meme esprit que `advancement-consumed`).
  const rosterMutations: OfflineRosterMutations = {
    home: snapshot.rosterMutations?.home ?? EMPTY_MUTATION_SIDE,
    away: snapshot.rosterMutations?.away ?? EMPTY_MUTATION_SIDE,
  };
  if (await offlinePurchasesConsumed(rosterMutations)) {
    return { skipped: true, reason: "purchase-consumed" };
  }

  // Licenciements reellement appliques par ce match (a re-activer).
  const firedApplied: string[] = Array.isArray(snapshot.firedApplied)
    ? snapshot.firedApplied.filter((s): s is string => typeof s === "string")
    : [];

  // --- Reversion ---
  const { input } = snapshot;
  const winner = winnerOf(input.scoreHome, input.scoreAway);
  const bareme = match.leagueSeason.league;
  const pointsHome = pointsFor(winner, "home", bareme);
  const pointsAway = pointsFor(winner, "away", bareme);

  // Recompute le SPP gagne par joueur (meme modifier que la saisie) pour le
  // decrementer exactement.
  const sppOps: Array<{ id: string; earned: number; stats: PlayerMatchStats }> =
    [];
  if (input.playerStats.length > 0) {
    const context = await loadLeagueSPPContext(prisma, {
      isLeagueMatch: true,
      teamARoster: home.team.roster,
      teamBRoster: away.team.roster,
    });
    const ids = input.playerStats.map((s) => s.teamPlayerId);
    const owned = (await prisma.teamPlayer.findMany({
      where: { id: { in: ids } },
      select: { id: true, teamId: true },
    })) as Array<{ id: string; teamId: string }>;
    const teamById = new Map<string, string>(owned.map((p) => [p.id, p.teamId]));
    for (const s of input.playerStats) {
      const teamId = teamById.get(s.teamPlayerId);
      if (teamId !== home.teamId && teamId !== away.teamId) continue;
      const modifier = teamId === home.teamId ? context.teamA : context.teamB;
      const stats: PlayerMatchStats = {
        touchdowns: s.touchdowns ?? 0,
        casualties: s.casualties ?? 0,
        completions: s.completions ?? 0,
        interceptions: s.interceptions ?? 0,
        ttmLandings: s.ttmLandings ?? 0,
        mvp: s.mvp ?? false,
      };
      sppOps.push({
        id: s.teamPlayerId,
        earned: calculatePlayerSPP(stats, modifier),
        stats,
      });
    }
  }

  const ops: Promise<unknown>[] = [];

  // 1. Standings (decrement). ELO non touche (skipSeasonElo a la saisie).
  ops.push(
    prisma.leagueParticipant.update({
      where: { id: home.id },
      data: {
        wins: { decrement: winner === "home" ? 1 : 0 },
        draws: { decrement: winner === "draw" ? 1 : 0 },
        losses: { decrement: winner === "away" ? 1 : 0 },
        points: { decrement: pointsHome },
        touchdownsFor: { decrement: input.scoreHome },
        touchdownsAgainst: { decrement: input.scoreAway },
        casualtiesFor: { decrement: input.casualtiesHome },
        casualtiesAgainst: { decrement: input.casualtiesAway },
      },
    }),
    prisma.leagueParticipant.update({
      where: { id: away.id },
      data: {
        wins: { decrement: winner === "away" ? 1 : 0 },
        draws: { decrement: winner === "draw" ? 1 : 0 },
        losses: { decrement: winner === "home" ? 1 : 0 },
        points: { decrement: pointsAway },
        touchdownsFor: { decrement: input.scoreAway },
        touchdownsAgainst: { decrement: input.scoreHome },
        casualtiesFor: { decrement: input.casualtiesAway },
        casualtiesAgainst: { decrement: input.casualtiesHome },
      },
    }),
  );

  // 2. SPP par joueur (decrement exact).
  for (const op of sppOps) {
    ops.push(
      prisma.teamPlayer.update({
        where: { id: op.id },
        data: {
          spp: { decrement: op.earned },
          totalTouchdowns: { decrement: op.stats.touchdowns },
          totalCasualties: { decrement: op.stats.casualties },
          totalCompletions: { decrement: op.stats.completions },
          totalInterceptions: { decrement: op.stats.interceptions },
          totalMvpAwards: { decrement: op.stats.mvp ? 1 : 0 },
          matchesPlayed: { decrement: 1 },
        },
      }),
    );
  }

  // 2b. SPP bonus "Nuffle" (decrement) + bonus au classement (decrement).
  for (const b of input.sppBonus ?? []) {
    if (!b.spp) continue;
    ops.push(
      prisma.teamPlayer.update({
        where: { id: b.teamPlayerId },
        data: { spp: { decrement: b.spp } },
      }),
    );
  }
  if (input.rankingBonusHome) {
    ops.push(
      prisma.leagueParticipant.update({
        where: { id: home.id },
        data: { points: { decrement: input.rankingBonusHome } },
      }),
    );
  }
  if (input.rankingBonusAway) {
    ops.push(
      prisma.leagueParticipant.update({
        where: { id: away.id },
        data: { points: { decrement: input.rankingBonusAway } },
      }),
    );
  }

  // 3. Economie : annule le net treasury applique a la saisie
  //    (gains - depenses) + restaure dedicatedFans (pre-valeur).
  const treasuryDeltaHome =
    input.winningsHome - (input.treasuryDebitHome ?? 0);
  const treasuryDeltaAway =
    input.winningsAway - (input.treasuryDebitAway ?? 0);
  ops.push(
    prisma.team.update({
      where: { id: home.teamId },
      data: {
        treasury:
          treasuryDeltaHome >= 0
            ? { decrement: treasuryDeltaHome }
            : { increment: -treasuryDeltaHome },
        dedicatedFans: snapshot.dedicatedFansBefore.home,
      },
    }),
    prisma.team.update({
      where: { id: away.teamId },
      data: {
        treasury:
          treasuryDeltaAway >= 0
            ? { decrement: treasuryDeltaAway }
            : { increment: -treasuryDeltaAway },
        dedicatedFans: snapshot.dedicatedFansBefore.away,
      },
    }),
  );

  // 4. Blessures (decrement compteurs + missNextMatch=false + restauration
  //    des caracteristiques perdues sur Séquelle, cf. buildInjuryReverse).
  const injuredRows = (await prisma.teamPlayer.findMany({
    where: { id: { in: input.injuries.map((i) => i.teamPlayerId) } },
    select: {
      id: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      maReduction: true,
      stReduction: true,
      agReduction: true,
      paReduction: true,
      avReduction: true,
    },
  })) as Array<{
    id: string;
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
    maReduction: number;
    stReduction: number;
    agReduction: number;
    paReduction: number;
    avReduction: number;
  }>;
  const reverseStateById = new Map<string, InjuryReverseState>(
    injuredRows.map((p) => [
      p.id,
      {
        stats: { ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av },
        reductions: {
          ma: p.maReduction,
          st: p.stReduction,
          ag: p.agReduction,
          pa: p.paReduction,
          av: p.avReduction,
        },
      },
    ]),
  );
  // Les morts ne sont PAS reversees ici : elles passent par
  // `revertPlayerStatus` (apres la transaction), qui verifie que la mort
  // courante a bien ete posee par CE match avant de ressusciter.
  const deathsToRevert = input.injuries
    .filter((inj) => inj.type === "dead")
    .map((inj) => inj.teamPlayerId);

  for (const inj of input.injuries) {
    if (inj.type === "dead") continue;
    const state = reverseStateById.get(inj.teamPlayerId);
    // Ligne joueur introuvable (defensif) : reversion legacy des compteurs
    // seuls, sans restauration de caracteristique.
    if (!state) {
      ops.push(
        prisma.teamPlayer.update({
          where: { id: inj.teamPlayerId },
          data: injuryReverseData(inj.type),
        }),
      );
      continue;
    }
    const { data, nextState } = buildInjuryReverse(inj.type, state);
    reverseStateById.set(inj.teamPlayerId, nextState);
    ops.push(
      prisma.teamPlayer.update({
        where: { id: inj.teamPlayerId },
        data,
      }),
    );
  }

  // 4b. Achats : suppression des joueurs crees + decrement des compteurs
  //     (des deltas EXACTS memorises dans le snapshot). TV recalculee apres
  //     la transaction.
  if (sideHasMutation(rosterMutations.home)) {
    ops.push(...buildPurchaseReverseOps(home.teamId, rosterMutations.home));
  }
  if (sideHasMutation(rosterMutations.away)) {
    ops.push(...buildPurchaseReverseOps(away.teamId, rosterMutations.away));
  }

  // 4c. Licenciements : re-integration des joueurs licencies par ce match.
  //     Comme les morts, la reversion passe par `revertPlayerStatus` APRES
  //     la transaction : un licenciement dont le statut a ete re-pose par
  //     une autre source ne doit pas etre leve en aveugle.

  // 5. Suppression du Match synthetique : d'abord les TeamSelection (pas de
  //    cascade), puis le Match (cascade la post-match-sequence).
  ops.push(
    prisma.teamSelection.deleteMany({ where: { matchId: match.id } }),
    prisma.match.delete({ where: { id: match.id } }),
  );

  // 6. Re-ouverture du pairing + du round si la saisie l'avait clôture.
  //    Le snapshot de points bonus (Lot E) est remis a zero : les bonus ne
  //    sont plus comptes dans `points` mais la colonne `Bo` du classement
  //    agrege ces snapshots — un match reverse ne doit plus y contribuer.
  ops.push(
    prisma.leaguePairing.update({
      where: { id: pairing.id },
      data: {
        status: "scheduled",
        bonusPointsHome: 0,
        bonusPointsAway: 0,
        bonusBreakdown: null,
      },
    }),
  );
  if (match.leagueRound && match.leagueRound.status === "completed") {
    ops.push(
      prisma.leagueRound.update({
        where: { id: match.leagueRound.id },
        data: { status: "scheduled" },
      }),
    );
  }

  await prisma.$transaction(ops);

  // Morts + licenciements : reversion VERIFIEE (la source du statut courant
  // doit etre ce match). Un joueur re-tue/re-licencie entre-temps par une
  // autre source reste inactif — on log le skip plutot que de corrompre.
  const statusReverted: string[] = [];
  for (const [kind, ids] of [
    ["death", deathsToRevert],
    ["firing", firedApplied],
  ] as const) {
    for (const playerId of ids) {
      const out = await revertPlayerStatus({
        playerId,
        kind,
        source: "match_sheet",
        sourceId: match.id,
      });
      if ("reverted" in out) {
        statusReverted.push(playerId);
      } else if (out.reason !== "no-status-to-revert") {
        serverLog.warn(
          `[league-offline-edit] reversion ${kind} ignoree (${out.reason}) player=${playerId} match=${match.id}`,
        );
      }
    }
  }

  // Recalcul TV (apres la transaction : updateTeamValues lit puis ecrit)
  // pour les DEUX equipes : la reversion peut avoir mute le roster
  // (achats, licenciements, morts) mais aussi les flags missNextMatch
  // (blessures MNG annulees) dont depend desormais la VEA.
  for (const teamId of [home.teamId, away.teamId]) {
    await updateTeamValues(prisma, teamId);
  }

  serverLog.info(
    `[league-offline-edit] reversed match=${match.id} pairing=${pairing.id} ${input.scoreHome}-${input.scoreAway}`,
  );

  return { reversed: true, matchId: match.id, pairingId: pairing.id };
}

export type EditOfflineOutcome =
  | RecordOfflineResultOutcome
  | {
      readonly skipped: true;
      readonly reason: ReverseOfflineSkipReason | "no-existing-result";
    };

/**
 * Edite un resultat offline deja saisi : annule la saisie existante puis
 * re-saisit la nouvelle. Reuse integralement `recordOfflineLeagueResult` pour
 * la re-application (aucune duplication de logique).
 *
 * Note : reverse + record sont deux transactions distinctes. Si la
 * re-saisie echoue apres une reversion reussie, le pairing est simplement
 * re-ouvert (status `scheduled`) sans resultat — etat recuperable (le
 * createur peut ressaisir).
 */
export async function editOfflineLeagueResult(
  input: RecordOfflineResultInput,
): Promise<EditOfflineOutcome> {
  const existing = (await prisma.match.findFirst({
    where: { leaguePairingId: input.pairingId, mode: OFFLINE_MATCH_MODE },
    select: { id: true },
  })) as { id: string } | null;
  if (!existing) return { skipped: true, reason: "no-existing-result" };

  const reversed = await reverseOfflineLeagueResult(existing.id);
  if ("skipped" in reversed) return reversed;

  return recordOfflineLeagueResult(input);
}
