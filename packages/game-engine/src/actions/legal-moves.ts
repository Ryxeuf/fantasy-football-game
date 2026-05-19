/**
 * S27.8.11 — Module dedie a `getLegalMoves` et son helper local
 * `getAdjacentOpponents` (variante privee, plus permissive que celle
 * de `mechanics/movement`). Extrait depuis `actions/actions.ts` pour
 * reduire le monolithique vers la cible DoD `actions.ts <= 600 lignes`.
 *
 * Aucune dependance vers `actions.ts` : tous les helpers proviennent
 * de `mechanics/*` ou `core/*`. Aucune mutation du `GameState`.
 *
 * NOTE : la version locale de `getAdjacentOpponents` ne filtre pas les
 * joueurs hypnotises ni les Titchy contrairement a celle exportee
 * depuis `mechanics/movement.ts`. Ce comportement est preserve a
 * l'identique pour eviter toute regression dans `getLegalMoves`.
 */

import { GameState, Move, Player, Position, TeamId } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { inBounds, isAdjacent } from '../mechanics/movement';
import { canBlock, canBlitz } from '../mechanics/blocking';
import {
  hasPlayerActed,
  canPlayerMove,
  canPlayerContinueMoving,
  shouldAutoEndTurn,
  canTeamBlitz,
} from '../core/game-state';
import { getPassRange, canAttemptPassForRange } from '../mechanics/passing';
import { canThrowTeamMate, getThrowRange } from '../mechanics/throw-team-mate';
import { canHypnoticGaze } from '../mechanics/hypnotic-gaze';
import { canProjectileVomit } from '../mechanics/projectile-vomit';
import { canStab } from '../mechanics/stab';
import { canChainsaw } from '../mechanics/chainsaw';
import { canInstablePerformAction } from '../mechanics/negative-traits';
import {
  canLeap as playerCanLeap,
  getLegalLeapDestinations,
} from '../mechanics/leap';

/**
 * Trouve tous les adversaires adjacents a une position.
 *
 * Variante locale a `getLegalMoves` : ne filtre que les joueurs
 * `stunned`. Contrairement a `mechanics/movement#getAdjacentOpponents`
 * elle n'exclut PAS les hypnotises ni les `titchy`.
 *
 * @param state - Etat du jeu
 * @param position - Position de reference
 * @param team - Equipe du joueur (pour identifier les adversaires)
 * @returns Liste des adversaires adjacents
 */
function getAdjacentOpponents(state: GameState, position: Position, team: TeamId): Player[] {
  const opponents: Player[] = [];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const opponent = state.players.find(
      p => p.team !== team && p.pos.x === checkPos.x && p.pos.y === checkPos.y && !p.stunned
    );
    if (opponent) {
      opponents.push(opponent);
    }
  }

  return opponents;
}

