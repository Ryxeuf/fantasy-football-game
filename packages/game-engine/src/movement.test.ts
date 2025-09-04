import { describe, it, expect, beforeEach } from 'vitest'
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  requiresDodgeRoll,
  performDodgeRoll,
  getAdjacentOpponents,
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
