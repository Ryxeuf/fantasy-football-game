/**
 * Bandeau « dernières infos » de la home (`GET /api/public/news-ticker`).
 *
 * Agrège, en un seul round-trip parallèle, ce qui s'est passé récemment sur
 * la partie PUBLIQUE du site :
 *  - résultats de ligue (feuilles VALIDÉES d'une ligue publique) ;
 *  - résultats de coupe (rencontres d'une coupe publique, matérialisées en
 *    `LocalMatch` à la validation de leur feuille). Les parties offline hors
 *    coupe sont exclues : leur page vit derrière `offline_match` (OFF) ;
 *  - dernier article de blog publié ;
 *  - compétitions publiques ouvertes aux inscriptions.
 *
 * Deux règles de visibilité du repo s'appliquent ici comme ailleurs :
 *  - une ligue / coupe PRIVÉE n'existe pas pour un visiteur (filtre `where`) ;
 *  - un bracket de play-offs NON PUBLIÉ (`playoffsPublished === false`) ne
 *    s'annonce nulle part — pas même par le résultat d'une de ses rencontres.
 *
 * `buildNewsTicker` est PUR (tri + plafonds par famille) ; `gatherNewsTicker`
 * ne fait que charger, source par source en best-effort : une source en
 * échec est journalisée et ignorée, le bandeau sert les autres. Le client est typé structurellement pour être testé
 * avec un faux léger, sans base.
 */

import type { Prisma } from "@prisma/client";
import { serverLog } from "../utils/server-log";

export type NewsTickerKind =
  | "league_result"
  | "cup_result"
  | "blog_post"
  | "competition_open";

export interface NewsTickerTeam {
  readonly name: string;
  readonly roster: string;
}

export interface NewsTickerItem {
  readonly kind: NewsTickerKind;
  readonly id: string;
  /** Date ISO de l'évènement (validation, fin de match, publication…). */
  readonly at: string;
  /** Lien interne vers la page qui détaille l'évènement. */
  readonly href: string;
  /** Titre libre : nom de la compétition, titre de l'article. */
  readonly title: string;
  readonly home?: NewsTickerTeam;
  readonly away?: NewsTickerTeam;
  readonly scoreHome?: number;
  readonly scoreAway?: number;
  /** Côté déclaré forfait (résultat de ligue sur tapis vert). */
  readonly forfeitSide?: "home" | "away";
  /** Pour `competition_open` : ligue ou coupe. */
  readonly competition?: "league" | "cup";
}

/** Plafond par famille : un week-end de ligue chargé ne noie pas le blog. */
export const NEWS_TICKER_LIMITS: Readonly<Record<NewsTickerKind, number>> = {
  league_result: 5,
  cup_result: 5,
  blog_post: 1,
  competition_open: 3,
};

export const NEWS_TICKER_MAX_ITEMS = 12;

/**
 * Trie par date décroissante, applique le plafond de chaque famille puis le
 * plafond global. Les dates invalides tombent en fin de liste.
 */
export function buildNewsTicker(
  items: ReadonlyArray<NewsTickerItem>,
): NewsTickerItem[] {
  const time = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? -Infinity : t;
  };
  const sorted = [...items].sort((a, b) => time(b.at) - time(a.at));
  const used = new Map<NewsTickerKind, number>();
  const out: NewsTickerItem[] = [];
  for (const item of sorted) {
    const count = used.get(item.kind) ?? 0;
    if (count >= NEWS_TICKER_LIMITS[item.kind]) continue;
    used.set(item.kind, count + 1);
    out.push(item);
    if (out.length >= NEWS_TICKER_MAX_ITEMS) break;
  }
  return out;
}

/** Un tour de bracket se reconnaît à `kind` OU à `bracketSlot` (défaut "regular"). */
function isPlayoffRound(round: { kind: string; bracketSlot: string | null }): boolean {
  return round.kind === "playoff" || round.bracketSlot !== null;
}

