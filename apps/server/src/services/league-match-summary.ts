/**
 * Lot G — Summarizer PUR de feuille de match.
 *
 * A partir d'un journal d'evenements (`LeagueMatchEvent`), derive :
 *   - le score (count des touchdowns par equipe) ;
 *   - les casualties infligees par equipe (events `casualty` +
 *     `other_elim`/`crowd_surge`/`aggression` ayant une `injurySeverity`) ;
 *   - la liste des joueurs blesses (cible + severite) ;
 *   - les stats par joueur (TD, casualties infligees, passes, interceptions,
 *     aggressions) utiles pour les SPP / classements.
 *
 * 100% pur (pas de Prisma) ⇒ testable en unit sans DB. Le service
 * `league-match-sheet` appelle cette fonction au read et a la validation
 * pour figer `scoreHome/scoreAway` et alimenter le pipeline post-match.
 */

export type MatchEventKind =
  | "kickoff"
  | "touchdown"
  | "casualty"
  | "pass_complete"
  | "interception"
  | "aggression"
  | "expulsion"
  | "crowd_surge"
  | "stalling"
  | "team_throw"
  | "other_elim";

export type MatchEventTeam = "home" | "away";

export type InjurySeverity =
  | "badly_hurt"
  | "mng"
  | "niggling"
  | "stat_loss"
  | "dead";

export interface MatchEventInput {
  readonly kind: MatchEventKind;
  readonly team?: MatchEventTeam | null;
  readonly actorPlayerId?: string | null;
  readonly targetPlayerId?: string | null;
  readonly causeDetail?: string | null;
  readonly injurySeverity?: InjurySeverity | string | null;
}

export interface InjuredPlayer {
  readonly playerId: string;
  readonly severity: InjurySeverity;
  /** Equipe du joueur blesse (cote oppose a `team` de l'event source). */
  readonly side: MatchEventTeam;
  /** Cause de l'elimination (block, failed_dodge, crowd, ...). */
  readonly cause: string | null;
}

export interface PlayerStatLine {
  readonly playerId: string;
  readonly side: MatchEventTeam;
  touchdowns: number;
  casualtiesInflicted: number;
  completions: number;
  interceptions: number;
  aggressions: number;
}

export interface MatchSummary {
  readonly scoreHome: number;
  readonly scoreAway: number;
  /** Casualties infligees (toutes causes avec injury) par equipe. */
  readonly casualtiesHome: number;
  readonly casualtiesAway: number;
  readonly injuries: ReadonlyArray<InjuredPlayer>;
  readonly playerStats: ReadonlyArray<PlayerStatLine>;
}

const INJURY_SEVERITIES = new Set<string>([
  "badly_hurt",
  "mng",
  "niggling",
  "stat_loss",
  "dead",
]);

function opposite(team: MatchEventTeam): MatchEventTeam {
  return team === "home" ? "away" : "home";
}

function normalizeSeverity(raw: unknown): InjurySeverity | null {
  if (typeof raw === "string" && INJURY_SEVERITIES.has(raw)) {
    return raw as InjurySeverity;
  }
  return null;
}

/**
 * Evenements qui peuvent porter une casualty/blessure quand
 * `injurySeverity` est present. Une `aggression` reussie qui blesse
 * compte aussi comme casualty infligee.
 */
const CASUALTY_BEARING = new Set<MatchEventKind>([
  "casualty",
  "aggression",
  "other_elim",
  "crowd_surge",
]);

/**
 * Resume un journal d'evenements. Determinisme total : meme entree ->
 * meme sortie. Les events `kind` inconnus sont ignores silencieusement
 * (defensif vis-a-vis d'un futur kind non gere).
 */
