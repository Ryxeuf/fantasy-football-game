/**
 * Bandeau « À la une » de la home — logique PURE (sans DOM).
 *
 * Le serveur (`GET /api/public/news-ticker`) sert des évènements typés ;
 * ce module les répartit entre les deux zones du bandeau :
 *  - les RÉSULTATS (ligue, coupe) deviennent des cartes de score fixes ;
 *  - les ACTUALITÉS (Gazette, inscriptions ouvertes) tournent une à une sur
 *    une ligne, là où un titre se lit en une phrase.
 *
 * Tolérant à une réponse partielle ou inattendue : un item mal formé est
 * ignoré, jamais rendu à moitié.
 */
import { getTeamColors } from "@bb/game-engine";

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
  readonly at: string;
  readonly href: string;
  readonly title: string;
  readonly home?: NewsTickerTeam;
  readonly away?: NewsTickerTeam;
  readonly scoreHome?: number;
  readonly scoreAway?: number;
  readonly forfeitSide?: "home" | "away";
  readonly competition?: "league" | "cup";
}

export interface NewsTickerResponse {
  readonly items?: ReadonlyArray<NewsTickerItem>;
}

export interface NewsTickerLabels {
  readonly leagueResult: string;
  readonly cupResult: string;
  readonly blogPost: string;
  readonly leagueOpen: string;
  readonly cupOpen: string;
  readonly forfeit: string;
  readonly readMore: string;
  readonly register: string;
}

/** Famille d'affichage : pilote la couleur du badge. */
export type NewsTickerFamily = "league" | "cup" | "blog" | "open";

export interface NewsTickerCrest {
  /** Deux lettres tirées du nom de l'équipe. */
  readonly initials: string;
  readonly background: string;
  readonly color: string;
}

export interface NewsTickerSide {
  readonly name: string;
  readonly score: number;
  readonly winner: boolean;
  readonly forfeit: boolean;
  readonly crest: NewsTickerCrest;
}

export interface NewsTickerResultCard {
  readonly key: string;
  readonly href: string;
  readonly family: "league" | "cup";
  readonly tag: string;
  /** Nom de la compétition. */
  readonly context: string;
  readonly at: string;
  readonly home: NewsTickerSide;
  readonly away: NewsTickerSide;
  /** Phrase complète pour les lecteurs d'écran. */
  readonly summary: string;
}

export interface NewsTickerHeadline {
  readonly key: string;
  readonly href: string;
  readonly family: "blog" | "open";
  readonly tag: string;
  readonly title: string;
  readonly at: string;
  readonly cta: string;
}

export interface NewsTickerView {
  readonly results: ReadonlyArray<NewsTickerResultCard>;
  readonly headlines: ReadonlyArray<NewsTickerHeadline>;
}

const KNOWN_KINDS = new Set<NewsTickerKind>([
  "league_result",
  "cup_result",
  "blog_post",
  "competition_open",
]);

function isResult(kind: NewsTickerKind): boolean {
  return kind === "league_result" || kind === "cup_result";
}

function isValidItem(raw: unknown): raw is NewsTickerItem {
  if (!raw || typeof raw !== "object") return false;
  const i = raw as Partial<NewsTickerItem>;
  if (!i.kind || !KNOWN_KINDS.has(i.kind)) return false;
  if (typeof i.id !== "string" || typeof i.href !== "string") return false;
  // Lien interne uniquement : jamais d'URL externe servie par l'API.
  if (!i.href.startsWith("/") || i.href.startsWith("//")) return false;
  if (typeof i.title !== "string") return false;
  if (isResult(i.kind)) {
    return (
      typeof i.home?.name === "string" &&
      typeof i.away?.name === "string" &&
      typeof i.scoreHome === "number" &&
      typeof i.scoreAway === "number"
    );
  }
  return i.title.length > 0;
}

