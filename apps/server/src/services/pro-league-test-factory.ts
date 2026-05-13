/**
 * Pro League test factory — creation et suppression de saisons "test"
 * isolees de la production.
 *
 * Une saison test (`ProLeagueSeason.isTest = true`) est :
 *   - invisible des endpoints user-facing (hub, standings, leaderboards,
 *     feed, gazette) : ces routes filtrent `isTest=false`.
 *   - composee de matchs eux-meme `isTest=true`, donc deja exclus des
 *     agregateurs (bets, casualties, drift, SPP, ELO, etc. — cf.
 *     `pro-league-isTest-guards`).
 *   - genere sur la meme ligue singleton (`old-world-league`) en
 *     reutilisant les 16 `ProTeam` existantes, ou un sous-ensemble si
 *     `teamSlugs` est fourni (utile pour iterer rapidement).
 *   - completement simulee a la creation : on appelle `simulateProMatch`
 *     sur chaque match en serie pour que le replay binaire soit
 *     immediatement disponible cote admin (page detail match / replay
 *     player).
 *   - supprimable d'un coup via `deleteTestSeason` : cascade naturelle
 *     sur rounds/matches/standings + delete explicite des replays
 *     (FK non-cascade sur `Replay.matchId`).
 *
 * Pourquoi pas reutiliser `pro-season-factory.createSeason` ?
 * ----------------------------------------------------------
 *  - `createSeason` impose `year` unique (2020..2100) au sein de la
 *    ligue. Pour les test seasons on veut pouvoir en creer plusieurs
 *    sans gerer manuellement la collision : on calcule un `year`
 *    auto-incrementee dans la plage reservee [9000..9999].
 *  - `createSeason` ne flag pas `isTest=true` (par design — la prod ne
 *    doit pas pouvoir creer une saison sandbox par accident).
 *  - On a besoin de regrouper schedule + simulate dans une seule
 *    operation atomique cote API (et un seul audit log).
 *
 * L'annee reservee [9000..9999] permet jusqu'a 1000 test seasons
 * concurrentes par ligue ; au-dela, l'admin doit en supprimer avant
 * d'en creer de nouvelles. Le picker prend la premiere annee libre
 * a partir de 9000 (pas un random) pour rendre les ids predictibles.
 */

import { ENGINE_VER as CURRENT_ENGINE_VER } from "@bb/sim-engine";

import { prisma } from "../prisma";
import { OLD_WORLD_LEAGUE_SLUG } from "../seeders/pro-league";
import { generateRoundRobin } from "./league-schedule";
import { simulateProMatch } from "./pro-league-sim-runner";

const TEST_YEAR_MIN = 9000;
const TEST_YEAR_MAX = 9999;
const DEFAULT_TEST_LABEL = "test-season";

export class TestFactoryError extends Error {
  constructor(
    public readonly code:
      | "LEAGUE_NOT_FOUND"
      | "NO_TEAMS_AVAILABLE"
      | "INVALID_INPUT"
      | "SEASON_NOT_FOUND"
      | "SEASON_NOT_TEST"
      | "YEAR_RANGE_EXHAUSTED",
    message: string,
  ) {
    super(message);
    this.name = "TestFactoryError";
  }
}

export interface CreateTestSeasonInput {
  /** Label libre (max 120 chars). Default "test-season". */
  readonly label?: string;
  /** Driver de simulation : default "hybrid" (rapide ; ~50ms/match). */
  readonly driverKind?: "hybrid" | "full";
  /** engineVer pinne : default `CURRENT_ENGINE_VER` du sim-engine. */
  readonly engineVer?: string;
  /**
   * Sous-ensemble de slugs de teams a inclure. Si null/undefined :
   * toutes les teams de la ligue (16 par defaut). Min 2 (round-robin
   * requiert au moins 2 participants).
   */
  readonly teamSlugs?: readonly string[];
}

export interface CreateTestSeasonResult {
  readonly seasonId: string;
  readonly year: number;
  readonly label: string;
  readonly teamCount: number;
  readonly roundsCreated: number;
  readonly matchesSimulated: number;
  readonly matchesFailed: number;
  readonly engineVer: string;
  readonly driverKind: string;
}