/**
 * Obtient tous les mouvements legaux pour l'etat actuel.
 *
 * @param state - Etat du jeu
 * @returns Liste des mouvements possibles
 */
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: 'END_TURN' }];
  const team = state.currentPlayer;

  // Si le match est terminé, aucune action possible
  if (state.gamePhase === 'ended') {
    return [];
  }

  // Vérifier que state.players existe
  if (!state.players || !Array.isArray(state.players)) {
    return moves;
  }

  // Si un pendingKickoffEvent est en attente, seules les actions kickoff sont possibles
  if (state.pendingKickoffEvent) {
    switch (state.pendingKickoffEvent.type) {
      case 'perfect-defence':
        return [{ type: 'KICKOFF_PERFECT_DEFENCE', positions: [] } as Move];
      case 'high-kick':
        return [{ type: 'KICKOFF_HIGH_KICK', playerId: null } as Move];
      case 'quick-snap':
        return [{ type: 'KICKOFF_QUICK_SNAP', moves: [] } as Move];
      case 'blitz':
        return [{ type: 'KICKOFF_BLITZ_RESOLVE' } as Move];
    }
  }

  // Si un pendingApothecary est en attente, seul le choix d'apothecaire est possible
  if (state.pendingApothecary) {
    return [
      { type: 'APOTHECARY_CHOOSE', useApothecary: true } as Move,
      { type: 'APOTHECARY_CHOOSE', useApothecary: false } as Move,
    ];
  }

  // Si un pendingReroll est en attente, seules les relances sont possibles
  if (state.pendingReroll) {
    return [
      { type: 'REROLL_CHOOSE', useReroll: true } as Move,
      { type: 'REROLL_CHOOSE', useReroll: false } as Move,
    ];
  }

  // Si c'est un turnover, seul END_TURN est possible
  if (state.isTurnover) {
    return moves;
  }

  // Si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir, seul END_TURN est possible
  if (shouldAutoEndTurn(state)) {
    return moves;
  }

  const myPlayers = state.players.filter(
    p => p.team === team && (canPlayerMove(state, p.id) || canPlayerContinueMoving(state, p.id))
  );
  const occ = new Map<string, Player>();
  state.players.forEach(p => occ.set(`${p.pos.x},${p.pos.y}`, p));

  for (const p of myPlayers) {
    // Mouvements orthogonaux ET diagonaux (Blood Bowl rules)
    const dirs = [
      // Orthogonaux
      { x: 1, y: 0 }, // droite
      { x: -1, y: 0 }, // gauche
      { x: 0, y: 1 }, // bas
      { x: 0, y: -1 }, // haut
      // Diagonaux
      { x: 1, y: 1 }, // bas-droite
      { x: 1, y: -1 }, // haut-droite
      { x: -1, y: 1 }, // bas-gauche
      { x: -1, y: -1 }, // haut-gauche
    ];
    for (const d of dirs) {
      const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
      if (!inBounds(state, to)) continue;
      if (occ.has(`${to.x},${to.y}`)) continue; // pas de chevauchement
      moves.push({ type: 'MOVE', playerId: p.id, to });
    }

    // Actions de Saut (LEAP / Pogo Stick) — 2 cases de mouvement, test d'AG,
    // ignore les zones de tacle au depart.
    // MVP: on exige p.pm >= 2 (pas de leap-via-GFI pour l'instant).
    if (playerCanLeap(p) && p.pm >= 2) {
      const leapDests = getLegalLeapDestinations(state, p.pos);
      for (const to of leapDests) {
        moves.push({ type: 'LEAP', playerId: p.id, to });
      }
    }

    // Actions de blocage — BB 2025 : un BLOCK ne peut être déclaré qu'en
    // début d'activation du joueur (avant tout mouvement). Si le joueur
    // a déjà bougé ce tour, il faut passer par un BLITZ. Cette contrainte
    // est encodée via `playerAction` : si l'activation a déjà enregistré
    // une action (MOVE typiquement), un BLOCK simple n'est plus légal.
    const playerAction = state.playerActions?.[p.id];
    const adjacentOpponents = getAdjacentOpponents(state, p.pos, p.team);
    if (!playerAction) {
      for (const opponent of adjacentOpponents) {
        if (canBlock(state, p.id, opponent.id)) {
          moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
        }
      }
    }

    // Blitz au contact : un joueur qui a commencé à se déplacer peut bloquer
    // un adversaire adjacent si l'équipe peut encore blitzer
    if (playerAction === 'MOVE' && canTeamBlitz(state, p.team) && p.pm > 0) {
      for (const opponent of adjacentOpponents) {
        // Éviter les doublons si canBlock a déjà ajouté ce BLOCK
        const alreadyHasBlock = moves.some(
          m => m.type === 'BLOCK' && m.playerId === p.id && m.targetId === opponent.id
        );
        if (!alreadyHasBlock && !opponent.stunned && opponent.team !== p.team) {
          moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
        }
      }
    }

    // Actions de blitz (mouvement + blocage atomique, pour les joueurs pas encore déplacés)
    if (!playerAction) {
      for (const d of dirs) {
        const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
        if (!inBounds(state, to)) continue;
        if (occ.has(`${to.x},${to.y}`)) continue;

        const allOpponents = state.players.filter(opp => opp.team !== p.team && !opp.stunned);
        for (const opponent of allOpponents) {
          if (canBlitz(state, p.id, to, opponent.id)) {
            moves.push({ type: 'BLITZ', playerId: p.id, to, targetId: opponent.id });
          }
        }
      }
    }

    // Actions de passe (PASS) - le joueur doit avoir le ballon et pas encore agi
    // Passes interdites pendant le tour de blitz kickoff
    // Instable: prohibition — le joueur ne peut pas declarer d'action de passe
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn && canInstablePerformAction(p, 'PASS')) {
      const teammates = state.players.filter(
        t => t.team === team && t.id !== p.id && !t.stunned && t.state === 'active'
      );
      for (const target of teammates) {
        const range = getPassRange(p.pos, target.pos);
        if (canAttemptPassForRange(p, range)) {
          moves.push({ type: 'PASS', playerId: p.id, targetId: target.id });
        }
      }
    }

    // Actions de remise (HANDOFF) - le joueur doit avoir le ballon, cible adjacente
    // Remises interdites pendant le tour de blitz kickoff
    // Instable: prohibition — le joueur ne peut pas declarer d'action de remise
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn && canInstablePerformAction(p, 'HANDOFF')) {
      const teammates = state.players.filter(
        t => t.team === team && t.id !== p.id && !t.stunned && t.state === 'active'
      );
      for (const target of teammates) {
        if (isAdjacent(p.pos, target.pos)) {
          moves.push({ type: 'HANDOFF', playerId: p.id, targetId: target.id });
        }
      }
    }

    // Actions de faute (FOUL) - sur un joueur au sol, max 1 par tour
    if (!hasPlayerActed(state, p.id) && ((state.teamFoulCount && state.teamFoulCount[team]) || 0) === 0) {
      const groundedOpponents = state.players.filter(
        opp => opp.team !== team && opp.stunned && isAdjacent(p.pos, opp.pos)
      );
      for (const target of groundedOpponents) {
        moves.push({ type: 'FOUL', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Lancer de Coéquipier (THROW_TEAM_MATE)
    // Instable: prohibition — le joueur ne peut pas declarer d'action de lancer de coequipier
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'throw-team-mate') && canInstablePerformAction(p, 'THROW_TEAM_MATE')) {
      // Chercher les coéquipiers adjacents avec Right Stuff
      const throwableTeammates = state.players.filter(
        t => t.team === team && t.id !== p.id && canThrowTeamMate(state, p, t)
      );
      for (const thrown of throwableTeammates) {
        // Générer les positions cibles dans la portée Long Pass max (distance ≤ 10)
        for (let dx = -10; dx <= 10; dx++) {
          for (let dy = -10; dy <= 10; dy++) {
            const targetPos = { x: p.pos.x + dx, y: p.pos.y + dy };
            if (!inBounds(state, targetPos)) continue;
            if (dx === 0 && dy === 0) continue;
            const range = getThrowRange(p.pos, targetPos);
            if (!range) continue;
            moves.push({
              type: 'THROW_TEAM_MATE',
              playerId: p.id,
              thrownPlayerId: thrown.id,
              targetPos,
            });
          }
        }
      }
    }

    // Actions de Regard Hypnotique (HYPNOTIC_GAZE)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'hypnotic-gaze')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canHypnoticGaze(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'HYPNOTIC_GAZE', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Vomissement Projectile (PROJECTILE_VOMIT)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'projectile-vomit')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canProjectileVomit(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'PROJECTILE_VOMIT', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Poignard (STAB)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'stab')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canStab(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'STAB', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Tronçonneuse (CHAINSAW)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'chainsaw')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canChainsaw(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'CHAINSAW', playerId: p.id, targetId: target.id });
      }
    }

    // END_PLAYER_TURN : permet d'arrêter l'activation d'un joueur en cours
    const pAction = state.playerActions?.[p.id];
    if (pAction === 'MOVE' || pAction === 'BLITZ') {
      moves.push({ type: 'END_PLAYER_TURN', playerId: p.id });
    }
  }
  return moves;
}