/** Vrai si la rencontre appartient à un bracket encore en attente de publication. */
export function isHiddenPlayoffResult(
  round: { kind: string; bracketSlot: string | null } | null | undefined,
  playoffsPublished: boolean | null | undefined,
): boolean {
  if (!round) return false;
  return isPlayoffRound(round) && playoffsPublished === false;
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

interface TeamRow {
  name: string;
  roster: string;
}

interface RoundRow {
  kind: string;
  bracketSlot: string | null;
}

export interface LeagueSheetRow {
  id: string;
  validatedAt: Date | null;
  scoreHome: number;
  scoreAway: number;
  forfeitSide: string | null;
  pairing: {
    id: string;
    homeParticipant: { team: TeamRow };
    awayParticipant: { team: TeamRow };
    round: RoundRow & {
      season: {
        playoffsPublished: boolean | null;
        league: { id: string; name: string };
      };
    };
  } | null;
}

export interface LocalMatchRow {
  id: string;
  completedAt: Date | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  teamA: TeamRow;
  teamB: TeamRow | null;
  cup: { id: string; name: string; playoffsPublished: boolean | null } | null;
  cupPairing: { round: RoundRow } | null;
}

export interface BlogRow {
  id: string;
  slug: string;
  title: string;
  publishedAt: Date | null;
}

export interface OpenCompetitionRow {
  id: string;
  name: string;
  createdAt: Date;
}

/** Sous-ensemble structurel de PrismaClient : juste les `findMany` utiles. */
export interface NewsTickerClient {
  leagueMatchSheet: { findMany(args: unknown): Promise<LeagueSheetRow[]> };
  localMatch: { findMany(args: unknown): Promise<LocalMatchRow[]> };
  blogPost: { findMany(args: unknown): Promise<BlogRow[]> };
  league: { findMany(args: unknown): Promise<OpenCompetitionRow[]> };
  cup: { findMany(args: unknown): Promise<OpenCompetitionRow[]> };
}

const TEAM_SELECT = { select: { name: true, roster: true } } as const;
const ROUND_SELECT = { kind: true, bracketSlot: true } as const;

// On sur-échantillonne un peu : des lignes peuvent être écartées ensuite
// (bracket non publié, équipe adverse supprimée).
const FETCH_MARGIN = 3;

export function mapLeagueSheet(row: LeagueSheetRow): NewsTickerItem | null {
  const pairing = row.pairing;
  if (!pairing || !row.validatedAt) return null;
  const { round } = pairing;
  if (isHiddenPlayoffResult(round, round.season.playoffsPublished)) return null;
  const forfeitSide =
    row.forfeitSide === "home" || row.forfeitSide === "away"
      ? row.forfeitSide
      : undefined;
  return {
    kind: "league_result",
    id: row.id,
    at: row.validatedAt.toISOString(),
    href: `/leagues/${round.season.league.id}`,
    title: round.season.league.name,
    home: { ...pairing.homeParticipant.team },
    away: { ...pairing.awayParticipant.team },
    scoreHome: row.scoreHome,
    scoreAway: row.scoreAway,
    ...(forfeitSide ? { forfeitSide } : {}),
  };
}

export function mapLocalMatch(row: LocalMatchRow): NewsTickerItem | null {
  if (!row.cup || !row.completedAt || !row.teamB) return null;
  if (row.scoreTeamA === null || row.scoreTeamB === null) return null;
  if (isHiddenPlayoffResult(row.cupPairing?.round, row.cup.playoffsPublished)) {
    return null;
  }
  return {
    kind: "cup_result",
    id: row.id,
    at: row.completedAt.toISOString(),
    href: `/cups/${row.cup.id}`,
    title: row.cup.name,
    home: { ...row.teamA },
    away: { ...row.teamB },
    scoreHome: row.scoreTeamA,
    scoreAway: row.scoreTeamB,
  };
}

/** Une source qui échoue (ou absente du client) vaut « rien à annoncer ». */
async function fromSource<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    serverLog.warn(`[public-news-ticker] source ${label} ignorée`, error);
    return [];
  }
}

