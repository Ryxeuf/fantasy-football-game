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

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'dice' | 'turnover' | 'score' | 'info';
  message: string;
  playerId?: string;
  team?: TeamId;
  details?: any;
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
    chooser: "attacker" | "defender"; // qui choisit
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
  type: "dodge" | "pickup" | "pass" | "catch" | "armor" | "block";
  playerId: string;
  diceRoll: number;
  targetNumber: number;
  success: boolean;
  modifiers: number;
}

export type ActionType = "MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "THROW_TEAM_MATE" | "FOUL";

export type Move =
  | { type: "MOVE"; playerId: string; to: Position }
  | { type: "END_TURN" }
  | { type: "DODGE"; playerId: string; from: Position; to: Position }
  | { type: "BLOCK"; playerId: string; targetId: string }
  | { type: "BLOCK_CHOOSE"; playerId: string; targetId: string; result: BlockResult }
  | { type: "BLITZ"; playerId: string; to: Position; targetId: string }
  | { type: "PUSH_CHOOSE"; playerId: string; targetId: string; direction: Position }
  | { type: "FOLLOW_UP_CHOOSE"; playerId: string; targetId: string; followUp: boolean };

export type BlockResult = "PLAYER_DOWN" | "BOTH_DOWN" | "PUSH_BACK" | "STUMBLE" | "POW";

export interface BlockDiceResult {
  type: "block";
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

// --- Système de log ---
export function createLogEntry(
  type: GameLogEntry['type'],
  message: string,
  playerId?: string,
  team?: TeamId,
  details?: any
): GameLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    message,
    playerId,
    team,
    details,
  };
}

export function addLogEntry(state: GameState, entry: GameLogEntry): GameState {
  return {
    ...state,
    gameLog: [...state.gameLog, entry],
  };
}

// --- Touchdown & En-but ---
export function isInOpponentEndzone(state: GameState, player: Player): boolean {
  // Orientation du terrain (26x15) :
  // L'équipe A marque dans la ligne d'en-but de droite (x = state.width - 1)
  // L'équipe B marque dans la ligne d'en-but de gauche (x = 0)
  const endzoneX = player.team === "A" ? state.width - 1 : 0;
  return player.pos.x === endzoneX;
}

function awardTouchdown(state: GameState, scoringTeam: TeamId, scorer?: Player): GameState {
  let next = structuredClone(state) as GameState;

  // Mettre à jour le score
  const newScore = {
    teamA: scoringTeam === "A" ? next.score.teamA + 1 : next.score.teamA,
    teamB: scoringTeam === "B" ? next.score.teamB + 1 : next.score.teamB,
  };

  // Nettoyer la balle et arrêter le drive (Turnover satisfaisant)
  next.ball = undefined;
  next.players = next.players.map((p) => ({ ...p, hasBall: false }));
  next.isTurnover = true;

  // Log du score
  const teamName = scoringTeam === "A" ? next.teamNames.teamA : next.teamNames.teamB;
  const message = `Touchdown pour ${teamName} !`;
  const logEntry = createLogEntry('score', message, scorer?.id, scoringTeam, {
    scorer: scorer?.name,
    score: newScore,
  });

  next = addLogEntry(next, logEntry);

  return {
    ...next,
    score: newScore,
  };
}

// Gestion de la fin de tour et de mi-temps (8 tours par équipe / 8 "rounds")
function advanceHalfIfNeeded(state: GameState): GameState {
  // Si on a dépassé le 8e round, on passe à la mi‑temps suivante ou on termine le match
  if (state.turn > 8) {
    if (state.half === 1) {
      const halftimeLog = createLogEntry(
        'info',
        `Mi-temps atteinte (8 tours par équipe). Début de la 2e mi-temps`,
        undefined,
        undefined
      );

      return {
        ...state,
        half: 2,
        turn: 1,
        currentPlayer: 'A',
        gameLog: [...state.gameLog, halftimeLog],
      };
    } else {
      const endLog = createLogEntry(
        'info',
        `Fin du match (2e mi-temps terminée)`,
        undefined,
        undefined
      );
      return {
        ...state,
        isTurnover: true,
        gameLog: [...state.gameLog, endLog],
      };
    }
  }
  return state;
}

// Vérification continue des touchdowns
function checkTouchdowns(state: GameState): GameState {
  // Vérifier tous les joueurs qui ont le ballon et sont debout
  const playersWithBall = state.players.filter(p => p.hasBall && !p.stunned);
  
  for (const player of playersWithBall) {
    if (isInOpponentEndzone(state, player)) {
      return awardTouchdown(state, player.team, player);
    }
  }
  
  return state;
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
  // L'armure est percée si le résultat est >= à la valeur d'armure du joueur
  // Les modificateurs positifs rendent l'armure plus difficile à percer (augmentent la valeur cible)
  // La valeur de base est l'armure du joueur (av), et on ajoute les modificateurs positifs
  return Math.min(12, player.av + modifiers);
}

export function performArmorRoll(player: Player, rng: RNG, modifiers: number = 0): DiceResult {
  const diceRoll = roll2D6(rng);
  const targetNumber = calculateArmorTarget(player, modifiers);
  // En Blood Bowl, l'armure est percée (échec) si le résultat est >= à la valeur d'armure
  // Donc success = false si diceRoll >= targetNumber
  const success = diceRoll < targetNumber;
  
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

// --- Fonctions pour le blocage ---
export function getAdjacentPlayers(state: GameState, position: Position): Player[] {
  const players: Player[] = [];
  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ];
  
  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const player = state.players.find(p => 
      p.pos.x === checkPos.x && 
      p.pos.y === checkPos.y &&
      !p.stunned
    );
    if (player) {
      players.push(player);
    }
  }
  
  return players;
}

export function isAdjacent(pos1: Position, pos2: Position): boolean {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
}

export function canBlock(state: GameState, playerId: string, targetId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  const target = state.players.find(p => p.id === targetId);
  
  if (!player || !target) return false;
  
  // Le joueur doit être debout et non étourdi
  if (player.stunned || player.pm <= 0) return false;
  
  // La cible doit être debout et non étourdie
  if (target.stunned || target.pm <= 0) return false;
  
  // Les joueurs doivent être adjacents
  if (!isAdjacent(player.pos, target.pos)) return false;
  
  // Les joueurs doivent être d'équipes différentes
  if (player.team === target.team) return false;
  
  return true;
}

export function canBlitz(state: GameState, attackerId: string, to: Position, targetId: string): boolean {
  const attacker = state.players.find(p => p.id === attackerId);
  const target = state.players.find(p => p.id === targetId);
  
  if (!attacker || !target) return false;
  
  // Vérifier que l'équipe n'a pas déjà utilisé son blitz ce tour
  if (!canTeamBlitz(state, attacker.team)) return false;
  
  // Vérifier que l'attaquant peut bouger (pas étourdi, a des PM)
  if (attacker.stunned || attacker.pm <= 0) return false;
  
  // Vérifier que la cible n'est pas étourdie
  if (target.stunned) return false;
  
  // Vérifier que les joueurs sont d'équipes différentes
  if (attacker.team === target.team) return false;
  
  // Vérifier que la position de destination est valide
  if (!inBounds(state, to)) return false;
  
  // Vérifier que la position de destination n'est pas occupée
  const occupied = state.players.some(p => p.pos.x === to.x && p.pos.y === to.y);
  if (occupied) return false;
  
  // Vérifier que le joueur a assez de PM pour le mouvement (le blocage coûtera 1 PM supplémentaire)
  const distance = Math.abs(attacker.pos.x - to.x) + Math.abs(attacker.pos.y - to.y);
  if (attacker.pm < distance) return false; // Pas de +1 ici, le blocage sera vérifié après
  
  // Vérifier que la cible sera adjacente après le mouvement
  return isAdjacent(to, target.pos);
}

