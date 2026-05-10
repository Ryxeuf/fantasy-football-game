/**
 * Pick d'un scorer pseudo-aleatoire dans un roster pour le hybrid
 * driver (Lot 4.D.4).
 *
 * Pourquoi
 * --------
 * Le hybrid driver synthetise les TDs (`emitTd`) sans tracker quel
 * joueur exact a marque (synthese archetype-vs-archetype). En 3.C.3
 * on a ajoute `scorerId` aux TD events du **full driver** pour
 * permettre au SPP service d'attribuer +3 SPP au porteur. Le hybrid
 * driver continuait d'emettre des TD sans `scorerId` -> 0 SPP TD en
 * mode hybrid.
 *
 * Solution : quand le `SimInput.home.roster` est fourni, on choisit
 * un scorer pseudo-aleatoire pondere par position (Catcher / Runner
 * dominent, Lineman moyen, Big Guy rare). Deterministe via le RNG
 * partage du driver -> meme seed = meme scorer = replay-stable.
 *
 * Hors scope
 * ----------
 * - Pondertaion par stats individuelles (MA, AG) : poids plat par
 *   position pour le MVP. Si une saison a un Lineman avec MA10
 *   buffe (lvl-up + stat increase 4.D.1), il restera "Lineman" du
 *   point de vue du picker.
 * - Filtre joueurs "actifs" (non casualty) : le roster passe ici a
 *   deja ete filtre cote sim-runner. Defense-in-depth : fallback sur
 *   tous les joueurs si le filtre rate.
 */

import type { SimRosterPlayer } from '../types';

/**
 * Poids de selection par position. Source : intuition BB +
 * statistique FUMBBL. Catcher / Runner dominent, Skink (Lizardmen)
 * marqueur agile, Lineman moyen, Big Guy rare (peu mobile).
 *
 * Les positions absentes de cette table tombent sur DEFAULT_WEIGHT
 * (3 = niveau Lineman). Permet au picker de gerer des rosters
 * exotiques (Star Players, mercenaires, etc.) sans crasher.
 */
export const HYBRID_SCORER_POSITION_WEIGHTS: Record<string, number> = {
  // Tres mobiles, designed-to-score
  Catcher: 8,
  Runner: 8,
  Skink: 7,
  // Designed-to-fight + occasionally score
  Blitzer: 4,
  Thrower: 4,
  // Lineman generique
  Lineman: 3,
  Linewoman: 3,
  Zombie: 3,
  Skeleton: 3,
  Saurus: 3,
  // Big Guys
  'Big Guy': 1,
  Blocker: 2,
};

const DEFAULT_WEIGHT = 3;

function weightFor(position: string): number {
  return HYBRID_SCORER_POSITION_WEIGHTS[position] ?? DEFAULT_WEIGHT;
}

/**
 * Choisit un scorer dans `roster` via un sample pondere par position.
 * Retourne `null` si le roster est vide.
 *
 * Le `rng` doit etre une fonction `() => number` produisant des
 * valeurs dans `[0, 1)`. Le caller fournit le RNG du driver pour
 * preserver la determinisme du replay (meme seed -> meme scorer).
 */
export function pickHybridScorer(
  roster: readonly SimRosterPlayer[],
  rng: () => number,
): string | null {
  if (roster.length === 0) return null;
  if (roster.length === 1) return roster[0].id;

  let totalWeight = 0;
  for (const p of roster) totalWeight += weightFor(p.position);
  // Tous poids 0 (impossible avec DEFAULT_WEIGHT > 0 mais defense) :
  // tirer uniformement.
  if (totalWeight <= 0) {
    return roster[Math.floor(rng() * roster.length)].id;
  }

  const target = rng() * totalWeight;
  let cumulative = 0;
  for (const p of roster) {
    cumulative += weightFor(p.position);
    if (target < cumulative) return p.id;
  }
  // Edge case rounding : retombe sur le dernier.
  return roster[roster.length - 1].id;
}