/**
 * Picker d'annee libre dans la plage [9000..9999] pour la ligue donnee.
 * Premier slot libre en partant de 9000.
 */
async function pickFreeTestYear(leagueId: string): Promise<number> {
  const used = (await prisma.proLeagueSeason.findMany({
    where: {
      leagueId,
      year: { gte: TEST_YEAR_MIN, lte: TEST_YEAR_MAX },
    },
    select: { year: true },
  })) as Array<{ year: number }>;
  const usedSet = new Set(used.map((s) => s.year));
  for (let y = TEST_YEAR_MIN; y <= TEST_YEAR_MAX; y += 1) {
    if (!usedSet.has(y)) return y;
  }
  throw new TestFactoryError(
    "YEAR_RANGE_EXHAUSTED",
    `Aucun slot libre dans la plage [${TEST_YEAR_MIN}..${TEST_YEAR_MAX}] — supprimez d'anciennes test seasons.`,
  );
}

/**
 * Cree une saison Pro League "test" :
 *   1. Resout la ligue singleton + les teams cibles.
 *   2. Insere la saison en `isTest=true`, status='in_progress'.
 *   3. Genere les rounds via round-robin Berger (N teams => N-1 rounds).
 *   4. Cree les matchs (tous flagges `isTest=true`).
 *   5. Initialise les standings a zero.
 *   6. Simule chaque match en serie via `simulateProMatch` (replays
 *      persistes dans la table `Replay`, disponibles immediatement).
 *
 * En cas d'echec sur un sim individuel, on continue (le match passe
 * a 'failed' cote sim-runner) ; le compteur `matchesFailed` remonte
 * l'info a l'appelant.
 */
