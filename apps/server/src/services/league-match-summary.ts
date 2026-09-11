/**
 * Lot G — Summarizer PUR de feuille de match.
 *
 * A partir d'un journal d'evenements (`LeagueMatchEvent`), derive :
 *   - le score (count des touchdowns par equipe) ;
 *   - les sorties infligees par equipe : les seules eliminations qui
 *     RAPPORTENT DES PSP (`eliminationEarnsSpp` — blocage, plus les
 *     exceptions nommees : Innovateur Violent, Vol Fatal, Frenesie
 *     d'Agression) ;
 *   - la liste des joueurs blesses (cible + severite) ;
 *   - les stats par joueur (TD, casualties infligees, passes, receptions,
 *     interceptions, aggressions) utiles pour les SPP / classements.
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
  | "ttm_landing"
  | "special_elim"
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
  /**
   * Joueur subissant l'action, dans l'equipe OPPOSEE a `team`… sauf sur
   * `pass_complete`, ou il porte le RECEPTIONNEUR : un coequipier du
   * lanceur (cf. `receptions` ci-dessous).
   */
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
  /**
   * Joueur ADVERSE qui a inflige la sortie, quand il y en a un. `null`
   * pour une auto-elimination (esquive ratee) ou une sortie sans auteur
   * (foule). Alimente l'acquisition du trait Haine (X) : X est un
   * Mot-cle de ce joueur-la.
   */
  readonly causedByPlayerId: string | null;
}

export interface PlayerStatLine {
  readonly playerId: string;
  readonly side: MatchEventTeam;
  touchdowns: number;
  casualtiesInflicted: number;
  completions: number;
  /**
   * Receptions reussies : le joueur a RECEPTIONNE le ballon sur une Action
   * de Passe reussie d'un coequipier (`pass_complete.targetPlayerId`). Ne
   * rapporte AUCUN PSP par defaut (seul le lanceur marque la Reussite) :
   * c'est la Priere a Nuffle « Reception Etourdissante » (D16 = 11) qui
   * accorde 1 PSP au receptionneur.
   */
  receptions: number;
  interceptions: number;
  aggressions: number;
  /** Atterrissages reussis (lancer de coequipier) : 1 PSP chacun. */
  ttmLandings: number;
}

export interface MatchSummary {
  readonly scoreHome: number;
  readonly scoreAway: number;
  /**
   * Sorties infligees par equipe : eliminations qui rapportent des PSP
   * (cf. `eliminationEarnsSpp`). Une agression qui blesse, une sortie par
   * le public ou une Action Speciale sans exception n'y comptent pas.
   */
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
 * Auto-eliminations saisies SANS cible : la victime est l'acteur, dans sa
 * propre equipe, et personne n'« inflige » la sortie (pas de compteur
 * equipe ni de casualtiesInflicted, donc pas de SPP). `other_elim`
 * (esquive ratee, chute…) et `stalling` (temporisation avec blessure
 * saisie « si necessaire », comme pour autre elimination).
 */
const SELF_ELIM_KINDS = new Set<MatchEventKind>(["other_elim", "stalling"]);

/** Côtés d'une feuille bénéficiant d'un effet (Prière à Nuffle). */
export interface SummarySides {
  readonly home?: boolean;
  readonly away?: boolean;
}

export interface MatchSummaryOptions {
  /**
   * Ids des joueurs ayant la compétence « Innovateur Violent »
   * (violent-innovator). BB S3 : une Élimination infligée par une
   * Action Spéciale ne rapporte AUCUN PSP… sauf si son auteur a cette
   * compétence — il gagne alors les PSP d'Élimination (2, ou 3 via le
   * modificateur Bagarreurs Brutaux appliqué en aval par
   * calculatePlayerSPP).
   */
  readonly violentInnovators?: ReadonlySet<string>;
  /**
   * Ids des joueurs ayant la compétence « Vol Fatal » (fatal-flight).
   * BB S3 : lors d'un Lancer de Coéquipier, le joueur LANCÉ qui atterrit
   * (ou rebondit) sur une case occupée et plaque l'adversaire gagne les
   * PSP d'Élimination si celui-ci sort (2, ou 3 via le modificateur
   * Bagarreurs Brutaux appliqué en aval par `calculatePlayerSPP`).
   * Sans la compétence, l'Élimination est bien consignée mais ne
   * rapporte rien à son auteur.
   */
  readonly fatalFlighters?: ReadonlySet<string>;
  /**
   * Côtés bénéficiant de la Prière à Nuffle 13 « Frénésie d'Agression » :
   * une Élimination infligée lors d'une Action d'Agression rapporte alors
   * les PSP d'Élimination à son auteur — et compte donc comme une sortie.
   * Sans la prière, une agression qui blesse reste une agression
   * (`aggressions`) : la blessure est consignée, rien n'est crédité.
   */
  readonly foulingFrenzy?: SummarySides;
}