export function calculateOffensiveAssists(state: GameState, attacker: Player, target: Player): number {
  let assists = 0;
  
  // Trouver tous les coéquipiers de l'attaquant qui marquent la cible
  const teammates = state.players.filter(p => 
    p.team === attacker.team && 
    p.id !== attacker.id &&
    !p.stunned &&
    p.pm > 0
  );
  
  for (const teammate of teammates) {
    // Le coéquipier doit marquer la cible
    if (isAdjacent(teammate.pos, target.pos)) {
      // Vérifier que le coéquipier n'est pas marqué par un autre adversaire que la cible
      const opponentsMarkingTeammate = getAdjacentOpponents(state, teammate.pos, teammate.team);
      const isMarkedByOtherThanTarget = opponentsMarkingTeammate.some(opp => opp.id !== target.id);
      
      if (!isMarkedByOtherThanTarget) {
        assists++;
      }
    }
  }
  
  return assists;
}

export function calculateDefensiveAssists(state: GameState, attacker: Player, target: Player): number {
  let assists = 0;
  
  // Trouver tous les coéquipiers de la cible qui marquent l'attaquant
  const teammates = state.players.filter(p => 
    p.team === target.team && 
    p.id !== target.id &&
    !p.stunned &&
    p.pm > 0
  );
  
  for (const teammate of teammates) {
    // Le coéquipier doit marquer l'attaquant
    if (isAdjacent(teammate.pos, attacker.pos)) {
      // Vérifier que le coéquipier n'est pas marqué par un autre adversaire que l'attaquant
      const opponentsMarkingTeammate = getAdjacentOpponents(state, teammate.pos, teammate.team);
      const isMarkedByOtherThanAttacker = opponentsMarkingTeammate.some(opp => opp.id !== attacker.id);
      
      if (!isMarkedByOtherThanAttacker) {
        assists++;
      }
    }
  }
  
  return assists;
}

// --- Système de dés de blocage ---
export function calculateBlockDiceCount(attackerStrength: number, targetStrength: number): number {
  if (attackerStrength < targetStrength / 2) {
    return 3; // 3 dés, le défenseur choisit
  } else if (attackerStrength < targetStrength) {
    return 2; // 2 dés, le défenseur choisit
  } else if (attackerStrength === targetStrength) {
    return 1; // 1 dé
  } else if (attackerStrength < targetStrength * 2) {
    return 2; // 2 dés, l'attaquant choisit
  } else {
    return 3; // 3 dés, l'attaquant choisit
  }
}

export function getBlockDiceChooser(attackerStrength: number, targetStrength: number): "attacker" | "defender" {
  if (attackerStrength < targetStrength) {
    return "defender";
  } else {
    return "attacker";
  }
}

export function rollBlockDice(rng: RNG): BlockResult {
  const roll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
  
  switch (roll) {
    case 1: return "PLAYER_DOWN";
    case 2: return "BOTH_DOWN";
    case 3: return "PUSH_BACK";  // Première face Push Back
    case 4: return "STUMBLE";
    case 5: return "POW";
    case 6: return "PUSH_BACK";  // Deuxième face Push Back (dupliquée)
    default: return "PUSH_BACK"; // Ne devrait jamais arriver
  }
}

export function rollBlockDiceMany(rng: RNG, count: number): BlockResult[] {
  const results: BlockResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollBlockDice(rng));
  }
  return results;
}

export function rollBlockDiceManyWithRolls(rng: RNG, count: number): Array<{ diceRoll: number; result: BlockResult }> {
  const results: Array<{ diceRoll: number; result: BlockResult }> = [];
  for (let i = 0; i < count; i++) {
    const diceRoll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
    const result = rollBlockDice(rng);
    results.push({ diceRoll, result });
  }
  return results;
}

export function performBlockRoll(
  attacker: Player, 
  target: Player, 
  rng: RNG, 
  offensiveAssists: number, 
  defensiveAssists: number
): BlockDiceResult {
  const attackerStrength = attacker.st + offensiveAssists;
  const targetStrength = target.st + defensiveAssists;
  
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);
  
  // Pour simplifier, on lance un seul dé et on prend le résultat
  // Dans un vrai jeu, on lancerait plusieurs dés et le chooser sélectionnerait
  const diceRoll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
  const result = rollBlockDice(rng);
  
  return {
    type: "block",
    playerId: attacker.id,
    targetId: target.id,
    diceRoll,
    result,
    offensiveAssists,
    defensiveAssists,
    totalStrength: attackerStrength,
    targetStrength: targetStrength
  };
}

