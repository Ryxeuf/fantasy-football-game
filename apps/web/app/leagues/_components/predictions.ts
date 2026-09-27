/**
 * Pronostics de ligue — types de l'API et règles d'AFFICHAGE (pur, sans DOM).
 *
 * Le serveur reste la vérité : éligibilité, clôture, notes et classement
 * arrivent calculés (`GET /leagues/seasons/:id/predictions[/leaderboard]`).
 * Ce module ne fait que les présenter, et double la validation d'un choix
 * pour un retour immédiat (`validatePredictionDraft`, calqué sur
 * `league-predictions-rules` côté serveur).
 */

// ---------------------------------------------------------------------------
// Portée
// ---------------------------------------------------------------------------

export const PREDICTION_SCOPES = ["off", "members", "open"] as const;
export type PredictionScope = (typeof PREDICTION_SCOPES)[number];

/** Valeur d'une ligue créée sans préciser : la même que le serveur. */
export const DEFAULT_PREDICTION_SCOPE: PredictionScope = "members";

/**
 * Portée EFFECTIVE d'une valeur brute : une ligue antérieure (colonne à
 * `null`) ou une valeur inconnue n'a PAS de pronostics.
 */
export function parsePredictionScope(raw: unknown): PredictionScope {
  return typeof raw === "string" &&
    (PREDICTION_SCOPES as readonly string[]).includes(raw)
    ? (raw as PredictionScope)
    : "off";
}

export const PREDICTION_SCOPE_OPTIONS: ReadonlyArray<{
  readonly value: PredictionScope;
  readonly label: string;
  readonly description: string;
}> = [
  {
    value: "off",
    label: "Désactivés",
    description: "Aucun pronostic sur les rencontres de la ligue.",
  },
  {
    value: "members",
    label: "Membres de la ligue",
    description:
      "Le commissaire et les coachs inscrits pronostiquent les rencontres des autres.",
  },
  {
    value: "open",
    label: "Tout le monde",
    description:
      "Tout compte connecté qui voit la ligue peut pronostiquer ; les non-inscrits forment les Tribunes.",
  },
];

// ---------------------------------------------------------------------------
// Types de l'API
// ---------------------------------------------------------------------------

export const PREDICTION_PICKS = ["home", "draw", "away"] as const;
export type PredictionPick = (typeof PREDICTION_PICKS)[number];
export type PredictionResult = PredictionPick | "void";
export type PredictionGrade = "pending" | "void" | "exact" | "outcome" | "wrong";
export type PredictionGroup = "coach" | "stands";
export type PredictionEligibility =
  | "ok"
  | "predictions-off"
  | "anonymous"
  | "not-member"
  | "own-match"
  | "placeholder"
  | "closed";

export interface PredictionTeamView {
  readonly participantId: string;
  readonly teamId: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly coachName: string | null;
}

export interface PredictionView {
  readonly pick: PredictionPick;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly grade: PredictionGrade;
  readonly points: number;
}

export interface OtherPredictionView extends PredictionView {
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly isViewer: boolean;
}

export interface PickDistribution {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
  readonly total: number;
}

export interface PairingPredictionsView {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: string | null;
  readonly closesAt: string | null;
  readonly closed: boolean;
  readonly placeholder: boolean;
  readonly home: PredictionTeamView;
  readonly away: PredictionTeamView;
  readonly result: {
    readonly outcome: PredictionResult;
    readonly homeScore: number | null;
    readonly awayScore: number | null;
  } | null;
  readonly eligibility: PredictionEligibility;
  readonly canClose: boolean;
  readonly myPrediction: PredictionView | null;
  /** `null` tant que la rencontre est ouverte : rien ne fuit avant. */
  readonly predictions: readonly OtherPredictionView[] | null;
  readonly distribution: PickDistribution | null;
}

export interface RoundPredictionsView {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly kind: string;
  readonly startDate: string | null;
  readonly canClose: boolean;
  readonly pairings: readonly PairingPredictionsView[];
}

