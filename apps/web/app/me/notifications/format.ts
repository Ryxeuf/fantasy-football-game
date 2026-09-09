/**
 * Helpers PURS de la page `/me/notifications` (testés sans rendu).
 */

/** Taille de page de la liste (« Charger plus » au-delà). */
export const NOTIFICATIONS_PAGE_SIZE = 50;

/** Libellés de temps relatif, injectés depuis le dictionnaire i18n. */
export interface RelativeTimeLabels {
  readonly justNow: string;
  readonly minutesAgo: string;
  readonly hoursAgo: string;
  readonly daysAgo: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * « à l'instant » / « il y a 5 min » / « il y a 3 h » / « il y a 2 j », puis
 * la date locale au-delà de 7 jours. Une date invalide renvoie une chaîne
 * vide plutôt que « Invalid Date ».
 */
export function formatRelativeTime(
  iso: string,
  labels: RelativeTimeLabels,
  now: Date = new Date(),
  locale = "fr-FR",
): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  const diff = Math.max(0, now.getTime() - at);
  if (diff < MINUTE) return labels.justNow;
  if (diff < HOUR) {
    return labels.minutesAgo.replace("{count}", String(Math.floor(diff / MINUTE)));
  }
  if (diff < DAY) {
    return labels.hoursAgo.replace("{count}", String(Math.floor(diff / HOUR)));
  }
  if (diff < 7 * DAY) {
    return labels.daysAgo.replace("{count}", String(Math.floor(diff / DAY)));
  }
  return new Date(at).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Pictogramme par famille de notification (`kind` dot-case). */
export function notificationIcon(kind: string): string {
  if (kind.endsWith(".deleted")) return "🗑️";
  if (kind.endsWith(".archived")) return "📦";
  if (kind === "league.match_validation") return "📝";
  if (kind === "league.round_pairing") return "📅";
  if (kind === "league.round_followup") return "⏰";
  if (kind.startsWith("league.")) return "🏅";
  if (kind.startsWith("cup.")) return "🏆";
  if (kind.startsWith("friend.")) return "🤝";
  return "🔔";
}

/**
 * Seules les URL RELATIVES au site sont suivies : une notification est une
 * donnée serveur, mais on ne veut jamais rendre un lien sortant à partir
 * d'une chaîne stockée en base.
 */
export function safeInternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}