// --- Résolution des résultats de blocage ---
export function resolveBlockResult(
  state: GameState, 
  blockResult: BlockDiceResult, 
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === blockResult.playerId);
  const target = state.players.find(p => p.id === blockResult.targetId);
  
  if (!attacker || !target) return state;
  
  let newState = structuredClone(state) as GameState;
  
  // Log du résultat de blocage
  const blockLogEntry = createLogEntry(
    'dice',
    `Blocage: ${blockResult.result} (${blockResult.totalStrength} vs ${blockResult.targetStrength})`,
    attacker.id,
    attacker.team,
    { 
      result: blockResult.result, 
      attackerStrength: blockResult.totalStrength, 
      targetStrength: blockResult.targetStrength,
      offensiveAssists: blockResult.offensiveAssists,
      defensiveAssists: blockResult.defensiveAssists
    }
  );
  newState.gameLog = [...newState.gameLog, blockLogEntry];
  
  switch (blockResult.result) {
    case "PLAYER_DOWN":
      // L'attaquant est mis au sol
      newState.players = newState.players.map(p => 
        p.id === attacker.id ? { ...p, stunned: true } : p
      );
      newState.isTurnover = true;
      
      // Log de la chute de l'attaquant
      const attackerDownLog = createLogEntry(
        'action',
        `${attacker.name} est mis au sol par ${target.name}`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, attackerDownLog];
      
      // Jet d'armure pour l'attaquant
      const attackerArmorResult = performArmorRoll(attacker, rng);
      newState.lastDiceResult = attackerArmorResult;
      
      // Log du jet d'armure
      const attackerArmorLog = createLogEntry(
        'dice',
        `Jet d'armure: ${attackerArmorResult.diceRoll}/${attackerArmorResult.targetNumber} ${attackerArmorResult.success ? '✓' : '✗'}`,
        attacker.id,
        attacker.team,
        { diceRoll: attackerArmorResult.diceRoll, targetNumber: attackerArmorResult.targetNumber, success: attackerArmorResult.success }
      );
      newState.gameLog = [...newState.gameLog, attackerArmorLog];
      
      // Si l'attaquant avait le ballon, le perdre
      if (attacker.hasBall) {
        newState.players = newState.players.map(p => 
          p.id === attacker.id ? { ...p, hasBall: false } : p
        );
        newState.ball = { ...attacker.pos };
        return bounceBall(newState, rng);
      }
      break;
      
    case "BOTH_DOWN":
      // Les deux joueurs sont mis au sol
      newState.players = newState.players.map(p => 
        p.id === attacker.id || p.id === target.id ? { ...p, stunned: true } : p
      );
      newState.isTurnover = true;
      
      // Log de la chute des deux joueurs
      const bothDownLog = createLogEntry(
        'action',
        `${attacker.name} et ${target.name} tombent tous les deux`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, bothDownLog];
      
      // Jets d'armure pour les deux joueurs
      const attackerArmorResult2 = performArmorRoll(attacker, rng);
      const targetArmorResult = performArmorRoll(target, rng);
      newState.lastDiceResult = attackerArmorResult2; // On stocke le dernier jet
      
      // Logs des jets d'armure
      const attackerArmorLog2 = createLogEntry(
        'dice',
        `Jet d'armure attaquant: ${attackerArmorResult2.diceRoll}/${attackerArmorResult2.targetNumber} ${attackerArmorResult2.success ? '✓' : '✗'}`,
        attacker.id,
        attacker.team,
        { diceRoll: attackerArmorResult2.diceRoll, targetNumber: attackerArmorResult2.targetNumber, success: attackerArmorResult2.success }
      );
      const targetArmorLog = createLogEntry(
        'dice',
        `Jet d'armure cible: ${targetArmorResult.diceRoll}/${targetArmorResult.targetNumber} ${targetArmorResult.success ? '✓' : '✗'}`,
        target.id,
        target.team,
        { diceRoll: targetArmorResult.diceRoll, targetNumber: targetArmorResult.targetNumber, success: targetArmorResult.success }
      );
      newState.gameLog = [...newState.gameLog, attackerArmorLog2, targetArmorLog];
      
      // Si l'attaquant avait le ballon, le perdre
      if (attacker.hasBall) {
        newState.players = newState.players.map(p => 
          p.id === attacker.id ? { ...p, hasBall: false } : p
        );
        newState.ball = { ...attacker.pos };
        return bounceBall(newState, rng);
      }
      break;
      
    case "PUSH_BACK":
      // La cible est repoussée d'une case - vérifier les directions disponibles
      const pushDirections = getPushDirections(attacker.pos, target.pos);
      const availableDirections: Position[] = [];
      
      for (const pushDirection of pushDirections) {
        const newTargetPos = {
          x: target.pos.x + pushDirection.x,
          y: target.pos.y + pushDirection.y
        };
        
        // Vérifier si la case de destination est libre
        if (inBounds(newState, newTargetPos) && !isPositionOccupied(newState, newTargetPos)) {
          availableDirections.push(pushDirection);
        }
      }
      
      if (availableDirections.length === 0) {
        // Aucune direction disponible - ne pas pousser
        const noPushLog = createLogEntry(
          'action',
          `${target.name} ne peut pas être repoussé (toutes les directions bloquées)`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, noPushLog];
      } else if (availableDirections.length === 1) {
        // Une seule direction disponible - pousser automatiquement
        const pushDirection = availableDirections[0];
        const newTargetPos = {
          x: target.pos.x + pushDirection.x,
          y: target.pos.y + pushDirection.y
        };
        
        newState.players = newState.players.map(p => 
          p.id === target.id ? { ...p, pos: newTargetPos } : p
        );
        
        // L'attaquant peut suivre (follow-up)
        newState.players = newState.players.map(p => 
          p.id === attacker.id ? { ...p, pos: target.pos } : p
        );
        
        const pushLog = createLogEntry(
          'action',
          `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y})`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, pushLog];
      } else {
        // Plusieurs directions disponibles - l'attaquant doit choisir
        newState.pendingPushChoice = {
          attackerId: attacker.id,
          targetId: target.id,
          availableDirections,
          blockResult: "PUSH_BACK",
          offensiveAssists: 0,
          defensiveAssists: 0,
          totalStrength: 3,
          targetStrength: 2
        };
        
        const choiceLog = createLogEntry(
          'action',
          `${attacker.name} doit choisir la direction de poussée pour ${target.name}`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, choiceLog];
        return newState;
      }
      break;
      
    case "STUMBLE":
      // Si la cible a Dodge, c'est un Push Back, sinon c'est POW
      if (target.skills.includes("Dodge")) {
        // Traiter comme un Push Back - vérifier les directions disponibles
        const pushDirections = getPushDirections(attacker.pos, target.pos);
        const availableDirections: Position[] = [];
        
        for (const pushDirection of pushDirections) {
          const newTargetPos = {
            x: target.pos.x + pushDirection.x,
            y: target.pos.y + pushDirection.y
          };
          
          if (inBounds(newState, newTargetPos) && !isPositionOccupied(newState, newTargetPos)) {
            availableDirections.push(pushDirection);
          }
        }
        
        if (availableDirections.length === 0) {
          // Aucune direction disponible - ne pas pousser
          const noPushLog = createLogEntry(
            'action',
            `${target.name} ne peut pas être repoussé (toutes les directions bloquées)`,
            attacker.id,
            attacker.team
          );
          newState.gameLog = [...newState.gameLog, noPushLog];
        } else if (availableDirections.length === 1) {
          // Une seule direction disponible - pousser automatiquement
          const pushDirection = availableDirections[0];
          const newTargetPos = {
            x: target.pos.x + pushDirection.x,
            y: target.pos.y + pushDirection.y
          };
          
          newState.players = newState.players.map(p => 
            p.id === target.id ? { ...p, pos: newTargetPos } : p
          );
          
          // Demander confirmation pour le follow-up
          newState.pendingFollowUpChoice = {
            attackerId: attacker.id,
            targetId: target.id,
            targetNewPosition: newTargetPos,
            targetOldPosition: target.pos
          };
          
          const pushLog = createLogEntry(
            'action',
            `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y})`,
            attacker.id,
            attacker.team
          );
          newState.gameLog = [...newState.gameLog, pushLog];
        } else {
          // Plusieurs directions disponibles - l'attaquant doit choisir
          newState.pendingPushChoice = {
            attackerId: attacker.id,
            targetId: target.id,
            availableDirections,
            blockResult: "STUMBLE",
            offensiveAssists: 0,
            defensiveAssists: 0,
            totalStrength: 3,
            targetStrength: 2
          };
          
          const choiceLog = createLogEntry(
            'action',
            `${attacker.name} doit choisir la direction de poussée pour ${target.name}`,
            attacker.id,
            attacker.team
          );
          newState.gameLog = [...newState.gameLog, choiceLog];
          return newState;
        }
      } else {
        // Pas de Dodge - traiter comme POW
        newState.players = newState.players.map(p => 
          p.id === target.id ? { ...p, stunned: true } : p
        );
        newState.isTurnover = true;
        
        // Log de la mise au sol
        const stumbleDownLog = createLogEntry(
          'action',
          `${target.name} est mis au sol par ${attacker.name}`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, stumbleDownLog];
        
        // Jet d'armure pour la cible
        const targetArmorResult2 = performArmorRoll(target, rng);
        newState.lastDiceResult = targetArmorResult2;
        
        // Log du jet d'armure
        const targetArmorLog2 = createLogEntry(
          'dice',
          `Jet d'armure: ${targetArmorResult2.diceRoll}/${targetArmorResult2.targetNumber} ${targetArmorResult2.success ? '✓' : '✗'}`,
          target.id,
          target.team,
          { diceRoll: targetArmorResult2.diceRoll, targetNumber: targetArmorResult2.targetNumber, success: targetArmorResult2.success }
        );
        newState.gameLog = [...newState.gameLog, targetArmorLog2];
        
        // Gérer la poussée avec choix de direction
        const pushResult = handlePushWithChoice(newState, attacker, target, "STUMBLE");
        
        // Si la cible avait le ballon, le perdre
        if (target.hasBall) {
          pushResult.players = pushResult.players.map(p => 
            p.id === target.id ? { ...p, hasBall: false } : p
          );
          pushResult.ball = { ...target.pos };
          return bounceBall(pushResult, rng);
        }
        
        return pushResult;
      }
      break;
      
    case "POW":
      // La cible est repoussée puis mise au sol
      newState.players = newState.players.map(p => 
        p.id === target.id ? { ...p, stunned: true } : p
      );
      newState.isTurnover = true;
      
      // Log de la mise au sol
      const powLog = createLogEntry(
        'action',
        `${target.name} est mis au sol par ${attacker.name} (POW!)`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, powLog];
      
      // Jet d'armure pour la cible
      const targetArmorResult3 = performArmorRoll(target, rng);
      newState.lastDiceResult = targetArmorResult3;
      
      // Log du jet d'armure
      const targetArmorLog3 = createLogEntry(
        'dice',
        `Jet d'armure: ${targetArmorResult3.diceRoll}/${targetArmorResult3.targetNumber} ${targetArmorResult3.success ? '✓' : '✗'}`,
        target.id,
        target.team,
        { diceRoll: targetArmorResult3.diceRoll, targetNumber: targetArmorResult3.targetNumber, success: targetArmorResult3.success }
      );
      newState.gameLog = [...newState.gameLog, targetArmorLog3];
      
      // Gérer la poussée avec choix de direction
      const pushResult2 = handlePushWithChoice(newState, attacker, target, "POW");
      
      // Si la cible avait le ballon, le perdre
      if (target.hasBall) {
        pushResult2.players = pushResult2.players.map(p => 
          p.id === target.id ? { ...p, hasBall: false } : p
        );
        pushResult2.ball = { ...target.pos };
        return bounceBall(pushResult2, rng);
      }
      
      return pushResult2;
  }
  
  return checkTouchdowns(newState);
}

