/**
 * Types et interfaces pour le moteur de jeu Blood Bowl
 */

export type TeamId = 'A' | 'B';

export interface Position {
  x: number; // 0..25
  y: number; // 0..14
}

export type PlayerState = 'active' | 'stunned' | 'knocked_out' | 'casualty' | 'sent_off';

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
  gfiUsed?: number; // nombre de GFI (Going For It) utilisés ce tour (max 2)
  hasBall?: boolean; // indique si le joueur a la balle
  state?: PlayerState; // état du joueur pour les zones de dugout
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

export interface DugoutZone {
  id: string;
  name: string;
  color: string;
  icon: string;
  maxCapacity: number;
  players: string[]; // IDs des joueurs dans cette zone
  position: { x: number; y: number; width: number; height: number };
}

export interface TeamDugout {
  teamId: TeamId;
  zones: {
    reserves: DugoutZone;
    stunned: DugoutZone;
    knockedOut: DugoutZone;
    casualty: DugoutZone;
    sentOff: DugoutZone;
  };
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
  // Zones de dugout pour chaque équipe
  dugouts: {
    teamA: TeamDugout;
    teamB: TeamDugout;
  };
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
  playerActions: Record<string, ActionType>; // playerId -> action effectuée ce tour
  // Compteur de blitz par équipe par tour
  teamBlitzCount: Record<string, number>; // teamId -> nombre de blitz effectués ce tour
  // Compteur de foul par équipe par tour
  teamFoulCount: Record<string, number>;
  // Informations de match
  gamePhase: 'playing' | 'post-td' | 'halftime' | 'ended';
  kickingTeam?: TeamId; // Équipe qui frappe (kick)
  half: number; // 1 ou 2
  score: {
    teamA: number;
    teamB: number;
  };
  teamNames: {
    teamA: string;
    teamB: string;
  };
  // Système de relances (rerolls)
  teamRerolls: { teamA: number; teamB: number };
  rerollUsedThisTurn: boolean;
  pendingReroll?: {
    rollType: 'dodge' | 'pickup' | 'gfi';
    playerId: string;
    team: TeamId;
    targetNumber: number;
    modifiers: number;
    playerIndex: number;
    from?: Position; // pour dodge
    to?: Position; // pour dodge/gfi
  };
  // Statistiques de match par joueur (pour calcul SPP en fin de match)
  matchStats: Record<string, {
    touchdowns: number;
    casualties: number;
    completions: number;
    interceptions: number;
    mvp: boolean;
  }>;
  // Résultats finaux (rempli en fin de match)
  matchResult?: {
    winner?: TeamId;
    spp: Record<string, number>; // playerId -> SPP earned
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
  playerName?: string;
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
  | { type: 'FOLLOW_UP_CHOOSE'; playerId: string; targetId: string; followUp: boolean }
  | { type: 'REROLL_CHOOSE'; useReroll: boolean }
  | { type: 'PASS'; playerId: string; targetId: string }
  | { type: 'HANDOFF'; playerId: string; targetId: string }
  | { type: 'FOUL'; playerId: string; targetId: string };

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
