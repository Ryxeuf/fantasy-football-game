/**
 * Underdog variance boost — sprint Pro League 0.C.3.
 *
 * BB rule (sprint table) :
 *   "Si TV gap > 200 ou pre-match win prob < 15%, +10% sur les rolls
 *    critiques cote underdog. Non visible utilisateur. Cible : upset
 *    rate 12-18% (pas 5%)."
 *
 * Implémentation : pré-calcul du `underdogSide` à partir du TV gap, puis
 * dans le driver hybride on accorde au camp underdog **un seul retry**
 * sur un turnover déclenché par un de ses key moments — avec
 * probabilité 10%. Le retry consomme à nouveau les streams resolveurs
 * mais c'est exactement ça qui crée la variance souhaitée.
 *
 * "Non visible utilisateur" : le retry remplace les events du premier
 * essai sur la timeline si et seulement s'il convertit le turnover en
 * succès. L'utilisateur ne voit donc jamais le premier essai raté.
 */

import type { SimTeamInput } from '../types';

/** Seuil de TV gap qui active le boost (sprint table). */
export const UNDERDOG_TV_GAP_THRESHOLD = 200;
/** Probabilité par turnover de déclencher le retry (sprint table).
 *  Iter #12-16 (engineVer 0.13.0) : 0.10 → 0.03. La proba 10% rendait
 *  l'upset rate des matchups TV-déséquilibrés trop volatil (Ogres vs
 *  Halflings 27% au lieu de la cible 12-18%). 3% pousse le favori plus
 *  consistamment tout en gardant un signal underdog symbolique. Combiné
 *  avec le tvBonus divisor /80 et recalibrage des TVs (Halflings 700,
 *  Ogres 1100), Snow Ogres vs Halflings tombe à 17.8% upset (DANS la
 *  cible C2). */
export const UNDERDOG_BOOST_PROBABILITY = 0.03;

export interface UnderdogContext {
  /** `null` = pas de boost (TV gap < 200 ou TVs absentes). */
  side: 'home' | 'away' | null;
  /** Probabilité actuelle de retry (0 si pas de boost). */
  probability: number;
  /** Gap absolu (pour audit / Gazette). */
  tvGap: number;
}

/**
 * Calcule l'underdog d'un match à partir des `SimTeamInput.tv` optionnels.
 * - `tv` absent côté home OU away → pas de boost (`side = null`).
 * - Gap < 200 → pas de boost.
 * - Sinon, l'équipe avec le TV le plus bas est l'underdog.
 */
export function computeUnderdog(home: SimTeamInput, away: SimTeamInput): UnderdogContext {
  const tvHome = home.tv;
  const tvAway = away.tv;
  if (typeof tvHome !== 'number' || typeof tvAway !== 'number') {
    return { side: null, probability: 0, tvGap: 0 };
  }
  const tvGap = Math.abs(tvHome - tvAway);
  if (tvGap < UNDERDOG_TV_GAP_THRESHOLD) {
    return { side: null, probability: 0, tvGap };
  }
  const side: 'home' | 'away' = tvHome < tvAway ? 'home' : 'away';
  return { side, probability: UNDERDOG_BOOST_PROBABILITY, tvGap };
}
