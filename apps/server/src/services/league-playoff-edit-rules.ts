/**
 * Édition d'un bracket de play-offs de LIGUE déjà généré — règles PURES.
 *
 * Deux leviers du commissaire, qui ne se chevauchent pas :
 *
 *  - RÉINITIALISER : tant qu'aucune rencontre du bracket n'est engagée, on
 *    supprime tous les tours de bracket ; la taille redevient éditable et
 *    le commissaire relance. C'est la réponse à « j'ai choisi une finale à
 *    2, je veux un carré final ».
 *  - REMPLACER un qualifié dans UNE rencontre non engagée, même si d'autres
 *    rencontres du bracket sont jouées. C'est la réponse à « le 2e a quitté
 *    la ligue, je ne peux pas mettre le 3e ». L'éditeur complet existant
 *    (`overridePlayoffParticipants`) reste le levier quand rien n'est joué.
 *
 * Le service charge, ce module décide : aucune I/O, testable sans Prisma.
 */

/** Rencontre ENCORE OUVERTE (aucun résultat). */
export const OPEN_PLAYOFF_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "in_progress",
]);

/**
 * Statuts de feuille qui disent qu'un résultat a été saisi : soumise par un
 * coach, par les deux, validée, ou en correction après invalidation.
 */
const SHEET_ENGAGED_STATUSES: ReadonlySet<string> = new Set([
  "submitted_home",
  "submitted_away",
  "both_submitted",
  "validated",
  "invalidated",
]);

/** Une rencontre de bracket telle que les décisions doivent la lire. */
export interface PlayoffPairingState {
  readonly id: string;
  readonly status: string;
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
  /** Match en ligne rattaché (`Match.leaguePairingId`), null sinon. */
  readonly matchId: string | null;
  /** Statut de la feuille de match, null si aucune feuille n'existe. */
  readonly sheetStatus: string | null;
  /** Nombre d'évènements saisis sur la feuille (0 sans feuille). */
  readonly sheetEventCount: number;
}

/**
 * Une rencontre est ENGAGÉE dès que quelque chose a été joué ou saisi :
 * résultat (statut terminal hors annulation), match en ligne lancé, feuille
 * soumise / validée / invalidée, ou brouillon qui porte déjà des évènements.
 * Une feuille en brouillon VIDE ne compte pas : elle n'est qu'un gel des
 * rosters, recréé à la prochaine ouverture.
 */
export function isPlayoffPairingEngaged(p: PlayoffPairingState): boolean {
  if (p.status !== "scheduled" && p.status !== "cancelled") return true;
  if (p.matchId) return true;
  if (p.sheetStatus && SHEET_ENGAGED_STATUSES.has(p.sheetStatus)) return true;
  return p.sheetEventCount > 0;
}

/** Convention de bracket : une rencontre dont un seul côté est connu. */
export function isPlaceholderPairing(p: {
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
}): boolean {
  return p.homeParticipantId === p.awayParticipantId;
}

// ───────────────────────────── Réinitialisation ─────────────────────────────

export type PlayoffResetRefusal =
  | "season_completed"
  | "no_bracket"
  | "bracket_engaged";

export type PlayoffResetDecision =
  | { readonly ok: true; readonly roundCount: number }
  | {
      readonly ok: false;
      readonly code: PlayoffResetRefusal;
      readonly message: string;
      /** Rencontres qui bloquent (pour `bracket_engaged`). */
      readonly engagedPairingIds?: readonly string[];
    };

export function decidePlayoffReset(input: {
  readonly seasonStatus: string;
  readonly rounds: ReadonlyArray<{
    readonly pairings: readonly PlayoffPairingState[];
  }>;
}): PlayoffResetDecision {
  if (input.seasonStatus === "completed") {
    return {
      ok: false,
      code: "season_completed",
      message: "Saison clôturée : le bracket ne peut plus être réinitialisé",
    };
  }
  if (input.rounds.length === 0) {
    return {
      ok: false,
      code: "no_bracket",
      message: "Aucun bracket de play-offs à réinitialiser",
    };
  }
  const engaged = input.rounds
    .flatMap((r) => r.pairings)
    .filter(isPlayoffPairingEngaged)
    .map((p) => p.id);
  if (engaged.length > 0) {
    return {
      ok: false,
      code: "bracket_engaged",
      message:
        "Une rencontre de play-off est déjà jouée ou en cours de saisie : remplacez plutôt le qualifié dans la rencontre concernée",
      engagedPairingIds: engaged,
    };
  }
  return { ok: true, roundCount: input.rounds.length };
}

// ─────────────────────────────── Remplacement ───────────────────────────────

export type PlayoffReplaceRefusal =
  | "not_a_bracket_pairing"
  | "season_completed"
  | "pairing_closed"
  | "pairing_engaged"
  | "participant_not_found"
  | "participant_not_active"
  | "participant_already_in_bracket"
  | "no_change";

