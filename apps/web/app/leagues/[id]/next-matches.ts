/**
 * Sélection PURE des prochaines rencontres d'un coach dans une saison.
 *
 * Le calendrier complet répond à « qui joue quand » ; il ne répond pas à
 * « et moi, je joue quoi ensuite ? » — le coach devait déplier les
 * journées une à une pour retrouver ses propres rencontres.
 */
import type { LeaguePairingDetail, LeagueRoundDetail } from "./types";

/** Statuts d'une rencontre déjà tranchée : elle n'est plus « à venir ». */
const SETTLED_STATUSES: ReadonlySet<string> = new Set([
  "played",
  "forfeit_home",
  "forfeit_away",
  "cancelled",
]);

/** Nombre de rencontres proposées par défaut. */
export const NEXT_MATCHES_COUNT = 3;

/** Une rencontre à venir du coach, avec la journée dont elle relève. */
export interface UpcomingMatch {
  readonly pairing: LeaguePairingDetail;
  readonly roundNumber: number;
  readonly roundName: string | null;
  /** Côté du coach : détermine l'adversaire à afficher. */
  readonly side: "home" | "away";
  readonly opponent: LeaguePairingDetail["homeParticipant"];
}

/** Côté du coach dans la rencontre, ou `null` s'il n'y joue pas. */
function coachSide(
  pairing: LeaguePairingDetail,
  userId: string,
): "home" | "away" | null {
  if (pairing.homeParticipant.team.ownerId === userId) return "home";
  if (pairing.awayParticipant.team.ownerId === userId) return "away";
  return null;
}

/** Clé de tri d'une date prévisionnelle : les rencontres sans date passent après. */
function plannedAt(pairing: LeaguePairingDetail): number {
  if (!pairing.scheduledAt) return Number.POSITIVE_INFINITY;
  const ms = new Date(pairing.scheduledAt).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * Les `limit` prochaines rencontres NON JOUÉES du coach, dans l'ordre du
 * calendrier : par numéro de journée croissant, puis par date
 * prévisionnelle (celles sans date en dernier), puis par id — le tri est
 * totalement déterministe.
 *
 * Retourne une liste vide sans coach connecté, ce qui suffit à masquer la
 * zone côté UI.
 */
export function selectUpcomingMatches(
  rounds: readonly LeagueRoundDetail[],
  currentUserId: string | null,
  limit: number = NEXT_MATCHES_COUNT,
): UpcomingMatch[] {
  if (!currentUserId || limit <= 0) return [];
  const out: UpcomingMatch[] = [];
  for (const round of [...rounds].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  )) {
    const pairings = [...(round.pairings ?? [])].sort((a, b) => {
      // Soustraire deux `Infinity` donne NaN, et un seul donne ±Infinity :
      // on compare donc les clés, jamais leur différence.
      const dateA = plannedAt(a);
      const dateB = plannedAt(b);
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    for (const pairing of pairings) {
      if (SETTLED_STATUSES.has(pairing.status)) continue;
      const side = coachSide(pairing, currentUserId);
      if (!side) continue;
      out.push({
        pairing,
        roundNumber: round.roundNumber,
        roundName: round.name,
        side,
        opponent:
          side === "home" ? pairing.awayParticipant : pairing.homeParticipant,
      });
    }
  }
  return out.slice(0, limit);
}
