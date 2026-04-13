/**
 * Types et interfaces pour le moteur de jeu Blood Bowl
 */

export type TeamId = 'A' | 'B';

export interface Position {
  x: number; // 0..25
  y: number; // 0..14
}

export type PlayerState = 'active' | 'stunned' | 'knocked_out' | 'casualty' | 'sent_off';

export type CasualtyOutcome = 'badly_hurt' | 'seriously_hurt' | 'serious_injury' | 'lasting_injury' | 'dead';

/**
 * Specific lasting injury type for BB2020/BB3 casualty table.
 * - 'niggling': Niggling Injury (accumulates, -1 on future casualty rolls)
 * - stat reductions: permanent -1 to the specified characteristic
 */
export type LastingInjuryType =
  | 'niggling'
  | '-1ma'
  | '-1av'
  | '-1pa'
  | '-1ag'
  | '-1st';

/**
 * Details of a lasting/serious injury for a player.
 * Stored in GameState to be persisted post-match.
 */
export interface LastingInjuryDetail {
  outcome: CasualtyOutcome; // 'serious_injury' | 'lasting_injury'
  injuryType: LastingInjuryType;
  missNextMatch: boolean;
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

export interface PendingKickoffEvent {
  type: 'perfect-defence' | 'high-kick' | 'quick-snap' | 'blitz';
  team: TeamId;
  ballPosition?: Position; // for high-kick: where the ball will land
}

export interface PendingApothecary {
  playerId: string;
  team: TeamId;
  injuryType: 'ko' | 'casualty';
  originalCasualtyOutcome?: CasualtyOutcome;
  originalCasualtyRoll?: number;
  originalLastingInjury?: LastingInjuryDetail;
  causedById?: string;
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
  // Apothecaire
  apothecaryAvailable: { teamA: boolean; teamB: boolean };
  pendingApothecary?: PendingApothecary;
  // Événement de kickoff en attente de résolution UI
  pendingKickoffEvent?: PendingKickoffEvent;
  // Tour de blitz kickoff en cours (équipe qui botte joue un tour immédiat)
  kickoffBlitzTurn?: boolean;
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
  // Joueur actuellement en train de blitzer (peut se déplacer puis bloquer)
  blitzingPlayerId?: string;
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
  /**
   * H.6 — canonical roster slugs for each side (e.g. 'skaven', 'lizardmen').
   * Used by the Pixi renderer to apply per-roster primary/secondary colors.
   * Optional so legacy game states (and fixtures) remain backward compatible.
   */
  teamRosters?: {
    teamA?: string;
    teamB?: string;
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
  // Résultats des blessures graves par joueur (rempli pendant le match)
  casualtyResults: Record<string, CasualtyOutcome>; // playerId -> outcome
  // Détails des blessures permanentes (serious_injury / lasting_injury)
  lastingInjuryDetails: Record<string, LastingInjuryDetail>; // playerId -> injury detail
  // Fan attendance (somme des fan factors des deux équipes, calculé en pré-match)
  fanAttendance?: number;
  // Dedicated fans par équipe (préservés depuis pré-match pour calcul post-match)
  dedicatedFans?: { teamA: number; teamB: number };
  // Résultats finaux (rempli en fin de match)
  matchResult?: {
    winner?: TeamId;
    spp: Record<string, number>; // playerId -> SPP earned
    winnings?: { teamA: number; teamB: number }; // Gains en pièces d'or
    dedicatedFansChange?: { teamA: number; teamB: number }; // Changement de dedicated fans (+1/0/-1)
  };
  // Effets de prières à Nuffle actifs pour ce match
  prayerEffects?: Array<{
    type: 'bribe' | 'foul-penalty' | 'skill-granted' | 'stat-mod';
    team: TeamId;
    prayerId: string;
    playerId?: string;
    details?: Record<string, unknown>;
  }>;
  // Timer de tour (en secondes, 0 = désactivé)
  turnTimerSeconds: number;
  // Deadline ISO du timer actuel (mis à jour côté serveur, utilisé côté client pour l'affichage)
  turnDeadline?: string;
  // Log du match
  gameLog: GameLogEntry[];
  // Suivi des règles spéciales de Star Players utilisées (clé: "playerId:ruleSlug")
  usedStarPlayerRules: Record<string, boolean>;
  // Nombre de bribes restantes par équipe (achetées via inducements ou prières)
  bribesRemaining: { teamA: number; teamB: number };
  // Joueurs hypnotisés (perdent leur zone de tacle jusqu'à leur prochaine activation)
  hypnotizedPlayers?: string[];
  // Condition météo active pour ce match (persistée depuis le pré-match)
  weatherCondition?: { condition: string; description: string };
}

export interface DiceResult {
  type: 'dodge' | 'pickup' | 'pass' | 'catch' | 'armor' | 'block' | 'landing' | 'gaze' | 'vomit';
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
  | 'FOUL'
  | 'HYPNOTIC_GAZE'
  | 'PROJECTILE_VOMIT';

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
  | { type: 'APOTHECARY_CHOOSE'; useApothecary: boolean }
  | { type: 'PASS'; playerId: string; targetId: string }
  | { type: 'HANDOFF'; playerId: string; targetId: string }
  | { type: 'THROW_TEAM_MATE'; playerId: string; thrownPlayerId: string; targetPos: Position }
  | { type: 'FOUL'; playerId: string; targetId: string }
  | { type: 'HYPNOTIC_GAZE'; playerId: string; targetId: string }
  | { type: 'PROJECTILE_VOMIT'; playerId: string; targetId: string }
  | { type: 'KICKOFF_PERFECT_DEFENCE'; positions: Array<{ playerId: string; position: Position }> }
  | { type: 'KICKOFF_HIGH_KICK'; playerId: string | null }
  | { type: 'KICKOFF_QUICK_SNAP'; moves: Array<{ playerId: string; to: Position }> }
  | { type: 'KICKOFF_BLITZ_RESOLVE' };

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
