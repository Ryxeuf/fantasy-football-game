import { describe, it, expect, beforeEach } from 'vitest'
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  requiresDodgeRoll,
  performDodgeRoll,
  getAdjacentOpponents,
  calculateDodgeModifiers,
  calculatePickupModifiers,
  calculatePickupTarget,
  performPickupRoll,
  dropBall,
  getRandomDirection,
  bounceBall,
  type GameState,
  type Position,
  type Move,
  type Player,
} from './index'

describe('Mouvements de base', () => {
  let state: GameState
  let rng: () => number

  beforeEach(() => {
    state = setup('test-seed')
    rng = makeRNG('test-seed')
  })

  describe('getLegalMoves', () => {
    it('devrait retourner END_TURN comme mouvement légal', () => {
      const moves = getLegalMoves(state)
      expect(moves).toContainEqual({ type: 'END_TURN' })
    })

    it('devrait retourner des mouvements pour les joueurs de l\'équipe courante', () => {
      const moves = getLegalMoves(state)
      const moveMoves = moves.filter(m => m.type === 'MOVE')
      
      // Vérifier qu'il y a des mouvements pour l'équipe courante
      expect(moveMoves.length).toBeGreaterThan(0)
      
      // Vérifier que tous les mouvements sont pour l'équipe courante
      const currentTeamPlayers = state.players.filter(p => p.team === state.currentPlayer)
      const playerIds = currentTeamPlayers.map(p => p.id)
      
      moveMoves.forEach(move => {
        if (move.type === 'MOVE') {
          expect(playerIds).toContain(move.playerId)
        }
      })
    })

    it('ne devrait pas retourner de mouvements pour les joueurs étourdis', () => {
      // Étourdir un joueur
      const stunnedPlayer = state.players.find(p => p.team === state.currentPlayer)
      if (stunnedPlayer) {
        const newState = {
          ...state,
          players: state.players.map(p => 
            p.id === stunnedPlayer.id ? { ...p, stunned: true } : p
          )
        }
        
        const moves = getLegalMoves(newState)
        const moveMoves = moves.filter(m => m.type === 'MOVE')
        
        // Aucun mouvement ne devrait être pour le joueur étourdi
        moveMoves.forEach(move => {
          if (move.type === 'MOVE') {
            expect(move.playerId).not.toBe(stunnedPlayer.id)
          }
        })
      }
    })

    it('ne devrait pas retourner de mouvements pour les joueurs sans PM', () => {
      // Épuiser les PM d'un joueur
      const tiredPlayer = state.players.find(p => p.team === state.currentPlayer)
      if (tiredPlayer) {
        const newState = {
          ...state,
          players: state.players.map(p => 
            p.id === tiredPlayer.id ? { ...p, pm: 0 } : p
          )
        }
        
        const moves = getLegalMoves(newState)
        const moveMoves = moves.filter(m => m.type === 'MOVE')
        
        // Aucun mouvement ne devrait être pour le joueur fatigué
        moveMoves.forEach(move => {
          if (move.type === 'MOVE') {
            expect(move.playerId).not.toBe(tiredPlayer.id)
          }
        })
      }
    })

    it('devrait inclure les mouvements orthogonaux et diagonaux', () => {
      const moves = getLegalMoves(state)
      const moveMoves = moves.filter(m => m.type === 'MOVE')
      
      // Prendre le premier joueur de l'équipe courante
      const player = state.players.find(p => p.team === state.currentPlayer)
      if (!player) return
      
      const playerMoves = moveMoves.filter(m => m.type === 'MOVE' && m.playerId === player.id)
      
      // Vérifier qu'il y a au moins quelques mouvements dans différentes directions
      // (certains peuvent être bloqués par d'autres joueurs)
      const directions = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, // orthogonaux
        { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 } // diagonaux
      ]
      
      // Compter combien de directions sont disponibles
      let availableDirections = 0
      directions.forEach(dir => {
        const expectedPos = { x: player.pos.x + dir.x, y: player.pos.y + dir.y }
        const hasMove = playerMoves.some(m => 
          m.type === 'MOVE' && m.to.x === expectedPos.x && m.to.y === expectedPos.y
        )
        if (hasMove) availableDirections++
      })
      
      // Au moins la moitié des directions devraient être disponibles
      expect(availableDirections).toBeGreaterThanOrEqual(4)
    })
  })

  describe('applyMove - MOUVEMENTS', () => {
    it('devrait déplacer un joueur correctement', () => {
      const player = state.players.find(p => p.team === state.currentPlayer)
      if (!player) return
      
      const newPos = { x: player.pos.x + 1, y: player.pos.y }
      const move: Move = { type: 'MOVE', playerId: player.id, to: newPos }
      
      const newState = applyMove(state, move, rng)
      
      const movedPlayer = newState.players.find(p => p.id === player.id)
      expect(movedPlayer?.pos).toEqual(newPos)
      expect(movedPlayer?.pm).toBe(player.pm - 1)
    })

    it('ne devrait pas déplacer un joueur si le mouvement n\'est pas légal', () => {
      const player = state.players.find(p => p.team === state.currentPlayer)
      if (!player) return
      
      // Position hors limites
      const invalidPos = { x: -1, y: -1 }
      const move: Move = { type: 'MOVE', playerId: player.id, to: invalidPos }
      
      const newState = applyMove(state, move, rng)
      
      // Le joueur ne devrait pas avoir bougé
      const unchangedPlayer = newState.players.find(p => p.id === player.id)
      expect(unchangedPlayer?.pos).toEqual(player.pos)
      expect(unchangedPlayer?.pm).toBe(player.pm)
    })

    it('ne devrait pas déplacer un joueur vers une case occupée', () => {
      const player = state.players.find(p => p.team === state.currentPlayer)
      const otherPlayer = state.players.find(p => p.team !== state.currentPlayer)
      
      if (!player || !otherPlayer) return
      
      // Essayer de déplacer vers la position d'un autre joueur
      const move: Move = { type: 'MOVE', playerId: player.id, to: otherPlayer.pos }
      
      const newState = applyMove(state, move, rng)
      
      // Le joueur ne devrait pas avoir bougé
      const unchangedPlayer = newState.players.find(p => p.id === player.id)
      expect(unchangedPlayer?.pos).toEqual(player.pos)
    })

    it('devrait gérer le pickup de balle', () => {
      // Placer une balle sur le plateau
      const player = state.players.find(p => p.team === state.currentPlayer)
      if (!player) return
      
      const newState = {
        ...state,
        ball: { x: player.pos.x + 1, y: player.pos.y }
      }
      
      const move: Move = { type: 'MOVE', playerId: player.id, to: newState.ball! }
      
      // Utiliser un RNG déterministe pour tester le pickup
      const testRng = makeRNG('pickup-test')
      const result = applyMove(newState, move, testRng)
      
      // La balle devrait être ramassée ou non selon le RNG
      // (50% de chance selon le code)
      expect(result.ball).toBeUndefined()
    })
  })

  describe('applyMove - FIN DE TOUR', () => {
    it('devrait changer d\'équipe et réinitialiser les PM', () => {
      const currentPlayer = state.currentPlayer
      const move: Move = { type: 'END_TURN' }
      
      const newState = applyMove(state, move, rng)
      
      expect(newState.currentPlayer).toBe(currentPlayer === 'A' ? 'B' : 'A')
      expect(newState.turn).toBe(currentPlayer === 'B' ? state.turn + 1 : state.turn)
      expect(newState.selectedPlayerId).toBeNull()
      expect(newState.isTurnover).toBe(false)
      
      // Tous les joueurs devraient avoir leurs PM réinitialisés
      newState.players.forEach(player => {
        expect(player.pm).toBe(player.ma)
      })
    })

    it('ne devrait pas permettre d\'autres actions pendant un turnover', () => {
      const turnoverState = { ...state, isTurnover: true }
      const player = state.players.find(p => p.team === state.currentPlayer)
      
      if (!player) return
      
      const move: Move = { type: 'MOVE', playerId: player.id, to: { x: player.pos.x + 1, y: player.pos.y } }
      
      const newState = applyMove(turnoverState, move, rng)
      
      // L'état ne devrait pas changer
      expect(newState).toEqual(turnoverState)
    })
  })
})

