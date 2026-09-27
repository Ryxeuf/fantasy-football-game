/**
 * Pronostics de ligue — règles PURES (aucun I/O, aucun Prisma).
 *
 * Tout ce qui DÉCIDE vit ici, pour être testé sans base et partagé par la
 * lecture comme par l'écriture : portée, cohérence d'une saisie, note et
 * points d'un pronostic, clôture d'une rencontre, éligibilité (avec un MOTIF,
 * pour que l'écran explique un bouton grisé), groupe et classement.
 *
 * Le service (`league-predictions`) ne fait qu'assembler les lignes Prisma
 * et appeler ces fonctions. Cf. `openspec/changes/league-match-predictions`.
 */

// ---------------------------------------------------------------------------
// Portée
// ---------------------------------------------------------------------------

export const PREDICTION_SCOPES = ["off", "members", "open"] as const;
export type PredictionScope = (typeof PREDICTION_SCOPES)[number];

/** Portée écrite par `createLeague` quand le créateur ne précise rien. */
export const DEFAULT_PREDICTION_SCOPE: PredictionScope = "members";

export function isPredictionScope(raw: unknown): raw is PredictionScope {
  return (
    typeof raw === "string" &&
    (PREDICTION_SCOPES as readonly string[]).includes(raw)
  );
}

/**
 * Portée EFFECTIVE. `null` (ligue antérieure à la fonctionnalité : `db push`
 * n'a rien backfillé) comme toute valeur illisible valent « off » : on ne
 * rouvre jamais une ligue par défaut.
 */
export function parsePredictionScope(raw: unknown): PredictionScope {
  return isPredictionScope(raw) ? raw : "off";
}

// ---------------------------------------------------------------------------
// Saisie
// ---------------------------------------------------------------------------

export const PREDICTION_PICKS = ["home", "draw", "away"] as const;
export type PredictionPick = (typeof PREDICTION_PICKS)[number];
export type PredictionResult = PredictionPick | "void";

/** Borne haute d'un score prédit (un match de Blood Bowl dépasse rarement 6). */
export const MAX_PREDICTED_SCORE = 30;

export function isPredictionPick(raw: unknown): raw is PredictionPick {
  return (
    typeof raw === "string" &&
    (PREDICTION_PICKS as readonly string[]).includes(raw)
  );
}

/** Issue d'un score : domicile, nul ou extérieur. */
export function outcomeOf(homeScore: number, awayScore: number): PredictionPick {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export type PredictionInputError =
  | "invalid_pick"
  | "partial_score"
  | "invalid_score"
  | "score_pick_mismatch";

export interface PredictionInput {
  readonly pick: unknown;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
}

export interface ValidPrediction {
  readonly pick: PredictionPick;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

export type PredictionInputCheck =
  | { readonly ok: true; readonly value: ValidPrediction }
  | { readonly ok: false; readonly error: PredictionInputError };

function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PREDICTED_SCORE;
}

/**
 * Le score est optionnel mais, s'il est donné, il l'est pour les DEUX côtés
 * et il désigne le même vainqueur que `pick` : « extérieur, 2-1 » est refusé.
 * Sans cette règle, un score exact pourrait rapporter avec un vainqueur faux.
 */
export function validatePredictionInput(
  input: PredictionInput,
): PredictionInputCheck {
  if (!isPredictionPick(input.pick)) {
    return { ok: false, error: "invalid_pick" };
  }
  const home = input.homeScore ?? null;
  const away = input.awayScore ?? null;
  if (home === null && away === null) {
    return { ok: true, value: { pick: input.pick, homeScore: null, awayScore: null } };
  }
  if (home === null || away === null) {
    return { ok: false, error: "partial_score" };
  }
  if (!isValidScore(home) || !isValidScore(away)) {
    return { ok: false, error: "invalid_score" };
  }
  if (outcomeOf(home, away) !== input.pick) {
    return { ok: false, error: "score_pick_mismatch" };
  }
  return { ok: true, value: { pick: input.pick, homeScore: home, awayScore: away } };
}

// ---------------------------------------------------------------------------
// Note et points
// ---------------------------------------------------------------------------

/** Barème : le nul juste vaut une victoire juste ; le score exact s'y ajoute. */
export const PREDICTION_POINTS = { outcome: 3, exactScore: 2 } as const;

export type PredictionGrade = "pending" | "void" | "exact" | "outcome" | "wrong";

/** Statuts de rencontre qui sortent un pronostic du classement. */
const VOID_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "forfeit_home",
  "forfeit_away",
  "cancelled",
]);