export interface PlayoffReplacementCandidate {
  readonly id: string;
  readonly seasonId: string;
  readonly status: string;
}

export interface PlayoffReplaceInput {
  readonly seasonId: string;
  readonly seasonStatus: string;
  /** La rencontre visée. `isBracket` : tour `kind=playoff` OU `bracketSlot`. */
  readonly pairing: PlayoffPairingState & { readonly isBracket: boolean };
  readonly side: "home" | "away";
  /** null = participant introuvable. */
  readonly replacement: PlayoffReplacementCandidate | null;
  /** Toutes les rencontres du bracket de la saison (la visée comprise). */
  readonly bracketPairings: readonly PlayoffPairingState[];
}

export type PlayoffReplaceDecision =
  | {
      readonly ok: true;
      /** Participant qui sort du bracket. */
      readonly replacedParticipantId: string;
      /** Données à écrire sur la rencontre. */
      readonly data: {
        readonly homeParticipantId: string;
        readonly awayParticipantId: string;
      };
    }
  | {
      readonly ok: false;
      readonly code: PlayoffReplaceRefusal;
      readonly message: string;
    };

function refuse(
  code: PlayoffReplaceRefusal,
  message: string,
): PlayoffReplaceDecision {
  return { ok: false, code, message };
}

/**
 * Remplacer le participant d'un côté d'une rencontre de bracket.
 *
 * - La rencontre doit être OUVERTE (`scheduled`) et non engagée — les
 *   autres rencontres du bracket, elles, peuvent être jouées.
 * - Le remplaçant est un participant `active` de la saison, absent de toute
 *   rencontre de bracket ENCORE OUVERTE (sinon il jouerait deux tableaux à
 *   la fois). Une équipe éliminée plus tôt peut être repêchée : c'est
 *   exactement le cas du 3e qui remplace un finaliste parti.
 * - PLACEHOLDER (`home === away`, un seul qualifié connu) : on remplace CE
 *   qualifié, sur les deux côtés, pour que la convention tienne — le
 *   vainqueur de la rencontre sœur écrasera son côté à son arrivée.
 *   `side` est alors sans effet.
 */
export function decidePlayoffReplacement(
  input: PlayoffReplaceInput,
): PlayoffReplaceDecision {
  const { pairing, replacement } = input;
  if (!pairing.isBracket) {
    return refuse(
      "not_a_bracket_pairing",
      "Cette rencontre n'appartient pas au bracket des play-offs",
    );
  }
  if (input.seasonStatus === "completed") {
    return refuse(
      "season_completed",
      "Saison clôturée : le bracket ne peut plus être modifié",
    );
  }
  if (pairing.status !== "scheduled") {
    return refuse(
      "pairing_closed",
      "Rencontre déjà jouée, déclarée forfait ou annulée : elle ne se modifie plus",
    );
  }
  if (isPlayoffPairingEngaged(pairing)) {
    return refuse(
      "pairing_engaged",
      "Rencontre en cours de saisie : traitez sa feuille de match avant de changer d'équipe",
    );
  }
  if (!replacement || replacement.seasonId !== input.seasonId) {
    return refuse(
      "participant_not_found",
      "Équipe introuvable dans cette saison",
    );
  }
  if (replacement.status !== "active") {
    return refuse(
      "participant_not_active",
      "Seule une équipe encore inscrite (active) peut entrer dans le bracket",
    );
  }

  const placeholder = isPlaceholderPairing(pairing);
  const replacedParticipantId = placeholder
    ? pairing.homeParticipantId
    : input.side === "home"
      ? pairing.homeParticipantId
      : pairing.awayParticipantId;
  if (replacement.id === replacedParticipantId) {
    return refuse("no_change", "Cette équipe occupe déjà cette place");
  }

  const alreadyAlive = input.bracketPairings.some((p) => {
    if (!OPEN_PLAYOFF_PAIRING_STATUSES.has(p.status)) return false;
    if (p.id === pairing.id) {
      // L'autre côté de la rencontre visée (le côté remplacé, lui, s'en va).
      return (
        !placeholder &&
        (input.side === "home"
          ? p.awayParticipantId
          : p.homeParticipantId) === replacement.id
      );
    }
    return (
      p.homeParticipantId === replacement.id ||
      p.awayParticipantId === replacement.id
    );
  });
  if (alreadyAlive) {
    return refuse(
      "participant_already_in_bracket",
      "Cette équipe a déjà une rencontre de play-off à jouer",
    );
  }

  const data = placeholder
    ? { homeParticipantId: replacement.id, awayParticipantId: replacement.id }
    : input.side === "home"
      ? {
          homeParticipantId: replacement.id,
          awayParticipantId: pairing.awayParticipantId,
        }
      : {
          homeParticipantId: pairing.homeParticipantId,
          awayParticipantId: replacement.id,
        };
  return { ok: true, replacedParticipantId, data };
}
