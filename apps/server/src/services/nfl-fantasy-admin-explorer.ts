/**
 * Service admin Phase 3.C — vues read-only sur le referentiel NFL
 * (seasons, teams, players, stats) + actions de resync par joueur.
 *
 * Lecture seule par defaut : `listNflSeasonsForAdmin`,
 * `listNflTeamsForAdmin`, `getNflTeamDetail`, `listNflPlayersForAdmin`,
 * `getNflPlayerDetail`.
 *
 * Mutations idempotentes ciblees (un joueur a la fois) :
 *   - `recomputePlayerSpp`   relance computeSpp() sur tous les NflGameStat
 *     (utile si la formule SPP @bb/nfl-mapper a evolue).
 *   - `reDerivePlayerBb`     relance getBbPosition(nflPosition, teamRace)
 *     (utile si la table de mapping race-dependent a evolue).
 *
 * La resync ESPN d'un joueur (refresh teamCode/jersey/status) est
 * implementee dans `nfl-ingest-espn.ts` comme `resyncEspnPlayer` pour
 * rester pres du code d'ingestion.
 *
 * Toutes les fonctions sont idempotentes (pattern Q.D.1). Les erreurs
 * typees `NflFantasyAdminError` sont mappees via `nfl-error-mapper`.
 */

import type {
  NflFantasyEntry,
  NflFantasyLeague,
  NflGame,
  NflGameStat,
  NflIngestRun,
  NflPlayer,
  NflSeason,
  NflTeam,
  NflWeek,
  Prisma,
} from "@prisma/client";
import {
  computeSpp,
  getBbPosition,
  type BbRace,
  type NflPlayerStatLine,
} from "@bb/nfl-mapper";

