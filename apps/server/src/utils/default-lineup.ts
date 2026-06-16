/**
 * Onboarding "Crée ton équipe en 60 secondes" — constructeur de
 * composition par défaut (pur, sans I/O).
 *
 * Le endpoint `POST /team/create-from-roster` ne disposait que de 3
 * templates figés (skaven / wood_elf / lizardmen) et retombait sur le
 * template lizardmen pour **tous** les autres rosters. Conséquence :
 * une équipe "orc" se retrouvait peuplée de joueurs `lizardmen_saurus`,
 * dont le slug de position n'existe pas dans le roster orc. Le calcul de
 * VE (`getPlayerCost(player.position, team.roster, ruleset)`) renvoyait
 * alors un coût erroné → bug latent.
 *
 * `buildDefaultLineup` construit une composition **légale et cohérente**
 * à partir des positions réelles du roster (issues de la DB) :
 *   1. on part des minimums obligatoires de chaque position ;
 *   2. on complète jusqu'à `target` joueurs avec la position "lineman"
 *      (la moins chère parmi celles au plus grand plafond) ;
 *   3. si ce remplisseur est plafonné, on complète avec les autres
 *      positions ;
 *   4. on borne le total à `hardCap` (16 par défaut).
 *
 * 100% pur ⇒ testable en unit sans Prisma.
 */

/** Position telle que remontée par `getRosterFromDb`. */
export interface DefaultLineupPosition {
  readonly slug: string;
  readonly displayName: string;
  readonly cost: number;
  readonly min: number;
  readonly max: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null; // null = pas de passe ("-")
  readonly av: number;
  readonly skills: string;
}

/** Entrée de composition : une position et son nombre de joueurs. */
export interface LineupEntry {
  readonly position: string;
  readonly displayName: string;
  readonly count: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null; // null = pas de passe ("-")
  readonly av: number;
  readonly skills: string;
}

export interface BuildDefaultLineupOptions {
  /** Nombre de joueurs visé (défaut 11 — la composition de départ BB). */
  readonly target?: number;
  /** Plafond dur de joueurs (défaut 16 — la limite d'un roster BB). */
  readonly hardCap?: number;
}

/**
 * Choisit la position "remplisseur" : celle au plus grand plafond
 * (`max`), départage par le coût le plus faible. C'est en pratique le
 * lineman du roster, ce qui garde la composition de départ abordable.
 */
function pickFiller(
  positions: readonly DefaultLineupPosition[],
): DefaultLineupPosition | null {
  if (positions.length === 0) return null;
  return [...positions].sort((a, b) => {
    if ((b.max ?? 0) !== (a.max ?? 0)) return (b.max ?? 0) - (a.max ?? 0);
    if ((a.cost ?? 0) !== (b.cost ?? 0)) return (a.cost ?? 0) - (b.cost ?? 0);
    return a.slug.localeCompare(b.slug);
  })[0];
}

export function buildDefaultLineup(
  positions: readonly DefaultLineupPosition[],
  options: BuildDefaultLineupOptions = {},
): LineupEntry[] {
  const target = options.target ?? 11;
  const hardCap = options.hardCap ?? 16;
  if (positions.length === 0) return [];

  const counts = new Map<string, number>();
  let total = 0;

  // 1. Minimums obligatoires.
  for (const p of positions) {
    const min = Math.max(0, p.min ?? 0);
    if (min > 0) {
      counts.set(p.slug, min);
      total += min;
    }
  }

  const capOf = (p: DefaultLineupPosition): number =>
    Math.max(0, Math.min(p.max ?? hardCap, hardCap));

  // 2. Complète jusqu'à `target` avec le remplisseur (lineman).
  const filler = pickFiller(positions);
  if (filler) {
    const fillerCap = capOf(filler);
    while (total < target) {
      const current = counts.get(filler.slug) ?? 0;
      if (current >= fillerCap) break;
      counts.set(filler.slug, current + 1);
      total += 1;
    }
  }

  // 3. Remplisseur plafonné : complète avec les autres positions.
  if (total < target) {
    for (const p of positions) {
      const cap = capOf(p);
      while (total < target) {
        const current = counts.get(p.slug) ?? 0;
        if (current >= cap) break;
        counts.set(p.slug, current + 1);
        total += 1;
      }
      if (total >= target) break;
    }
  }

  // 4. Matérialise les entrées dans l'ordre des positions, borné à hardCap.
  const entries: LineupEntry[] = [];
  let used = 0;
  for (const p of positions) {
    let count = counts.get(p.slug) ?? 0;
    if (count <= 0) continue;
    if (used + count > hardCap) count = hardCap - used;
    if (count <= 0) break;
    entries.push({
      position: p.slug,
      displayName: p.displayName,
      count,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills,
    });
    used += count;
    if (used >= hardCap) break;
  }
  return entries;
}