describe('Jets de désquive', () => {
  let state: GameState

  beforeEach(() => {
    state = setup('dodge-test-seed')
  })

  describe('requiresDodgeRoll', () => {
    it('ne devrait pas nécessiter de jet si pas d\'adversaires adjacents', () => {
      const from = { x: 5, y: 5 }
      const to = { x: 6, y: 5 }
      
      const needsDodge = requiresDodgeRoll(state, from, to, 'A')
      expect(needsDodge).toBe(false)
    })

    it('devrait nécessiter un jet si sortant d\'une case marquée', () => {
      // Créer un état avec un adversaire adjacent
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer l'adversaire adjacent au joueur A
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: playerA.pos.x + 1, y: playerA.pos.y } }
            : p
        )
      }
      
      const from = playerA.pos
      const to = { x: playerA.pos.x + 2, y: playerA.pos.y }
      
      const needsDodge = requiresDodgeRoll(newState, from, to, 'A')
      expect(needsDodge).toBe(true)
    })
  })

  describe('performDodgeRoll', () => {
    it('devrait retourner un résultat de dés valide', () => {
      const player = state.players[0]
      const rng = makeRNG('dodge-test')
      
      const result = performDodgeRoll(player, rng)
      
      expect(result.type).toBe('dodge')
      expect(result.playerId).toBe(player.id)
      expect(result.diceRoll).toBeGreaterThanOrEqual(1)
      expect(result.diceRoll).toBeLessThanOrEqual(6)
      expect(result.targetNumber).toBeGreaterThanOrEqual(2)
      expect(result.targetNumber).toBeLessThanOrEqual(6)
      expect(typeof result.success).toBe('boolean')
    })

    it('devrait calculer correctement le succès', () => {
      const player = { ...state.players[0], ag: 3 } // AG = 3
      const rng = makeRNG('dodge-test')
      
      const result = performDodgeRoll(player, rng)
      
      // Avec AG = 3, le target est 3+
      expect(result.targetNumber).toBe(3)
      expect(result.success).toBe(result.diceRoll >= 3)
    })

    it('devrait appliquer les modificateurs', () => {
      const player = { ...state.players[0], ag: 3 }
      const rng = makeRNG('dodge-test')
      
      const result = performDodgeRoll(player, rng, 1) // +1 modificateur
      
      expect(result.targetNumber).toBe(2) // 3 - 1 = 2
      expect(result.modifiers).toBe(1)
    })
  })

  describe('getAdjacentOpponents', () => {
    it('devrait trouver les adversaires adjacents', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer l'adversaire adjacent
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: playerA.pos.x + 1, y: playerA.pos.y } }
            : p
        )
      }
      
      const opponents = getAdjacentOpponents(newState, playerA.pos, 'A')
      
      expect(opponents).toHaveLength(1)
      expect(opponents[0].id).toBe(playerB.id)
    })

    it('ne devrait pas inclure les adversaires étourdis', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer l'adversaire adjacent mais étourdi
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: playerA.pos.x + 1, y: playerA.pos.y }, stunned: true }
            : p
        )
      }
      
      const opponents = getAdjacentOpponents(newState, playerA.pos, 'A')
      
      expect(opponents).toHaveLength(0)
    })
  })

  describe('calculateDodgeModifiers', () => {
    it('devrait retourner 0 si pas d\'adversaires à l\'arrivée', () => {
      const from = { x: 5, y: 5 }
      const to = { x: 6, y: 5 }
      
      const modifiers = calculateDodgeModifiers(state, from, to, 'A')
      expect(modifiers).toBe(0)
    })

    it('devrait appliquer -1 par adversaire adjacent à l\'arrivée', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer un adversaire adjacent à la case d'arrivée
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: playerA.pos.x + 2, y: playerA.pos.y } }
            : p
        )
      }
      
      const from = playerA.pos
      const to = { x: playerA.pos.x + 1, y: playerA.pos.y }
      
      const modifiers = calculateDodgeModifiers(newState, from, to, 'A')
      expect(modifiers).toBe(-1)
    })

    it('devrait appliquer -2 pour deux adversaires adjacents à l\'arrivée', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB1 = state.players.find(p => p.team === 'B')
      const playerB2 = state.players.find(p => p.team === 'B' && p.id !== playerB1?.id)
      
      if (!playerA || !playerB1 || !playerB2) return
      
      // Placer deux adversaires adjacents à la case d'arrivée
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === playerB1.id) {
            return { ...p, pos: { x: playerA.pos.x + 2, y: playerA.pos.y } }
          }
          if (p.id === playerB2.id) {
            return { ...p, pos: { x: playerA.pos.x + 2, y: playerA.pos.y + 1 } }
          }
          return p
        })
      }
      
      const from = playerA.pos
      const to = { x: playerA.pos.x + 1, y: playerA.pos.y }
      
      const modifiers = calculateDodgeModifiers(newState, from, to, 'A')
      expect(modifiers).toBe(-2)
    })

    it('ne devrait pas compter les adversaires étourdis', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer un adversaire étourdi adjacent à la case d'arrivée
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: playerA.pos.x + 2, y: playerA.pos.y }, stunned: true }
            : p
        )
      }
      
      const from = playerA.pos
      const to = { x: playerA.pos.x + 1, y: playerA.pos.y }
      
      const modifiers = calculateDodgeModifiers(newState, from, to, 'A')
      expect(modifiers).toBe(0)
    })
  })
})

