/**
 * Appariement en ronde suisse (moteur PUR, sans I/O).
 *
 * Principe (système suisse « à la Monrad », le plus courant en tournoi
 * Blood Bowl) : à chaque ronde, on apparie les équipes dans l'ordre du
 * classement courant, chacune contre l'adversaire le plus proche qu'elle
 * n'a pas encore rencontré. Personne n'est éliminé, tout le monde joue à
 * chaque ronde, et les équipes de même niveau se retrouvent.
 *
 * Contrats :
 *   - `standings` est la liste des équipes DANS L'ORDRE du classement
 *     (1er en tête). Le moteur ne recalcule pas le classement : c'est le
 *     service qui le fournit (`computeCupStandings`), départages compris.
 *   - Jamais de rematch tant qu'un appariement sans rematch existe : une
 *     recherche avec retour arrière (backtracking) explore les
 *     alternatives quand le choix « au plus proche » mène à une impasse.
 *     Si aucun appariement sans rematch n'existe (petit tournoi, beaucoup
 *     de rondes), on retombe sur l'appariement le plus proche en
 *     autorisant les rematches.
 *   - Nombre impair : la dernière équipe du classement n'ayant PAS encore
 *     été exemptée est exempte (bye) ; si toutes l'ont déjà été, la
 *     dernière.
 *   - Domicile / extérieur : l'équipe ayant reçu le moins de fois joue à
 *     domicile ; à égalité, la mieux classée.
 *   - Déterministe : même entrée -> même sortie.
 */

export interface SwissStanding {
  readonly teamId: string;
}

export interface SwissHistory {
  /** Rencontres déjà jouées (ou planifiées), dans n'importe quel ordre. */
  readonly playedPairs: ReadonlyArray<readonly [string, string]>;
  /** Équipes déjà exemptées lors d'une ronde précédente. */
  readonly byes: ReadonlyArray<string>;
  /** Nombre de rencontres à domicile par équipe (absent = 0). */
  readonly homeCounts?: Readonly<Record<string, number>>;
}

export interface SwissPairing {
  readonly home: string;
  readonly away: string;
  /** 1 = table de tête (meilleur classé de la rencontre). */
  readonly table: number;
}

export interface SwissRoundResult {
  readonly pairings: readonly SwissPairing[];
  /** Équipe exemptée (nombre impair), sinon null. */
  readonly bye: string | null;
  /** Vrai si un rematch a dû être accepté (aucune alternative). */
  readonly rematchForced: boolean;
}

/** Budget de nœuds explorés avant de renoncer au « zéro rematch ». */
const BACKTRACK_BUDGET = 200_000;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Choisit l'exempt : la dernière équipe du classement qui ne l'a pas
 * encore été, sinon la dernière tout court.
 */
export function pickBye(
  ranked: readonly string[],
  previousByes: ReadonlyArray<string>,
): string {
  const had = new Set(previousByes);
  for (let i = ranked.length - 1; i >= 0; i -= 1) {
    if (!had.has(ranked[i])) return ranked[i];
  }
  return ranked[ranked.length - 1];
}

/**
 * Appariement sans rematch par recherche avec retour arrière. `ranked`
 * est de taille paire. Retourne null si aucun appariement complet
 * n'existe (ou si le budget est épuisé).
 */
function pairWithoutRematch(
  ranked: readonly string[],
  played: ReadonlySet<string>,
): Array<[string, string]> | null {
  let budget = BACKTRACK_BUDGET;
  const solve = (remaining: string[]): Array<[string, string]> | null => {
    if (remaining.length === 0) return [];
    if (budget <= 0) return null;
    const [first, ...rest] = remaining;
    for (let i = 0; i < rest.length; i += 1) {
      budget -= 1;
      const candidate = rest[i];
      if (played.has(pairKey(first, candidate))) continue;
      const next = rest.slice(0, i).concat(rest.slice(i + 1));
      const tail = solve(next);
      if (tail) return [[first, candidate], ...tail];
      if (budget <= 0) return null;
    }
    return null;
  };
  return solve([...ranked]);
}

/** Appariement glouton au plus proche, rematches autorisés (repli). */
function pairGreedy(ranked: readonly string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < ranked.length; i += 2) {
    out.push([ranked[i], ranked[i + 1]]);
  }
  return out;
}

export function generateSwissRound(
  standings: readonly SwissStanding[],
  history: SwissHistory,
): SwissRoundResult {
  const ranked = standings.map((s) => s.teamId);
  if (ranked.length < 2) {
    throw new Error(
      "Au moins deux équipes sont nécessaires pour apparier une ronde",
    );
  }
  if (new Set(ranked).size !== ranked.length) {
    throw new Error("Les identifiants d'équipe doivent être uniques");
  }

  let bye: string | null = null;
  let toPair: string[] = ranked;
  if (ranked.length % 2 === 1) {
    bye = pickBye(ranked, history.byes);
    toPair = ranked.filter((id) => id !== bye);
  }

  const played = new Set(
    history.playedPairs.map(([a, b]) => pairKey(a, b)),
  );
  let pairs = pairWithoutRematch(toPair, played);
  let rematchForced = false;
  if (!pairs) {
    pairs = pairGreedy(toPair);
    rematchForced = true;
  }

  const rankOf = new Map(ranked.map((id, i) => [id, i]));
  const homeCounts = history.homeCounts ?? {};
  const homeOf = (id: string) => homeCounts[id] ?? 0;

  const pairings: SwissPairing[] = pairs
    .map(([a, b]) => {
      // `a` est toujours le mieux classé des deux (ordre de la liste).
      const [better, worse] =
        (rankOf.get(a) ?? 0) <= (rankOf.get(b) ?? 0) ? [a, b] : [b, a];
      const home = homeOf(worse) < homeOf(better) ? worse : better;
      const away = home === better ? worse : better;
      return { home, away, bestRank: rankOf.get(better) ?? 0 };
    })
    .sort((x, y) => x.bestRank - y.bestRank)
    .map((p, i) => ({ home: p.home, away: p.away, table: i + 1 }));

  return { pairings, bye, rematchForced };
}
