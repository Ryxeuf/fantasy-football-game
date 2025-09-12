/**
 * Types et interfaces pour le moteur de jeu Blood Bowl
 */

export type TeamId = 'A' | 'B';

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

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'dice' | 'turnover' | 'score' | 'info';
  message: string;
  playerId?: string;
  team?: TeamId;
  details?: Record<string, unknown>;
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
  // Choix de blocage en attente (règles officielles 1/2/3 dés)
  pendingBlock?: {
    attackerId: string;
    targetId: string;
    options: BlockResult[]; // résultats tirés
    chooser: 'attacker' | 'defender'; // qui choisit
    offensiveAssists: number;
    defensiveAssists: number;
    totalStrength: number;
    targetStrength: number;
  };
  // Choix de direction de poussée en attente
  pendingPushChoice?: {
    attackerId: string;
    targetId: string;
    availableDirections: Position[];
    blockResult: BlockResult;
    offensiveAssists: number;
    defensiveAssists: number;
    totalStrength: number;
    targetStrength: number;
  };
  // Choix de follow-up en attente
  pendingFollowUpChoice?: {
    attackerId: string;
    targetId: string;
    targetNewPosition: Position;
    targetOldPosition: Position;
  };
  // Suivi des actions par joueur par tour
  playerActions: Map<string, ActionType>; // playerId -> action effectuée ce tour
  // Compteur de blitz par équipe par tour
  teamBlitzCount: Map<TeamId, number>; // teamId -> nombre de blitz effectués ce tour
  // Informations de match
  half: number; // 1 ou 2
  score: {
    teamA: number;
    teamB: number;
  };
  teamNames: {
    teamA: string;
    teamB: string;
  };
  // Log du match
  gameLog: GameLogEntry[];
}

export interface DiceResult {
  type: 'dodge' | 'pickup' | 'pass' | 'catch' | 'armor' | 'block';
  playerId: string;
  diceRoll: number;
  targetNumber: number;
  success: boolean;
  modifiers: number;
}

export type ActionType =
  | 'MOVE'
  | 'BLOCK'
  | 'BLITZ'
  | 'PASS'
  | 'HANDOFF'
  | 'THROW_TEAM_MATE'
  | 'FOUL';

export type Move =
  | { type: 'MOVE'; playerId: string; to: Position }
  | { type: 'END_TURN' }
  | { type: 'DODGE'; playerId: string; from: Position; to: Position }
  | { type: 'BLOCK'; playerId: string; targetId: string }
  | { type: 'BLOCK_CHOOSE'; playerId: string; targetId: string; result: BlockResult }
  | { type: 'BLITZ'; playerId: string; to: Position; targetId: string }
  | { type: 'PUSH_CHOOSE'; playerId: string; targetId: string; direction: Position }
  | { type: 'FOLLOW_UP_CHOOSE'; playerId: string; targetId: string; followUp: boolean };

export type BlockResult = 'PLAYER_DOWN' | 'BOTH_DOWN' | 'PUSH_BACK' | 'STUMBLE' | 'POW';

export interface BlockDiceResult {
  type: 'block';
  playerId: string;
  targetId: string;
  diceRoll: number;
  result: BlockResult;
  offensiveAssists: number;
  defensiveAssists: number;
  totalStrength: number;
  targetStrength: number;
}

// --- RNG déterministe (mulberry32) ---
export type RNG = () => number;
