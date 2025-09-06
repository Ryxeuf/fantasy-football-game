/**
 * @bb/game-engine – squelette minimal déterministe
 * Plateau par défaut: 26 x 15 (Blood Bowl-like)
 * Moves supportés (MVP): MOVE (1 pas ortho), END_TURN
 */

export type TeamId = "A" | "B";

export interface Position {
  x: number; // 0..25
  y: number; // 0..14
}

export interface Player {
  id: string;
  team: TeamId;
  pos: Position;
  stunned?: boolean;
  name: string;
  number: number;
  position: string;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string[];
  pm: number; // points de mouvement restants
  hasBall?: boolean; // indique si le joueur a la balle
}

export interface GameState {
  width: number;
  height: number;
  players: Player[];
  ball?: Position;
  currentPlayer: TeamId;
  turn: number;
  selectedPlayerId: string | null;
  lastDiceResult?: DiceResult;
  isTurnover: boolean;
}

export interface DiceResult {
  type: "dodge" | "pickup" | "pass" | "catch" | "armor";
  playerId: string;
  diceRoll: number;
  targetNumber: number;
  success: boolean;
  modifiers: number;
}

export type Move =
  | { type: "MOVE"; playerId: string; to: Position }
  | { type: "END_TURN" }
  | { type: "DODGE"; playerId: string; from: Position; to: Position };

// --- RNG déterministe (mulberry32) ---
export type RNG = () => number;