export function summarizeMatchSheet(
  events: ReadonlyArray<MatchEventInput>,
): MatchSummary {
  let scoreHome = 0;
  let scoreAway = 0;
  let casualtiesHome = 0;
  let casualtiesAway = 0;
  const injuries: InjuredPlayer[] = [];
  const statsByPlayer = new Map<string, PlayerStatLine>();

  const ensureStat = (
    playerId: string,
    side: MatchEventTeam,
  ): PlayerStatLine => {
    let line = statsByPlayer.get(playerId);
    if (!line) {
      line = {
        playerId,
        side,
        touchdowns: 0,
        casualtiesInflicted: 0,
        completions: 0,
        interceptions: 0,
        aggressions: 0,
      };
      statsByPlayer.set(playerId, line);
    }
    return line;
  };

  for (const ev of events) {
    const team = ev.team === "home" || ev.team === "away" ? ev.team : null;

    switch (ev.kind) {
      case "touchdown": {
        if (team === "home") scoreHome += 1;
        else if (team === "away") scoreAway += 1;
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).touchdowns += 1;
        }
        break;
      }
      case "pass_complete": {
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).completions += 1;
        }
        break;
      }
      case "interception": {
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).interceptions += 1;
        }
        break;
      }
      case "aggression":
      case "casualty":
      case "other_elim":
      case "crowd_surge": {
        const severity = normalizeSeverity(ev.injurySeverity);
        if (ev.kind === "aggression" && ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).aggressions += 1;
        }
        if (CASUALTY_BEARING.has(ev.kind) && severity) {
          // L'acteur inflige une casualty (sauf crowd_surge : la foule
          // n'a pas d'acteur ; on credite l'equipe via `team` = celle
          // qui beneficie, mais pas de stat joueur).
          if (team === "home") casualtiesHome += 1;
          else if (team === "away") casualtiesAway += 1;
          if (
            ev.actorPlayerId &&
            team &&
            ev.kind !== "crowd_surge"
          ) {
            ensureStat(ev.actorPlayerId, team).casualtiesInflicted += 1;
          }
          // Le joueur blesse est dans l'equipe opposee a `team`
          // (l'auteur). Pour other_elim (esquive ratee, etc.) la
          // victime EST dans `team` (auto-elimination) : on gere via
          // un flag `causeDetail` self-cause.
          if (ev.targetPlayerId) {
            const isSelfCause =
              ev.kind === "other_elim" || ev.causeDetail === "self";
            const side = team
              ? isSelfCause
                ? team
                : opposite(team)
              : "home";
            injuries.push({
              playerId: ev.targetPlayerId,
              severity,
              side,
              cause: ev.causeDetail ?? ev.kind,
            });
          }
        }
        break;
      }
      // kickoff / expulsion / stalling : pas d'impact sur score/casualty.
      case "kickoff":
      case "expulsion":
      case "stalling":
      default:
        break;
    }
  }

  return {
    scoreHome,
    scoreAway,
    casualtiesHome,
    casualtiesAway,
    injuries,
    playerStats: [...statsByPlayer.values()],
  };
}

/** Liste blanche des kinds valides (validation cote service/Zod). */
export const MATCH_EVENT_KINDS: ReadonlyArray<MatchEventKind> = [
  "kickoff",
  "touchdown",
  "casualty",
  "pass_complete",
  "interception",
  "aggression",
  "expulsion",
  "crowd_surge",
  "stalling",
  "other_elim",
];

export function isMatchEventKind(v: unknown): v is MatchEventKind {
  return (
    typeof v === "string" &&
    (MATCH_EVENT_KINDS as readonly string[]).includes(v)
  );
}

/**
 * Polish — Gold gagne par point de "facteur de popularite" (BB : le
 * resultat du jet de gains / affluence saisi en avant-match). 1 point
 * = 10 000 po. Heuristique configurable ici ; le commissaire peut
 * toujours overrider la valeur calculee sur la feuille.
 */
export const WINNINGS_PER_POPULARITY = 10_000;

/**
 * Calcule le gain de tresorerie auto a partir du facteur de
 * popularite (clampe >= 0). Pur. `null`/undefined -> 0.
 */
export function computeWinnings(popularity: number | null | undefined): number {
  if (typeof popularity !== "number" || !Number.isFinite(popularity)) {
    return 0;
  }
  return Math.max(0, Math.floor(popularity)) * WINNINGS_PER_POPULARITY;
}