/** « Rats 2 – 1 Nains », avec la mention forfait le cas échéant. */
export function formatScoreLine(item: NewsTickerItem, forfeitLabel: string): string {
  const home = item.home?.name ?? "";
  const away = item.away?.name ?? "";
  const base = `${home} ${item.scoreHome ?? 0} – ${item.scoreAway ?? 0} ${away}`;
  if (item.forfeitSide === "home") return `${base} (${forfeitLabel} ${home})`;
  if (item.forfeitSide === "away") return `${base} (${forfeitLabel} ${away})`;
  return base;
}

/** Articles et prépositions ignorés pour les initiales (« Les Rats du Port » → « RP »). */
const MINOR_WORDS = new Set(["le", "la", "les", "l", "de", "des", "du", "d", "the", "of"]);

/** Deux initiales du nom d'équipe, pour l'écusson. */
export function teamInitials(name: string): string {
  const words = name
    .split(/[\s'’-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0);
  const significant = words.filter((w) => !MINOR_WORDS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;
  if (pool.length === 0) return "?";
  const letters =
    pool.length === 1 ? Array.from(pool[0]).slice(0, 2) : pool.slice(0, 2).map((w) => Array.from(w)[0]);
  return letters.join("").toLocaleUpperCase();
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Couleurs canoniques du roster (moteur), texte choisi par luminance. */
export function crestFor(team: NewsTickerTeam): NewsTickerCrest {
  const { primary } = getTeamColors(team.roster);
  const r = (primary >> 16) & 0xff;
  const g = (primary >> 8) & 0xff;
  const b = primary & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return {
    initials: teamInitials(team.name),
    background: hex(primary),
    color: luminance > 150 ? "#1c1917" : "#ffffff",
  };
}

function side(
  team: NewsTickerTeam,
  score: number,
  opponentScore: number,
  forfeit: boolean,
): NewsTickerSide {
  return {
    name: team.name,
    score,
    winner: score > opponentScore,
    forfeit,
    crest: crestFor(team),
  };
}

export function toTickerView(
  response: NewsTickerResponse | null | undefined,
  labels: NewsTickerLabels,
): NewsTickerView {
  const items = Array.isArray(response?.items) ? response.items : [];
  const results: NewsTickerResultCard[] = [];
  const headlines: NewsTickerHeadline[] = [];
  for (const item of items) {
    if (!isValidItem(item)) continue;
    const key = `${item.kind}:${item.id}`;
    if (item.kind === "league_result" || item.kind === "cup_result") {
      const home = item.home as NewsTickerTeam;
      const away = item.away as NewsTickerTeam;
      const sh = item.scoreHome as number;
      const sa = item.scoreAway as number;
      const league = item.kind === "league_result";
      results.push({
        key,
        href: item.href,
        family: league ? "league" : "cup",
        tag: league ? labels.leagueResult : labels.cupResult,
        context: item.title,
        at: item.at,
        home: side(home, sh, sa, item.forfeitSide === "home"),
        away: side(away, sa, sh, item.forfeitSide === "away"),
        summary: `${item.title} — ${formatScoreLine(item, labels.forfeit)}`,
      });
    } else if (item.kind === "blog_post") {
      headlines.push({
        key,
        href: item.href,
        family: "blog",
        tag: labels.blogPost,
        title: item.title,
        at: item.at,
        cta: labels.readMore,
      });
    } else {
      headlines.push({
        key,
        href: item.href,
        family: "open",
        tag: item.competition === "cup" ? labels.cupOpen : labels.leagueOpen,
        title: item.title,
        at: item.at,
        cta: labels.register,
      });
    }
  }
  return { results, headlines };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Âge relatif court (« il y a 2 h », « hier », « 3 days ago »).
 * `null` si la date est illisible : on n'affiche alors rien plutôt qu'une
 * valeur fausse. Une date future (horloges décalées) vaut « maintenant ».
 */
export function formatRelativeAge(iso: string, now: number, locale: string): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const diff = Math.max(0, now - at);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (diff < MINUTE) return rtf.format(0, "second");
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), "hour");
  if (diff < 7 * DAY) return rtf.format(-Math.floor(diff / DAY), "day");
  if (diff < 35 * DAY) return rtf.format(-Math.floor(diff / (7 * DAY)), "week");
  return rtf.format(-Math.floor(diff / (30 * DAY)), "month");
}