// --- Fonctions utilitaires pour le blocage ---
export function getPushDirection(attackerPos: Position, targetPos: Position): Position {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  
  // Normaliser la direction
  const normalizedX = dx === 0 ? 0 : dx / Math.abs(dx);
  const normalizedY = dy === 0 ? 0 : dy / Math.abs(dy);
  
  return { x: normalizedX, y: normalizedY };
}

// Fonction utilitaire pour gérer la poussée avec choix de direction
function handlePushWithChoice(
  state: GameState, 
  attacker: Player, 
  target: Player, 
  blockResult: string
): GameState {
  const availableDirections = getPushDirections(attacker.pos, target.pos).filter(dir => {
    const newPos = {
      x: target.pos.x + dir.x,
      y: target.pos.y + dir.y
    };
    return inBounds(state, newPos) && !isPositionOccupied(state, newPos);
  });

  if (availableDirections.length === 0) {
    // Aucune direction disponible - pas de poussée possible
    const noPushLog = createLogEntry(
      'action',
      `${target.name} ne peut pas être repoussé (aucune case libre)`,
      attacker.id,
      attacker.team
    );
    return { ...state, gameLog: [...state.gameLog, noPushLog] };
  } else if (availableDirections.length === 1) {
    // Une seule direction disponible - pousser automatiquement
    const pushDirection = availableDirections[0];
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y
    };
    
    let newState = { ...state };
    newState.players = newState.players.map(p => 
      p.id === target.id ? { ...p, pos: newTargetPos } : p
    );
    
    // Demander confirmation pour le follow-up
    newState.pendingFollowUpChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      targetNewPosition: newTargetPos,
      targetOldPosition: target.pos
    };
    
    const pushLog = createLogEntry(
      'action',
      `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y})`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, pushLog];
    
    return newState;
  } else {
    // Plusieurs directions disponibles - l'attaquant doit choisir
    const newState = { ...state };
    newState.pendingPushChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      availableDirections,
      blockResult: blockResult as any,
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 2
    };
    
    const choiceLog = createLogEntry(
      'action',
      `${attacker.name} doit choisir la direction de poussée pour ${target.name}`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, choiceLog];
    
    return newState;
  }
}

// Fonction pour obtenir les 3 directions possibles de poussée
export function getPushDirections(attackerPos: Position, targetPos: Position): Position[] {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  
  // Normaliser la direction de l'attaquant vers la cible
  const normalizedX = dx === 0 ? 0 : Math.sign(dx);
  const normalizedY = dy === 0 ? 0 : Math.sign(dy);
  
  // Les directions de poussée sont dans la direction opposée à l'attaquant
  // (la cible est poussée dans la direction opposée à l'attaquant)
  const pushX = normalizedX === 0 ? 0 : -normalizedX;
  const pushY = normalizedY === 0 ? 0 : -normalizedY;
  
  const directions: Position[] = [];
  
  // Direction directe (opposée à l'attaquant)
  directions.push({ x: pushX, y: pushY });
  
  // Calculer les directions à 45° de la direction directe
  if (pushX !== 0 && pushY !== 0) {
    // Si on est en diagonale, les directions à 45° sont les directions cardinales
    directions.push({ x: pushX, y: 0 });
    directions.push({ x: 0, y: pushY });
  } else if (pushX !== 0) {
    // Si on est horizontal, les directions à 45° sont les diagonales
    directions.push({ x: pushX, y: 1 });
    directions.push({ x: pushX, y: -1 });
  } else if (pushY !== 0) {
    // Si on est vertical, les directions à 45° sont les diagonales
    directions.push({ x: 1, y: pushY });
    directions.push({ x: -1, y: pushY });
  }
  
  return directions;
}

export function isPositionOccupied(state: GameState, pos: Position): boolean {
  return state.players.some(p => p.pos.x === pos.x && p.pos.y === pos.y);
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
  
  // Log du rebond
  const bounceLogEntry = createLogEntry(
    'action',
    `Ballon rebondit vers (${newBallPos.x}, ${newBallPos.y})`,
    undefined,
    undefined
  );
  newState.gameLog = [...newState.gameLog, bounceLogEntry];
  
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
    
    // Log du jet de réception
    const catchLogEntry = createLogEntry(
      'dice',
      `Jet de réception: ${catchResult.diceRoll}/${catchResult.targetNumber} ${catchResult.success ? '✓' : '✗'}`,
      playerAtNewPos.id,
      playerAtNewPos.team,
      { diceRoll: catchResult.diceRoll, targetNumber: catchResult.targetNumber, success: catchResult.success, modifiers: catchModifiers }
    );
    newState.gameLog = [...newState.gameLog, catchLogEntry];
    
    if (catchResult.success) {
      // Réception réussie : attacher la balle au joueur
      newState.ball = undefined;
      newState.players = newState.players.map(p => 
        p.id === playerAtNewPos.id ? { ...p, hasBall: true } : p
      );
      
      // Log de la réception réussie
      const successCatchLogEntry = createLogEntry(
        'action',
        `Ballon réceptionné avec succès`,
        playerAtNewPos.id,
        playerAtNewPos.team
      );
      newState.gameLog = [...newState.gameLog, successCatchLogEntry];

      // Si réception dans l'en-but adverse, touchdown immédiat
      const scorer = newState.players.find(p => p.id === playerAtNewPos.id)!;
      if (isInOpponentEndzone(newState, scorer)) {
        return awardTouchdown(newState, scorer.team, scorer);
      }
    } else {
      // Échec de réception : la balle continue à rebondir
      newState.ball = newBallPos;
      
      // Log de l'échec de réception
      const failCatchLogEntry = createLogEntry(
        'action',
        `Échec de réception - le ballon continue à rebondir`,
        playerAtNewPos.id,
        playerAtNewPos.team
      );
      newState.gameLog = [...newState.gameLog, failCatchLogEntry];
      
      // Appel récursif pour continuer le rebond
      return bounceBall(newState, rng);
    }
  } else {
    // Case vide ou joueur sans Zone de Tackle : la balle s'arrête là
    newState.ball = newBallPos;
    
    // Log de l'arrêt du ballon
    const stopLogEntry = createLogEntry(
      'action',
      `Ballon s'arrête à (${newBallPos.x}, ${newBallPos.y})`,
      undefined,
      undefined
    );
    newState.gameLog = [...newState.gameLog, stopLogEntry];
  }
  
  return checkTouchdowns(newState);
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
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    // Informations de match
    half: 1,
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: "Orcs de Fer",
      teamB: "Elfes Sombres",
    },
    // Log du match
    gameLog: [
      createLogEntry('info', 'Match commencé - Orcs de Fer vs Elfes Sombres'),
    ],
  };
}

