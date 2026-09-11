/**
 * Resynchronisation des SORTIES d'une feuille de match déjà validée.
 *
 * La définition d'une sortie a changé (`eliminationEarnsSpp`) : seule une
 * élimination qui rapporte des PSP en est une. Une agression qui blessait
 * était jusque-là comptée comme sortie, créditée 2 PSP à son auteur et
 * ajoutée au compteur d'équipe — persistés à la validation (classement
 * `casualtiesFor/Against`, `TeamPlayer.totalCasualties` et `spp`, points
 * bonus « sorties infligées » du pairing, snapshot `offlineResultInput`).
 * La feuille, elle, se relit avec la nouvelle règle : ses compteurs
 * DIVERGENT donc de ce qui a été persisté (« 5 sorties » au classement pour
 * « 4 sorties + 1 agression » sur la feuille).
 *
 * Invalider puis revalider chaque feuille rejouerait toute la séquence de
 * fin de match (jets de Haine, évolutions, achats) et se heurte aux
 * garde-fous d'invalidation. Ce module ne rejoue QUE ce qui dépend de la
 * qualification des sorties :
 *
 *  1. re-dérive le résumé de la feuille par le MÊME chemin que la lecture
 *     et la validation (`sheetSummaryOptions` + `summarizeMatchSheet`) ;
 *  2. compare aux compteurs figés dans le snapshot du match offline ;
 *  3. applique les DELTAS — compteurs des deux participants, `totalCasualties`
 *     et PSP de chaque joueur (au barème du côté : 2, ou 3 en Bagarreurs
 *     Brutaux), points bonus du pairing (règles de la ligue ré-évaluées,
 *     bonus commissaire conservé) — et réécrit le snapshot pour qu'une
 *     invalidation ultérieure reprenne exactement ce qui a été appliqué.
 *
 * Idempotent : une feuille déjà à jour ne produit aucun delta et n'écrit
 * rien. Le calcul (`planCasualtyResync`) est PUR ; l'application est
 * journalisée dans le journal d'équipe des deux équipes.
 *
 * Point d'entrée opérateur : `scripts/resync-sheet-casualties.ts`
 * (`pnpm --filter @bb/server db:resync-sheet-casualties [-- --apply]`).
 */

import { prisma } from "../prisma";
import { OFFLINE_MATCH_MODE } from "./match-modes";
import {
  summarizeMatchSheet,
  type MatchEventInput,
  type MatchEventTeam,
  type MatchSummary,
} from "./league-match-summary";
import { loadSheetTeams, sheetSummaryOptions } from "./league-match-sheet";
import { resolveCompetitionPairing } from "./competition-match-sheet-context";
import {
  COMMISSIONER_RANKING_BONUS_RULE_ID,
  parseOfflineSnapshot,
  type OfflinePlayerStatInput,
  type OfflineResultSnapshot,
} from "./league-offline-result";
import {
  evaluateBonusRules,
  parseBonusConfig,
  type BonusAppliedEntry,
  type BonusRule,
} from "./league-bonus-points";
import { calculatePlayerSPP, loadLeagueSPPContext } from "./spp-tracking";
import { isSyntheticSheetPlayerId } from "./league-sheet-star-players";
import { captureTeamState, safeRecordTeamAudit } from "./team-audit";
import { serverLog } from "../utils/server-log";

export type CasualtyResyncSkipReason =
  | "pairing-missing"
  | "not-a-league"
  | "sheet-not-validated"
  | "snapshot-missing"
  | "participant-missing"
  | "season-completed";

/** Un joueur dont la sortie change de qualification. */
export interface CasualtyResyncPlayerDelta {
  readonly teamPlayerId: string;
  readonly side: MatchEventTeam;
  /** Sorties créditées avant / après. */
  readonly before: number;
  readonly after: number;
  /** PSP à ajouter au joueur (négatif = reprise). */
  readonly sppDelta: number;
}

export interface SideCounts {
  readonly home: number;
  readonly away: number;
}

export interface CasualtyResyncBonus {
  /** Points bonus de règles avant / après (hors bonus commissaire). */
  readonly before: SideCounts;
  readonly after: SideCounts;
  /** Entrées de règles à écrire, à la place des anciennes. */
  readonly applied: readonly BonusAppliedEntry[];
}

export interface CasualtyResyncPlan {
  readonly pairingId: string;
  readonly matchId: string;
  readonly casualties: { readonly before: SideCounts; readonly after: SideCounts };
  readonly players: readonly CasualtyResyncPlayerDelta[];
  /** `null` : pas de règle bonus dans la ligue, ou sorties inchangées. */
  readonly bonus: CasualtyResyncBonus | null;
  /** Vrai dès qu'un compteur ou un joueur bouge. */
  readonly changed: boolean;
  /** Snapshot du match offline mis à jour (à persister si `changed`). */
  readonly snapshot: OfflineResultSnapshot;
}