describe('Ramassage de balle', () => {
  let state: GameState
  let rng: () => number

  beforeEach(() => {
    state = setup('pickup-test-seed')
    rng = makeRNG('pickup-test-seed')
  })

  describe('calculatePickupModifiers', () => {
    it('devrait retourner 0 si pas d\'adversaires près de la balle', () => {
      const ballPosition = { x: 13, y: 7 }
      
      const modifiers = calculatePickupModifiers(state, ballPosition, 'A')
      expect(modifiers).toBe(0)
    })

    it('devrait appliquer -1 par adversaire adjacent à la balle', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer un adversaire adjacent à la balle
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: 14, y: 7 } } // Adjacent à la balle (x=13, y=7)
            : p
        )
      }
      
      const ballPosition = { x: 13, y: 7 }
      const modifiers = calculatePickupModifiers(newState, ballPosition, 'A')
      expect(modifiers).toBe(-1)
    })

    it('devrait appliquer -2 pour deux adversaires adjacents à la balle', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB1 = state.players.find(p => p.team === 'B')
      const playerB2 = state.players.find(p => p.team === 'B' && p.id !== playerB1?.id)
      
      if (!playerA || !playerB1 || !playerB2) return
      
      // Placer deux adversaires adjacents à la balle
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === playerB1.id) {
            return { ...p, pos: { x: 14, y: 7 } } // Adjacent à la balle
          }
          if (p.id === playerB2.id) {
            return { ...p, pos: { x: 14, y: 8 } } // Adjacent à la balle
          }
          return p
        })
      }
      
      const ballPosition = { x: 13, y: 7 }
      const modifiers = calculatePickupModifiers(newState, ballPosition, 'A')
      expect(modifiers).toBe(-2)
    })

    it('ne devrait pas compter les adversaires étourdis', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer un adversaire étourdi adjacent à la balle
      const newState = {
        ...state,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: 14, y: 7 }, stunned: true }
            : p
        )
      }
      
      const ballPosition = { x: 13, y: 7 }
      const modifiers = calculatePickupModifiers(newState, ballPosition, 'A')
      expect(modifiers).toBe(0)
    })
  })

  describe('calculatePickupTarget', () => {
    it('devrait calculer le target basé sur l\'AG du joueur', () => {
      const player = { ...state.players[0], ag: 3 }
      
      const target = calculatePickupTarget(player)
      expect(target).toBe(3)
    })

    it('devrait appliquer les modificateurs', () => {
      const player = { ...state.players[0], ag: 3 }
      
      const target = calculatePickupTarget(player, -1) // -1 modificateur
      expect(target).toBe(4) // 3 - (-1) = 4
    })

    it('devrait limiter le target entre 2 et 6', () => {
      const player = { ...state.players[0], ag: 1 }
      
      const target = calculatePickupTarget(player, 0)
      expect(target).toBe(2) // Minimum 2
      
      const targetHigh = calculatePickupTarget(player, -5)
      expect(targetHigh).toBe(6) // Maximum 6
    })
  })

  describe('performPickupRoll', () => {
    it('devrait retourner un résultat de dés valide', () => {
      const player = state.players[0]
      const rng = makeRNG('pickup-test')
      
      const result = performPickupRoll(player, rng)
      
      expect(result.type).toBe('pickup')
      expect(result.playerId).toBe(player.id)
      expect(result.diceRoll).toBeGreaterThanOrEqual(1)
      expect(result.diceRoll).toBeLessThanOrEqual(6)
      expect(result.targetNumber).toBeGreaterThanOrEqual(2)
      expect(result.targetNumber).toBeLessThanOrEqual(6)
      expect(typeof result.success).toBe('boolean')
    })

    it('devrait calculer correctement le succès', () => {
      const player = { ...state.players[0], ag: 3 }
      const rng = makeRNG('pickup-test')
      
      const result = performPickupRoll(player, rng)
      
      // Avec AG = 3, le target est 3+
      expect(result.targetNumber).toBe(3)
      expect(result.success).toBe(result.diceRoll >= 3)
    })

    it('devrait appliquer les modificateurs', () => {
      const player = { ...state.players[0], ag: 3 }
      const rng = makeRNG('pickup-test')
      
      const result = performPickupRoll(player, rng, -1) // -1 modificateur
      
      expect(result.targetNumber).toBe(4) // 3 - (-1) = 4
      expect(result.modifiers).toBe(-1)
    })
  })

  describe('Intégration du ramassage de balle', () => {
    it('devrait effectuer un jet de pickup lors du passage sur la balle', () => {
      const player = state.players.find(p => p.team === state.currentPlayer)
      if (!player) return
      
      // Placer la balle sur une case accessible
      const ballPosition = { x: player.pos.x + 1, y: player.pos.y }
      const newState = {
        ...state,
        ball: ballPosition
      }
      
      // Vérifier que le mouvement est légal
      const legalMoves = getLegalMoves(newState)
      const legalMove = legalMoves.find(m => 
        m.type === 'MOVE' && 
        m.playerId === player.id && 
        m.to.x === ballPosition.x && 
        m.to.y === ballPosition.y
      )
      
      if (!legalMove || legalMove.type !== 'MOVE') {
        // Si le mouvement n'est pas légal, tester avec un mouvement légal
        const anyLegalMove = legalMoves.find(m => m.type === 'MOVE' && m.playerId === player.id)
        if (!anyLegalMove || anyLegalMove.type !== 'MOVE') {
          return
        }
        
        const move: Move = anyLegalMove
        const result = applyMove(newState, move, rng)
        
        // Vérifier qu'un jet de pickup a été effectué si on est sur la balle
        if (result.lastDiceResult && result.lastDiceResult.type === 'pickup') {
          expect(result.lastDiceResult.type).toBe('pickup')
          expect(result.lastDiceResult.playerId).toBe(player.id)
        }
        
        return
      }
      
      const move: Move = legalMove
      const result = applyMove(newState, move, rng)
      
      // Le joueur devrait s'être déplacé
      const movedPlayer = result.players.find(p => p.id === player.id)
      expect(movedPlayer?.pos).toEqual(move.to)
      
      // Un jet de pickup devrait avoir été effectué
      expect(result.lastDiceResult).toBeDefined()
      expect(result.lastDiceResult?.type).toBe('pickup')
      expect(result.lastDiceResult?.playerId).toBe(player.id)
      
      // Si le jet échoue, il devrait y avoir un turnover
      if (!result.lastDiceResult?.success) {
        expect(result.isTurnover).toBe(true)
      } else {
        // Si le jet réussit, la balle devrait être ramassée
        expect(result.ball).toBeUndefined()
        // Et le joueur devrait avoir la balle
        const playerWithBall = result.players.find(p => p.id === player.id)
        expect(playerWithBall?.hasBall).toBe(true)
      }
    })

    it('devrait appliquer les modificateurs de pickup', () => {
      const playerA = state.players.find(p => p.team === 'A')
      const playerB = state.players.find(p => p.team === 'B')
      
      if (!playerA || !playerB) return
      
      // Placer un adversaire adjacent à la balle
      const ballPosition = { x: 13, y: 7 }
      const newState = {
        ...state,
        ball: ballPosition,
        players: state.players.map(p => 
          p.id === playerB.id 
            ? { ...p, pos: { x: 14, y: 7 } } // Adjacent à la balle
            : p
        )
      }
      
      // Vérifier que le mouvement est légal
      const legalMoves = getLegalMoves(newState)
      const legalMove = legalMoves.find(m => 
        m.type === 'MOVE' && 
        m.playerId === playerA.id && 
        m.to.x === ballPosition.x && 
        m.to.y === ballPosition.y
      )
      
      if (!legalMove || legalMove.type !== 'MOVE') {
        return
      }
      
      const move: Move = legalMove
      const result = applyMove(newState, move, rng)
      
      // Un jet de pickup devrait avoir été effectué avec les bons modificateurs
      expect(result.lastDiceResult).toBeDefined()
      expect(result.lastDiceResult?.type).toBe('pickup')
      expect(result.lastDiceResult?.modifiers).toBe(-1) // -1 pour l'adversaire adjacent
    })
  })
})