/** Une rencontre qui ne se jouera plus (ou plus autrement). */
export function isTerminalPairingStatus(status: string): boolean {
  return status === "played" || VOID_PAIRING_STATUSES.has(status);
}

export interface GradablePrediction {
  readonly pick: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly result: string | null;
  readonly resultHomeScore: number | null;
  readonly resultAwayScore: number | null;
}

export interface PredictionScore {
  readonly grade: PredictionGrade;
  readonly points: number;
}

/**
 * Note d'un pronostic, recalculée à chaque lecture : on stocke le RÉSULTAT,
 * jamais les points, pour qu'un changement de barème ne laisse aucun compteur
 * périmé.
 *
 * Le STATUT de la rencontre fait foi avant le résultat copié : un forfait ou
 * une annulation sort le pronostic du classement sans rien écrire, et un
 * résultat resté sur une rencontre ré-ouverte (reversion dont le dérèglement
 * aurait échoué) n'est jamais compté.
 */
export function gradePrediction(
  prediction: GradablePrediction,
  pairingStatus: string,
): PredictionScore {
  if (VOID_PAIRING_STATUSES.has(pairingStatus)) {
    return { grade: "void", points: 0 };
  }
  if (pairingStatus !== "played") {
    return { grade: "pending", points: 0 };
  }
  if (prediction.result === "void") {
    return { grade: "void", points: 0 };
  }
  if (!isPredictionPick(prediction.result)) {
    // Rencontre jouée mais règlement absent : rien à compter.
    return { grade: "pending", points: 0 };
  }
  if (prediction.pick !== prediction.result) {
    return { grade: "wrong", points: 0 };
  }
  const exact =
    prediction.homeScore !== null &&
    prediction.awayScore !== null &&
    prediction.homeScore === prediction.resultHomeScore &&
    prediction.awayScore === prediction.resultAwayScore;
  return exact
    ? {
        grade: "exact",
        points: PREDICTION_POINTS.outcome + PREDICTION_POINTS.exactScore,
      }
    : { grade: "outcome", points: PREDICTION_POINTS.outcome };
}

/** Une note qui compte au classement (réglée, ni forfait ni en attente). */
export function isSettledGrade(grade: PredictionGrade): boolean {
  return grade === "exact" || grade === "outcome" || grade === "wrong";
}

// ---------------------------------------------------------------------------
// Clôture
// ---------------------------------------------------------------------------

export interface PredictionClosureInput {
  readonly status: string;
  /** Clôture WRITE-ONCE (1er évènement, 1re soumission, résultat, manuelle). */
  readonly predictionsClosedAt: Date | null;
  /** Date prévue : une PRÉVISION, relue à chaque lecture. */
  readonly scheduledAt: Date | null;
  /** Journée de play-off pas encore publiée par le commissaire. */
  readonly hiddenPlayoff?: boolean;
  readonly leagueArchived?: boolean;
}

/**
 * Une rencontre est fermée dès qu'un signal est présent. La clôture persistée
 * ne s'efface jamais ; la date prévue, elle, suit un report.
 */