export async function gatherNewsTicker(
  db: NewsTickerClient,
): Promise<NewsTickerItem[]> {
  const [sheets, localMatches, posts, leagues, cups] = await Promise.all([
    fromSource("league-results", () => db.leagueMatchSheet.findMany({
      where: {
        status: "validated",
        validatedAt: { not: null },
        pairing: { round: { season: { league: { isPublic: true } } } },
      },
      orderBy: { validatedAt: "desc" },
      take: NEWS_TICKER_LIMITS.league_result + FETCH_MARGIN,
      select: {
        id: true,
        validatedAt: true,
        scoreHome: true,
        scoreAway: true,
        forfeitSide: true,
        pairing: {
          select: {
            id: true,
            homeParticipant: { select: { team: TEAM_SELECT } },
            awayParticipant: { select: { team: TEAM_SELECT } },
            round: {
              select: {
                ...ROUND_SELECT,
                season: {
                  select: {
                    playoffsPublished: true,
                    league: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.LeagueMatchSheetFindManyArgs)),
    fromSource("cup-results", () => db.localMatch.findMany({
      where: {
        status: "completed",
        isPublic: true,
        completedAt: { not: null },
        cup: { isPublic: true },
      },
      orderBy: { completedAt: "desc" },
      take: NEWS_TICKER_LIMITS.cup_result + FETCH_MARGIN,
      select: {
        id: true,
        completedAt: true,
        scoreTeamA: true,
        scoreTeamB: true,
        teamA: TEAM_SELECT,
        teamB: TEAM_SELECT,
        cup: { select: { id: true, name: true, playoffsPublished: true } },
        cupPairing: { select: { round: { select: ROUND_SELECT } } },
      },
    } satisfies Prisma.LocalMatchFindManyArgs)),
    fromSource("blog", () => db.blogPost.findMany({
      where: { status: "published", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: NEWS_TICKER_LIMITS.blog_post,
      select: { id: true, slug: true, title: true, publishedAt: true },
    } satisfies Prisma.BlogPostFindManyArgs)),
    fromSource("open-leagues", () => db.league.findMany({
      where: { isPublic: true, status: "open" },
      orderBy: { createdAt: "desc" },
      take: NEWS_TICKER_LIMITS.competition_open,
      select: { id: true, name: true, createdAt: true },
    } satisfies Prisma.LeagueFindManyArgs)),
    fromSource("open-cups", () => db.cup.findMany({
      where: { isPublic: true, status: "ouverte", validated: false },
      orderBy: { createdAt: "desc" },
      take: NEWS_TICKER_LIMITS.competition_open,
      select: { id: true, name: true, createdAt: true },
    } satisfies Prisma.CupFindManyArgs)),
  ]);

  const items: NewsTickerItem[] = [];
  for (const s of sheets) {
    const item = mapLeagueSheet(s);
    if (item) items.push(item);
  }
  for (const m of localMatches) {
    const item = mapLocalMatch(m);
    if (item) items.push(item);
  }
  for (const p of posts) {
    if (!p.publishedAt) continue;
    items.push({
      kind: "blog_post",
      id: p.id,
      at: p.publishedAt.toISOString(),
      href: `/blog/${p.slug}`,
      title: p.title,
    });
  }
  for (const l of leagues) {
    items.push({
      kind: "competition_open",
      competition: "league",
      id: l.id,
      at: l.createdAt.toISOString(),
      href: `/leagues/${l.id}`,
      title: l.name,
    });
  }
  for (const c of cups) {
    items.push({
      kind: "competition_open",
      competition: "cup",
      id: c.id,
      at: c.createdAt.toISOString(),
      href: `/cups/${c.id}`,
      title: c.name,
    });
  }
  return buildNewsTicker(items);
}