export type CasualtyResyncOutcome =
  | { readonly skipped: true; readonly reason: CasualtyResyncSkipReason }
  | { readonly skipped: false; readonly applied: boolean; readonly plan: CasualtyResyncPlan };

export interface PlanCasualtyResyncInput {
  readonly pairingId: string;
  readonly matchId: string;
  readonly snapshot: OfflineResultSnapshot;
  /** Résumé re-dérivé de la feuille avec la règle courante. */
  readonly summary: MatchSummary;
  /** Côté d'un joueur du roster réel, `null` s'il n'est d'aucune des deux équipes. */
  readonly sideOf: (teamPlayerId: string) => MatchEventTeam | null;
  /** PSP d'UNE sortie par côté (2, ou 3 en Bagarreurs Brutaux). */
  readonly casualtySpp: SideCounts;
  /** Règles de bonus de la ligue (`League.bonusPointsConfig`), `null` sans config. */
  readonly bonusRules: readonly BonusRule[] | null;
}

function winnerOf(scoreHome: number, scoreAway: number): "home" | "away" | "draw" {
  if (scoreHome > scoreAway) return "home";
  if (scoreAway > scoreHome) return "away";
  return "draw";
}

/**
 * PUR — compare les sorties persistées (snapshot) aux sorties re-dérivées
 * (résumé) et décrit ce qu'il faut appliquer. Les joueurs synthétiques
 * (journaliers, Star Players) n'ont pas de ligne `TeamPlayer` : ils sont
 * ignorés, comme à la validation.
 */
export function planCasualtyResync(
  input: PlanCasualtyResyncInput,
): CasualtyResyncPlan {
  const { snapshot, summary } = input;
  const before: SideCounts = {
    home: snapshot.input.casualtiesHome,
    away: snapshot.input.casualtiesAway,
  };
  const after: SideCounts = {
    home: summary.casualtiesHome,
    away: summary.casualtiesAway,
  };

  const oldById = new Map<string, number>();
  for (const s of snapshot.input.playerStats) {
    oldById.set(s.teamPlayerId, s.casualties ?? 0);
  }
  const newById = new Map<string, number>();
  for (const s of summary.playerStats) {
    if (isSyntheticSheetPlayerId(s.playerId)) continue;
    newById.set(s.playerId, s.casualtiesInflicted);
  }

  const players: CasualtyResyncPlayerDelta[] = [];
  const ids = new Set<string>([...oldById.keys(), ...newById.keys()]);
  for (const id of ids) {
    const side = input.sideOf(id);
    if (!side) continue;
    const oldCas = oldById.get(id) ?? 0;
    const newCas = newById.get(id) ?? 0;
    if (oldCas === newCas) continue;
    players.push({
      teamPlayerId: id,
      side,
      before: oldCas,
      after: newCas,
      sppDelta: (newCas - oldCas) * input.casualtySpp[side],
    });
  }

  const casualtiesChanged = before.home !== after.home || before.away !== after.away;
  let bonus: CasualtyResyncBonus | null = null;
  if (casualtiesChanged && input.bonusRules && input.bonusRules.length > 0) {
    const winner = winnerOf(snapshot.input.scoreHome, snapshot.input.scoreAway);
    const evaluate = (cas: SideCounts) =>
      evaluateBonusRules(input.bonusRules, {
        tdsHome: snapshot.input.scoreHome,
        tdsAway: snapshot.input.scoreAway,
        casualtiesInflictedHome: cas.home,
        casualtiesInflictedAway: cas.away,
        winner,
      });
    const evalBefore = evaluate(before);
    const evalAfter = evaluate(after);
    bonus = {
      before: { home: evalBefore.homeBonus, away: evalBefore.awayBonus },
      after: { home: evalAfter.homeBonus, away: evalAfter.awayBonus },
      applied: evalAfter.applied,
    };
  }

  // Snapshot mis à jour : mêmes lignes, sorties réécrites. Une ligne
  // manquante (joueur crédité sous la règle nouvelle mais absent de la
  // saisie figée) est ajoutée avec ses seules sorties.
  const seen = new Set<string>();
  const playerStats: OfflinePlayerStatInput[] = snapshot.input.playerStats.map(
    (s) => {
      seen.add(s.teamPlayerId);
      const delta = players.find((p) => p.teamPlayerId === s.teamPlayerId);
      return delta ? { ...s, casualties: delta.after } : s;
    },
  );
  for (const delta of players) {
    if (!seen.has(delta.teamPlayerId)) {
      playerStats.push({ teamPlayerId: delta.teamPlayerId, casualties: delta.after });
    }
  }

  return {
    pairingId: input.pairingId,
    matchId: input.matchId,
    casualties: { before, after },
    players,
    bonus,
    changed: casualtiesChanged || players.length > 0,
    snapshot: {
      ...snapshot,
      input: {
        ...snapshot.input,
        casualtiesHome: after.home,
        casualtiesAway: after.away,
        playerStats,
      },
    },
  };
}