export function isPredictionClosed(
  input: PredictionClosureInput,
  now: Date,
): boolean {
  if (isTerminalPairingStatus(input.status)) return true;
  if (input.predictionsClosedAt) return true;
  if (input.hiddenPlayoff || input.leagueArchived) return true;
  if (input.scheduledAt && input.scheduledAt.getTime() <= now.getTime()) {
    return true;
  }
  return false;
}

/** Heure de clôture à annoncer : la clôture posée, sinon la date prévue. */
export function predictionClosesAt(
  input: Pick<PredictionClosureInput, "predictionsClosedAt" | "scheduledAt">,
): Date | null {
  return input.predictionsClosedAt ?? input.scheduledAt ?? null;
}

/** Placeholder de bracket : le premier qualifié occupe les deux côtés. */
export function isPlaceholderPairing(
  homeParticipantId: string,
  awayParticipantId: string,
): boolean {
  return homeParticipantId === awayParticipantId;
}

// ---------------------------------------------------------------------------
// Éligibilité
// ---------------------------------------------------------------------------

export type PredictionEligibility =
  | "ok"
  | "predictions-off"
  | "anonymous"
  | "not-member"
  | "own-match"
  | "placeholder"
  | "closed";

export interface PredictionEligibilityInput {
  readonly scope: PredictionScope;
  readonly viewerId: string | null;
  /** Commissaire, ou propriétaire d'une équipe ACTIVE de la saison. */
  readonly isMember: boolean;
  /** Le lecteur possède l'une des deux équipes de la rencontre. */
  readonly ownsPairingTeam: boolean;
  readonly placeholder: boolean;
  readonly closed: boolean;
}

/**
 * Qui peut pronostiquer cette rencontre, et sinon pourquoi. La VISIBILITÉ de
 * la ligue est tranchée AVANT, par `services/league-access` : une ligue privée
 * invisible répond 404 et n'arrive jamais ici.
 *
 * L'ordre des motifs va du plus général au plus particulier, pour que l'écran
 * annonce la vraie raison (« pronostics désactivés » plutôt que « fermé »).
 */
export function predictionEligibility(
  input: PredictionEligibilityInput,
): PredictionEligibility {
  if (input.scope === "off") return "predictions-off";
  if (!input.viewerId) return "anonymous";
  if (input.scope === "members" && !input.isMember) return "not-member";
  if (input.ownsPairingTeam) return "own-match";
  if (input.placeholder) return "placeholder";
  if (input.closed) return "closed";
  return "ok";
}

// ---------------------------------------------------------------------------
// Affichage des autres
// ---------------------------------------------------------------------------

export const ANONYMOUS_PREDICTOR = "Coach anonyme";

/**
 * Nom affiché d'un pronostiqueur. Les membres de la ligue (coachs de la
 * saison, commissaire) sont déjà nommés partout sur la fiche ; un spectateur
 * au profil privé, lui, ne l'est pas — sauf pour lui-même.
 */
export function predictorDisplayName(input: {
  readonly coachName: string | null;
  readonly privateProfile: boolean;
  readonly isLeagueMember: boolean;
  readonly isViewer: boolean;
}): string {
  if (input.privateProfile && !input.isLeagueMember && !input.isViewer) {
    return ANONYMOUS_PREDICTOR;
  }
  const name = input.coachName?.trim();
  return name && name.length > 0 ? name : ANONYMOUS_PREDICTOR;
}

export interface PickDistribution {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
  readonly total: number;
}

/** Répartition des choix d'une rencontre FERMÉE. */
export function pickDistribution(
  picks: readonly string[],
): PickDistribution {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const pick of picks) {
    if (pick === "home") home += 1;
    else if (pick === "draw") draw += 1;
    else if (pick === "away") away += 1;
  }
  return { home, draw, away, total: home + draw + away };
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

export type PredictionGroup = "coach" | "stands";