export function makeRNG(seed: string): RNG {
  // hash string -> 32-bit
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let t = h >>> 0;
  return function mulberry32() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Helpers ---
export function inBounds(s: GameState, p: Position): boolean {
  return p.x >= 0 && p.x < s.width && p.y >= 0 && p.y < s.height;
}

export function samePos(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

// --- Système de jets de dés ---
export function rollD6(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}

export function roll2D6(rng: RNG): number {
  return rollD6(rng) + rollD6(rng);
}

export function calculateDodgeTarget(player: Player, modifiers: number = 0): number {
  // Target = AG - modifiers (modificateurs positifs améliorent le jet)
  return Math.max(2, Math.min(6, player.ag - modifiers));
}

export function performDodgeRoll(player: Player, rng: RNG, modifiers: number = 0): DiceResult {
  const diceRoll = rollD6(rng);
  const targetNumber = calculateDodgeTarget(player, modifiers);
  const success = diceRoll >= targetNumber;
  
  return {
    type: "dodge",
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

export function calculateArmorTarget(player: Player, modifiers: number = 0): number {
  // En Blood Bowl, le jet d'armure se fait sur 2D6
  // Le joueur doit faire 8+ pour réussir son jet d'armure (modificateurs positifs améliorent)
  // La valeur cible est 8, et on soustrait les modificateurs positifs
  return Math.max(2, 8 - modifiers);
}

export function performArmorRoll(player: Player, rng: RNG, modifiers: number = 0): DiceResult {
  const diceRoll = roll2D6(rng);
  const targetNumber = calculateArmorTarget(player, modifiers);
  const success = diceRoll >= targetNumber;
  
  return {
    type: "armor",
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

// --- Détection des zones de tacle (influence) ---
export function getAdjacentOpponents(state: GameState, position: Position, team: TeamId): Player[] {
  const opponents: Player[] = [];
  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ];
  
  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const opponent = state.players.find(p => 
      p.team !== team && 
      p.pos.x === checkPos.x && 
      p.pos.y === checkPos.y &&
      !p.stunned
    );
    if (opponent) {
      opponents.push(opponent);
    }
  }
  
  return opponents;
}

// --- Calcul des modificateurs de désquive ---
export function calculateDodgeModifiers(state: GameState, from: Position, to: Position, team: TeamId): number {
  let modifiers = 0;
  
  // Malus pour chaque adversaire qui marque la case d'arrivée
  const opponentsAtTo = getAdjacentOpponents(state, to, team);
  modifiers -= opponentsAtTo.length; // -1 par adversaire adjacent à la case d'arrivée
  
  return modifiers;
}

// --- Calcul des modificateurs de ramassage de balle ---
export function calculatePickupModifiers(state: GameState, ballPosition: Position, team: TeamId): number {
  let modifiers = 0;
  
  // Malus pour chaque adversaire qui marque la case où se trouve la balle
  const opponentsAtBall = getAdjacentOpponents(state, ballPosition, team);
  modifiers -= opponentsAtBall.length; // -1 par adversaire adjacent à la balle
  
  return modifiers;
}

// --- Calcul du target de ramassage de balle ---
export function calculatePickupTarget(player: Player, modifiers: number = 0): number {
  // Target = AG - modifiers (modificateurs positifs améliorent le jet)
  return Math.max(2, Math.min(6, player.ag - modifiers));
}

// --- Jet de ramassage de balle ---
export function performPickupRoll(player: Player, rng: RNG, modifiers: number = 0): DiceResult {
  const diceRoll = rollD6(rng);
  const targetNumber = calculatePickupTarget(player, modifiers);
  const success = diceRoll >= targetNumber;
  
  return {
    type: "pickup",
    playerId: player.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
}

// --- Calcul de direction aléatoire pour rebond de balle ---
export function getRandomDirection(rng: RNG): Position {
  // 1D8 sur le Gabarit de Direction Aléatoire
  // 1: Nord, 2: Nord-Est, 3: Est, 4: Sud-Est, 5: Sud, 6: Sud-Ouest, 7: Ouest, 8: Nord-Ouest
  const direction = Math.min(8, Math.floor(rng() * 8) + 1);
  
  switch (direction) {
    case 1: return { x: 0, y: -1 };  // Nord
    case 2: return { x: 1, y: -1 };  // Nord-Est
    case 3: return { x: 1, y: 0 };   // Est
    case 4: return { x: 1, y: 1 };   // Sud-Est
    case 5: return { x: 0, y: 1 };   // Sud
    case 6: return { x: -1, y: 1 };  // Sud-Ouest
    case 7: return { x: -1, y: 0 };  // Ouest
    case 8: return { x: -1, y: -1 }; // Nord-Ouest
    default: return { x: 0, y: 0 };  // Ne devrait jamais arriver
  }
}

// --- Fonction de rebond de balle ---
export function bounceBall(state: GameState, rng: RNG): GameState {
  if (!state.ball) return state;
  
  const newState = structuredClone(state) as GameState;
  const currentBallPos = { ...state.ball };
  
  // Calculer la nouvelle position après rebond
  const direction = getRandomDirection(rng);
  const newBallPos: Position = {
    x: Math.max(0, Math.min(state.width - 1, currentBallPos.x + direction.x)),
    y: Math.max(0, Math.min(state.height - 1, currentBallPos.y + direction.y))
  };
  
  // Vérifier si la balle atterrit sur un joueur debout avec sa Zone de Tackle
  const playerAtNewPos = newState.players.find(p => 
    samePos(p.pos, newBallPos) && 
    !p.stunned && 
    p.pm > 0 // Zone de Tackle = joueur non étourdi avec des PM
  );
  
  if (playerAtNewPos) {
    // Le joueur doit tenter de réceptionner la balle
    const catchModifiers = calculatePickupModifiers(newState, newBallPos, playerAtNewPos.team);
    const catchResult = performPickupRoll(playerAtNewPos, rng, catchModifiers);
    
    newState.lastDiceResult = {
      type: "catch",
      playerId: playerAtNewPos.id,
      diceRoll: catchResult.diceRoll,
      targetNumber: catchResult.targetNumber,
      success: catchResult.success,
      modifiers: catchResult.modifiers
    };
    
    if (catchResult.success) {
      // Réception réussie : attacher la balle au joueur
      newState.ball = undefined;
      newState.players = newState.players.map(p => 
        p.id === playerAtNewPos.id ? { ...p, hasBall: true } : p
      );
    } else {
      // Échec de réception : la balle continue à rebondir
      newState.ball = newBallPos;
      // Appel récursif pour continuer le rebond
      return bounceBall(newState, rng);
    }
  } else {
    // Case vide ou joueur sans Zone de Tackle : la balle s'arrête là
    newState.ball = newBallPos;
  }
  
  return newState;
}

export function requiresDodgeRoll(state: GameState, from: Position, to: Position, team: TeamId): boolean {
  // Vérifier si le joueur sort d'une case où il était marqué par un adversaire
  const opponentsAtFrom = getAdjacentOpponents(state, from, team);
  
  // Pas de jet d'esquive si pas d'adversaires adjacents
  if (opponentsAtFrom.length === 0) {
    return false;
  }
  
  // Calculer la distance de mouvement
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.abs(dx) + Math.abs(dy); // Distance Manhattan
  
  // Si on ne bouge pas, pas de jet d'esquive
  if (distance === 0) {
    return false;
  }
  
  // En Blood Bowl : jet d'esquive nécessaire si on quitte une case marquée
  // Peu importe où on va, dès qu'on sort d'une zone de marquage, c'est un jet d'esquive
  return true;
}

// --- Setup minimal ---
export function setup(seed = "seed"): GameState {
  return {
    width: 26,
    height: 15,
    players: [
      {
        id: "A1",
        team: "A",
        pos: { x: 11, y: 7 },
        name: "Grim Ironjaw",
        number: 1,
        position: "Blitzer",
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ["Block", "Tackle"],
        pm: 7,
        hasBall: false,
      },
      {
        id: "A2",
        team: "A",
        pos: { x: 10, y: 7 },
        name: "Thunder Stonefist",
        number: 2,
        position: "Lineman",
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
      },
      {
        id: "B1",
        team: "B",
        pos: { x: 15, y: 7 },
        name: "Shadow Swift",
        number: 1,
        position: "Runner",
        ma: 8,
        st: 2,
        ag: 4,
        pa: 3,
        av: 7,
        skills: ["Dodge", "Sure Hands"],
        pm: 8,
        hasBall: false,
      },
      {
        id: "B2",
        team: "B",
        pos: { x: 16, y: 7 },
        name: "Iron Hide",
        number: 2,
        position: "Lineman",
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
      },
    ],
    ball: { x: 13, y: 7 },
    currentPlayer: "A",
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
  };
}

// --- Légalité des moves (MVP) ---
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: "END_TURN" }];
  const team = state.currentPlayer;
  const myPlayers = state.players.filter(
    (p) => p.team === team && !p.stunned && p.pm > 0,
  );
  const occ = new Map<string, Player>();
  state.players.forEach((p) => occ.set(`${p.pos.x},${p.pos.y}`, p));

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
      moves.push({ type: "MOVE", playerId: p.id, to });
    }
  }
  return moves;
}

