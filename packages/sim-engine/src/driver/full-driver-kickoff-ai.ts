/**
 * Lot 1 « match complet » — résolution headless des évènements de coup
 * d'envoi INTERACTIFS (table 2D6 saison 2025) : Solide défense (4),
 * Chandelle (5), Surprise (9), Charge (10).
 *
 * Avant ce lot, le full driver les ignorait purement et simplement (ils
 * étaient seulement journalisés). Ici l'IA prend une décision simple et
 * les résolveurs OFFICIELS du moteur (`mechanics/kickoff-resolution`)
 * l'appliquent — aucune règle n'est réécrite côté driver.
 */

import {
  resolveKickoffSolidDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from '@bb/game-engine';
import type { GameState, Position, TeamId } from '@bb/game-engine';

function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Direction « vers l'en-but adverse » pour une équipe (A marque en x=25). */
function forwardX(team: TeamId): number {
  return team === 'A' ? 1 : -1;
}

/**
 * Chandelle : le joueur éligible le plus proche du point de chute se place
 * dessous (s'il est à portée raisonnable), sinon on décline.
 */
function resolveHighKickAI(state: GameState): GameState {
  const pending = state.pendingKickoffEvent;
  if (!pending || pending.type !== 'high-kick') return state;
  const landing = pending.ballPosition ?? state.ball;
  if (!landing) return resolveKickoffHighKick(state, null);
  const eligible = new Set(pending.eligiblePlayerIds ?? []);
  const candidates = state.players.filter(
    (p) =>
      p.team === pending.team &&
      p.pos.x >= 0 &&
      !p.stunned &&
      (eligible.size === 0 || eligible.has(p.id)),
  );
  if (candidates.length === 0) return resolveKickoffHighKick(state, null);
  const best = candidates.reduce((acc, p) =>
    chebyshev(p.pos, landing) < chebyshev(acc.pos, landing) ? p : acc,
  );
  const resolved = resolveKickoffHighKick(state, best.id);
  // Si le moteur a refusé (case occupée, hors moitié…), on décline.
  return resolved.pendingKickoffEvent ? resolveKickoffHighKick(state, null) : resolved;
}

/**
 * Surprise : jusqu'à `maxPlayers` joueurs éligibles avancent d'une case
 * vers l'en-but adverse quand la case est libre.
 */
function resolveQuickSnapAI(state: GameState): GameState {
  const pending = state.pendingKickoffEvent;
  if (!pending || pending.type !== 'quick-snap') return state;
  const eligible = new Set(pending.eligiblePlayerIds ?? []);
  const occupied = new Set(state.players.filter((p) => p.pos.x >= 0).map((p) => `${p.pos.x},${p.pos.y}`));
  const dx = forwardX(pending.team);
  const moves: Array<{ playerId: string; to: Position }> = [];
  const limit = pending.maxPlayers ?? Number.POSITIVE_INFINITY;
  for (const p of state.players) {
    if (moves.length >= limit) break;
    if (p.team !== pending.team || p.pos.x < 0 || p.stunned) continue;
    if (eligible.size > 0 && !eligible.has(p.id)) continue;
    const to = { x: p.pos.x + dx, y: p.pos.y };
    if (to.x < 0 || to.x >= state.width) continue;
    const key = `${to.x},${to.y}`;
    if (occupied.has(key)) continue;
    occupied.delete(`${p.pos.x},${p.pos.y}`);
    occupied.add(key);
    moves.push({ playerId: p.id, to });
  }
  const resolved = resolveKickoffQuickSnap(state, moves);
  return resolved.pendingKickoffEvent ? resolveKickoffQuickSnap(state, []) : resolved;
}

/**
 * Résout l'évènement interactif en attente, s'il y en a un. Solide défense
 * conserve la formation (aucun replacement) ; Charge désigne les joueurs
 * éligibles par défaut et ouvre le tour de blitz que la boucle du driver
 * joue ensuite comme un tour normal.
 */
export function resolveInteractiveKickoffEvent(state: GameState): GameState {
  const pending = state.pendingKickoffEvent;
  if (!pending) return state;
  switch (pending.type) {
    case 'solid-defence':
      return resolveKickoffSolidDefence(state, []);
    case 'high-kick':
      return resolveHighKickAI(state);
    case 'quick-snap':
      return resolveQuickSnapAI(state);
    case 'blitz':
      return resolveKickoffBlitz(state);
    default:
      return state;
  }
}
