/**
 * Sélection PURE des prochaines rencontres d'un coach dans une coupe — le
 * pendant de `leagues/[id]/next-matches` sur la forme des rencontres de
 * coupe (équipes portées directement, exempts, rondes de play-off).
 */
import type { CupPairingTeamView, CupPairingView, CupRoundView } from "./CupRoundsView";

/** Rencontre encore à jouer : un exempt ou une rencontre tranchée n'en est pas. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["scheduled", "in_progress"]);

export const CUP_NEXT_MATCHES_COUNT = 3;

export interface CupUpcomingMatch {
  readonly pairing: CupPairingView;
  readonly roundNumber: number;
  readonly side: "home" | "away";
  readonly opponent: CupPairingTeamView;
}

function plannedAt(pairing: CupPairingView): number {
  if (!pairing.scheduledAt) return Number.POSITIVE_INFINITY;
  const ms = new Date(pairing.scheduledAt).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * Les `limit` prochaines rencontres NON JOUÉES du coach, par ronde puis par
 * date prévue (sans date en dernier) puis par id. Un placeholder de bracket
 * (`home === away`) n'a pas encore d'adversaire : il est ignoré.
 */
export function selectCupUpcomingMatches(
  rounds: readonly CupRoundView[],
  currentUserId: string | null,
  limit: number = CUP_NEXT_MATCHES_COUNT,
): CupUpcomingMatch[] {
  if (!currentUserId || limit <= 0) return [];
  const out: CupUpcomingMatch[] = [];
  for (const round of [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)) {
    const pairings = [...round.pairings].sort((a, b) => {
      const dateA = plannedAt(a);
      const dateB = plannedAt(b);
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    for (const pairing of pairings) {
      if (!OPEN_STATUSES.has(pairing.status) || !pairing.awayTeam) continue;
      if (pairing.homeTeam.id === pairing.awayTeam.id) continue;
      const side =
        pairing.homeTeam.ownerId === currentUserId
          ? "home"
          : pairing.awayTeam.ownerId === currentUserId
            ? "away"
            : null;
      if (!side) continue;
      out.push({
        pairing,
        roundNumber: round.roundNumber,
        side,
        opponent: side === "home" ? pairing.awayTeam : pairing.homeTeam,
      });
    }
  }
  return out.slice(0, limit);
}