/** Opération atomique Prisma pour un delta signé (rien pour 0). */
function atomicDelta(
  n: number,
): { increment: number } | { decrement: number } | undefined {
  if (n > 0) return { increment: n };
  if (n < 0) return { decrement: -n };
  return undefined;
}

/** Parse tolérant du breakdown bonus du pairing (objet PG / chaîne sqlite). */
function parseBreakdown(raw: unknown): Record<string, unknown>[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(arr)
    ? arr.filter(
        (e): e is Record<string, unknown> => typeof e === "object" && e !== null,
      )
    : [];
}

interface PairingForResync {
  id: string;
  bonusBreakdown: unknown;
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
  round: {
    season: {
      status: string;
      league: { bonusPointsConfig: unknown };
    };
  };
}

export interface ResyncOptions {
  /** `false` (défaut) : simulation, rien n'est écrit. */
  readonly apply?: boolean;
}

/**
 * Resynchronise les sorties d'UNE feuille validée de ligue. Sans `apply`,
 * calcule et retourne le plan sans rien écrire.
 */
export async function resyncValidatedSheetCasualties(
  pairingId: string,
  options: ResyncOptions = {},
): Promise<CasualtyResyncOutcome> {
  const ctx = await resolveCompetitionPairing(pairingId);
  if (!ctx) return { skipped: true, reason: "pairing-missing" };
  // Une coupe n'écrit ni PSP ni classement matérialisé : rien à resynchroniser.
  if (ctx.kind !== "league") return { skipped: true, reason: "not-a-league" };

  const sheet = (await prisma.leagueMatchSheet.findUnique({
    where: { pairingId },
    include: { events: { orderBy: { occurredAt: "asc" } } },
  })) as
    | ({
        id: string;
        status: string;
        events?: MatchEventInput[];
        rosterSnapshotHome?: unknown;
        rosterSnapshotAway?: unknown;
        prayersHome?: unknown;
        prayersAway?: unknown;
      } & Record<string, unknown>)
    | null;
  if (!sheet || sheet.status !== "validated") {
    return { skipped: true, reason: "sheet-not-validated" };
  }

  const match = (await prisma.match.findFirst({
    where: { leaguePairingId: pairingId, mode: OFFLINE_MATCH_MODE },
    select: { id: true, offlineResultInput: true },
  })) as { id: string; offlineResultInput: unknown } | null;
  const snapshot = match ? parseOfflineSnapshot(match.offlineResultInput) : null;
  if (!match || !snapshot) return { skipped: true, reason: "snapshot-missing" };

  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      bonusBreakdown: true,
      homeParticipant: {
        select: { id: true, teamId: true, team: { select: { roster: true } } },
      },
      awayParticipant: {
        select: { id: true, teamId: true, team: { select: { roster: true } } },
      },
      round: {
        select: {
          season: {
            select: {
              status: true,
              league: { select: { bonusPointsConfig: true } },
            },
          },
        },
      },
    },
  })) as PairingForResync | null;
  if (!pairing?.homeParticipant || !pairing.awayParticipant) {
    return { skipped: true, reason: "participant-missing" };
  }
  // Saison clôturée : le palmarès est persisté, le classement est figé.
  if (pairing.round.season.status === "completed") {
    return { skipped: true, reason: "season-completed" };
  }
  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  // 1. Résumé re-dérivé par le chemin de la feuille (gel + prières).
  const teams = await loadSheetTeams(ctx);
  const summary = summarizeMatchSheet(
    sheet.events ?? [],
    sheetSummaryOptions(teams, sheet),
  );

  // 2. Barème d'UNE sortie par côté (Bagarreurs Brutaux : 3 au lieu de 2).
  const sppContext = await loadLeagueSPPContext(prisma, {
    isLeagueMatch: true,
    teamARoster: home.team.roster,
    teamBRoster: away.team.roster,
  });
  const oneCasualty = {
    touchdowns: 0,
    casualties: 1,
    completions: 0,
    interceptions: 0,
    ttmLandings: 0,
    mvp: false,
  };
  const casualtySpp: SideCounts = {
    home: calculatePlayerSPP(oneCasualty, sppContext.teamA),
    away: calculatePlayerSPP(oneCasualty, sppContext.teamB),
  };

  // 3. Côté de chaque joueur concerné (les ids hors des deux équipes sont
  //    ignorés, comme à la validation et à l'invalidation).
  const candidateIds = [
    ...snapshot.input.playerStats.map((s) => s.teamPlayerId),
    ...summary.playerStats
      .map((s) => s.playerId)
      .filter((id) => !isSyntheticSheetPlayerId(id)),
  ];
  const owned = (await prisma.teamPlayer.findMany({
    where: { id: { in: [...new Set(candidateIds)] } },
    select: { id: true, teamId: true },
  })) as Array<{ id: string; teamId: string }>;
  const teamById = new Map(owned.map((p) => [p.id, p.teamId]));
  const sideOf = (id: string): MatchEventTeam | null => {
    const teamId = teamById.get(id);
    if (teamId === home.teamId) return "home";
    if (teamId === away.teamId) return "away";
    return null;
  };

  const plan = planCasualtyResync({
    pairingId,
    matchId: match.id,
    snapshot,
    summary,
    sideOf,
    casualtySpp,
    bonusRules: parseBonusConfig(pairing.round.season.league.bonusPointsConfig),
  });

  if (!options.apply || !plan.changed) {
    return { skipped: false, applied: false, plan };
  }

  await applyCasualtyResync(plan, {
    home: { participantId: home.id, teamId: home.teamId },
    away: { participantId: away.id, teamId: away.teamId },
    bonusBreakdown: pairing.bonusBreakdown,
  });
  return { skipped: false, applied: true, plan };
}