/**
 * Une élimination rapporte-t-elle les PSP d'Élimination à son auteur ?
 *
 * C'est LA définition d'une « sortie » pour tout ce qui se compte : le
 * compteur d'équipe de la feuille (`casualtiesHome/Away`, donc les colonnes
 * Sor+/Sor- du classement et les points bonus « sorties infligées »), la
 * stat-line du joueur (`casualtiesInflicted`, donc ses PSP et le classement
 * des cogneurs). Règle du livre : seule une Élimination infligée par une
 * Action de Blocage (blitz compris) rapporte des PSP ; une élimination
 * causée autrement — Agression, Action Spéciale, Poussée dans le Public,
 * atterrissage sur un adversaire, auto-élimination — n'en rapporte aucun,
 * sauf exception nommée (compétence ou Prière) portée par `options` :
 *
 *   - `special_elim`  ⇒ « Innovateur Violent » (compétence de l'auteur) ;
 *   - `ttm_landing`   ⇒ « Vol Fatal » (compétence du joueur lancé) ;
 *   - `aggression`    ⇒ « Frénésie d'Agression » (Prière du côté).
 *
 * Une agression sans exception est comptée dans les AGRESSIONS, jamais dans
 * les sorties. Pur : ne lit que l'évènement et les options.
 */
export function eliminationEarnsSpp(
  ev: MatchEventInput,
  options: MatchSummaryOptions = {},
): boolean {
  if (!normalizeSeverity(ev.injurySeverity)) return false;
  const team = ev.team === "home" || ev.team === "away" ? ev.team : null;
  const actor = ev.actorPlayerId ?? null;
  switch (ev.kind) {
    case "casualty":
      // Élimination sur Blocage. Un `causeDetail: "self"` (forme
      // historique d'une auto-élimination) n'a pas d'auteur.
      return ev.causeDetail !== "self";
    case "aggression":
      return team !== null && options.foulingFrenzy?.[team] === true;
    case "special_elim":
      return actor !== null && options.violentInnovators?.has(actor) === true;
    case "ttm_landing":
      return actor !== null && options.fatalFlighters?.has(actor) === true;
    // Poussée dans le Public (« la foule n'a pas d'acteur »), esquive
    // ratée, chute, temporisation : personne n'inflige la sortie.
    case "crowd_surge":
    case "other_elim":
    case "stalling":
    default:
      return false;
  }
}

/**
 * Resume un journal d'evenements. Determinisme total : meme entree ->
 * meme sortie. Les events `kind` inconnus sont ignores silencieusement
 * (defensif vis-a-vis d'un futur kind non gere).
 *
 * Invariant : `casualtiesHome/Away` ne compte que les éliminations qui
 * rapportent des PSP (`eliminationEarnsSpp`), c'est-à-dire exactement
 * celles créditées en `casualtiesInflicted` — à une exception près, une
 * Élimination sur Blocage saisie SANS acteur, qui compte pour l'équipe
 * sans pouvoir être attribuée à un joueur.
 */