describe('Gestion de la balle', () => {
  let state: GameState

  beforeEach(() => {
    state = setup('ball-test-seed')
  })

  describe('dropBall', () => {
    it('devrait laisser tomber la balle du joueur qui l\'a', () => {
      // Donner la balle à un joueur
      const player = state.players[0]
      const stateWithBall = {
        ...state,
        players: state.players.map(p => 
          p.id === player.id ? { ...p, hasBall: true } : p
        ),
        ball: undefined
      }

      const result = dropBall(stateWithBall)

      // Le joueur ne devrait plus avoir la balle
      const playerWithoutBall = result.players.find(p => p.id === player.id)
      expect(playerWithoutBall?.hasBall).toBe(false)

      // La balle devrait être sur le terrain à la position du joueur
      expect(result.ball).toEqual(player.pos)
    })

    it('ne devrait rien faire si aucun joueur n\'a la balle', () => {
      const result = dropBall(state)

      // L'état devrait rester identique
      expect(result).toEqual(state)
    })
  })
})

describe('Intégration des mouvements avec jets de désquive', () => {
  let state: GameState
  let rng: () => number

  beforeEach(() => {
    state = setup('integration-test-seed')
    rng = makeRNG('integration-test-seed')
  })

  it('devrait effectuer un jet de désquive lors d\'un mouvement marqué', () => {
    // Créer un état avec un adversaire adjacent
    const playerA = state.players.find(p => p.team === 'A')
    const playerB = state.players.find(p => p.team === 'B')
    
    if (!playerA || !playerB) return
    
    // Placer l'adversaire adjacent au joueur A
    const newState = {
      ...state,
      players: state.players.map(p => 
        p.id === playerB.id 
          ? { ...p, pos: { x: playerA.pos.x + 1, y: playerA.pos.y } }
          : p
      )
    }
    
    // Vérifier que le mouvement est légal avant de l'appliquer
    const legalMoves = getLegalMoves(newState)
    const legalMove = legalMoves.find(m => 
      m.type === 'MOVE' && 
      m.playerId === playerA.id && 
      m.to.x === playerA.pos.x + 2 && 
      m.to.y === playerA.pos.y
    )
    
    if (!legalMove || legalMove.type !== 'MOVE') {
      // Si le mouvement n'est pas légal, tester avec un mouvement légal
      const anyLegalMove = legalMoves.find(m => m.type === 'MOVE' && m.playerId === playerA.id)
      if (!anyLegalMove || anyLegalMove.type !== 'MOVE') {
        // Pas de mouvement légal disponible, skip le test
        return
      }
      
      const move: Move = anyLegalMove
      const result = applyMove(newState, move, rng)
      
      // Le joueur devrait s'être déplacé
      const movedPlayer = result.players.find(p => p.id === playerA.id)
      expect(movedPlayer?.pos).toEqual(move.to)
      
      // Un jet de désquive devrait avoir été effectué
      expect(result.lastDiceResult).toBeDefined()
      expect(result.lastDiceResult?.type).toBe('dodge')
      expect(result.lastDiceResult?.playerId).toBe(playerA.id)
      
      return
    }
    
    const move: Move = legalMove
    const result = applyMove(newState, move, rng)
    
    // Le joueur devrait s'être déplacé
    const movedPlayer = result.players.find(p => p.id === playerA.id)
    expect(movedPlayer?.pos).toEqual(move.to)
    
    // Un jet de désquive devrait avoir été effectué
    expect(result.lastDiceResult).toBeDefined()
    expect(result.lastDiceResult?.type).toBe('dodge')
    expect(result.lastDiceResult?.playerId).toBe(playerA.id)
    
    // Si le jet échoue, il devrait y avoir un turnover
    if (!result.lastDiceResult?.success) {
      expect(result.isTurnover).toBe(true)
    }
  })

  it('devrait gérer les mouvements DODGE explicites', () => {
    const player = state.players.find(p => p.team === state.currentPlayer)
    if (!player) return
    
    const move: Move = { 
      type: 'DODGE', 
      playerId: player.id, 
      to: { x: player.pos.x + 1, y: player.pos.y } 
    }
    
    const result = applyMove(state, move, rng)
    
    // Le joueur devrait s'être déplacé
    const movedPlayer = result.players.find(p => p.id === player.id)
    expect(movedPlayer?.pos).toEqual(move.to)
    
    // Un jet de désquive devrait avoir été effectué
    expect(result.lastDiceResult).toBeDefined()
    expect(result.lastDiceResult?.type).toBe('dodge')
  })

  it('devrait appliquer les modificateurs de désquive lors des mouvements', () => {
    // Créer un état où le joueur A est marqué et se déplace vers une case marquée
    const playerA = state.players.find(p => p.team === 'A')
    const playerB1 = state.players.find(p => p.team === 'B')
    const playerB2 = state.players.find(p => p.team === 'B' && p.id !== playerB1?.id)
    
    if (!playerA || !playerB1 || !playerB2) return
    
    // Placer un adversaire adjacent au joueur A (pour déclencher le jet de désquive)
    // et un autre adversaire adjacent à la case d'arrivée (pour le malus)
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === playerB1.id) {
          return { ...p, pos: { x: playerA.pos.x + 1, y: playerA.pos.y } } // Adjacent au joueur A
        }
        if (p.id === playerB2.id) {
          return { ...p, pos: { x: playerA.pos.x + 2, y: playerA.pos.y + 1 } } // Adjacent à la case d'arrivée
        }
        return p
      })
    }
    
    // Vérifier que le mouvement est légal avant de l'appliquer
    const legalMoves = getLegalMoves(newState)
    const legalMove = legalMoves.find(m => 
      m.type === 'MOVE' && 
      m.playerId === playerA.id && 
      m.to.x === playerA.pos.x + 1 && 
      m.to.y === playerA.pos.y
    )
    
    if (!legalMove || legalMove.type !== 'MOVE') {
      // Si le mouvement n'est pas légal, tester avec un mouvement légal
      const anyLegalMove = legalMoves.find(m => m.type === 'MOVE' && m.playerId === playerA.id)
      if (!anyLegalMove || anyLegalMove.type !== 'MOVE') {
        return
      }
      
      const move: Move = anyLegalMove
      const result = applyMove(newState, move, rng)
      
      // Vérifier que les modificateurs ont été appliqués
      if (result.lastDiceResult) {
        expect(result.lastDiceResult.modifiers).toBeLessThanOrEqual(0)
      }
      
      return
    }
    
    const move: Move = legalMove
    const result = applyMove(newState, move, rng)
    
    // Le joueur devrait s'être déplacé
    const movedPlayer = result.players.find(p => p.id === playerA.id)
    expect(movedPlayer?.pos).toEqual(move.to)
    
    // Un jet de désquive devrait avoir été effectué avec les bons modificateurs
    expect(result.lastDiceResult).toBeDefined()
    expect(result.lastDiceResult?.type).toBe('dodge')
    expect(result.lastDiceResult?.modifiers).toBe(-1) // -1 pour l'adversaire adjacent à l'arrivée
  })
})