interface ResyncSides {
  readonly home: { readonly participantId: string; readonly teamId: string };
  readonly away: { readonly participantId: string; readonly teamId: string };
  readonly bonusBreakdown: unknown;
}

/** Applique un plan (une transaction), puis journalise les deux équipes. */
async function applyCasualtyResync(
  plan: CasualtyResyncPlan,
  sides: ResyncSides,
): Promise<void> {
  const dHome = plan.casualties.after.home - plan.casualties.before.home;
  const dAway = plan.casualties.after.away - plan.casualties.before.away;

  // Capturer AVANT, publier APRÈS le commit (cf. CLAUDE.md, journal d'équipe).
  const before = {
    home: await captureTeamState(prisma, sides.home.teamId),
    away: await captureTeamState(prisma, sides.away.teamId),
  };

  const ops: Promise<unknown>[] = [];
  ops.push(
    prisma.leagueParticipant.update({
      where: { id: sides.home.participantId },
      data: {
        casualtiesFor: atomicDelta(dHome),
        casualtiesAgainst: atomicDelta(dAway),
      },
    }),
    prisma.leagueParticipant.update({
      where: { id: sides.away.participantId },
      data: {
        casualtiesFor: atomicDelta(dAway),
        casualtiesAgainst: atomicDelta(dHome),
      },
    }),
  );
  for (const p of plan.players) {
    ops.push(
      prisma.teamPlayer.update({
        where: { id: p.teamPlayerId },
        data: {
          totalCasualties: atomicDelta(p.after - p.before),
          spp: atomicDelta(p.sppDelta),
        },
      }),
    );
  }
  if (plan.bonus) {
    // Les entrées de règles sont réécrites ; celles du bonus commissaire
    // sont conservées telles quelles (elles ne dépendent pas des sorties).
    const kept = parseBreakdown(sides.bonusBreakdown).filter(
      (e) => e.ruleId === COMMISSIONER_RANKING_BONUS_RULE_ID,
    );
    const entries = [...plan.bonus.applied, ...kept];
    ops.push(
      prisma.leaguePairing.update({
        where: { id: plan.pairingId },
        data: {
          bonusPointsHome: atomicDelta(plan.bonus.after.home - plan.bonus.before.home),
          bonusPointsAway: atomicDelta(plan.bonus.after.away - plan.bonus.before.away),
          // Chaîne JSON : compatible colonne Json (PG) et String (miroir sqlite).
          bonusBreakdown: entries.length > 0 ? JSON.stringify(entries) : null,
        },
      }),
    );
  }
  ops.push(
    prisma.match.update({
      where: { id: plan.matchId },
      data: { offlineResultInput: JSON.parse(JSON.stringify(plan.snapshot)) },
    }),
  );
  await prisma.$transaction(ops);

  for (const side of ["home", "away"] as const) {
    await safeRecordTeamAudit(prisma, {
      teamId: sides[side].teamId,
      action: "league.sheet.casualties.resync",
      before: before[side],
      details: {
        pairingId: plan.pairingId,
        matchId: plan.matchId,
        casualties: plan.casualties,
        players: plan.players.filter((p) => p.side === side),
        bonus: plan.bonus
          ? { before: plan.bonus.before, after: plan.bonus.after }
          : null,
      },
    });
  }
  serverLog.info(
    `[league-sheet-casualty-resync] pairing=${plan.pairingId} sorties ` +
      `${plan.casualties.before.home}/${plan.casualties.before.away} -> ` +
      `${plan.casualties.after.home}/${plan.casualties.after.away}, ` +
      `${plan.players.length} joueur(s)`,
  );
}