import { prisma } from "../prisma";
import { buildStatLineFromRow, type NflverseRow } from "./nfl-ingest";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export class NflFantasyAdminError extends Error {
  constructor(
    public readonly code:
      | "PLAYER_NOT_FOUND"
      | "TEAM_NOT_FOUND"
      | "PLAYER_NO_TEAM"
      | "INVALID_BB_RACE"
      | "SEASON_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyAdminError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Seasons
// ────────────────────────────────────────────────────────────────────

export interface AdminSeasonRow {
  readonly id: string;
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly weeksCount: number;
  readonly gamesCount: number;
  readonly playersCount: number;
}

/**
 * Liste toutes les NflSeason seedees, avec compteurs derives (weeks,
 * games, joueurs ayant joue au moins 1 game). Trie DESC (saison la
 * plus recente d'abord).
 */
export async function listNflSeasonsForAdmin(): Promise<AdminSeasonRow[]> {
  const seasons = await prisma.nflSeason.findMany({ orderBy: { id: "desc" } });
  if (seasons.length === 0) return [];

  const ids = seasons.map((s: NflSeason) => s.id);

  const [weeks, games] = await Promise.all([
    prisma.nflWeek.groupBy({
      by: ["seasonId"],
      _count: { _all: true },
      where: { seasonId: { in: ids } },
    }) as Promise<Array<{ seasonId: string; _count: { _all: number } }>>,
    prisma.nflGame.groupBy({
      by: ["seasonId"],
      _count: { _all: true },
      where: { seasonId: { in: ids } },
    }) as Promise<Array<{ seasonId: string; _count: { _all: number } }>>,
  ]);

  const weeksMap = new Map(weeks.map((w) => [w.seasonId, w._count._all]));
  const gamesMap = new Map(games.map((g) => [g.seasonId, g._count._all]));

  // Players ayant joue au moins 1 game cette saison.
  // Pour eviter N requetes, on agrege via raw stats puis dedup.
  const playerCountsBySeason = new Map<string, number>();
  for (const id of ids) {
    const c = await prisma.nflPlayer.count({
      where: { gameStats: { some: { game: { seasonId: id } } } },
    });
    playerCountsBySeason.set(id, c);
  }

  return seasons.map((s: NflSeason) => ({
    id: s.id,
    status: s.status,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    weeksCount: weeksMap.get(s.id) ?? 0,
    gamesCount: gamesMap.get(s.id) ?? 0,
    playersCount: playerCountsBySeason.get(s.id) ?? 0,
  }));
}

// ────────────────────────────────────────────────────────────────────
// Teams
// ────────────────────────────────────────────────────────────────────

export interface AdminTeamRow {
  readonly code: string;
  readonly city: string;
  readonly bbRace: string;
  readonly raceLabel: string;
  readonly activePlayers: number;
  readonly totalPlayers: number;
  readonly gamesInSeason: number;
}

/**
 * Liste les 32 NflTeam avec compteurs joueurs (active vs total) et,
 * si `seasonId` fourni, le nombre de games programmes/joues cette
 * saison.
 */
export async function listNflTeamsForAdmin(opts: {
  seasonId?: string;
}): Promise<AdminTeamRow[]> {
  const teams = await prisma.nflTeam.findMany({ orderBy: { code: "asc" } });

  type GroupByCode<K extends string> = Array<
    Record<K, string | null> & { _count: { _all: number } }
  >;

  const [activeByTeam, totalByTeam] = (await Promise.all([
    prisma.nflPlayer.groupBy({
      by: ["teamCode"],
      _count: { _all: true },
      where: { status: "active", teamCode: { not: null } },
    }),
    prisma.nflPlayer.groupBy({
      by: ["teamCode"],
      _count: { _all: true },
      where: { teamCode: { not: null } },
    }),
  ])) as [GroupByCode<"teamCode">, GroupByCode<"teamCode">];

  const activeMap = new Map<string, number>(
    activeByTeam
      .filter((r): r is typeof r & { teamCode: string } => r.teamCode !== null)
      .map((r) => [r.teamCode, r._count._all]),
  );
  const totalMap = new Map<string, number>(
    totalByTeam
      .filter((r): r is typeof r & { teamCode: string } => r.teamCode !== null)
      .map((r) => [r.teamCode, r._count._all]),
  );

  const gamesByTeam = new Map<string, number>();
  if (opts.seasonId) {
    const [home, away] = (await Promise.all([
      prisma.nflGame.groupBy({
        by: ["homeTeam"],
        _count: { _all: true },
        where: { seasonId: opts.seasonId },
      }),
      prisma.nflGame.groupBy({
        by: ["awayTeam"],
        _count: { _all: true },
        where: { seasonId: opts.seasonId },
      }),
    ])) as [
      Array<{ homeTeam: string; _count: { _all: number } }>,
      Array<{ awayTeam: string; _count: { _all: number } }>,
    ];
    for (const r of home) {
      gamesByTeam.set(
        r.homeTeam,
        (gamesByTeam.get(r.homeTeam) ?? 0) + r._count._all,
      );
    }
    for (const r of away) {
      gamesByTeam.set(
        r.awayTeam,
        (gamesByTeam.get(r.awayTeam) ?? 0) + r._count._all,
      );
    }
  }

  return teams.map((t: NflTeam) => ({
    code: t.code,
    city: t.city,
    bbRace: t.bbRace,
    raceLabel: t.raceLabel,
    activePlayers: activeMap.get(t.code) ?? 0,
    totalPlayers: totalMap.get(t.code) ?? 0,
    gamesInSeason: gamesByTeam.get(t.code) ?? 0,
  }));
}

export interface AdminTeamPlayerRow {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
}

export interface AdminTeamGameRow {
  readonly id: string;
  readonly weekId: string;
  readonly opponent: string;
  readonly isHome: boolean;
  readonly kickoffAt: string;
  readonly status: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

export interface AdminTeamDetail extends AdminTeamRow {
  readonly players: ReadonlyArray<AdminTeamPlayerRow>;
  readonly games: ReadonlyArray<AdminTeamGameRow>;
}

interface TeamDetailGameSelect {
  readonly id: string;
  readonly weekId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly kickoffAt: Date;
  readonly status: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

/**
 * Detail d'une equipe : metadata + roster (groupe par status) + games
 * programmes/joues sur la saison filtree.
 */
export async function getNflTeamDetail(opts: {
  code: string;
  seasonId?: string;
}): Promise<AdminTeamDetail | null> {
  const team = await prisma.nflTeam.findUnique({ where: { code: opts.code } });
  if (!team) return null;

  const players = await prisma.nflPlayer.findMany({
    where: { teamCode: opts.code },
    orderBy: [
      { status: "asc" },
      { bbPosition: "asc" },
      { jerseyNumber: "asc" },
      { pseudonym: "asc" },
    ],
    select: {
      id: true,
      pseudonym: true,
      realName: true,
      realNameDisplay: true,
      jerseyNumber: true,
      nflPosition: true,
      bbPosition: true,
      status: true,
    },
  });

  const games = await prisma.nflGame.findMany({
    where: {
      OR: [{ homeTeam: opts.code }, { awayTeam: opts.code }],
      ...(opts.seasonId ? { seasonId: opts.seasonId } : {}),
    },
    orderBy: { kickoffAt: "asc" },
    select: {
      id: true,
      weekId: true,
      homeTeam: true,
      awayTeam: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
    },
  });

  return {
    code: team.code,
    city: team.city,
    bbRace: team.bbRace,
    raceLabel: team.raceLabel,
    activePlayers: players.filter(
      (p: AdminTeamPlayerRow) => p.status === "active",
    ).length,
    totalPlayers: players.length,
    gamesInSeason: games.length,
    players,
    games: games.map((g: TeamDetailGameSelect) => ({
      id: g.id,
      weekId: g.weekId,
      opponent: g.homeTeam === opts.code ? g.awayTeam : g.homeTeam,
      isHome: g.homeTeam === opts.code,
      kickoffAt: g.kickoffAt.toISOString(),
      status: g.status,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Players
// ────────────────────────────────────────────────────────────────────

export interface ListPlayersOpts {
  readonly teamCode?: string;
  readonly bbPosition?: string;
  readonly nflPosition?: string;
  readonly status?: string;
  readonly search?: string;
  readonly seasonId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface AdminPlayerRow {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly teamCode: string | null;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
  /** Optionnel — present uniquement si seasonId filtre. */
  readonly totalSpp?: number;
  readonly gamesPlayed?: number;
}

export interface ListPlayersResult {
  readonly players: ReadonlyArray<AdminPlayerRow>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

/**
 * Liste paginee + filtree des NflPlayer. Tri stable par teamCode,
 * bbPosition, pseudonym (deterministe pour les tests). Si `seasonId`
 * filtre, ajoute totalSpp + gamesPlayed agreges sur la saison.
 */
export async function listNflPlayersForAdmin(
  opts: ListPlayersOpts,
): Promise<ListPlayersResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const where: Prisma.NflPlayerWhereInput = {
    ...(opts.teamCode ? { teamCode: opts.teamCode } : {}),
    ...(opts.bbPosition ? { bbPosition: opts.bbPosition } : {}),
    ...(opts.nflPosition ? { nflPosition: opts.nflPosition } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { pseudonym: { contains: opts.search, mode: "insensitive" } },
            { realName: { contains: opts.search, mode: "insensitive" } },
            { id: { contains: opts.search } },
          ],
        }
      : {}),
    ...(opts.seasonId
      ? { gameStats: { some: { game: { seasonId: opts.seasonId } } } }
      : {}),
  };

  const [total, players] = await Promise.all([
    prisma.nflPlayer.count({ where }),
    prisma.nflPlayer.findMany({
      where,
      orderBy: [
        { teamCode: "asc" },
        { bbPosition: "asc" },
        { pseudonym: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        pseudonym: true,
        realName: true,
        realNameDisplay: true,
        teamCode: true,
        jerseyNumber: true,
        nflPosition: true,
        bbPosition: true,
        status: true,
      },
    }),
  ]);

  type PlayerSummary = Pick<
    NflPlayer,
    | "id"
    | "pseudonym"
    | "realName"
    | "realNameDisplay"
    | "teamCode"
    | "jerseyNumber"
    | "nflPosition"
    | "bbPosition"
    | "status"
  >;
  type StatPlayerSpp = Pick<NflGameStat, "playerId" | "computedSpp">;

  let sppByPlayer = new Map<string, { total: number; games: number }>();
  if (opts.seasonId && players.length > 0) {
    const playerIds = (players as PlayerSummary[]).map((p) => p.id);
    const stats = (await prisma.nflGameStat.findMany({
      where: {
        playerId: { in: playerIds },
        game: { seasonId: opts.seasonId },
      },
      select: { playerId: true, computedSpp: true },
    })) as StatPlayerSpp[];
    for (const s of stats) {
      const cur = sppByPlayer.get(s.playerId) ?? { total: 0, games: 0 };
      cur.total += s.computedSpp ?? 0;
      cur.games += 1;
      sppByPlayer.set(s.playerId, cur);
    }
  }

  return {
    total: total as number,
    page,
    pageSize,
    players: (players as PlayerSummary[]).map((p) => ({
      id: p.id,
      pseudonym: p.pseudonym,
      realName: p.realName,
      realNameDisplay: p.realNameDisplay,
      teamCode: p.teamCode,
      jerseyNumber: p.jerseyNumber,
      nflPosition: p.nflPosition,
      bbPosition: p.bbPosition,
      status: p.status,
      ...(opts.seasonId
        ? {
            totalSpp: sppByPlayer.get(p.id)?.total ?? 0,
            gamesPlayed: sppByPlayer.get(p.id)?.games ?? 0,
          }
        : {}),
    })),
  };
}

export interface AdminPlayerStatRow {
  readonly gameId: string;
  readonly weekId: string;
  readonly weekNumber: number;
  readonly seasonId: string;
  readonly opponent: string;
  readonly isHome: boolean;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly gameStatus: string;
  readonly computedSpp: number | null;
  readonly sppBreakdown: unknown;
  readonly rawStats: unknown;
  readonly ingestSource: string;
  readonly ingestedAt: string;
}

export interface AdminPlayerBio {
  readonly heightInches: number | null;
  readonly weightLbs: number | null;
  readonly birthDate: string | null;
  /** Age en annees au moment du fetch. null si birthDate inconnu. */
  readonly ageYears: number | null;
  readonly college: string | null;
  readonly headshotUrl: string | null;
  readonly draftYear: number | null;
  readonly draftRound: number | null;
  readonly draftPick: number | null;
  readonly draftClub: string | null;
  readonly rookieYear: number | null;
  readonly yearsExp: number | null;
}

export interface PassingStats {
  readonly completions: number;
  readonly attempts: number;
  readonly passingYards: number;
  readonly passingTds: number;
  readonly interceptions: number;
  readonly sacks: number;
}

export interface RushingStats {
  readonly carries: number;
  readonly rushingYards: number;
  readonly rushingTds: number;
  readonly rushingFumblesLost: number;
}

export interface ReceivingStats {
  readonly targets: number;
  readonly receptions: number;
  readonly receivingYards: number;
  readonly receivingTds: number;
  readonly receivingFumblesLost: number;
}

export interface DefenseStats {
  readonly tacklesSolo: number;
  readonly tackleAssists: number;
  readonly sacks: number;
  readonly interceptions: number;
  readonly fumblesForced: number;
  readonly fumblesRecovered: number;
  readonly defTds: number;
  readonly passesDefended: number;
}

export interface AdminPlayerCategoryStats {
  readonly passing: PassingStats;
  readonly rushing: RushingStats;
  readonly receiving: ReceivingStats;
  readonly defense: DefenseStats;
}

export interface AdminPlayerSeasonAggregate {
  readonly seasonId: string;
  readonly gamesPlayed: number;
  readonly totalSpp: number;
  readonly categoryStats: AdminPlayerCategoryStats;
}

export interface AdminPlayerDetail {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly teamCode: string | null;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
  readonly retiredAt: string | null;
  readonly bbStats: unknown;
  readonly bbSkills: unknown;
  readonly bio: AdminPlayerBio;
  readonly team: {
    readonly code: string;
    readonly city: string;
    readonly raceLabel: string;
    readonly bbRace: string;
  } | null;
  readonly totalSpp: number;
  readonly gamesPlayed: number;
  /**
   * Totaux agreges par categorie sur la fenetre filtree (seasonId si
   * fourni, sinon carriere complete).
   */
  readonly categoryStats: AdminPlayerCategoryStats;
  /**
   * Aggregats par saison (DESC) pour le tableau "Career". Toujours
   * retourne meme si seasonId est filtre — permet d'afficher l'onglet
   * Career sans round-trip.
   */
  readonly seasons: ReadonlyArray<AdminPlayerSeasonAggregate>;
  readonly stats: ReadonlyArray<AdminPlayerStatRow>;
}

// ────────────────────────────────────────────────────────────────────
// Pure helpers stats (Phase 5.C)
// ────────────────────────────────────────────────────────────────────

function toNum(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Aggrege une liste de rawStats nflverse en totaux par categorie.
 * Tolerant : null/undefined/colonnes manquantes → 0.
 *
 * Pure, deterministe.
 */
export function aggregateCategoryStats(
  rawStatsList: ReadonlyArray<unknown>,
): AdminPlayerCategoryStats {
  const passing: PassingStats = {
    completions: 0,
    attempts: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    sacks: 0,
  };
  const rushing: RushingStats = {
    carries: 0,
    rushingYards: 0,
    rushingTds: 0,
    rushingFumblesLost: 0,
  };
  const receiving: ReceivingStats = {
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    receivingFumblesLost: 0,
  };
  const defense: DefenseStats = {
    tacklesSolo: 0,
    tackleAssists: 0,
    sacks: 0,
    interceptions: 0,
    fumblesForced: 0,
    fumblesRecovered: 0,
    defTds: 0,
    passesDefended: 0,
  };

  // Use mutable accumulators internally, freeze at end.
  const p = passing as unknown as Record<keyof PassingStats, number>;
  const ru = rushing as unknown as Record<keyof RushingStats, number>;
  const rc = receiving as unknown as Record<keyof ReceivingStats, number>;
  const d = defense as unknown as Record<keyof DefenseStats, number>;

  for (const raw of rawStatsList) {
    let row: Record<string, unknown> | null = null;
    if (raw && typeof raw === "object") row = raw as Record<string, unknown>;
    else if (typeof raw === "string") {
      try {
        row = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        row = null;
      }
    }
    if (!row) continue;

    p.completions += toNum(row.completions);
    p.attempts += toNum(row.attempts);
    p.passingYards += toNum(row.passing_yards);
    p.passingTds += toNum(row.passing_tds);
    p.interceptions += toNum(row.passing_interceptions ?? row.interceptions);
    p.sacks += toNum(row.sacks);

    ru.carries += toNum(row.carries);
    ru.rushingYards += toNum(row.rushing_yards);
    ru.rushingTds += toNum(row.rushing_tds);
    ru.rushingFumblesLost += toNum(row.rushing_fumbles_lost);

    rc.targets += toNum(row.targets);
    rc.receptions += toNum(row.receptions);
    rc.receivingYards += toNum(row.receiving_yards);
    rc.receivingTds += toNum(row.receiving_tds);
    rc.receivingFumblesLost += toNum(row.receiving_fumbles_lost);

    d.tacklesSolo += toNum(row.tackles_solo ?? row.def_tackles_solo);
    d.tackleAssists += toNum(row.tackle_assists ?? row.def_tackle_assists);
    d.sacks += toNum(row.def_sacks);
    d.interceptions += toNum(row.def_interceptions);
    d.fumblesForced += toNum(row.def_fumbles_forced);
    d.fumblesRecovered += toNum(
      row.def_fumble_recovery_opp ?? row.def_fumbles_recovered,
    );
    d.defTds += toNum(row.def_tds);
    d.passesDefended += toNum(row.def_pass_defended ?? row.def_pds);
  }

  return { passing, rushing, receiving, defense };
}

/**
 * Detail d'un joueur : identite, mapping NFL→BB, equipe courante, et
 * historique de NflGameStat (filtrable par saison, trie DESC par
 * kickoff).
 */
export async function getNflPlayerDetail(opts: {
  id: string;
  seasonId?: string;
}): Promise<AdminPlayerDetail | null> {
  const player = (await prisma.nflPlayer.findUnique({
    where: { id: opts.id },
  })) as NflPlayer | null;
  if (!player) return null;

  const team = (player.teamCode
    ? await prisma.nflTeam.findUnique({ where: { code: player.teamCode } })
    : null) as NflTeam | null;

  type StatWithGame = NflGameStat & {
    game: {
      readonly weekId: string;
      readonly seasonId: string;
      readonly homeTeam: string;
      readonly awayTeam: string;
      readonly homeScore: number | null;
      readonly awayScore: number | null;
      readonly status: string;
      readonly kickoffAt: Date;
      readonly week: { readonly weekNumber: number };
    };
  };

  const stats = (await prisma.nflGameStat.findMany({
    where: {
      playerId: opts.id,
      ...(opts.seasonId ? { game: { seasonId: opts.seasonId } } : {}),
    },
    include: { game: { include: { week: true } } },
    orderBy: { game: { kickoffAt: "desc" } },
  })) as StatWithGame[];

  const totalSpp = stats.reduce(
    (acc: number, s: StatWithGame) => acc + (s.computedSpp ?? 0),
    0,
  );

  const categoryStats = aggregateCategoryStats(
    stats.map((s) => s.rawStats as unknown),
  );

  // Charge TOUTES les stats (sans filtre seasonId) pour produire le
  // tableau "Career" — peu importe le seasonId courant.
  type StatBySeason = { seasonId: string; computedSpp: number | null; rawStats: unknown };
  const allSeasonStats = (await prisma.nflGameStat.findMany({
    where: { playerId: opts.id },
    select: {
      computedSpp: true,
      rawStats: true,
      game: { select: { seasonId: true } },
    },
  })) as Array<{
    computedSpp: number | null;
    rawStats: unknown;
    game: { seasonId: string };
  }>;
  const bySeason = new Map<string, StatBySeason[]>();
  for (const s of allSeasonStats) {
    const sid = s.game.seasonId;
    const arr = bySeason.get(sid) ?? [];
    arr.push({
      seasonId: sid,
      computedSpp: s.computedSpp,
      rawStats: s.rawStats,
    });
    bySeason.set(sid, arr);
  }
  const seasons: AdminPlayerSeasonAggregate[] = Array.from(bySeason.entries())
    .map(([seasonId, list]) => ({
      seasonId,
      gamesPlayed: list.length,
      totalSpp: list.reduce((acc, s) => acc + (s.computedSpp ?? 0), 0),
      categoryStats: aggregateCategoryStats(list.map((l) => l.rawStats)),
    }))
    .sort((a, b) => (a.seasonId < b.seasonId ? 1 : -1));

  const birthDate = player.birthDate ? new Date(player.birthDate) : null;
  const ageYears = birthDate
    ? Math.floor(
        (Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000),
      )
    : null;

  return {
    id: player.id,
    pseudonym: player.pseudonym,
    realName: player.realName,
    realNameDisplay: player.realNameDisplay,
    teamCode: player.teamCode,
    jerseyNumber: player.jerseyNumber,
    nflPosition: player.nflPosition,
    bbPosition: player.bbPosition,
    status: player.status,
    retiredAt: player.retiredAt ? player.retiredAt.toISOString() : null,
    bbStats: player.bbStats,
    bbSkills: player.bbSkills,
    bio: {
      heightInches: player.heightInches,
      weightLbs: player.weightLbs,
      birthDate: player.birthDate ? player.birthDate.toISOString() : null,
      ageYears,
      college: player.college,
      headshotUrl: player.headshotUrl,
      draftYear: player.draftYear,
      draftRound: player.draftRound,
      draftPick: player.draftPick,
      draftClub: player.draftClub,
      rookieYear: player.rookieYear,
      yearsExp: player.yearsExp,
    },
    team: team
      ? {
          code: team.code,
          city: team.city,
          raceLabel: team.raceLabel,
          bbRace: team.bbRace,
        }
      : null,
    totalSpp,
    gamesPlayed: stats.length,
    categoryStats,
    seasons,
    stats: stats.map((s) => ({
      gameId: s.gameId,
      weekId: s.game.weekId,
      weekNumber: s.game.week.weekNumber,
      seasonId: s.game.seasonId,
      opponent:
        s.game.homeTeam === player.teamCode ? s.game.awayTeam : s.game.homeTeam,
      isHome: s.game.homeTeam === player.teamCode,
      homeScore: s.game.homeScore,
      awayScore: s.game.awayScore,
      gameStatus: s.game.status,
      computedSpp: s.computedSpp,
      sppBreakdown: s.sppBreakdown,
      rawStats: s.rawStats,
      ingestSource: s.ingestSource,
      ingestedAt: s.ingestedAt.toISOString(),
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Resync actions (idempotents)
// ────────────────────────────────────────────────────────────────────

export interface RecomputeSppResult {
  readonly playerId: string;
  readonly statsUpdated: number;
  readonly previousTotalSpp: number;
  readonly newTotalSpp: number;
}

/**
 * Relance computeSpp() sur tous les NflGameStat du joueur a partir des
 * rawStats stockes. Idempotent (meme rawStats → meme SPP). Util quand
 * la formule SPP a evolue.
 */
export async function recomputePlayerSpp(
  playerId: string,
): Promise<RecomputeSppResult> {
  const player = (await prisma.nflPlayer.findUnique({
    where: { id: playerId },
  })) as NflPlayer | null;
  if (!player) {
    throw new NflFantasyAdminError(
      "PLAYER_NOT_FOUND",
      `NflPlayer ${playerId} introuvable`,
    );
  }

  const stats = (await prisma.nflGameStat.findMany({
    where: { playerId },
  })) as NflGameStat[];

  let previous = 0;
  let next = 0;
  let updated = 0;

  for (const s of stats) {
    previous += s.computedSpp ?? 0;
    const row = (s.rawStats ?? {}) as NflverseRow;
    const statLine: NflPlayerStatLine = buildStatLineFromRow(
      row,
      player.bbPosition as NflPlayerStatLine["bbPosition"],
    );
    const breakdown = computeSpp(statLine);
    await prisma.nflGameStat.update({
      where: { id: s.id },
      data: {
        computedSpp: breakdown.totalSpp,
        sppBreakdown: { events: breakdown.events, totalSpp: breakdown.totalSpp },
      },
    });
    next += breakdown.totalSpp;
    updated++;
  }

  return {
    playerId,
    statsUpdated: updated,
    previousTotalSpp: previous,
    newTotalSpp: next,
  };
}

export interface ReDeriveBbResult {
  readonly playerId: string;
  readonly previousBbPosition: string;
  readonly newBbPosition: string;
  readonly changed: boolean;
}

/**
 * Recalcule `bbPosition` via getBbPosition(nflPosition, teamRace).
 * Idempotent. Echec si le joueur n'a pas d'equipe (FA ou retired sans
 * teamCode) — on ne peut pas determiner la race sans equipe.
 */
export async function reDerivePlayerBb(
  playerId: string,
): Promise<ReDeriveBbResult> {
  const player = (await prisma.nflPlayer.findUnique({
    where: { id: playerId },
  })) as NflPlayer | null;
  if (!player) {
    throw new NflFantasyAdminError(
      "PLAYER_NOT_FOUND",
      `NflPlayer ${playerId} introuvable`,
    );
  }
  if (!player.teamCode) {
    throw new NflFantasyAdminError(
      "PLAYER_NO_TEAM",
      `NflPlayer ${playerId} sans teamCode — race BB indeterminable`,
    );
  }

  const team = (await prisma.nflTeam.findUnique({
    where: { code: player.teamCode },
  })) as NflTeam | null;
  if (!team) {
    throw new NflFantasyAdminError(
      "TEAM_NOT_FOUND",
      `NflTeam ${player.teamCode} introuvable`,
    );
  }

  const newBb = getBbPosition(player.nflPosition, team.bbRace as BbRace);
  const changed = newBb !== player.bbPosition;

  if (changed) {
    await prisma.nflPlayer.update({
      where: { id: playerId },
      data: { bbPosition: newBb },
    });
  }

  return {
    playerId,
    previousBbPosition: player.bbPosition,
    newBbPosition: newBb,
    changed,
  };
}

// ────────────────────────────────────────────────────────────────────
// Ingest runs (Phase 3.D — audit log)
// ────────────────────────────────────────────────────────────────────

export interface AdminIngestRunRow {
  readonly id: string;
  readonly source: string;
  readonly weekId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: string;
  readonly durationMs: number | null;
  readonly result: unknown;
}

export interface ListIngestRunsOpts {
  readonly source?: string;
  readonly status?: string;
  readonly weekId?: string;
  readonly limit?: number;
}

const MAX_INGEST_RUNS_LIMIT = 500;
const DEFAULT_INGEST_RUNS_LIMIT = 100;

/**
 * Liste les derniers `NflIngestRun` tries DESC par startedAt. Filtres
 * optionnels par source (nflverse/espn) et/ou status (success/partial/
 * failed/in_progress).
 */
export async function listNflIngestRunsForAdmin(
  opts: ListIngestRunsOpts,
): Promise<AdminIngestRunRow[]> {
  const limit = Math.min(
    MAX_INGEST_RUNS_LIMIT,
    Math.max(1, opts.limit ?? DEFAULT_INGEST_RUNS_LIMIT),
  );

  const where: Prisma.NflIngestRunWhereInput = {
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.weekId ? { weekId: opts.weekId } : {}),
  };

  const runs = (await prisma.nflIngestRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
  })) as NflIngestRun[];

  return runs.map((r) => ({
    id: r.id,
    source: r.source,
    weekId: r.weekId,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    status: r.status,
    durationMs: r.completedAt
      ? r.completedAt.getTime() - r.startedAt.getTime()
      : null,
    result: r.result,
  }));
}

/** Detail d'une NflIngestRun. Retourne null si introuvable. */
export async function getNflIngestRunForAdmin(
  id: string,
): Promise<AdminIngestRunRow | null> {
  const r = (await prisma.nflIngestRun.findUnique({
    where: { id },
  })) as NflIngestRun | null;
  if (!r) return null;
  return {
    id: r.id,
    source: r.source,
    weekId: r.weekId,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    status: r.status,
    durationMs: r.completedAt
      ? r.completedAt.getTime() - r.startedAt.getTime()
      : null,
    result: r.result,
  };
}

// ────────────────────────────────────────────────────────────────────
// Weeks + games (Phase 3.D — calendrier)
// ────────────────────────────────────────────────────────────────────

export interface AdminWeekRow {
  readonly id: string;
  readonly seasonId: string;
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPlayoffs: boolean;
  readonly gamesCount: number;
  readonly gamesFinal: number;
  readonly ingestStatus: string | null;
}

/**
 * Liste les 22 weeks d'une saison avec compteurs games + statut de la
 * derniere ingestion nflverse (success/partial/failed/in_progress/null).
 */
export async function listWeeksForSeason(
  seasonId: string,
): Promise<AdminWeekRow[]> {
  const weeks = (await prisma.nflWeek.findMany({
    where: { seasonId },
    orderBy: { weekNumber: "asc" },
  })) as NflWeek[];
  if (weeks.length === 0) return [];

  const weekIds = weeks.map((w) => w.id);

  const [allGames, finalGames, runs] = (await Promise.all([
    prisma.nflGame.groupBy({
      by: ["weekId"],
      _count: { _all: true },
      where: { weekId: { in: weekIds } },
    }),
    prisma.nflGame.groupBy({
      by: ["weekId"],
      _count: { _all: true },
      where: { weekId: { in: weekIds }, status: "final" },
    }),
    prisma.nflIngestRun.findMany({
      where: {
        source: "nflverse",
        weekId: { in: weekIds },
      },
      orderBy: { startedAt: "desc" },
    }),
  ])) as [
    Array<{ weekId: string; _count: { _all: number } }>,
    Array<{ weekId: string; _count: { _all: number } }>,
    NflIngestRun[],
  ];

  const allMap = new Map(allGames.map((g) => [g.weekId, g._count._all]));
  const finalMap = new Map(finalGames.map((g) => [g.weekId, g._count._all]));
  const lastRunByWeek = new Map<string, NflIngestRun>();
  for (const r of runs) {
    if (r.weekId && !lastRunByWeek.has(r.weekId)) {
      lastRunByWeek.set(r.weekId, r);
    }
  }

  return weeks.map((w) => ({
    id: w.id,
    seasonId: w.seasonId,
    weekNumber: w.weekNumber,
    startDate: w.startDate.toISOString(),
    endDate: w.endDate.toISOString(),
    isPlayoffs: w.isPlayoffs,
    gamesCount: allMap.get(w.id) ?? 0,
    gamesFinal: finalMap.get(w.id) ?? 0,
    ingestStatus: lastRunByWeek.get(w.id)?.status ?? null,
  }));
}

export interface AdminWeekGameRow {
  readonly id: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly status: string;
  readonly kickoffAt: string;
  readonly statsCount: number;
}

export interface AdminWeekDetail extends AdminWeekRow {
  readonly games: ReadonlyArray<AdminWeekGameRow>;
}

/**
 * Detail d'une week : metadata + games + compteur de stat lines par game.
 */
export async function getWeekDetail(
  weekId: string,
): Promise<AdminWeekDetail | null> {
  const week = (await prisma.nflWeek.findUnique({
    where: { id: weekId },
  })) as NflWeek | null;
  if (!week) return null;

  const games = (await prisma.nflGame.findMany({
    where: { weekId },
    orderBy: { kickoffAt: "asc" },
  })) as NflGame[];

  const gameIds = games.map((g) => g.id);
  const statCounts =
    gameIds.length > 0
      ? ((await prisma.nflGameStat.groupBy({
          by: ["gameId"],
          _count: { _all: true },
          where: { gameId: { in: gameIds } },
        })) as Array<{ gameId: string; _count: { _all: number } }>)
      : [];
  const statsMap = new Map(statCounts.map((s) => [s.gameId, s._count._all]));

  const lastRun = (await prisma.nflIngestRun.findFirst({
    where: { source: "nflverse", weekId },
    orderBy: { startedAt: "desc" },
  })) as NflIngestRun | null;

  return {
    id: week.id,
    seasonId: week.seasonId,
    weekNumber: week.weekNumber,
    startDate: week.startDate.toISOString(),
    endDate: week.endDate.toISOString(),
    isPlayoffs: week.isPlayoffs,
    gamesCount: games.length,
    gamesFinal: games.filter((g) => g.status === "final").length,
    ingestStatus: lastRun?.status ?? null,
    games: games.map((g) => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: g.status,
      kickoffAt: g.kickoffAt.toISOString(),
      statsCount: statsMap.get(g.id) ?? 0,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Leagues globales (Phase 3.D — admin overview)
// ────────────────────────────────────────────────────────────────────

export interface AdminLeagueRow {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly seasonId: string;
  readonly size: number;
  readonly type: string;
  readonly draftMode: string;
  readonly status: string;
  readonly inviteCode: string | null;
  readonly entriesCount: number;
  readonly matchupsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListLeaguesAdminOpts {
  readonly status?: string;
  readonly type?: string;
  readonly seasonId?: string;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListLeaguesAdminResult {
  readonly leagues: ReadonlyArray<AdminLeagueRow>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

const DEFAULT_LEAGUES_PAGE_SIZE = 50;
const MAX_LEAGUES_PAGE_SIZE = 200;

/**
 * Liste toutes les NflFantasyLeague (admin only). Pagine + filtree.
 * Trie DESC par createdAt.
 */
export async function listAllLeaguesForAdmin(
  opts: ListLeaguesAdminOpts,
): Promise<ListLeaguesAdminResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(
    MAX_LEAGUES_PAGE_SIZE,
    Math.max(1, opts.pageSize ?? DEFAULT_LEAGUES_PAGE_SIZE),
  );

  const where: Prisma.NflFantasyLeagueWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.seasonId ? { seasonId: opts.seasonId } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" } },
            { id: { contains: opts.search } },
            { ownerId: { contains: opts.search } },
            { inviteCode: { contains: opts.search.toUpperCase() } },
          ],
        }
      : {}),
  };

  const [total, leagues] = await Promise.all([
    prisma.nflFantasyLeague.count({ where }) as Promise<number>,
    prisma.nflFantasyLeague.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }) as Promise<NflFantasyLeague[]>,
  ]);

  if (leagues.length === 0) {
    return { total, page, pageSize, leagues: [] };
  }

  const leagueIds = leagues.map((l) => l.id);
  const [entries, matchups] = (await Promise.all([
    prisma.nflFantasyEntry.groupBy({
      by: ["leagueId"],
      _count: { _all: true },
      where: { leagueId: { in: leagueIds } },
    }),
    prisma.nflFantasyMatchup.groupBy({
      by: ["leagueId"],
      _count: { _all: true },
      where: { leagueId: { in: leagueIds } },
    }),
  ])) as [
    Array<{ leagueId: string; _count: { _all: number } }>,
    Array<{ leagueId: string; _count: { _all: number } }>,
  ];

  const entriesMap = new Map(entries.map((e) => [e.leagueId, e._count._all]));
  const matchupsMap = new Map(
    matchups.map((m) => [m.leagueId, m._count._all]),
  );

  return {
    total,
    page,
    pageSize,
    leagues: leagues.map((l) => ({
      id: l.id,
      name: l.name,
      ownerId: l.ownerId,
      seasonId: l.seasonId,
      size: l.size,
      type: l.type,
      draftMode: l.draftMode,
      status: l.status,
      inviteCode: l.inviteCode,
      entriesCount: entriesMap.get(l.id) ?? 0,
      matchupsCount: matchupsMap.get(l.id) ?? 0,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
  };
}

export interface AdminLeagueEntryRow {
  readonly id: string;
  readonly userId: string;
  readonly teamName: string;
  readonly bbRace: string | null;
  readonly totalTV: number;
  readonly joinedAt: string;
}

export interface AdminLeagueMatchupRow {
  readonly id: string;
  readonly weekId: string;
  readonly homeEntryId: string;
  readonly awayEntryId: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly winnerId: string | null;
  readonly settledAt: string | null;
}

export interface AdminLeagueDetail extends AdminLeagueRow {
  readonly entries: ReadonlyArray<AdminLeagueEntryRow>;
  readonly matchups: ReadonlyArray<AdminLeagueMatchupRow>;
}

/** Detail admin d'une league : metadata + entries + matchups. */
export async function getLeagueDetailForAdmin(
  leagueId: string,
): Promise<AdminLeagueDetail | null> {
  const league = (await prisma.nflFantasyLeague.findUnique({
    where: { id: leagueId },
  })) as NflFantasyLeague | null;
  if (!league) return null;

  const [entries, matchups] = (await Promise.all([
    prisma.nflFantasyEntry.findMany({
      where: { leagueId },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.nflFantasyMatchup.findMany({
      where: { leagueId },
      orderBy: [{ weekId: "asc" }, { homeEntryId: "asc" }],
    }),
  ])) as [
    NflFantasyEntry[],
    Array<{
      id: string;
      weekId: string;
      homeEntryId: string;
      awayEntryId: string;
      homeScore: number | null;
      awayScore: number | null;
      winnerId: string | null;
      settledAt: Date | null;
    }>,
  ];

  return {
    id: league.id,
    name: league.name,
    ownerId: league.ownerId,
    seasonId: league.seasonId,
    size: league.size,
    type: league.type,
    draftMode: league.draftMode,
    status: league.status,
    inviteCode: league.inviteCode,
    entriesCount: entries.length,
    matchupsCount: matchups.length,
    createdAt: league.createdAt.toISOString(),
    updatedAt: league.updatedAt.toISOString(),
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      teamName: e.teamName,
      bbRace: e.bbRace,
      totalTV: e.totalTV,
      joinedAt: e.joinedAt.toISOString(),
    })),
    matchups: matchups.map((m) => ({
      id: m.id,
      weekId: m.weekId,
      homeEntryId: m.homeEntryId,
      awayEntryId: m.awayEntryId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winnerId: m.winnerId,
      settledAt: m.settledAt ? m.settledAt.toISOString() : null,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Bulk recompute SPP / re-derive BB (Phase 3.F)
// ────────────────────────────────────────────────────────────────────

export interface RecomputeSeasonSppResult {
  readonly seasonId: string;
  readonly statsUpdated: number;
  readonly previousTotalSpp: number;
  readonly newTotalSpp: number;
  readonly errors: ReadonlyArray<{ statId: string; error: string }>;
}

/**
 * Relance computeSpp() sur tous les NflGameStat d'une saison. Pour
 * chaque stat : reconstruit la NflPlayerStatLine via buildStatLineFromRow
 * + bbPosition courant du joueur, appelle computeSpp, persiste
 * computedSpp + sppBreakdown.
 *
 * Idempotent (meme rawStats → meme SPP). Util quand la formule
 * `@bb/nfl-mapper computeSpp` evolue : un seul appel re-applique partout.
 *
 * NOTE : bloquant et long. Pour 2024 (~19k stats), compter ~30-60s.
 * Pas de progress streaming en V1 — l'admin attend la reponse.
 */
export async function recomputeSeasonSpp(
  seasonId: string,
): Promise<RecomputeSeasonSppResult> {
  const season = (await prisma.nflSeason.findUnique({
    where: { id: seasonId },
  })) as NflSeason | null;
  if (!season) {
    throw new NflFantasyAdminError(
      "SEASON_NOT_FOUND",
      `NflSeason ${seasonId} introuvable`,
    );
  }

  type StatWithPlayer = NflGameStat & {
    player: { bbPosition: string };
  };

  const stats = (await prisma.nflGameStat.findMany({
    where: { game: { seasonId } },
    include: { player: { select: { bbPosition: true } } },
  })) as StatWithPlayer[];

  let previous = 0;
  let next = 0;
  let updated = 0;
  const errors: Array<{ statId: string; error: string }> = [];

  for (const s of stats) {
    try {
      previous += s.computedSpp ?? 0;
      const row = (s.rawStats ?? {}) as NflverseRow;
      const statLine: NflPlayerStatLine = buildStatLineFromRow(
        row,
        s.player.bbPosition as NflPlayerStatLine["bbPosition"],
      );
      const breakdown = computeSpp(statLine);
      await prisma.nflGameStat.update({
        where: { id: s.id },
        data: {
          computedSpp: breakdown.totalSpp,
          sppBreakdown: { events: breakdown.events, totalSpp: breakdown.totalSpp },
        },
      });
      next += breakdown.totalSpp;
      updated++;
    } catch (e) {
      errors.push({ statId: s.id, error: (e as Error).message });
    }
  }

  return {
    seasonId,
    statsUpdated: updated,
    previousTotalSpp: previous,
    newTotalSpp: next,
    errors,
  };
}

// ────────────────────────────────────────────────────────────────────
// Detail matchup individuel (Phase 3.J)
// ────────────────────────────────────────────────────────────────────

export interface AdminMatchupStarterRow {
  readonly playerId: string;
  readonly playerPseudonym: string;
  readonly teamCode: string | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
  readonly rawSpp: number | null;
  readonly finalSpp: number | null;
  readonly sppBreakdown: unknown;
}

export interface AdminMatchupSideRow {
  readonly entryId: string;
  readonly userId: string;
  readonly teamName: string;
  readonly bbRace: string | null;
  readonly score: number | null;
  readonly lineupId: string | null;
  readonly captainPlayerId: string | null;
  readonly viceCaptainPlayerId: string | null;
  readonly lineupLockedAt: string | null;
  readonly lineupTotalSpp: number | null;
  readonly starters: ReadonlyArray<AdminMatchupStarterRow>;
}

export interface AdminMatchupGazette {
  readonly title: string;
  readonly body: string;
  readonly generatedAt: string;
}

export interface AdminMatchupDetail {
  readonly id: string;
  readonly leagueId: string;
  readonly leagueName: string;
  readonly seasonId: string;
  readonly weekId: string;
  readonly home: AdminMatchupSideRow;
  readonly away: AdminMatchupSideRow;
  readonly winnerEntryId: string | null;
  readonly winnerSide: "home" | "away" | "tie" | null;
  readonly settledAt: string | null;
  readonly createdAt: string;
  readonly gazette: AdminMatchupGazette | null;
}

/**
 * Detail admin d'un matchup : metadata + les 2 entries + leur lineup
 * + starters (avec finalSpp / rawSpp / breakdown) + infos joueurs.
 *
 * Retourne null si matchup introuvable.
 */
export async function getMatchupDetailForAdmin(
  matchupId: string,
): Promise<AdminMatchupDetail | null> {
  type MatchupRow = {
    id: string;
    leagueId: string;
    weekId: string;
    homeEntryId: string;
    awayEntryId: string;
    homeScore: number | null;
    awayScore: number | null;
    winnerId: string | null;
    settledAt: Date | null;
    createdAt: Date;
    gazetteTitle: string | null;
    gazetteBody: string | null;
    gazetteGeneratedAt: Date | null;
  };

  const matchup = (await prisma.nflFantasyMatchup.findUnique({
    where: { id: matchupId },
  })) as MatchupRow | null;
  if (!matchup) return null;

  const league = (await prisma.nflFantasyLeague.findUnique({
    where: { id: matchup.leagueId },
    select: { id: true, name: true, seasonId: true },
  })) as { id: string; name: string; seasonId: string } | null;
  if (!league) return null;

  const entries = (await prisma.nflFantasyEntry.findMany({
    where: { id: { in: [matchup.homeEntryId, matchup.awayEntryId] } },
  })) as NflFantasyEntry[];
  const entryById = new Map<string, NflFantasyEntry>();
  for (const e of entries) entryById.set(e.id, e);

  type LineupRow = {
    id: string;
    entryId: string;
    weekId: string;
    captainId: string | null;
    viceCaptainId: string | null;
    lockedAt: Date | null;
    totalSpp: number | null;
  };
  const lineups = (await prisma.nflFantasyLineup.findMany({
    where: {
      entryId: { in: [matchup.homeEntryId, matchup.awayEntryId] },
      weekId: matchup.weekId,
    },
  })) as LineupRow[];
  const lineupByEntry = new Map<string, LineupRow>();
  for (const l of lineups) lineupByEntry.set(l.entryId, l);

  type StarterRow = {
    lineupId: string;
    playerId: string;
    bbPosition: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    rawSpp: number | null;
    finalSpp: number | null;
    sppBreakdown: unknown;
  };
  const lineupIds = lineups.map((l) => l.id);
  const starters = (lineupIds.length === 0
    ? []
    : ((await prisma.nflFantasyLineupStarter.findMany({
        where: { lineupId: { in: lineupIds } },
      })) as StarterRow[])) as StarterRow[];

  const playerIds = Array.from(new Set(starters.map((s) => s.playerId)));
  type PlayerRow = Pick<
    NflPlayer,
    "id" | "pseudonym" | "teamCode" | "nflPosition"
  >;
  const players = (playerIds.length === 0
    ? []
    : ((await prisma.nflPlayer.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          pseudonym: true,
          teamCode: true,
          nflPosition: true,
        },
      })) as PlayerRow[])) as PlayerRow[];
  const playerById = new Map<string, PlayerRow>();
  for (const p of players) playerById.set(p.id, p);

  function buildSide(
    entryId: string,
    score: number | null,
  ): AdminMatchupSideRow {
    const entry = entryById.get(entryId);
    const lineup = lineupByEntry.get(entryId) ?? null;
    const lineupStarters: AdminMatchupStarterRow[] = (lineup
      ? starters.filter((s) => s.lineupId === lineup.id)
      : []
    ).map((s) => {
      const p = playerById.get(s.playerId);
      return {
        playerId: s.playerId,
        playerPseudonym: p?.pseudonym ?? s.playerId,
        teamCode: p?.teamCode ?? null,
        nflPosition: p?.nflPosition ?? "",
        bbPosition: s.bbPosition,
        isCaptain: s.isCaptain,
        isViceCaptain: s.isViceCaptain,
        rawSpp: s.rawSpp,
        finalSpp: s.finalSpp,
        sppBreakdown: s.sppBreakdown,
      };
    });
    lineupStarters.sort(
      (a, b) => (b.finalSpp ?? -Infinity) - (a.finalSpp ?? -Infinity),
    );
    return {
      entryId,
      userId: entry?.userId ?? "",
      teamName: entry?.teamName ?? entryId,
      bbRace: entry?.bbRace ?? null,
      score,
      lineupId: lineup?.id ?? null,
      captainPlayerId: lineup?.captainId ?? null,
      viceCaptainPlayerId: lineup?.viceCaptainId ?? null,
      lineupLockedAt: lineup?.lockedAt ? lineup.lockedAt.toISOString() : null,
      lineupTotalSpp: lineup?.totalSpp ?? null,
      starters: lineupStarters,
    };
  }

  const home = buildSide(matchup.homeEntryId, matchup.homeScore);
  const away = buildSide(matchup.awayEntryId, matchup.awayScore);

  let winnerSide: "home" | "away" | "tie" | null = null;
  if (matchup.settledAt) {
    if (matchup.winnerId === matchup.homeEntryId) winnerSide = "home";
    else if (matchup.winnerId === matchup.awayEntryId) winnerSide = "away";
    else winnerSide = "tie";
  }

  return {
    id: matchup.id,
    leagueId: matchup.leagueId,
    leagueName: league.name,
    seasonId: league.seasonId,
    weekId: matchup.weekId,
    home,
    away,
    winnerEntryId: matchup.winnerId,
    winnerSide,
    settledAt: matchup.settledAt ? matchup.settledAt.toISOString() : null,
    createdAt: matchup.createdAt.toISOString(),
    gazette:
      matchup.gazetteGeneratedAt &&
      matchup.gazetteTitle &&
      matchup.gazetteBody
        ? {
            title: matchup.gazetteTitle,
            body: matchup.gazetteBody,
            generatedAt: matchup.gazetteGeneratedAt.toISOString(),
          }
        : null,
  };
}

// ────────────────────────────────────────────────────────────────────
// Cleanup leagues replay (Phase 3.I)
// ────────────────────────────────────────────────────────────────────

export interface CleanupReplayLeaguesResult {
  readonly deletedCount: number;
  readonly leagueIds: ReadonlyArray<string>;
}

/**
 * Supprime toutes les leagues replay (ownerId LIKE 'replay-%') et leur
 * arborescence (entries / rosters / lineups / starters / matchups /
 * rerolls / inducements) via cascade ON DELETE.
 *
 * Idempotent : 0 deletion si pas de replay leagues.
 */
export async function cleanupReplayLeagues(): Promise<CleanupReplayLeaguesResult> {
  const leagues = (await prisma.nflFantasyLeague.findMany({
    where: { ownerId: { startsWith: "replay-" } },
    select: { id: true },
  })) as Array<{ id: string }>;

  if (leagues.length === 0) {
    return { deletedCount: 0, leagueIds: [] };
  }

  const ids = leagues.map((l) => l.id);
  await prisma.nflFantasyLeague.deleteMany({ where: { id: { in: ids } } });

  return { deletedCount: ids.length, leagueIds: ids };
}

export interface ReDeriveAllBbResult {
  readonly playersUpdated: number;
  readonly playersUnchanged: number;
  readonly playersSkipped: number;
  readonly errors: ReadonlyArray<{ playerId: string; error: string }>;
}

/**
 * Re-derive bbPosition pour tous les NflPlayer ayant un teamCode (FA
 * / retired sans teamCode sont skip). Idempotent. Util quand la table
 * `@bb/nfl-mapper getBbPosition` evolue.
 */
export async function reDeriveAllPlayersBb(): Promise<ReDeriveAllBbResult> {
  const players = (await prisma.nflPlayer.findMany({
    where: { teamCode: { not: null } },
    select: { id: true, teamCode: true, nflPosition: true, bbPosition: true },
  })) as Array<
    Pick<NflPlayer, "id" | "teamCode" | "nflPosition" | "bbPosition">
  >;

  const teamRaces = new Map<string, string>();
  const teams = (await prisma.nflTeam.findMany({
    select: { code: true, bbRace: true },
  })) as Array<Pick<NflTeam, "code" | "bbRace">>;
  for (const t of teams) teamRaces.set(t.code, t.bbRace);

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const errors: Array<{ playerId: string; error: string }> = [];

  for (const p of players) {
    try {
      const race = teamRaces.get(p.teamCode!);
      if (!race) {
        skipped++;
        continue;
      }
      const newBb = getBbPosition(p.nflPosition, race as BbRace);
      if (newBb === p.bbPosition) {
        unchanged++;
        continue;
      }
      await prisma.nflPlayer.update({
        where: { id: p.id },
        data: { bbPosition: newBb },
      });
      updated++;
    } catch (e) {
      errors.push({ playerId: p.id, error: (e as Error).message });
    }
  }

  return {
    playersUpdated: updated,
    playersUnchanged: unchanged,
    playersSkipped: skipped,
    errors,
  };
}