export async function createTestSeason(
  input: CreateTestSeasonInput = {},
): Promise<CreateTestSeasonResult> {
  const driverKind = input.driverKind ?? "hybrid";
  const engineVer = input.engineVer ?? CURRENT_ENGINE_VER;
  const label = (input.label ?? DEFAULT_TEST_LABEL).slice(0, 120);

  const league = await prisma.proLeague.findUnique({
    where: { slug: OLD_WORLD_LEAGUE_SLUG },
    select: { id: true },
  });
  if (!league) {
    throw new TestFactoryError(
      "LEAGUE_NOT_FOUND",
      `Ligue '${OLD_WORLD_LEAGUE_SLUG}' introuvable — lance le seed d'abord.`,
    );
  }
  const leagueId = league.id as string;

  // Selection des teams : par defaut toutes celles de la ligue. Si
  // `teamSlugs` fourni, on filtre + valide la presence en DB.
  let teams: Array<{ id: string; slug: string }>;
  if (input.teamSlugs && input.teamSlugs.length > 0) {
    if (input.teamSlugs.length < 2) {
      throw new TestFactoryError(
        "INVALID_INPUT",
        "Au moins 2 teamSlugs requis pour un round-robin.",
      );
    }
    const rows = (await prisma.proTeam.findMany({
      where: { leagueId, slug: { in: [...input.teamSlugs] } },
      select: { id: true, slug: true },
    })) as Array<{ id: string; slug: string }>;
    const found = new Set(rows.map((r) => r.slug));
    const missing = input.teamSlugs.filter((s) => !found.has(s));
    if (missing.length > 0) {
      throw new TestFactoryError(
        "INVALID_INPUT",
        `Teams introuvables : ${missing.join(", ")}`,
      );
    }
    teams = rows;
  } else {
    teams = (await prisma.proTeam.findMany({
      where: { leagueId },
      select: { id: true, slug: true },
      orderBy: { slug: "asc" },
    })) as Array<{ id: string; slug: string }>;
  }

  if (teams.length < 2) {
    throw new TestFactoryError(
      "NO_TEAMS_AVAILABLE",
      `Au moins 2 teams requises pour generer un round-robin (trouve : ${teams.length}).`,
    );
  }

  const year = await pickFreeTestYear(leagueId);

  // Generation du calendrier round-robin avant l'insertion DB pour
  // pouvoir le creer en une seule transaction.
  const rrRounds = generateRoundRobin({
    participantIds: teams.map((t) => t.id),
    doubleRoundRobin: false,
  });

  // Date de base pour les matchs : maintenant. Pas de gap entre rounds
  // (une test season n'a pas vocation a respecter une cadence).
  const baseDate = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await prisma.$transaction(async (tx: any) => {
    const season = await tx.proLeagueSeason.create({
      data: {
        leagueId,
        year,
        status: "in_progress",
        engineVer,
        driverKind,
        isTest: true,
        testLabel: label,
        startsAt: baseDate,
      },
      select: { id: true },
    });
    const seasonId = season.id as string;

    let roundsCreated = 0;
    const matchIds: string[] = [];
    for (const rr of rrRounds) {
      const round = await tx.proLeagueRound.create({
        data: {
          seasonId,
          roundNumber: rr.roundNumber,
          status: "pending",
          scheduledAt: baseDate,
        },
        select: { id: true },
      });
      roundsCreated += 1;
      for (const pairing of rr.pairings) {
        const m = await tx.proLeagueMatch.create({
          data: {
            seasonId,
            roundId: round.id,
            homeTeamId: pairing.home,
            awayTeamId: pairing.away,
            status: "scheduled",
            scheduledAt: baseDate,
            isTest: true,
          },
          select: { id: true },
        });
        matchIds.push(m.id as string);
      }
    }

    await tx.proLeagueStandings.createMany({
      data: teams.map((team) => ({ seasonId, teamId: team.id })),
    });

    return { seasonId, roundsCreated, matchIds };
  });

  // Simulation hors transaction : `simulateProMatch` ouvre ses propres
  // $transactions et on ne veut pas tenir le verrou pendant le sim
  // (10ms..3s/match selon driver). L'echec d'un sim individuel laisse
  // le match en 'failed' mais ne corrompt pas la saison.
  //
  // Apres sim, le match est en `status='ready'` (en attente du
  // broadcaster prod). Pour une test season on shortcut : on promote
  // immediatement a `completed` pour que `pro-league-replay.ts`
  // accepte le replay (qui exige `status='completed'` pour rejouer).
  let matchesSimulated = 0;
  let matchesFailed = 0;
  const completedAt = new Date();
  for (const matchId of created.matchIds) {
    try {
      const ok = await simulateProMatch(matchId);
      if (ok) {
        matchesSimulated += 1;
        await prisma.proLeagueMatch.update({
          where: { id: matchId },
          data: { status: "completed", completedAt },
        });
      }
    } catch {
      matchesFailed += 1;
    }
  }

  // Promote les rounds + la saison en `completed` pour l'UX admin
  // (page detail season affiche un statut coherent). Pas de side-effect
  // production puisque `isTest=true` filtre partout.
  if (matchesFailed === 0) {
    await prisma.proLeagueRound.updateMany({
      where: { seasonId: created.seasonId },
      data: { status: "completed", completedAt },
    });
    await prisma.proLeagueSeason.update({
      where: { id: created.seasonId },
      data: { status: "completed", endsAt: completedAt },
    });
  }

  return {
    seasonId: created.seasonId,
    year,
    label,
    teamCount: teams.length,
    roundsCreated: created.roundsCreated,
    matchesSimulated,
    matchesFailed,
    engineVer,
    driverKind,
  };
}

export interface TestSeasonSummary {
  readonly id: string;
  readonly year: number;
  readonly label: string | null;
  readonly status: string;
  readonly engineVer: string;
  readonly driverKind: string;
  readonly roundCount: number;
  readonly matchCount: number;
  readonly simulatedCount: number;
  readonly failedCount: number;
  readonly createdAt: string;
}

/**
 * Liste les test seasons existantes, plus recentes en premier. Inclut
 * les compteurs roundCount / matchCount / simulatedCount / failedCount
 * pour piloter l'UI admin (badge "X / Y simulated").
 */
