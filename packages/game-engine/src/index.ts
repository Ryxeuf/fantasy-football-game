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
}

export interface GameState {
  width: number;
  height: number;
  players: Player[];
  ball?: Position;
  currentPlayer: TeamId;
  turn: number;
}

export type Move =
  | { type: "MOVE"; playerId: string; to: Position }
  | { type: "END_TURN" };

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
    t += 0x6D2B79F5;
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
        skills: ["Block", "Tackle"]
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
        skills: []
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
        skills: ["Dodge", "Sure Hands"]
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
        skills: []
      },
    ],
    ball: { x: 13, y: 7 },
    currentPlayer: "A",
    turn: 1,
  };
}

// --- Légalité des moves (MVP) ---
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: "END_TURN" }];
  const team = state.currentPlayer;
  const myPlayers = state.players.filter((p) => p.team === team && !p.stunned);
  const occ = new Map<string, Player>();
  state.players.forEach((p) => occ.set(`${p.pos.x},${p.pos.y}`, p));

  for (const p of myPlayers) {
    // Mouvements orthogonaux ET diagonaux (Blood Bowl rules)
    const dirs = [
      // Orthogonaux
      { x: 1, y: 0 },   // droite
      { x: -1, y: 0 },  // gauche
      { x: 0, y: 1 },   // bas
      { x: 0, y: -1 },  // haut
      // Diagonaux
      { x: 1, y: 1 },   // bas-droite
      { x: 1, y: -1 },  // haut-droite
      { x: -1, y: 1 },  // bas-gauche
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
  switch (move.type) {
    case "END_TURN":
      return {
        ...state,
        currentPlayer: state.currentPlayer === "A" ? "B" : "A",
        turn: state.currentPlayer === "B" ? state.turn + 1 : state.turn,
      };
    case "MOVE": {
      const idx = state.players.findIndex((p) => p.id === move.playerId);
      if (idx === -1) return state;
      const legal = getLegalMoves(state).some(
        (m) => m.type === "MOVE" && m.playerId === move.playerId && samePos(m.to, move.to)
      );
      if (!legal) return state;

      const next = structuredClone(state) as GameState;
      next.players[idx].pos = { ...move.to };

      // Ex: si on marche sur la balle -> pickup 50% (MVP)
      if (next.ball && samePos(next.ball, move.to)) {
        const pickup = rng() < 0.5;
        if (pickup) {
          // attacher la balle au joueur (MVP: on enlève du board)
          next.ball = undefined;
        }
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
      MOVE: (G: GameState, ctx: Ctx, args: { playerId: string; to: Position }) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(G, { type: "MOVE", playerId: args.playerId, to: args.to }, rng);
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