export function summarizeMatchSheet(
  events: ReadonlyArray<MatchEventInput>,
  options: MatchSummaryOptions = {},
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
        receptions: 0,
        interceptions: 0,
        aggressions: 0,
        ttmLandings: 0,
      };
      statsByPlayer.set(playerId, line);
    }
    return line;
  };

  /**
   * Consigne une élimination : compteurs de sortie si elle rapporte des
   * PSP, blessure de la victime dans tous les cas (une agression qui
   * blesse ne rapporte rien, mais le joueur est bien blessé).
   */
  const recordElimination = (
    ev: MatchEventInput,
    team: MatchEventTeam | null,
  ): void => {
    const severity = normalizeSeverity(ev.injurySeverity);
    if (!severity) return;

    if (eliminationEarnsSpp(ev, options)) {
      if (team === "home") casualtiesHome += 1;
      else if (team === "away") casualtiesAway += 1;
      if (ev.actorPlayerId && team) {
        ensureStat(ev.actorPlayerId, team).casualtiesInflicted += 1;
      }
    }

    // A62 — other_elim (esquive ratee, chute…) et stalling
    // (temporisation) sont des auto-eliminations saisies SANS cible : la
    // victime est l'acteur, dans sa propre equipe. Retro-compat : les
    // anciens events other_elim portaient la victime en targetPlayerId.
    const isSelfKind = SELF_ELIM_KINDS.has(ev.kind);
    const victimId = isSelfKind
      ? (ev.actorPlayerId ?? ev.targetPlayerId)
      : ev.targetPlayerId;
    if (!victimId) return;
    // Le joueur blesse est dans l'equipe opposee a `team` (l'auteur),
    // sauf auto-elimination (victime dans `team`).
    const isSelfCause = isSelfKind || ev.causeDetail === "self";
    const side = team ? (isSelfCause ? team : opposite(team)) : "home";
    injuries.push({
      playerId: victimId,
      severity,
      side,
      cause: ev.causeDetail ?? ev.kind,
      // Auto-elimination ou foule : personne n'a inflige la sortie, il
      // n'y a donc personne a hair.
      causedByPlayerId:
        isSelfCause || ev.kind === "crowd_surge"
          ? null
          : (ev.actorPlayerId ?? null),
    });
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
        // Le receptionneur est un COEQUIPIER (meme `team` que le lanceur),
        // pas un adversaire : c'est la seule cible du journal qui ne soit
        // pas dans l'equipe opposee. Il est facultatif (feuilles saisies
        // avant cette colonne) et ne compte pas s'il est confondu avec le
        // lanceur (un joueur ne receptionne pas sa propre passe).
        if (
          ev.targetPlayerId &&
          team &&
          ev.targetPlayerId !== ev.actorPlayerId
        ) {
          ensureStat(ev.targetPlayerId, team).receptions += 1;
        }
        break;
      }
      case "interception": {
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).interceptions += 1;
        }
        break;
      }
      case "ttm_landing": {
        // Atterrissage reussi apres un Lancer de coequipier : l'acteur
        // est le joueur LANCE, qui gagne 1 PSP (cf. spp-tracking).
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).ttmLandings += 1;
        }
        // « Vol Fatal » : le joueur lancé atterrit sur une case occupée et
        // plaque l'adversaire. L'Élimination est consignée quoi qu'il
        // arrive (la victime sort), mais elle ne compte — et ne rapporte
        // les PSP d'Élimination — qu'au porteur de la compétence.
        recordElimination(ev, team);
        break;
      }
      case "aggression": {
        // Une agression est une agression : elle compte dans `aggressions`
        // (colonne Agr), et sa blessure éventuelle est consignée. Elle ne
        // devient une sortie que sous « Frénésie d'Agression ».
        if (ev.actorPlayerId && team) {
          ensureStat(ev.actorPlayerId, team).aggressions += 1;
        }
        recordElimination(ev, team);
        break;
      }
      // Élimination sur Blocage (casualty) : la seule qui rapporte des PSP
      // par défaut. special_elim (tronçonneuse, bombe, botte…) : rien sans
      // Innovateur Violent. crowd_surge : la foule n'a pas d'acteur.
      // other_elim / stalling : auto-éliminations.
      case "casualty":
      case "special_elim":
      case "other_elim":
      case "stalling":
      case "crowd_surge": {
        recordElimination(ev, team);
        break;
      }
      // kickoff / expulsion / team_throw : pas d'impact sur score/casualty.
      case "kickoff":
      case "expulsion":
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
  "team_throw",
  "ttm_landing",
  "special_elim",
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
 * = 10 000 po. Le commissaire peut toujours overrider la valeur
 * calculee sur la feuille.
 */
export const WINNINGS_PER_POPULARITY = 10_000;

/**
 * Bonus « sans temporisation » : +10 000 po de gains pour une equipe dont
 * AUCUN joueur n'a temporise pendant le match (aucun event `stalling`
 * pour l'equipe sur la feuille).
 */
export const NO_STALLING_BONUS = 10_000;

/**
 * Derive, par equipe, la presence d'au moins un event `stalling`
 * (temporisation). Pur — sert a alimenter le bonus de gains
 * `NO_STALLING_BONUS` de `computeMatchWinnings`.
 */
export function computeStalledTeams(
  events: ReadonlyArray<MatchEventInput>,
): { home: boolean; away: boolean } {
  let home = false;
  let away = false;
  for (const ev of events) {
    if (ev.kind !== "stalling") continue;
    if (ev.team === "home") home = true;
    else if (ev.team === "away") away = true;
  }
  return { home, away };
}

function clampPopularity(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

/**
 * A63 — Gains officiels BB pour CHAQUE equipe :
 *   (facteur pop domicile + facteur pop exterieur) × 10k / 2
 *   + 10k par TD marque par l'equipe
 *   + 10k si l'equipe n'a pas temporise (cf. `NO_STALLING_BONUS`).
 * Exemple du livre : pop 3 et 2, score 2-1 -> 45 000 / 35 000 (hors bonus).
 * Pur.
 *
 * `stalledHome`/`stalledAway` sont tri-state : `false` = l'equipe n'a pas
 * temporise -> bonus ; `true` = temporisation constatee -> pas de bonus ;
 * omis = information inconnue -> pas de bonus (formule historique). Les
 * appelants feuille de match derivent les flags via `computeStalledTeams`.
 */
export function computeMatchWinnings(input: {
  popularityHome: number | null | undefined;
  popularityAway: number | null | undefined;
  scoreHome: number;
  scoreAway: number;
  stalledHome?: boolean;
  stalledAway?: boolean;
}): { home: number; away: number } {
  const shared = Math.floor(
    ((clampPopularity(input.popularityHome) +
      clampPopularity(input.popularityAway)) *
      WINNINGS_PER_POPULARITY) /
      2,
  );
  return {
    home:
      shared +
      Math.max(0, input.scoreHome) * WINNINGS_PER_POPULARITY +
      (input.stalledHome === false ? NO_STALLING_BONUS : 0),
    away:
      shared +
      Math.max(0, input.scoreAway) * WINNINGS_PER_POPULARITY +
      (input.stalledAway === false ? NO_STALLING_BONUS : 0),
  };
}

