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
  NflGameStat,
  NflPlayer,
  NflSeason,
  NflTeam,
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
      | "INVALID_BB_RACE",
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
  readonly team: {
    readonly code: string;
    readonly city: string;
    readonly raceLabel: string;
    readonly bbRace: string;
  } | null;
  readonly totalSpp: number;
  readonly gamesPlayed: number;
  readonly stats: ReadonlyArray<AdminPlayerStatRow>;
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