// --- Application d'un move ---
export function applyMove(state: GameState, move: Move, rng: RNG): GameState {
  // Si c'est un turnover, on ne peut que finir le tour
  if (state.isTurnover && move.type !== "END_TURN") {
    return state;
  }

  switch (move.type) {
    case "END_TURN":
      // Changement de tour - le porteur de ballon garde le ballon
      const newState: GameState = {
        ...state,
        currentPlayer: state.currentPlayer === "A" ? "B" : "A",
        turn: state.currentPlayer === "B" ? state.turn + 1 : state.turn,
        selectedPlayerId: null,
        players: state.players.map((p) => ({ ...p, pm: p.ma })),
        isTurnover: false,
        lastDiceResult: undefined,
      };
      
      // Le porteur de ballon garde le ballon lors du changement de tour
      return newState;
    case "MOVE": {
      const idx = state.players.findIndex((p) => p.id === move.playerId);
      if (idx === -1) return state;
      const legal = getLegalMoves(state).some(
        (m) =>
          m.type === "MOVE" &&
          m.playerId === move.playerId &&
          samePos(m.to, move.to),
      );
      if (!legal) return state;

      const player = state.players[idx];
      const from = player.pos;
      const to = move.to;

      // Vérifier si un jet d'esquive est nécessaire
      const needsDodge = requiresDodgeRoll(state, from, to, player.team);
      
      if (needsDodge) {
        // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée)
        const dodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
        
        // Effectuer le jet d'esquive avec les modificateurs
        const dodgeResult = performDodgeRoll(player, rng, dodgeModifiers);
        
        const next = structuredClone(state) as GameState;
        next.lastDiceResult = dodgeResult;
        
        // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
        next.players[idx].pos = { ...to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        
        if (dodgeResult.success) {
          // Jet réussi : mouvement autorisé
          // Garder le résultat de dés pour l'affichage de la popup
          // Il sera réinitialisé quand l'utilisateur fermera la popup
        } else {
          // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
          next.isTurnover = true;
          
          // Le joueur chute (est mis à terre)
          next.players[idx].stunned = true;
          
          // Effectuer le jet d'armure
          const armorResult = performArmorRoll(next.players[idx], rng);
          next.lastDiceResult = armorResult;
          
          // Si le jet d'armure échoue, le joueur est blessé (pour l'instant on garde juste le résultat)
          // TODO: Implémenter la table des blessures si nécessaire
          
          // Si le joueur avait le ballon, il le perd et le ballon rebondit
          if (next.players[idx].hasBall) {
            next.players[idx].hasBall = false;
            next.ball = { ...next.players[idx].pos };
            // Faire rebondir le ballon depuis la position du joueur
            return bounceBall(next, rng);
          }
        }
        
        return next;
      } else {
        // Pas de jet nécessaire : mouvement normal
        const next = structuredClone(state) as GameState;
        next.players[idx].pos = { ...to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        // Réinitialiser le résultat de dés après un mouvement normal
        next.lastDiceResult = undefined;

        // Ramassage de balle avec jet d'agilité
        if (next.ball && samePos(next.ball, to)) {
          // Calculer les modificateurs de pickup (malus pour adversaires marquant la balle)
          const pickupModifiers = calculatePickupModifiers(state, next.ball, player.team);
          
          // Effectuer le jet de pickup
          const pickupResult = performPickupRoll(player, rng, pickupModifiers);
          
          // Stocker le résultat pour l'affichage
          next.lastDiceResult = pickupResult;
          
          if (pickupResult.success) {
            // Ramassage réussi : attacher la balle au joueur
            next.ball = undefined;
            next.players[idx].hasBall = true;
          } else {
            // Échec de pickup : la balle rebondit et turnover
            next.isTurnover = true;
            // Faire rebondir la balle
            return bounceBall(next, rng);
          }
        }
        return next;
      }
    }
    case "DODGE": {
      // Action d'esquive explicite (pour l'interface)
      const idx = state.players.findIndex((p) => p.id === move.playerId);
      if (idx === -1) return state;
      
      const player = state.players[idx];
      const from = player.pos;
      const to = move.to;
      
      // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée)
      const dodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
      
      const dodgeResult = performDodgeRoll(player, rng, dodgeModifiers);
      
      const next = structuredClone(state) as GameState;
      next.lastDiceResult = dodgeResult;
      
      // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
      next.players[idx].pos = { ...move.to };
      next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
      
      if (dodgeResult.success) {
        // Jet réussi : mouvement autorisé
        // Garder le résultat de dés pour l'affichage de la popup
        // Il sera réinitialisé quand l'utilisateur fermera la popup
      } else {
        // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
        next.isTurnover = true;
        
        // Le joueur chute (est mis à terre)
        next.players[idx].stunned = true;
        
        // Effectuer le jet d'armure
        const armorResult = performArmorRoll(next.players[idx], rng);
        next.lastDiceResult = armorResult;
        
        // Si le jet d'armure échoue, le joueur est blessé (pour l'instant on garde juste le résultat)
        // TODO: Implémenter la table des blessures si nécessaire
        
        // Si le joueur avait le ballon, il le perd et le ballon rebondit
        if (next.players[idx].hasBall) {
          next.players[idx].hasBall = false;
          next.ball = { ...next.players[idx].pos };
          // Faire rebondir le ballon depuis la position du joueur
          return bounceBall(next, rng);
        }
      }
      
      return next;
    }
    default:
      return state;
  }
}

// --- Fonctions utilitaires ---
export function clearDiceResult(state: GameState): GameState {
  return {
    ...state,
    lastDiceResult: undefined,
  };
}

// --- Gestion de la balle ---
export function dropBall(state: GameState): GameState {
  // Trouver le joueur qui a la balle
  const playerWithBall = state.players.find(p => p.hasBall);
  if (!playerWithBall) return state;
  
  // Retirer la balle du joueur et la placer sur le terrain
  return {
    ...state,
    players: state.players.map(p => 
      p.id === playerWithBall.id ? { ...p, hasBall: false } : p
    ),
    ball: { ...playerWithBall.pos }
  };
}

// --- Intégration boardgame.io (MVP) ---
export function toBGIOGame() {
  // lazy import type pour ne pas obliger la dépendance côté client
  type Ctx = any;
  return {
    name: "bloobowl",
    setup: () => setup(),
    moves: {
      MOVE: (
        G: GameState,
        ctx: Ctx,
        args: { playerId: string; to: Position },
      ) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(
          G,
          { type: "MOVE", playerId: args.playerId, to: args.to },
          rng,
        );
        Object.assign(G, s2);
      },
      DODGE: (
        G: GameState,
        ctx: Ctx,
        args: { playerId: string; from: Position; to: Position },
      ) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(
          G,
          { type: "DODGE", playerId: args.playerId, from: args.from, to: args.to },
          rng,
        );
        Object.assign(G, s2);
      },
      END_TURN: (G: GameState, ctx: Ctx) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(G, { type: "END_TURN" }, rng);
        Object.assign(G, s2);
      },
      CLEAR_DICE_RESULT: (G: GameState) => {
        const s2 = clearDiceResult(G);
        Object.assign(G, s2);
      },
    },
    turn: {
      // alterne automatiquement entre 2 joueurs
      order: {
        first: () => 0,
        next: (G: GameState, ctx: Ctx) => (ctx.playOrderPos + 1) % 2,
      },
    },
  };
}
