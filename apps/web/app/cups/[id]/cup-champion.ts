/**
 * Palmarès d'une coupe — PUR, dérivé de ce que `GET /cup/:id` sert déjà.
 *
 * Le récap de saison d'une ligue annonce son champion et son Oracle ; une
 * coupe terminée n'annonçait rien (il fallait lire la finale dans le bracket
 * ou deviner le premier du classement). Règles :
 *
 * - avec play-offs, le champion est le VAINQUEUR DE LA FINALE — jouée, score
 *   validé, pas de nul (un nul se rejoue, cf. `advanceCupPlayoffs`) ; tant
 *   qu'elle ne l'est pas, pas de champion, même coupe close ;
 * - sans play-offs, c'est le premier du classement, une fois la coupe CLOSE
 *   (`terminee` / `archivee`) et s'il a joué ;
 * - l'Oracle est le meilleur pronostiqueur du groupe Coachs (ex aequo
 *   compris, points > 0), même règle que `leaderboardLeaders` côté serveur,
 *   annoncé quand le champion l'est.
 */

export interface ChampionTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl?: string | null;
  readonly coachName?: string | null;
}

interface FinalPairing {
  readonly status: string;
  readonly homeTeam: ChampionTeam;
  readonly awayTeam: ChampionTeam | null;
  readonly localMatch: {
    readonly status: string;
    readonly teamAId: string;
    readonly scoreTeamA: number | null;
    readonly scoreTeamB: number | null;
  } | null;
}

interface ChampionRound {
  readonly kind?: string;
  readonly bracketSlot?: string | null;
  readonly pairings: readonly FinalPairing[];
}

interface ChampionStanding {
  readonly teamId: string;
  readonly teamName: string;
  readonly roster: string;
  readonly logoUrl?: string | null;
  readonly matchesPlayed: number;
}

export interface CupChampion {
  readonly team: ChampionTeam;
  /** `final` : vainqueur de la finale ; `standings` : premier du classement. */
  readonly source: "final" | "standings";
  /** Score de la finale, vainqueur d'abord (« 2 – 1 »). */
  readonly finalScore: string | null;
}

const CLOSED_STATUSES: ReadonlySet<string> = new Set(["terminee", "archivee"]);

function finalWinner(
  pairing: FinalPairing,
): { team: ChampionTeam; score: string } | null {
  const m = pairing.localMatch;
  if (pairing.status !== "played" || !pairing.awayTeam) return null;
  if (!m || m.status !== "completed") return null;
  if (typeof m.scoreTeamA !== "number" || typeof m.scoreTeamB !== "number") {
    return null;
  }
  const homeIsA = m.teamAId === pairing.homeTeam.id;
  const home = homeIsA ? m.scoreTeamA : m.scoreTeamB;
  const away = homeIsA ? m.scoreTeamB : m.scoreTeamA;
  if (home === away) return null;
  return home > away
    ? { team: pairing.homeTeam, score: `${home} – ${away}` }
    : { team: pairing.awayTeam, score: `${away} – ${home}` };
}

export function cupChampion(input: {
  readonly status: string;
  readonly rounds: readonly ChampionRound[];
  readonly standings: readonly ChampionStanding[];
  /** Coach de chaque inscrit, pour nommer un champion issu du classement. */
  readonly coachNameByTeamId?: Readonly<Record<string, string | null>>;
}): CupChampion | null {
  const final = input.rounds.find((r) => r.bracketSlot === "final");
  if (final) {
    const pairing = final.pairings[0];
    const winner = pairing ? finalWinner(pairing) : null;
    return winner
      ? { team: winner.team, source: "final", finalScore: winner.score }
      : null;
  }
  // Une coupe à bracket dont la finale n'existe pas encore n'est pas jouée.
  if (input.rounds.some((r) => r.kind === "playoff" || r.bracketSlot)) {
    return null;
  }
  if (!CLOSED_STATUSES.has(input.status)) return null;
  const leader = input.standings[0];
  if (!leader || leader.matchesPlayed === 0) return null;
  return {
    team: {
      id: leader.teamId,
      name: leader.teamName,
      roster: leader.roster,
      logoUrl: leader.logoUrl ?? null,
      coachName: input.coachNameByTeamId?.[leader.teamId] ?? null,
    },
    source: "standings",
    finalScore: null,
  };
}

export interface OracleEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly rank: number;
  readonly points: number;
}

/** Meilleur(s) pronostiqueur(s) du groupe Coachs, ex aequo compris. */
export function cupOracles(
  coach: readonly OracleEntry[] | null | undefined,
): OracleEntry[] {
  return (coach ?? []).filter((e) => e.rank === 1 && e.points > 0);
}
