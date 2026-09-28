/**
 * Bandeau « dernières infos » de la home — logique PURE (sans DOM).
 *
 * Le serveur (`GET /api/public/news-ticker`) sert des évènements typés ;
 * ce module les transforme en libellés affichables. Tolérant à une réponse
 * partielle ou inattendue : un item mal formé est ignoré, jamais rendu à
 * moitié.
 */

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
}

export interface NewsTickerLine {
  readonly key: string;
  readonly href: string;
  readonly icon: string;
  /** Étiquette de famille (« Ligue », « Gazette »…). */
  readonly tag: string;
  /** Contexte : nom de la compétition, titre de l'article. */
  readonly context: string;
  /** Rencontre et score, absent hors résultat. */
  readonly score?: string;
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

export function toTickerLines(
  response: NewsTickerResponse | null | undefined,
  labels: NewsTickerLabels,
): NewsTickerLine[] {
  const items = Array.isArray(response?.items) ? response.items : [];
  const lines: NewsTickerLine[] = [];
  for (const item of items) {
    if (!isValidItem(item)) continue;
    const key = `${item.kind}:${item.id}`;
    switch (item.kind) {
      case "league_result":
        lines.push({
          key,
          href: item.href,
          icon: "🏆",
          tag: labels.leagueResult,
          context: item.title,
          score: formatScoreLine(item, labels.forfeit),
        });
        break;
      case "cup_result":
        lines.push({
          key,
          href: item.href,
          icon: "🥇",
          tag: labels.cupResult,
          context: item.title,
          score: formatScoreLine(item, labels.forfeit),
        });
        break;
      case "blog_post":
        lines.push({ key, href: item.href, icon: "📰", tag: labels.blogPost, context: item.title });
        break;
      case "competition_open":
        lines.push({
          key,
          href: item.href,
          icon: "📣",
          tag: item.competition === "cup" ? labels.cupOpen : labels.leagueOpen,
          context: item.title,
        });
        break;
    }
  }
  return lines;
}

/** Durée d'un tour complet : ~6 s par ligne, bornée pour rester lisible. */
export function tickerDurationSeconds(lineCount: number): number {
  return Math.min(90, Math.max(20, lineCount * 6));
}
