/**
 * Pro League storyline detector — sprint Pro League lot 1.E.3.
 *
 * Détecte automatiquement des "storylines" (= angles narratifs)
 * dans un set de matchs joués + standings, qui seront consommés par
 * la Nuffle Gazette (lot 1.E.1) comme contexte pour ses articles
 * LLM.
 *
 * Types détectés :
 *  - `blowout`         : écart de score ≥ 4 TDs.
 *  - `narrow`          : score serré (1 TD d'écart, ou nul).
 *  - `upset`           : équipe avec record < 50% gagne contre une
 *                        équipe avec record > 70% (par standings J-1).
 *  - `record_td`       : match avec ≥ 6 TDs au total (rare).
 *  - `bloodbath`       : match avec ≥ 4 casualties.
 *  - `nuffle_chaos`    : match avec ≥ 3 events Nuffle.
 *  - `rivalry_buildup` : 3e match consécutif entre les 2 mêmes
 *                        équipes en < 30 jours (rare au MVP, mais
 *                        détectable via history).
 *  - `season_top`      : équipe atteint la 1ère place du classement.
 *
 * Chaque storyline a un `weight` ∈ [0, 100] qui sert au LLM pour
 * trier les angles à mentionner en priorité dans la Gazette.
 *
 * Le service est PUR — pas d'I/O ; il consomme un snapshot de la
 * journée + standings + history. La couche DB est gérée séparément
 * (lot 1.E.1 quand on branche le cron Gazette).
 */

export type StorylineType =
  | "blowout"
  | "narrow"
  | "upset"
  | "record_td"
  | "bloodbath"
  | "nuffle_chaos"
  | "rivalry_buildup"
  | "season_top";

export interface MatchSnapshot {
  readonly id: string;
  readonly homeTeamSlug: string;
  readonly homeTeamName: string;
  readonly awayTeamSlug: string;
  readonly awayTeamName: string;
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly outcome: "home" | "away" | "draw";
  readonly touchdownCount: number;
  readonly casualtyCount: number;
  readonly nuffleCount: number;
  readonly playedAt: string;
}

export interface StandingEntry {
  readonly teamSlug: string;
  readonly teamName: string;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly rank: number;
}

export interface PriorMatchupCounts {
  /** Pour un couple ordonné (slug A, slug B), nombre de matchs joués
   *  entre eux dans les `historyDays` derniers jours (cf. helpers).
   *  La fonction de détection est agnostique de la fenêtre — elle
   *  compte juste le nombre fourni. */
  readonly count: number;
  /** Date du plus ancien match du compte, pour aider le LLM. */
  readonly firstAt: string;
  /** Q.A.4 — Bilan W-D-L de l'historique (perspective home du match
   *  courant). Optionnel — si absent la storyline n'expose pas le
   *  bilan dans ses refs. */
  readonly winsHome?: number;
  readonly winsAway?: number;
  readonly draws?: number;
  /** Q.A.4 — Streak en cours (perspective home du match courant) :
   *  "win" / "loss" / "draw" / "none". */
  readonly streakKind?: "win" | "loss" | "draw" | "none";
  /** Q.A.4 — Longueur du streak (>= 0). */
  readonly streakLength?: number;
}

export interface DetectStorylinesInput {
  readonly matches: readonly MatchSnapshot[];
  readonly standings: readonly StandingEntry[];
  /** Pour chaque match, le compte historique du matchup (incluant
   *  le match courant). Optionnel ; si absent, `rivalry_buildup`
   *  n'est pas détecté. */
  readonly priorMatchups?: ReadonlyMap<string, PriorMatchupCounts>;
}

export interface Storyline {
  readonly type: StorylineType;
  readonly weight: number;
  /** Référence(s) match / team / player. Forme libre, consommée
   *  par le LLM côté lot 1.E.1. */
  readonly refs: Record<string, string | number>;
  /** Synthèse 1-line lisible (logging / preview). */
  readonly summary: string;
}