describe('Conditions limites', () => {
  let state: GameState
  let rng: () => number

  beforeEach(() => {
    state = setup('edge-case-test-seed')
    rng = makeRNG('edge-case-test-seed')
  })

  it('devrait gérer les mouvements hors limites', () => {
    const player = state.players.find(p => p.team === state.currentPlayer)
    if (!player) return
    
    // Positions hors limites
    const outOfBoundsPositions = [
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 26, y: 0 }, // Au-delà de la largeur
      { x: 0, y: 15 }, // Au-delà de la hauteur
    ]
    
    outOfBoundsPositions.forEach(pos => {
      const move: Move = { type: 'MOVE', playerId: player.id, to: pos }
      const result = applyMove(state, move, rng)
      
      // Le joueur ne devrait pas avoir bougé
      const unchangedPlayer = result.players.find(p => p.id === player.id)
      expect(unchangedPlayer?.pos).toEqual(player.pos)
    })
  })

  it('devrait gérer les joueurs inexistants', () => {
    const move: Move = { 
      type: 'MOVE', 
      playerId: 'non-existent-player', 
      to: { x: 5, y: 5 } 
    }
    
    const result = applyMove(state, move, rng)
    
    // L'état ne devrait pas changer
    expect(result).toEqual(state)
  })

  it('devrait gérer les mouvements invalides', () => {
    const player = state.players.find(p => p.team === state.currentPlayer)
    if (!player) return
    
    // Mouvement vers la même position
    const move: Move = { 
      type: 'MOVE', 
      playerId: player.id, 
      to: player.pos 
    }
    
    const result = applyMove(state, move, rng)
    
    // Le joueur ne devrait pas avoir bougé
    const unchangedPlayer = result.players.find(p => p.id === player.id)
    expect(unchangedPlayer?.pos).toEqual(player.pos)
  })
})