// --- Fonctions utilitaires pour les actions ---
export function hasPlayerActed(state: GameState, playerId: string): boolean {
  return state.playerActions.has(playerId);
}

export function canPlayerAct(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  
  // Un joueur ne peut pas agir s'il est étourdi ou n'a plus de PM
  return !player.stunned && player.pm > 0;
}

export function canPlayerMove(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  
  // Un joueur peut bouger s'il n'est pas étourdi, a des PM, et n'a pas encore fait d'action principale
  return !player.stunned && player.pm > 0 && !hasPlayerActed(state, playerId);
}

export function canPlayerContinueMoving(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  
  // Un joueur peut continuer à bouger s'il n'est pas étourdi, a des PM, et 
  // soit il n'a pas encore agi, soit il a déjà commencé à bouger ou fait un blitz
  const playerAction = getPlayerAction(state, playerId);
  return !player.stunned && player.pm > 0 && (!hasPlayerActed(state, playerId) || playerAction === "MOVE" || playerAction === "BLITZ");
}

export function getPlayerAction(state: GameState, playerId: string): ActionType | undefined {
  return state.playerActions.get(playerId);
}

export function setPlayerAction(state: GameState, playerId: string, action: ActionType): GameState {
  const newPlayerActions = new Map(state.playerActions);
  newPlayerActions.set(playerId, action);
  return {
    ...state,
    playerActions: newPlayerActions
  };
}

export function clearPlayerActions(state: GameState): GameState {
  return {
    ...state,
    playerActions: new Map<string, ActionType>()
  };
}

// --- Gestion du compteur de blitz ---
export function getTeamBlitzCount(state: GameState, team: TeamId): number {
  return state.teamBlitzCount.get(team) || 0;
}

export function canTeamBlitz(state: GameState, team: TeamId): boolean {
  return getTeamBlitzCount(state, team) < 1;
}

export function incrementTeamBlitzCount(state: GameState, team: TeamId): GameState {
  const newTeamBlitzCount = new Map(state.teamBlitzCount);
  const currentCount = newTeamBlitzCount.get(team) || 0;
  newTeamBlitzCount.set(team, currentCount + 1);
  
  return {
    ...state,
    teamBlitzCount: newTeamBlitzCount
  };
}

export function clearTeamBlitzCounts(state: GameState): GameState {
  return {
    ...state,
    teamBlitzCount: new Map<TeamId, number>()
  };
}

export function shouldEndPlayerTurn(state: GameState, playerId: string): boolean {
  // Un joueur finit son tour s'il a effectué une action
  return hasPlayerActed(state, playerId);
}

export function endPlayerTurn(state: GameState, playerId: string): GameState {
  // Marquer le joueur comme ayant fini son tour
  const newState = setPlayerAction(state, playerId, "MOVE");
  
  // Log de fin de tour du joueur
  const player = state.players.find(p => p.id === playerId);
  if (player) {
    const logEntry = createLogEntry(
      'action',
      `Fin du tour de ${player.name}`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, logEntry];
  }
  
  return checkTouchdowns(newState);
}

export function checkPlayerTurnEnd(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Si le joueur n'a plus de PM et a commencé à bouger, finir son tour
  if (player.pm <= 0 && hasPlayerActed(state, playerId) && getPlayerAction(state, playerId) === "MOVE") {
    return endPlayerTurn(state, playerId);
  }
  
  return state;
}

export function shouldAutoEndTurn(state: GameState): boolean {
  const team = state.currentPlayer;
  const teamPlayers = state.players.filter(p => p.team === team);
  
  // Vérifier si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir
  return teamPlayers.every(player => 
    hasPlayerActed(state, player.id) || 
    player.stunned || 
    player.pm <= 0
  );
}

export function handlePlayerSwitch(state: GameState, newPlayerId: string): GameState {
  // Si on change de joueur, finir le tour du joueur précédemment sélectionné
  if (state.selectedPlayerId && state.selectedPlayerId !== newPlayerId) {
    const previousPlayer = state.players.find(p => p.id === state.selectedPlayerId);
    if (previousPlayer && hasPlayerActed(state, previousPlayer.id)) {
      // Le joueur précédent a déjà agi, on ne peut pas le laisser actif
      return {
        ...state,
        selectedPlayerId: newPlayerId
      };
    }
  }
  
  return {
    ...state,
    selectedPlayerId: newPlayerId
  };
}