const TD_BLOWOUT_DIFF = 4;
const TD_RECORD_TOTAL = 6;
const CASUALTY_BLOODBATH = 4;
const NUFFLE_CHAOS = 3;
const UPSET_LOSER_WIN_RATIO = 0.7;
const UPSET_WINNER_WIN_RATIO = 0.5;

function diff(a: number, b: number): number {
  return Math.abs(a - b);
}

/**
 * Construit la clé d'un matchup ordonnée alphabétiquement (peu importe
 * home/away) — pour lookup `priorMatchups`.
 */
export function matchupKey(slugA: string, slugB: string): string {
  return [slugA, slugB].sort().join("|");
}

function winRatio(s: StandingEntry): number {
  if (s.played === 0) return 0;
  return s.wins / s.played;
}

/**
 * Renvoie les storylines détectés pour la journée. Les doublons
 * (même type sur le même match) sont possibles uniquement si types
 * différents (ex: même match peut être à la fois `blowout` et
 * `bloodbath`). La fonction n'élimine pas les redondances cross-type.
 */
export function detectStorylines(
  input: DetectStorylinesInput,
): Storyline[] {
  const standingsBySlug = new Map<string, StandingEntry>(
    input.standings.map((s) => [s.teamSlug, s]),
  );
  const out: Storyline[] = [];

  // season_top : si un seul leader (rank=1), une storyline par leader.
  for (const s of input.standings) {
    if (s.rank === 1) {
      out.push({
        type: "season_top",
        weight: 70,
        refs: {
          teamSlug: s.teamSlug,
          teamName: s.teamName,
          points: s.points,
          played: s.played,
        },
        summary: `${s.teamName} prend la tête du classement (${s.points} pts en ${s.played} match${s.played > 1 ? "s" : ""}).`,
      });
    }
  }

  for (const m of input.matches) {
    const td = m.scoreHome + m.scoreAway;
    const scoreDiff = diff(m.scoreHome, m.scoreAway);

    // blowout
    if (scoreDiff >= TD_BLOWOUT_DIFF) {
      const winnerName =
        m.outcome === "home"
          ? m.homeTeamName
          : m.outcome === "away"
            ? m.awayTeamName
            : null;
      out.push({
        type: "blowout",
        weight: 80 + Math.min(20, (scoreDiff - TD_BLOWOUT_DIFF) * 5),
        refs: {
          matchId: m.id,
          scoreHome: m.scoreHome,
          scoreAway: m.scoreAway,
          winner: winnerName ?? "draw",
        },
        summary: winnerName
          ? `${winnerName} écrase ${m.homeTeamName === winnerName ? m.awayTeamName : m.homeTeamName} ${m.scoreHome}-${m.scoreAway}.`
          : `Score d'écart inhabituel ${m.scoreHome}-${m.scoreAway}.`,
      });
    }

    // narrow (1 d'écart ou draw)
    if (scoreDiff <= 1 && (td > 0 || m.outcome === "draw")) {
      out.push({
        type: "narrow",
        weight: 55,
        refs: {
          matchId: m.id,
          scoreHome: m.scoreHome,
          scoreAway: m.scoreAway,
        },
        summary:
          m.outcome === "draw"
            ? `Match nul ${m.scoreHome}-${m.scoreAway} entre ${m.homeTeamName} et ${m.awayTeamName}.`
            : `${m.homeTeamName} vs ${m.awayTeamName} : décision à 1 TD près (${m.scoreHome}-${m.scoreAway}).`,
      });
    }

    // upset (loser was favori sur les standings J-1)
    if (m.outcome !== "draw") {
      const winnerSlug =
        m.outcome === "home" ? m.homeTeamSlug : m.awayTeamSlug;
      const loserSlug =
        m.outcome === "home" ? m.awayTeamSlug : m.homeTeamSlug;
      const winnerStanding = standingsBySlug.get(winnerSlug);
      const loserStanding = standingsBySlug.get(loserSlug);
      if (
        winnerStanding &&
        loserStanding &&
        winnerStanding.played >= 2 &&
        loserStanding.played >= 2 &&
        winRatio(winnerStanding) < UPSET_WINNER_WIN_RATIO &&
        winRatio(loserStanding) > UPSET_LOSER_WIN_RATIO
      ) {
        out.push({
          type: "upset",
          weight: 90,
          refs: {
            matchId: m.id,
            winnerSlug,
            winnerName: winnerStanding.teamName,
            loserSlug,
            loserName: loserStanding.teamName,
          },
          summary: `Surprise : ${winnerStanding.teamName} (${(winRatio(winnerStanding) * 100).toFixed(0)}% V) renverse ${loserStanding.teamName} (${(winRatio(loserStanding) * 100).toFixed(0)}% V).`,
        });
      }
    }

    // record_td
    if (td >= TD_RECORD_TOTAL) {
      out.push({
        type: "record_td",
        weight: 75,
        refs: { matchId: m.id, totalTd: td },
        summary: `Festival de touchdowns : ${td} TDs entre ${m.homeTeamName} et ${m.awayTeamName}.`,
      });
    }

    // bloodbath
    if (m.casualtyCount >= CASUALTY_BLOODBATH) {
      out.push({
        type: "bloodbath",
        weight: 80,
        refs: { matchId: m.id, casualties: m.casualtyCount },
        summary: `Bain de sang : ${m.casualtyCount} blessures dans ${m.homeTeamName} - ${m.awayTeamName}.`,
      });
    }

    // nuffle_chaos
    if (m.nuffleCount >= NUFFLE_CHAOS) {
      out.push({
        type: "nuffle_chaos",
        weight: 65,
        refs: { matchId: m.id, nuffleCount: m.nuffleCount },
        summary: `Nuffle s'est déchaîné : ${m.nuffleCount} events scriptés sur ${m.homeTeamName} - ${m.awayTeamName}.`,
      });
    }

    // rivalry_buildup (Q.A.4 enrichi avec W-D-L + streak)
    if (input.priorMatchups) {
      const key = matchupKey(m.homeTeamSlug, m.awayTeamSlug);
      const matchup = input.priorMatchups.get(key);
      if (matchup && matchup.count >= 3) {
        const refs: Record<string, string | number> = {
          matchId: m.id,
          home: m.homeTeamSlug,
          away: m.awayTeamSlug,
          homeName: m.homeTeamName,
          awayName: m.awayTeamName,
          priorCount: matchup.count,
          since: matchup.firstAt,
          // Q.A.4 — la rivalry storyline preconise une persona
          // "statistician" : le LLM est invite a signer cet article
          // dans un EDITO chiffre.
          suggestedPersona: "statistician",
        };
        // Optionnels : ajoute uniquement si fourni cote caller.
        if (
          matchup.winsHome !== undefined &&
          matchup.winsAway !== undefined &&
          matchup.draws !== undefined
        ) {
          refs.winsHome = matchup.winsHome;
          refs.winsAway = matchup.winsAway;
          refs.drawsHistorical = matchup.draws;
        }
        if (matchup.streakKind && matchup.streakLength !== undefined) {
          refs.streakKind = matchup.streakKind;
          refs.streakLength = matchup.streakLength;
        }

        const balance =
          matchup.winsHome !== undefined &&
          matchup.winsAway !== undefined &&
          matchup.draws !== undefined
            ? ` Bilan : ${matchup.winsHome}-${matchup.draws}-${matchup.winsAway} pour ${m.homeTeamName}.`
            : "";

        out.push({
          type: "rivalry_buildup",
          // Weight +5 si on a un streak >= 2 (rivalry "qui chauffe")
          weight:
            matchup.streakLength !== undefined && matchup.streakLength >= 2
              ? 90
              : 85,
          refs,
          summary: `${m.homeTeamName} et ${m.awayTeamName} : ${matchup.count}e affrontement, la rivalité s'enracine.${balance}`,
        });
      }
    }
  }

  // Trie par weight desc — le LLM consommera dans cet ordre.
  out.sort((a, b) => b.weight - a.weight);
  return out;
}