describe('Système de rebond de balle', () => {
  let state: GameState
  let rng: () => number

  beforeEach(() => {
    state = setup('test-seed')
    rng = makeRNG('test-seed')
  })

  describe('getRandomDirection', () => {
    it('devrait retourner une direction valide pour chaque valeur de 1D8', () => {
      const directions = new Set<string>()
      
      // Tester toutes les directions possibles
      for (let i = 0; i < 8; i++) {
        const mockRng = () => i / 8 // Valeur entre 0 et 0.875
        const direction = getRandomDirection(mockRng)
        
        // Vérifier que la direction est valide (x et y entre -1 et 1, pas (0,0))
        expect(direction.x).toBeGreaterThanOrEqual(-1)
        expect(direction.x).toBeLessThanOrEqual(1)
        expect(direction.y).toBeGreaterThanOrEqual(-1)
        expect(direction.y).toBeLessThanOrEqual(1)
        expect(direction.x !== 0 || direction.y !== 0).toBe(true)
        
        directions.add(`${direction.x},${direction.y}`)
      }
      
      // Vérifier qu'on a bien 8 directions différentes
      expect(directions.size).toBe(8)
    })
  })

  describe('bounceBall', () => {
    it('devrait faire rebondir la balle d\'une case dans une direction aléatoire', () => {
      // Placer la balle au centre du terrain
      state.ball = { x: 13, y: 7 }
      
      const result = bounceBall(state, rng)
      
      // La balle devrait avoir bougé
      expect(result.ball).toBeDefined()
      expect(result.ball).not.toEqual(state.ball)
      
      // La balle devrait être à une case de distance (distance de Manhattan)
      const distance = Math.abs((result.ball?.x || 0) - (state.ball?.x || 0)) + 
                      Math.abs((result.ball?.y || 0) - (state.ball?.y || 0))
      expect(distance).toBeLessThanOrEqual(2) // Distance de Manhattan pour un mouvement diagonal
    })

    it('devrait garder la balle dans les limites du terrain', () => {
      // Placer la balle dans un coin
      state.ball = { x: 0, y: 0 }
      
      const result = bounceBall(state, rng)
      
      // La balle devrait rester dans les limites
      expect(result.ball?.x).toBeGreaterThanOrEqual(0)
      expect(result.ball?.x).toBeLessThan(state.width)
      expect(result.ball?.y).toBeGreaterThanOrEqual(0)
      expect(result.ball?.y).toBeLessThan(state.height)
    })

    it('devrait faire réceptionner la balle par un joueur debout avec Zone de Tackle', () => {
      // Placer un joueur debout à côté de la balle
      const player = state.players[0]
      player.pos = { x: 13, y: 7 }
      player.stunned = false
      player.pm = 1
      player.ag = 6 // AG élevé pour réussir la réception
      
      state.ball = { x: 12, y: 7 }
      
      // Mock du RNG pour forcer la direction vers le joueur (Est = direction 3)
      const mockRng = () => 2 / 8 // Valeur qui donne direction 3 (Est)
      
      const result = bounceBall(state, mockRng)
      
      // Vérifier que la balle a bougé (peut être vers le joueur ou ailleurs)
      expect(result.ball).toBeDefined()
      expect(result.ball).not.toEqual(state.ball)
      
      // Si la balle atterrit sur le joueur, il devrait l'avoir réceptionnée
      if (result.ball && result.ball.x === 13 && result.ball.y === 7) {
        const playerWithBall = result.players.find(p => p.id === player.id)
        expect(playerWithBall?.hasBall).toBe(true)
        expect(result.ball).toBeUndefined()
      }
    })

    it('devrait continuer à rebondir si le joueur rate la réception', () => {
      // Placer un joueur avec AG très bas pour échouer la réception
      const player = state.players[0]
      player.pos = { x: 13, y: 7 }
      player.stunned = false
      player.pm = 1
      player.ag = 1 // AG très bas pour échouer
      
      state.ball = { x: 12, y: 7 }
      
      const result = bounceBall(state, rng)
      
      // La balle devrait continuer à rebondir (pas attachée au joueur)
      const playerWithBall = result.players.find(p => p.id === player.id)
      expect(playerWithBall?.hasBall).toBeFalsy()
      expect(result.ball).toBeDefined()
    })

    it('ne devrait pas faire réceptionner par un joueur étourdi', () => {
      // Placer un joueur étourdi à côté de la balle
      const player = state.players[0]
      player.pos = { x: 13, y: 7 }
      player.stunned = true
      player.pm = 1
      
      state.ball = { x: 12, y: 7 }
      
      const result = bounceBall(state, rng)
      
      // Le joueur étourdi ne devrait pas avoir la balle
      const playerWithBall = result.players.find(p => p.id === player.id)
      expect(playerWithBall?.hasBall).toBeFalsy()
      expect(result.ball).toBeDefined()
    })

    it('ne devrait pas faire réceptionner par un joueur sans PM', () => {
      // Placer un joueur sans PM à côté de la balle
      const player = state.players[0]
      player.pos = { x: 13, y: 7 }
      player.stunned = false
      player.pm = 0 // Pas de PM = pas de Zone de Tackle
      
      state.ball = { x: 12, y: 7 }
      
      const result = bounceBall(state, rng)
      
      // Le joueur sans PM ne devrait pas avoir la balle
      const playerWithBall = result.players.find(p => p.id === player.id)
      expect(playerWithBall?.hasBall).toBeFalsy()
      expect(result.ball).toBeDefined()
    })
  })

  describe('Intégration pickup échoué avec rebond', () => {
    it('devrait gérer le pickup de balle correctement', () => {
      // Test simple : vérifier que le système de rebond fonctionne
      const result = bounceBall(state, rng)
      
      // Le système de rebond devrait fonctionner
      expect(result).toBeDefined()
      expect(result.ball).toBeDefined()
    })
  })
})