/**
 * Coachs : propriétaires d'une équipe ACTIVE de la saison — ils pronostiquent
 * N-1 rencontres par journée. Tribunes : tous les autres (commissaire sans
 * équipe, coach retiré, spectateurs), qui en ont N. Relu à chaque lecture.
 */
export function predictionGroupOf(isActiveCoach: boolean): PredictionGroup {
  return isActiveCoach ? "coach" : "stands";
}

export interface LeaderboardPrediction {
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly grade: PredictionGrade;
  readonly points: number;
}

export interface PredictionLeaderboardEntry {
  readonly rank: number;
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly points: number;
  /** Pronostics réglés (justes ou faux), forfaits exclus. */
  readonly settled: number;
  /** Bons résultats, scores exacts compris. */
  readonly correct: number;
  readonly exact: number;
}

export interface PredictionLeaderboard {
  readonly coach: readonly PredictionLeaderboardEntry[];
  readonly stands: readonly PredictionLeaderboardEntry[];
}

type UnrankedEntry = Omit<PredictionLeaderboardEntry, "rank">;

/** Points, puis scores exacts, puis bons résultats. */
function compareMerit(a: UnrankedEntry, b: UnrankedEntry): number {
  return b.points - a.points || b.exact - a.exact || b.correct - a.correct;
}

/** Ordre total : le mérite, puis le nom, puis l'id (stable d'un appel à l'autre). */
export function comparePredictionEntries(
  a: UnrankedEntry,
  b: UnrankedEntry,
): number {
  return (
    compareMerit(a, b) ||
    a.displayName.localeCompare(b.displayName, "fr") ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
}

function rankGroup(entries: UnrankedEntry[]): PredictionLeaderboardEntry[] {
  const sorted = [...entries].sort(comparePredictionEntries);
  const ranked: PredictionLeaderboardEntry[] = [];
  sorted.forEach((entry, index) => {
    const previous = ranked[index - 1];
    const tied = previous !== undefined && compareMerit(previous, entry) === 0;
    ranked.push({ ...entry, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}

/**
 * Classement DÉRIVÉ, jamais persisté : invalider une feuille le remet
 * d'aplomb sans rien réécrire. Un utilisateur n'y figure qu'avec au moins un
 * pronostic sur une rencontre FERMÉE et tranchée (réglée ou forfaite) : y
 * faire apparaître un pronostic encore en attente révélerait, avant la
 * clôture, qui a pronostiqué.
 */
export function computePredictionLeaderboard(
  predictions: readonly LeaderboardPrediction[],
): PredictionLeaderboard {
  const byUser = new Map<string, UnrankedEntry>();
  for (const prediction of predictions) {
    if (prediction.grade === "pending") continue;
    const current = byUser.get(prediction.userId) ?? {
      userId: prediction.userId,
      displayName: prediction.displayName,
      group: prediction.group,
      points: 0,
      settled: 0,
      correct: 0,
      exact: 0,
    };
    const settled = isSettledGrade(prediction.grade);
    const correct =
      prediction.grade === "exact" || prediction.grade === "outcome";
    byUser.set(prediction.userId, {
      ...current,
      points: current.points + (settled ? prediction.points : 0),
      settled: current.settled + (settled ? 1 : 0),
      correct: current.correct + (correct ? 1 : 0),
      exact: current.exact + (prediction.grade === "exact" ? 1 : 0),
    });
  }
  const all = Array.from(byUser.values());
  return {
    coach: rankGroup(all.filter((e) => e.group === "coach")),
    stands: rankGroup(all.filter((e) => e.group === "stands")),
  };
}

/**
 * Tête d'un groupe : les premiers ex æquo, à condition d'avoir marqué. Sert
 * le titre d'Oracle (groupe Coachs) et le succès des tribunes.
 */
export function leaderboardLeaders(
  entries: readonly PredictionLeaderboardEntry[],
): PredictionLeaderboardEntry[] {
  return entries.filter((e) => e.rank === 1 && e.points > 0);
}
