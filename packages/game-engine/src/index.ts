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
  type: "dodge" | "pickup" | "pass" | "catch";
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

export function calculateDodgeTarget(player: Player, modifiers: number = 0): number {
  // Target = AG + modifiers (AG = 3 => 3+, AG = 4 => 4+, etc.)
  return Math.max(2, Math.min(6, player.ag + modifiers));
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
        pos: { x: 5, y: 7 },
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
      },
      {
        id: "A2",
        team: "A",
        pos: { x: 4, y: 7 },
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
      },
      {
        id: "B1",
        team: "B",
        pos: { x: 20, y: 7 },
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
      },
      {
        id: "B2",
        team: "B",
        pos: { x: 21, y: 7 },
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
      return {
        ...state,
        currentPlayer: state.currentPlayer === "A" ? "B" : "A",
        turn: state.currentPlayer === "B" ? state.turn + 1 : state.turn,
        selectedPlayerId: null,
        players: state.players.map((p) => ({ ...p, pm: p.ma })),
        isTurnover: false,
        lastDiceResult: undefined,
      };
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
        // Effectuer le jet d'esquive
        const dodgeResult = performDodgeRoll(player, rng);
        
        const next = structuredClone(state) as GameState;
        next.lastDiceResult = dodgeResult;
        
        if (dodgeResult.success) {
          // Jet réussi : mouvement autorisé
          next.players[idx].pos = { ...to };
          next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
          // Réinitialiser le résultat de dés après un mouvement réussi
          next.lastDiceResult = undefined;
        } else {
          // Jet échoué : turnover
          next.isTurnover = true;
        }
        
        return next;
      } else {
        // Pas de jet nécessaire : mouvement normal
        const next = structuredClone(state) as GameState;
        next.players[idx].pos = { ...to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        // Réinitialiser le résultat de dés après un mouvement normal
        next.lastDiceResult = undefined;

        // Ex: si on marche sur la balle -> pickup 50% (MVP)
        if (next.ball && samePos(next.ball, to)) {
          const pickup = rng() < 0.5;
          if (pickup) {
            // attacher la balle au joueur (MVP: on enlève du board)
            next.ball = undefined;
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
      const dodgeResult = performDodgeRoll(player, rng);
      
      const next = structuredClone(state) as GameState;
      next.lastDiceResult = dodgeResult;
      
      if (dodgeResult.success) {
        // Jet réussi : mouvement autorisé
        next.players[idx].pos = { ...move.to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        // Réinitialiser le résultat de dés après un mouvement réussi
        next.lastDiceResult = undefined;
      } else {
        // Jet échoué : turnover
        next.isTurnover = true;
      }
      
      return next;
    }
    default:
      return state;
  }
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