export interface SeasonPredictionsView {
  readonly seasonId: string;
  readonly leagueId: string;
  readonly scope: PredictionScope;
  /** Faux sur une ligue antérieure à la fonctionnalité (flag brut). */
  readonly scopeConfigured: boolean;
  readonly viewer: {
    readonly userId: string | null;
    readonly isCommissioner: boolean;
    readonly isMember: boolean;
    readonly group: PredictionGroup | null;
  };
  readonly rounds: readonly RoundPredictionsView[];
}

export interface LeaderboardEntryView {
  readonly rank: number;
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly points: number;
  readonly settled: number;
  readonly correct: number;
  readonly exact: number;
  readonly isViewer: boolean;
}

export interface SeasonPredictionLeaderboardView {
  readonly seasonId: string;
  readonly scope: PredictionScope;
  readonly coach: readonly LeaderboardEntryView[];
  readonly stands: readonly LeaderboardEntryView[];
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

export function seasonPredictionsPath(seasonId: string): string {
  return `/leagues/seasons/${seasonId}/predictions`;
}

export function seasonPredictionLeaderboardPath(seasonId: string): string {
  return `/leagues/seasons/${seasonId}/predictions/leaderboard`;
}

export function pairingPredictionPath(pairingId: string): string {
  return `/leagues/pairings/${pairingId}/prediction`;
}

// ---------------------------------------------------------------------------
// Saisie
// ---------------------------------------------------------------------------

/** Borne haute d'un score prédit, identique au serveur. */
export const MAX_PREDICTED_SCORE = 30;

export interface PredictionDraft {
  readonly pick: PredictionPick | null;
  /** Champ texte brut : vide = pas de score. */
  readonly homeScore: string;
  readonly awayScore: string;
}

export type PredictionDraftResult =
  | {
      readonly ok: true;
      readonly body: {
        readonly pick: PredictionPick;
        readonly homeScore: number | null;
        readonly awayScore: number | null;
      };
    }
  | { readonly ok: false; readonly error: string };

export function outcomeOf(home: number, away: number): PredictionPick {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function parseScore(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  return value > MAX_PREDICTED_SCORE ? "invalid" : value;
}

/**
 * Valide un choix avant envoi, avec les règles du serveur : un choix est
 * obligatoire, le score est facultatif mais complet (les deux ou aucun), et
 * doit donner l'issue choisie.
 */
export function validatePredictionDraft(
  draft: PredictionDraft,
): PredictionDraftResult {
  if (!draft.pick) {
    return { ok: false, error: "Choisis une issue : victoire, nul ou défaite." };
  }
  const home = parseScore(draft.homeScore);
  const away = parseScore(draft.awayScore);
  if (home === "invalid" || away === "invalid") {
    return {
      ok: false,
      error: `Un score est un nombre entier entre 0 et ${MAX_PREDICTED_SCORE}.`,
    };
  }
  if ((home === null) !== (away === null)) {
    return {
      ok: false,
      error: "Renseigne les deux scores, ou aucun.",
    };
  }
  if (home !== null && away !== null && outcomeOf(home, away) !== draft.pick) {
    return {
      ok: false,
      error: "Le score ne correspond pas à l'issue choisie.",
    };
  }
  return {
    ok: true,
    body: { pick: draft.pick, homeScore: home, awayScore: away },
  };
}

/** Brouillon initial : le pronostic déjà posé, sinon vide. */
export function draftFromPrediction(
  prediction: PredictionView | null,
): PredictionDraft {
  if (!prediction) return { pick: null, homeScore: "", awayScore: "" };
  return {
    pick: prediction.pick,
    homeScore: prediction.homeScore === null ? "" : String(prediction.homeScore),
    awayScore: prediction.awayScore === null ? "" : String(prediction.awayScore),
  };
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

/** Libellé d'un choix, nommé par l'équipe plutôt que « 1 / N / 2 ». */
export function pickLabel(
  pick: PredictionResult,
  home: string,
  away: string,
): string {
  if (pick === "home") return `Victoire ${home}`;
  if (pick === "away") return `Victoire ${away}`;
  if (pick === "draw") return "Match nul";
  return "Rencontre non jouée";
}

/** Un pronostic en une ligne : « Victoire X (2-1) ». */
export function describePrediction(
  prediction: Pick<PredictionView, "pick" | "homeScore" | "awayScore">,
  home: string,
  away: string,
): string {
  const label = pickLabel(prediction.pick, home, away);
  return prediction.homeScore !== null && prediction.awayScore !== null
    ? `${label} (${prediction.homeScore}-${prediction.awayScore})`
    : label;
}

export const GRADE_LABELS: Readonly<Record<PredictionGrade, string>> = {
  pending: "En attente du résultat",
  void: "Annulé (rencontre non jouée)",
  exact: "Score exact",
  outcome: "Bon résultat",
  wrong: "Raté",
};

/** Pourquoi le lecteur ne peut pas (ou plus) pronostiquer une rencontre. */
export const ELIGIBILITY_MESSAGES: Readonly<
  Record<Exclude<PredictionEligibility, "ok">, string>
> = {
  "predictions-off": "Les pronostics sont désactivés sur cette ligue.",
  anonymous: "Connecte-toi pour pronostiquer.",
  "not-member": "Réservé aux membres de la ligue.",
  "own-match": "Tu joues cette rencontre : pas de pronostic sur ton propre match.",
  placeholder: "Affiche à venir : les deux équipes ne sont pas encore connues.",
  closed: "Pronostics clos.",
};

export const GROUP_LABELS: Readonly<Record<PredictionGroup, string>> = {
  coach: "Coachs",
  stands: "Tribunes",
};

export function roundLabel(round: {
  readonly roundNumber: number;
  readonly name: string | null;
}): string {
  return round.name?.trim() || `Journée ${round.roundNumber}`;
}

/** « 2 pts », « 1 pt », « 0 pt ». */
export function pointsLabel(points: number): string {
  return `${points} ${Math.abs(points) > 1 ? "pts" : "pt"}`;
}

/** Échéance lisible d'une rencontre encore ouverte, sinon `null`. */
export function formatClosesAt(
  closesAt: string | null,
  locale = "fr-FR",
): string | null {
  if (!closesAt) return null;
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Part d'un choix dans la répartition, en pourcentage entier. */
export function pickShare(distribution: PickDistribution, pick: PredictionPick): number {
  if (distribution.total <= 0) return 0;
  return Math.round((distribution[pick] / distribution.total) * 100);
}

// ---------------------------------------------------------------------------
// Sélection
// ---------------------------------------------------------------------------

/**
 * La journée à mettre en avant : la première qui a encore une rencontre
 * ouverte, sinon la dernière journée jouée (pour voir les pronostics des
 * autres), sinon rien.
 */
export function featuredRound(
  rounds: readonly RoundPredictionsView[],
): RoundPredictionsView | null {
  const open = rounds.find((r) =>
    r.pairings.some((p) => !p.closed && !p.placeholder),
  );
  if (open) return open;
  const withResults = rounds.filter((r) =>
    r.pairings.some((p) => p.result !== null),
  );
  return withResults.length > 0 ? withResults[withResults.length - 1] : null;
}

/** Nombre de rencontres encore pronostiquables par le lecteur. */
export function openPredictableCount(round: RoundPredictionsView): number {
  return round.pairings.filter((p) => p.eligibility === "ok").length;
}

/** La ligne du lecteur dans un onglet du classement, s'il y figure. */
export function viewerEntry(
  entries: readonly LeaderboardEntryView[],
): LeaderboardEntryView | null {
  return entries.find((e) => e.isViewer) ?? null;
}
