/**
 * Garde d'OUVERTURE d'une feuille de match de ligue.
 *
 * L'ouverture d'une feuille fige l'état complet des deux équipes (« version
 * du match », cf. `captureMatchSnapshots`). Ouverte AVANT que la rencontre
 * précédente d'une des deux équipes soit validée, elle part d'un état sans
 * les effets de cette rencontre (PSP, blessures, morts, or, fans,
 * évolutions) — retour testeur : « la fdm de ma J3 a été ouverte le 16/09 et
 * reste comme si nos 2 teams n'avaient pas joué ».
 *
 * Règle : une feuille de ligue ne s'ouvre pas tant qu'une rencontre d'une
 * journée ANTÉRIEURE de la même saison, impliquant l'une des deux équipes,
 * n'est pas close (jouée, forfait ou annulée). Le commissaire peut forcer :
 * en ligue physique, une journée reportée se joue parfois après la
 * suivante, et la bloquer gèlerait la ligue.
 *
 * Module PUR : le service lui passe les rencontres candidates, il décide.
 */

/** Statuts d'une rencontre de ligue dont le résultat ne bougera plus. */
export const CLOSED_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "played",
  "forfeit_home",
  "forfeit_away",
  "cancelled",
]);

/** La rencontre dont on ouvre la feuille. */
export interface OpenGuardCurrentPairing {
  readonly id: string;
  readonly roundNumber: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
}

/** Une rencontre de la saison, telle que la garde doit la lire. */
export interface OpenGuardCandidatePairing {
  readonly id: string;
  readonly status: string;
  readonly roundNumber: number;
  readonly roundName: string | null;
  readonly homeTeamId: string;
  readonly homeTeamName: string;
  readonly awayTeamId: string;
  readonly awayTeamName: string;
}

/** Une rencontre antérieure encore ouverte, qui bloque l'ouverture. */
export interface BlockingPreviousPairing {
  readonly pairingId: string;
  readonly roundNumber: number;
  readonly roundLabel: string;
  /** Équipe(s) de la feuille courante concernée(s) par cette rencontre. */
  readonly teamNames: readonly string[];
  /** Les deux équipes de la rencontre bloquante, pour l'affichage. */
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly status: string;
}

/** Libellé d'une journée : son nom s'il en a un, sinon « journée N ». */
export function roundLabel(roundNumber: number, roundName: string | null): string {
  const name = roundName?.trim();
  return name ? name : `journée ${roundNumber}`;
}

/**
 * Rencontres antérieures encore ouvertes d'une des deux équipes de
 * `current`, triées par journée. Vide = l'ouverture est libre.
 */
export function findBlockingPreviousPairings(input: {
  readonly current: OpenGuardCurrentPairing;
  readonly candidates: readonly OpenGuardCandidatePairing[];
}): BlockingPreviousPairing[] {
  const { current } = input;
  const teams = new Set([current.homeTeamId, current.awayTeamId]);
  const out: BlockingPreviousPairing[] = [];
  for (const p of input.candidates) {
    if (p.id === current.id) continue;
    if (p.roundNumber >= current.roundNumber) continue;
    if (CLOSED_PAIRING_STATUSES.has(p.status)) continue;
    const teamNames: string[] = [];
    if (teams.has(p.homeTeamId)) teamNames.push(p.homeTeamName);
    // Un placeholder de bracket (`home === away`) ne compte qu'une fois.
    if (teams.has(p.awayTeamId) && p.awayTeamId !== p.homeTeamId) {
      teamNames.push(p.awayTeamName);
    }
    if (teamNames.length === 0) continue;
    out.push({
      pairingId: p.id,
      roundNumber: p.roundNumber,
      roundLabel: roundLabel(p.roundNumber, p.roundName),
      teamNames,
      homeTeamName: p.homeTeamName,
      awayTeamName: p.awayTeamName,
      status: p.status,
    });
  }
  return out.sort(
    (a, b) => a.roundNumber - b.roundNumber || a.pairingId.localeCompare(b.pairingId),
  );
}

/**
 * Message du refus, lisible par un coach : QUELLE rencontre bloque, POURQUOI
 * il faut attendre, et — pour le commissaire — qu'il peut forcer.
 */
export function previousMatchPendingMessage(
  blocking: readonly BlockingPreviousPairing[],
  canForce: boolean,
): string {
  const list = blocking
    .map((b) => `${b.roundLabel} : ${b.homeTeamName} – ${b.awayTeamName}`)
    .join(" ; ");
  const base =
    `Feuille non ouverte : une rencontre précédente n'est pas encore close (${list}). ` +
    "Faites d'abord valider sa feuille — sinon celle-ci partirait d'un état " +
    "d'équipe sans ses effets (PSP, blessures, trésorerie…).";
  return canForce
    ? `${base} En tant que commissaire, vous pouvez l'ouvrir quand même (rencontre reportée).`
    : base;
}