export async function listTestSeasons(): Promise<TestSeasonSummary[]> {
  const seasons = (await prisma.proLeagueSeason.findMany({
    where: { isTest: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      year: true,
      testLabel: true,
      status: true,
      engineVer: true,
      driverKind: true,
      createdAt: true,
      _count: { select: { rounds: true, matches: true } },
    },
  })) as Array<{
    id: string;
    year: number;
    testLabel: string | null;
    status: string;
    engineVer: string;
    driverKind: string;
    createdAt: Date;
    _count: { rounds: number; matches: number };
  }>;

  if (seasons.length === 0) return [];

  // Compte des matchs `ready` ou `completed` (simules avec succes) +
  // `failed` (sim KO). On groupBy en un seul aller-retour pour eviter
  // N+1.
  const seasonIds = seasons.map((s) => s.id);
  const counters = (await prisma.proLeagueMatch.groupBy({
    by: ["seasonId", "status"],
    where: { seasonId: { in: seasonIds }, isTest: true },
    _count: { _all: true },
  })) as Array<{
    seasonId: string;
    status: string;
    _count: { _all: number };
  }>;
  const simulatedBy = new Map<string, number>();
  const failedBy = new Map<string, number>();
  for (const row of counters) {
    if (row.status === "ready" || row.status === "completed") {
      simulatedBy.set(
        row.seasonId,
        (simulatedBy.get(row.seasonId) ?? 0) + row._count._all,
      );
    } else if (row.status === "failed") {
      failedBy.set(
        row.seasonId,
        (failedBy.get(row.seasonId) ?? 0) + row._count._all,
      );
    }
  }

  return seasons.map((s) => ({
    id: s.id,
    year: s.year,
    label: s.testLabel,
    status: s.status,
    engineVer: s.engineVer,
    driverKind: s.driverKind,
    roundCount: s._count.rounds,
    matchCount: s._count.matches,
    simulatedCount: simulatedBy.get(s.id) ?? 0,
    failedCount: failedBy.get(s.id) ?? 0,
    createdAt: s.createdAt.toISOString(),
  }));
}

export interface DeleteTestSeasonResult {
  readonly seasonId: string;
  readonly deletedReplays: number;
  readonly deletedMatches: number;
  readonly deletedRounds: number;
  readonly deletedStandings: number;
}

/**
 * Supprime une test season + tous ses artefacts.
 *
 * Refuse explicitement si la saison cible n'a pas `isTest=true` : on
 * ne veut JAMAIS effacer une saison prod par accident, meme si
 * l'appelant a un seasonId admin. C'est une garantie defense-in-depth
 * en plus de la route admin-only.
 *
 * Ordre des deletes :
 *   1. `Replay` : pas de cascade depuis `ProLeagueMatch` (la FK est
 *      `ProLeagueMatch.replayId -> Replay.matchId` mais Replay.matchId
 *      est l'@id, donc pas de onDelete cote Replay). Delete explicite
 *      via `matchId IN (...)`.
 *   2. `ProLeagueSeason` : cascade naturelle sur rounds, matches,
 *      standings, survivorEntries (toutes en onDelete: Cascade), qui
 *      a leur tour cascade sur betMarkets/predictionPicks/mvpVotes/
 *      fanPredictions cote matchs.
 */
export async function deleteTestSeason(
  seasonId: string,
): Promise<DeleteTestSeasonResult> {
  const season = await prisma.proLeagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, isTest: true },
  });
  if (!season) {
    throw new TestFactoryError(
      "SEASON_NOT_FOUND",
      `Saison '${seasonId}' introuvable`,
    );
  }
  if (!season.isTest) {
    throw new TestFactoryError(
      "SEASON_NOT_TEST",
      `Saison '${seasonId}' n'est pas une test season — refus de suppression destructive.`,
    );
  }

  // Capture des matches pour delete les replays (pas de FK cascade).
  const matches = (await prisma.proLeagueMatch.findMany({
    where: { seasonId },
    select: { id: true },
  })) as Array<{ id: string }>;
  const matchIds = matches.map((m) => m.id);

  // Capture les counts pre-delete pour le retour audit-friendly.
  const [roundCount, standingsCount] = await Promise.all([
    prisma.proLeagueRound.count({ where: { seasonId } }),
    prisma.proLeagueStandings.count({ where: { seasonId } }),
  ]);

  let deletedReplays = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    if (matchIds.length > 0) {
      const r = await tx.replay.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      deletedReplays = r.count as number;
    }
    await tx.proLeagueSeason.delete({ where: { id: seasonId } });
  });

  return {
    seasonId,
    deletedReplays,
    deletedMatches: matches.length,
    deletedRounds: roundCount,
    deletedStandings: standingsCount,
  };
}