// --- Légalité des moves (MVP) ---
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: "END_TURN" }];
  const team = state.currentPlayer;
  
  // Si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir, seul END_TURN est possible
  if (shouldAutoEndTurn(state)) {
    return moves;
  }
  
  const myPlayers = state.players.filter(
    (p) => p.team === team && (canPlayerMove(state, p.id) || canPlayerContinueMoving(state, p.id)),
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
    
    // Actions de blocage
    const adjacentOpponents = getAdjacentOpponents(state, p.pos, p.team);
    for (const opponent of adjacentOpponents) {
      if (canBlock(state, p.id, opponent.id)) {
        moves.push({ type: "BLOCK", playerId: p.id, targetId: opponent.id });
      }
    }
    
    // Actions de blitz (mouvement + blocage)
    // Pour chaque direction de mouvement possible
    for (const d of dirs) {
      const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
      if (!inBounds(state, to)) continue;
      if (occ.has(`${to.x},${to.y}`)) continue; // pas de chevauchement
      
      // Vérifier si on peut faire un blitz vers cette position
      // Chercher tous les adversaires qui seraient adjacents après le mouvement
      const allOpponents = state.players.filter(opp => opp.team !== p.team && !opp.stunned);
      for (const opponent of allOpponents) {
        if (canBlitz(state, p.id, to, opponent.id)) {
          moves.push({ type: "BLITZ", playerId: p.id, to, targetId: opponent.id });
        }
      }
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
        playerActions: new Map<string, ActionType>(), // Réinitialiser les actions
        teamBlitzCount: new Map<TeamId, number>(), // Réinitialiser les compteurs de blitz
      };
      
      // Log du changement de tour
      const turnLogEntry = createLogEntry(
        'action',
        `Fin du tour - ${newState.currentPlayer === "A" ? newState.teamNames.teamA : newState.teamNames.teamB} joue maintenant`,
        undefined,
        newState.currentPlayer
      );
      newState.gameLog = [...newState.gameLog, turnLogEntry];
      
      // Le porteur de ballon garde le ballon lors du changement de tour
      // Vérifier touchdowns, puis passage de mi-temps si besoin
      return advanceHalfIfNeeded(checkTouchdowns(newState));
    case "MOVE": {
      const idx = state.players.findIndex((p) => p.id === move.playerId);
      if (idx === -1) return state;
      
      // Gérer le changement de joueur
      let newState = handlePlayerSwitch(state, move.playerId);
      
      const legal = getLegalMoves(newState).some(
        (m) =>
          m.type === "MOVE" &&
          m.playerId === move.playerId &&
          samePos(m.to, move.to),
      );
      if (!legal) return newState;

      const player = newState.players[idx];
      const from = player.pos;
      const to = move.to;

      // Vérifier si un jet d'esquive est nécessaire
      const needsDodge = requiresDodgeRoll(newState, from, to, player.team);
      
      if (needsDodge) {
        // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée)
        const dodgeModifiers = calculateDodgeModifiers(newState, from, to, player.team);
        
        // Effectuer le jet d'esquive avec les modificateurs
        const dodgeResult = performDodgeRoll(player, rng, dodgeModifiers);
        
        let next = structuredClone(newState) as GameState;
        next.lastDiceResult = dodgeResult;
        
        // Log du jet d'esquive
        const logEntry = createLogEntry(
          'dice',
          `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
          player.id,
          player.team,
          { diceRoll: dodgeResult.diceRoll, targetNumber: dodgeResult.targetNumber, success: dodgeResult.success, modifiers: dodgeModifiers }
        );
        next.gameLog = [...next.gameLog, logEntry];
        
        // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
        next.players[idx].pos = { ...to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        
        // Enregistrer l'action de mouvement seulement si c'est le premier mouvement
        if (!hasPlayerActed(next, player.id)) {
          next = setPlayerAction(next, player.id, "MOVE");
        }
        
        // Vérifier si le tour du joueur doit se terminer
        next = checkPlayerTurnEnd(next, player.id);
        
        if (dodgeResult.success) {
          // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
          const mover = next.players[idx];
          if (mover.hasBall && isInOpponentEndzone(next, mover)) {
            return awardTouchdown(next, mover.team, mover);
          }
        } else {
          // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
          next.isTurnover = true;
          
          // Le joueur chute (est mis à terre)
          next.players[idx].stunned = true;
          
          // Effectuer le jet d'armure
          const armorResult = performArmorRoll(next.players[idx], rng);
          next.lastDiceResult = armorResult;
          
          // Log du jet d'armure
          const armorLogEntry = createLogEntry(
            'dice',
            `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
            next.players[idx].id,
            next.players[idx].team,
            { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, success: armorResult.success }
          );
          next.gameLog = [...next.gameLog, armorLogEntry];
          
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
        let next = structuredClone(newState) as GameState;
        next.players[idx].pos = { ...to };
        next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
        
        // Enregistrer l'action de mouvement seulement si c'est le premier mouvement
        if (!hasPlayerActed(next, player.id)) {
          next = setPlayerAction(next, player.id, "MOVE");
        }
        
        // Vérifier si le tour du joueur doit se terminer
        next = checkPlayerTurnEnd(next, player.id);
        
        // Log du mouvement
        const moveLogEntry = createLogEntry(
          'action',
          `Mouvement vers (${to.x}, ${to.y})`,
          player.id,
          player.team
        );
        next.gameLog = [...next.gameLog, moveLogEntry];
        // Réinitialiser le résultat de dés après un mouvement normal
        next.lastDiceResult = undefined;

        // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
        const mover = next.players[idx];
        if (mover.hasBall && isInOpponentEndzone(next, mover)) {
          return awardTouchdown(next, mover.team, mover);
        }

        // Ramassage de balle avec jet d'agilité
        if (next.ball && samePos(next.ball, to)) {
          // Calculer les modificateurs de pickup (malus pour adversaires marquant la balle)
          const pickupModifiers = calculatePickupModifiers(newState, next.ball, player.team);
          
          // Effectuer le jet de pickup
          const pickupResult = performPickupRoll(player, rng, pickupModifiers);
          
          // Stocker le résultat pour l'affichage
          next.lastDiceResult = pickupResult;
          
          // Log du jet de pickup
          const pickupLogEntry = createLogEntry(
            'dice',
            `Jet de pickup: ${pickupResult.diceRoll}/${pickupResult.targetNumber} ${pickupResult.success ? '✓' : '✗'}`,
            player.id,
            player.team,
            { diceRoll: pickupResult.diceRoll, targetNumber: pickupResult.targetNumber, success: pickupResult.success, modifiers: pickupModifiers }
          );
          next.gameLog = [...next.gameLog, pickupLogEntry];
          
          if (pickupResult.success) {
            // Ramassage réussi : attacher la balle au joueur
            next.ball = undefined;
            next.players[idx].hasBall = true;
            
            // Log du ramassage réussi
            const successLogEntry = createLogEntry(
              'action',
              `Ballon ramassé avec succès`,
              player.id,
              player.team
            );
            next.gameLog = [...next.gameLog, successLogEntry];

            // Si pickup dans l'en-but adverse, touchdown immédiat
            const picker = next.players[idx];
            if (isInOpponentEndzone(next, picker)) {
              return awardTouchdown(next, picker.team, picker);
            }
          } else {
            // Échec de pickup : la balle rebondit et turnover
            next.isTurnover = true;
            
            // Log du ramassage échoué
            const failLogEntry = createLogEntry(
              'turnover',
              `Échec du ramassage - Turnover`,
              player.id,
              player.team
            );
            next.gameLog = [...next.gameLog, failLogEntry];
            
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
      
      // Log du jet d'esquive
      const dodgeLogEntry = createLogEntry(
        'dice',
        `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
        player.id,
        player.team,
        { diceRoll: dodgeResult.diceRoll, targetNumber: dodgeResult.targetNumber, success: dodgeResult.success, modifiers: dodgeModifiers }
      );
      next.gameLog = [...next.gameLog, dodgeLogEntry];
      
      // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
      next.players[idx].pos = { ...move.to };
      next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
      
      if (dodgeResult.success) {
        // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
        const mover = next.players[idx];
        if (mover.hasBall && isInOpponentEndzone(next, mover)) {
          return awardTouchdown(next, mover.team, mover);
        }
      } else {
        // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
        next.isTurnover = true;
        
        // Le joueur chute (est mis à terre)
        next.players[idx].stunned = true;
        
        // Log de la chute
        const fallLogEntry = createLogEntry(
          'action',
          `Joueur sonné après échec d'esquive`,
          player.id,
          player.team
        );
        next.gameLog = [...next.gameLog, fallLogEntry];
        
        // Effectuer le jet d'armure
        const armorResult = performArmorRoll(next.players[idx], rng);
        next.lastDiceResult = armorResult;
        
        // Log du jet d'armure
        const armorLogEntry = createLogEntry(
          'dice',
          `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
          next.players[idx].id,
          next.players[idx].team,
          { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, success: armorResult.success }
        );
        next.gameLog = [...next.gameLog, armorLogEntry];
        
        // Si le joueur avait le ballon, il le perd et le ballon rebondit
        if (next.players[idx].hasBall) {
          next.players[idx].hasBall = false;
          next.ball = { ...next.players[idx].pos };
          
          // Log de la perte de ballon
          const ballLossLogEntry = createLogEntry(
            'action',
            `Ballon perdu après chute`,
            player.id,
            player.team
          );
          next.gameLog = [...next.gameLog, ballLossLogEntry];
          
          // Faire rebondir le ballon depuis la position du joueur
          return bounceBall(next, rng);
        }
      }
      
      return next;
    }
    case "BLOCK": {
      const attacker = state.players.find(p => p.id === move.playerId);
      const target = state.players.find(p => p.id === move.targetId);
      
      if (!attacker || !target) return state;
      
      // Vérifier que le blocage est légal
      if (!canBlock(state, move.playerId, move.targetId)) return state;
      
      // Calculer les assists
      const offensiveAssists = calculateOffensiveAssists(state, attacker, target);
      const defensiveAssists = calculateDefensiveAssists(state, attacker, target);
      
      // Nombre de dés et qui choisit
      const attackerStrength = attacker.st + offensiveAssists;
      const targetStrength = target.st + defensiveAssists;
      const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
      const chooser = getBlockDiceChooser(attackerStrength, targetStrength);
      

      // Enregistrer l'action de blocage
      let newState = setPlayerAction(state, attacker.id, "BLOCK");
      
      // Si un seul dé, résoudre immédiatement
      if (diceCount === 1) {
        const blockResult = rollBlockDice(rng);
        const diceRoll = Math.floor(rng() * 6) + 1; // Simuler le jet de dé pour le log (1-6)
        const blockDiceResult: BlockDiceResult = {
          type: "block",
          playerId: attacker.id,
          targetId: target.id,
          diceRoll: diceRoll,
          result: blockResult,
          offensiveAssists,
          defensiveAssists,
          totalStrength: attackerStrength,
          targetStrength
        };
        
        // Log du résultat de blocage
        const blockLogEntry = createLogEntry(
          'dice',
          `Blocage: ${diceRoll} → ${blockResult}`,
          attacker.id,
          attacker.team,
          { diceRoll: diceRoll, result: blockResult, offensiveAssists, defensiveAssists }
        );
        newState.gameLog = [...newState.gameLog, blockLogEntry];
        
        return resolveBlockResult(newState, blockDiceResult, rng);
      } else {
        // Plusieurs dés : enregistrer un choix en attente
        const options = rollBlockDiceManyWithRolls(rng, diceCount);
        
        // Log des dés lancés
        const blockLogEntry = createLogEntry(
          'dice',
          `Blocage: ${options.map(o => o.diceRoll).join(', ')} (${diceCount} dés)`,
          attacker.id,
          attacker.team,
          { diceRolls: options.map(o => o.diceRoll), diceCount, offensiveAssists, defensiveAssists }
        );
        newState.gameLog = [...newState.gameLog, blockLogEntry];
        
        // Ne pas assigner lastDiceResult pour les choix de blocage multiples
        
        return {
          ...newState,
          pendingBlock: {
            attackerId: attacker.id,
            targetId: target.id,
            options: options.map(o => o.result),
            chooser,
            offensiveAssists,
            defensiveAssists,
            totalStrength: attackerStrength,
            targetStrength
          }
        };
      }
    }
    case "BLOCK_CHOOSE": {
      const attacker = state.players.find(p => p.id === move.playerId);
      const target = state.players.find(p => p.id === move.targetId);
      if (!attacker || !target) return state;
      if (!state.pendingBlock || state.pendingBlock.attackerId !== attacker.id || state.pendingBlock.targetId !== target.id) {
        return state; // pas de choix attendu
      }

      // Construire un résultat complet à partir du choix
      const blockResult: BlockDiceResult = {
        type: "block",
        playerId: attacker.id,
        targetId: target.id,
        diceRoll: 0,
        result: move.result,
        offensiveAssists: state.pendingBlock.offensiveAssists,
        defensiveAssists: state.pendingBlock.defensiveAssists,
        totalStrength: state.pendingBlock.totalStrength,
        targetStrength: state.pendingBlock.targetStrength,
      };

      let newState = resolveBlockResult({ ...state, pendingBlock: undefined }, blockResult, rng);
      
      // Déterminer si c'était un blitz ou un blocage normal
      // Si le joueur a déjà l'action BLITZ enregistrée, c'est un blitz
      // Sinon, c'est un blocage normal
      const isBlitz = hasPlayerActed(state, attacker.id) && getPlayerAction(state, attacker.id) === "BLITZ";
      
      if (isBlitz) {
        // Pour un blitz, consommer 1 PM supplémentaire pour le blocage
        const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
        if (attackerIdx !== -1) {
          newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - 1);
        }
        
        // Enregistrer l'action de blitz
        newState = setPlayerAction(newState, attacker.id, "BLITZ");
        
        // Pour un blitz, ne pas terminer l'activation du joueur - il peut continuer à bouger
        // sauf si c'est un turnover (PLAYER_DOWN, BOTH_DOWN, etc.)
        if (!newState.isTurnover) {
          // Le joueur peut continuer à bouger après le blocage
          // On ne termine pas son activation ici
        } else {
          // En cas de turnover, terminer l'activation
          newState = checkPlayerTurnEnd(newState, attacker.id);
        }
      } else {
        // Pour un blocage normal, terminer l'activation
        newState = setPlayerAction(newState, attacker.id, "BLOCK");
        newState = checkPlayerTurnEnd(newState, attacker.id);
      }
      
      // lastDiceResult est déjà renseigné par resolveBlockResult pour l'armure; on peut aussi logguer le block
      newState.lastDiceResult = {
        type: "block",
        playerId: attacker.id,
        diceRoll: 0,
        targetNumber: 0,
        success: true,
        modifiers: 0,
      };
      return newState;
    }
    case "PUSH_CHOOSE": {
      const attacker = state.players.find(p => p.id === move.playerId);
      const target = state.players.find(p => p.id === move.targetId);
      if (!attacker || !target) return state;
      if (!state.pendingPushChoice || state.pendingPushChoice.attackerId !== attacker.id || state.pendingPushChoice.targetId !== target.id) {
        return state; // pas de choix de poussée attendu
      }

      // Vérifier que la direction choisie est valide
      const isValidDirection = state.pendingPushChoice.availableDirections.some(dir => 
        dir.x === move.direction.x && dir.y === move.direction.y
      );
      if (!isValidDirection) return state;

      // Appliquer la poussée dans la direction choisie
      const newTargetPos = {
        x: target.pos.x + move.direction.x,
        y: target.pos.y + move.direction.y
      };

      let newState = { ...state, pendingPushChoice: undefined };
      newState.players = newState.players.map(p => 
        p.id === target.id ? { ...p, pos: newTargetPos } : p
      );

      // Demander confirmation pour le follow-up
      newState.pendingFollowUpChoice = {
        attackerId: attacker.id,
        targetId: target.id,
        targetNewPosition: newTargetPos,
        targetOldPosition: target.pos
      };

      // Log de la poussée
      const pushLog = createLogEntry(
        'action',
        `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y}) par ${attacker.name}`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, pushLog];

      return checkTouchdowns(newState);
    }
    case "FOLLOW_UP_CHOOSE": {
      const attacker = state.players.find(p => p.id === move.playerId);
      const target = state.players.find(p => p.id === move.targetId);
      if (!attacker || !target) return state;
      if (!state.pendingFollowUpChoice || state.pendingFollowUpChoice.attackerId !== attacker.id || state.pendingFollowUpChoice.targetId !== target.id) {
        return state; // pas de choix de follow-up attendu
      }

      let newState = { ...state, pendingFollowUpChoice: undefined };

      if (move.followUp) {
        // L'attaquant suit le joueur poussé
        newState.players = newState.players.map(p => 
          p.id === attacker.id ? { ...p, pos: state.pendingFollowUpChoice!.targetOldPosition } : p
        );
        
        const followUpLog = createLogEntry(
          'action',
          `${attacker.name} suit ${target.name} (follow-up)`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, followUpLog];
      } else {
        const noFollowUpLog = createLogEntry(
          'action',
          `${attacker.name} ne suit pas ${target.name}`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, noFollowUpLog];
      }

      return checkTouchdowns(newState);
    }
    case "BLITZ": {
      const attacker = state.players.find(p => p.id === move.playerId);
      const target = state.players.find(p => p.id === move.targetId);
      
      if (!attacker || !target) return state;
      
      // Vérifier que le blitz est légal
      if (!canBlitz(state, move.playerId, move.to, move.targetId)) return state;
      
      // Gérer le changement de joueur
      let newState = handlePlayerSwitch(state, move.playerId);
      
      // 1. Effectuer le mouvement
      const from = attacker.pos;
      const to = move.to;
      
      // Vérifier si un jet d'esquive est nécessaire pour le mouvement
      const needsDodge = requiresDodgeRoll(newState, from, to, attacker.team);
      
      if (needsDodge) {
        // Calculer les modificateurs de désquive
        const dodgeModifiers = calculateDodgeModifiers(newState, from, to, attacker.team);
        
        // Effectuer le jet d'esquive
        const dodgeResult = performDodgeRoll(attacker, rng, dodgeModifiers);
        
        newState.lastDiceResult = dodgeResult;
        
        // Log du jet d'esquive
        const dodgeLogEntry = createLogEntry(
          'dice',
          `Jet d'esquive (Blitz): ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
          attacker.id,
          attacker.team,
          { diceRoll: dodgeResult.diceRoll, targetNumber: dodgeResult.targetNumber, success: dodgeResult.success, modifiers: dodgeModifiers }
        );
        newState.gameLog = [...newState.gameLog, dodgeLogEntry];
        
        // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
        const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
        newState.players[attackerIdx].pos = { ...to };
        
        // Calculer le coût en PM : distance seulement (le blocage coûtera 1 PM supplémentaire)
        const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
        newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);
        
        if (dodgeResult.success) {
          // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
          const mover = newState.players[attackerIdx];
          if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
            return awardTouchdown(newState, mover.team, mover);
          }
        } else {
          // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
          newState.isTurnover = true;
          
          // Vérifier si le joueur avait le ballon AVANT de le mettre à terre
          const hadBall = newState.players[attackerIdx].hasBall;
          
          // Le joueur chute (est mis à terre)
          newState.players[attackerIdx].stunned = true;
          
          // Effectuer le jet d'armure
          const armorResult = performArmorRoll(newState.players[attackerIdx], rng);
          newState.lastDiceResult = armorResult;
          
          // Log du jet d'armure
          const armorLogEntry = createLogEntry(
            'dice',
            `Jet d'armure (Blitz échoué): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
            newState.players[attackerIdx].id,
            newState.players[attackerIdx].team,
            { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, success: armorResult.success }
          );
          newState.gameLog = [...newState.gameLog, armorLogEntry];
          
          // Si le joueur avait le ballon, il le perd et le ballon rebondit
          // (même si l'armure n'est pas percée, le joueur chute et perd le ballon)
          if (hadBall) {
            newState.players[attackerIdx].hasBall = false;
            newState.ball = { ...newState.players[attackerIdx].pos };
            
            // Log de la perte de ballon
            const ballLossLogEntry = createLogEntry(
              'action',
              `Ballon perdu après échec de blitz`,
              attacker.id,
              attacker.team
            );
            newState.gameLog = [...newState.gameLog, ballLossLogEntry];
            
            // Faire rebondir le ballon depuis la position du joueur
            return bounceBall(newState, rng);
          }
          
          // Enregistrer l'action de blitz et terminer le tour
          newState = setPlayerAction(newState, attacker.id, "BLITZ");
          newState = checkPlayerTurnEnd(newState, attacker.id);
          return newState;
        }
      } else {
        // Pas de jet d'esquive nécessaire, déplacer directement
        const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
        newState.players[attackerIdx].pos = { ...to };
        
        // Calculer le coût en PM : distance seulement (le blocage coûtera 1 PM supplémentaire)
        const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
        newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);
        
        // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
        const mover = newState.players[attackerIdx];
        if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
          return awardTouchdown(newState, mover.team, mover);
        }
      }
      
      // 2. Effectuer le blocage après le mouvement
      const updatedAttacker = newState.players.find(p => p.id === attacker.id);
      const updatedTarget = newState.players.find(p => p.id === target.id);
      
      if (!updatedAttacker || !updatedTarget) return newState;
      
      // Vérifier que le blocage est toujours possible après le mouvement
      if (!canBlock(newState, updatedAttacker.id, updatedTarget.id)) {
        // Si le blocage n'est plus possible, enregistrer l'action et terminer
        newState = setPlayerAction(newState, attacker.id, "BLITZ");
        newState = checkPlayerTurnEnd(newState, attacker.id);
        return newState;
      }
      
      // Calculer les assists
      const offensiveAssists = calculateOffensiveAssists(newState, updatedAttacker, updatedTarget);
      const defensiveAssists = calculateDefensiveAssists(newState, updatedAttacker, updatedTarget);
      
      // Nombre de dés et qui choisit
      const attackerStrength = updatedAttacker.st + offensiveAssists;
      const targetStrength = updatedTarget.st + defensiveAssists;
      const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
      const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

      // Tirer les dés et enregistrer un choix en attente
      const options = rollBlockDiceMany(rng, diceCount);
      
      // Log de l'action de blitz
      const blitzLogEntry = createLogEntry(
        'action',
        `Blitz: mouvement vers (${to.x}, ${to.y}) puis blocage de ${updatedTarget.name}`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, blitzLogEntry];
      
      // Enregistrer l'action de blitz AVANT de créer le pendingBlock
      newState = setPlayerAction(newState, attacker.id, "BLITZ");
      
      // Incrémenter le compteur de blitz de l'équipe
      newState = incrementTeamBlitzCount(newState, attacker.team);
      
      // Vérifier si le joueur porte la balle et est dans l'en-but adverse après le mouvement
      const mover = newState.players.find(p => p.id === attacker.id);
      if (mover && mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
      
      return {
        ...newState,
        pendingBlock: {
          attackerId: updatedAttacker.id,
          targetId: updatedTarget.id,
          options,
          chooser,
          offensiveAssists,
          defensiveAssists,
          totalStrength: attackerStrength,
          targetStrength
        }
      };
    }
    default:
      return checkTouchdowns(state);
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
      BLOCK: (
        G: GameState,
        ctx: Ctx,
        args: { playerId: string; targetId: string },
      ) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(
          G,
          { type: "BLOCK", playerId: args.playerId, targetId: args.targetId },
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
