/**
 * Types et interfaces pour le moteur de jeu Blood Bowl
 */

/**
 * Version sémantique du moteur de match BB. Bump à chaque changement de
 * comportement déterministe (règles, dés, ordres d'effet) — sert à
 * marquer les matchs déjà simulés pour distinguer les replays produits
 * par des versions différentes du moteur (cf. ProLeagueMatch.engineVer).
 * Pendant unique à `ENGINE_VER` de `@bb/sim-engine`.
 */
export const ENGINE_VER = '1.0.0';
export type EngineVersion = string;

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
  breakTackleUsed?: boolean; // Break Tackle utilisé pendant cette activation (BB3 — reset chaque tour d'équipe)
  hasBall?: boolean; // indique si le joueur a la balle
  state?: PlayerState; // état du joueur pour les zones de dugout
  /**
   * Règle spéciale d'équipe "Capitaine" (Saison 3) : ce joueur est le
   * capitaine désigné de son équipe. S'il est sur le terrain, chaque
   * relance d'équipe déclenche un D6 — sur un 6 naturel elle est gratuite.
   * Au placement, le capitaine doit être aligné si possible. Optionnel
   * pour compatibilité avec les états/replays antérieurs.
   */
  isCaptain?: boolean;
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

/**
 * Evenement de coup d'envoi en attente d'une decision de coach.
 *
 * Les `type` reprennent les identifiants de la table 2D6 de la saison
 * 2025 (cf. `mechanics/kickoff-events.ts`) :
 *  - `solid-defence` (4, Solide defense) : le coach qui engage retire
 *    puis replace jusqu'a `maxPlayers` (D3+3) de ses joueurs Demarques.
 *  - `high-kick` (5, Chandelle) : le coach qui receptionne place 1
 *    joueur Demarque sur la case d'atterrissage du ballon.
 *  - `quick-snap` (9, Surprise) : le coach qui receptionne deplace
 *    jusqu'a `maxPlayers` (D3+3) de ses joueurs Demarques d'1 case.
 *  - `blitz` (10, Charge) : le coach qui engage active jusqu'a
 *    `maxPlayers` (D3+3) de ses joueurs Demarques.
 */
export interface PendingKickoffEvent {
  type: 'solid-defence' | 'high-kick' | 'quick-snap' | 'blitz';
  team: TeamId;
  ballPosition?: Position; // for high-kick: where the ball will land
  /**
   * Nombre maximum de joueurs concernes (D3+3 sur les evenements 4, 9
   * et 10 de la table 2025). Tire au moment ou l'evenement est applique
   * pour que la resolution UI puisse le valider. Optionnel pour rester
   * compatible avec les etats serialises avant la table 2025.
   */
  maxPlayers?: number;
  /**
   * Joueurs eligibles (Demarques au moment du coup d'envoi). La
   * resolution refuse tout joueur hors de cette liste.
   */
  eligiblePlayerIds?: string[];
}

export interface PendingApothecary {
  playerId: string;
  team: TeamId;
  injuryType: 'ko' | 'casualty';
  originalCasualtyOutcome?: CasualtyOutcome;
  originalCasualtyRoll?: number;
  originalLastingInjury?: LastingInjuryDetail;
  causedById?: string;
  /**
   * Lot O.A.1 — Si vrai, le joueur a la skill Regeneration. Quand le
   * coach refuse l'apothecaire (`applyApothecaryChoice(_, false, _)`),
   * la regeneration est tentee en fallback. BB Season 2/3 : apothecaire
   * propose en premier, regeneration en dernier recours.
   */
  fallbackToRegeneration?: boolean;
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
  // BB2020 : un apothecary peut etre utilise UNE fois par match. Une
  // equipe avec apothecary natif (Human, Dwarf, etc.) demarre avec
  // teamA/teamB = 1. L'inducement Wandering Apothecary INCREMENTE ce
  // compteur (deuxieme usage), Igor pareil pour les equipes sans
  // apothecary natif. Stocker en number permet de cumuler plusieurs
  // achats. Avant le fix, c'etait un boolean -> 2e achat etait un no-op.
  apothecaryAvailable: { teamA: number; teamB: number };
  pendingApothecary?: PendingApothecary;
  // Événement de kickoff en attente de résolution UI
  pendingKickoffEvent?: PendingKickoffEvent;
  // Tour de blitz kickoff en cours (équipe qui botte joue un tour immédiat)
  kickoffBlitzTurn?: boolean;
  // Coup d'envoi « Charge » (10) : seuls ces joueurs (jusqu'a D3+3
  // Demarques choisis par le coach qui engage) peuvent etre actives
  // pendant le tour de Charge. Vide/absent = tous les joueurs de
  // l'equipe (etats serialises anterieurs a la table 2025).
  kickoffBlitzPlayerIds?: string[];
  // Arbitre sous surveillance : pour ce drive, tout foul declenche un
  // check D6 supplementaire ; sur 1 = expulsion automatique (en plus du
  // doublet armor/injury). Reset au prochain kickoff/TD.
  // NB saison 2025 : la table 2D6 de coup d'envoi ne contient plus
  // « Arbitre zele » (l'evenement 11 est desormais « En-cas suspect »).
  // Ce drapeau reste la mecanique de reference pour « Sous surveillance »
  // (table D16, pas encore implementee) et pour les prieres a Nuffle.
  officiousRefForDrive?: boolean;
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
  // Choix de Dump-off en attente : la cible d'un blocage a le skill `dump-off`
  // et le ballon. Elle peut choisir un receveur (Quick Pass) ou passer son
  // tour de Dump-off. Après résolution, le blocage initial reprend via la
  // `pendingBlockMove` conservée ci-dessous.
  pendingDumpOff?: {
    attackerId: string;         // joueur effectuant le blocage (adversaire)
    targetId: string;           // cible du blocage — passeur potentiel du Dump-off
    receiverOptions: string[];  // IDs des receveurs éligibles (Quick range)
    pendingBlockMove:
      | { type: 'BLOCK'; playerId: string; targetId: string }
      | { type: 'BLITZ'; playerId: string; to: Position; targetId: string };
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
  // Options de match
  terrainSkin?: string; // 'grass' | 'ruins' | 'snow'
  turnTimerEnabled?: boolean;
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
  // Facteur de Popularité PAR équipe (1D3 + fans dévoués, jeté en pré-match).
  // Préservé pour les événements de coup d'envoi qui s'y réfèrent (Invasion
  // du terrain). Absent sur les parties sauvegardées avant son introduction :
  // repli sur `dedicatedFans`.
  fanFactors?: { teamA: number; teamB: number };
  // Audit round 10 (HIGH/regle BB3) : assistant coaches par equipe,
  // utilises au kickoff event 'brilliant-coaching' : chaque coach jette
  // 1D3 + son nombre d'assistant coaches ; le plus haut total gagne une
  // relance d'equipe. Avant ce champ, seul le D3 etait compare → une
  // equipe avec 6 assistant coaches devrait quasi toujours gagner mais
  // gagnait 50/50. Optionnel pour back-compat ; defaut 0 par equipe.
  assistantCoaches?: { teamA: number; teamB: number };
  // Cheerleaders par equipe, utilises au coup d'envoi « Fans en folie »
  // (6) : chaque coach jette 1D6 + ses Cheerleaders ; le plus haut total
  // (ou les deux en cas d'egalite) obtient un Soutien Offensif
  // supplementaire sur sa premiere Action de Blocage du prochain Tour.
  // Optionnel pour back-compat ; defaut 0 par equipe.
  cheerleaders?: { teamA: number; teamB: number };
  // Bonus « Fans en folie » en attente : consomme par la premiere Action
  // de Blocage de l'equipe (cf. `actions/block-handler.ts`). Remis a zero
  // en fin de drive.
  cheeringFansAssist?: { teamA: boolean; teamB: boolean };
  // Malus de caracteristiques limites au drive en cours (coup d'envoi
  // « En-cas suspect » (11) : -1 MA et -1 AR). Conserve les valeurs
  // d'origine pour pouvoir les restaurer au drive suivant via
  // `restoreDriveStatModifiers`.
  driveStatModifiers?: Array<{
    playerId: string;
    source: string;
    ma: number; // valeur AVANT malus
    av: number; // valeur AVANT malus
  }>;
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
  /**
   * N.2 — Mode simplifie pour debutants.
   * Configuration de regles appliquee au match (toggle features, duree des
   * mi-temps, rerolls, timer). Optionnel pour conserver la compat descendante :
   * en l'absence, les helpers retombent sur FULL_RULES (8 tours, 3 rerolls).
   */
  rulesConfig?: import('./rules-config').RulesConfig;
  // Deadline ISO du timer actuel (mis à jour côté serveur, utilisé côté client pour l'affichage)
  turnDeadline?: string;
  // Log du match
  gameLog: GameLogEntry[];
  // Suivi des règles spéciales de Star Players utilisées (clé: "playerId:ruleSlug")
  usedStarPlayerRules: Record<string, boolean>;
  // Nombre de bribes restantes par équipe (achetées via inducements ou prières)
  bribesRemaining: { teamA: number; teamB: number };
  // Bloodweiser Kegs achetés (inducement) — chaque keg donne +1 aux jets de
  // KO recovery de l'équipe (BB rule, max 2 kegs). Optional pour compat avec
  // les états sérialisés pré-fix.
  bloodweiserKegs?: { teamA: number; teamB: number };
  // Joueurs hypnotisés (perdent leur zone de tacle jusqu'à leur prochaine activation)
  hypnotizedPlayers?: string[];
  // IDs des joueurs qui ont déjà utilisé Running Pass ce tour (une fois par tour par joueur).
  // La presence d'un id ici autorise aussi la poursuite du mouvement apres
  // une Action de Passe (cf. canPlayerContinueMoving dans game-state.ts).
  usedRunningPassThisTurn?: string[];
  // Equipes ayant utilise On the Ball pendant le tour adverse en cours
  // (reset au changement de tour). Une seule activation par tour d'equipe.
  usedOnTheBallThisTurn?: TeamId[];
  // Equipes ayant utilise Multiple Block ce tour (reset au changement de tour).
  // Une seule activation par tour d'equipe (BB2020 / BB3 S2/S3).
  usedMultipleBlockThisTurn?: TeamId[];
  // Multiple Block en cours : tant que pendingMultipleBlock.attackerId est
  // defini, les blocages effectues par cet attaquant subissent le modificateur
  // -2 ST. Quand `secondTargetId` est defini, le second bloc n'a pas encore
  // ete lance ; une fois lance, le champ est mis a `undefined` et le flag est
  // consomme quand la sequence complete se termine sans pending.
  pendingMultipleBlock?: {
    attackerId: string;
    secondTargetId?: string;
  };
  // Second bloc Frenzy en attente : après un PUSH_BACK, l'attaquant avec
  // Frenzy doit effectuer un second bloc une fois le follow-up résolu.
  pendingFrenzyBlock?: {
    attackerId: string;
    targetId: string;
  };
  // BB2020 : Frenzy donne EXACTEMENT un second bloc par action Block,
  // jamais un troisième. Cette liste contient les attackerIds qui ont
  // déjà déclenché leur second bloc Frenzy dans la séquence en cours.
  // Reset au changement de tour (END_TURN). Avant ce flag, une suite
  // de PUSH_BACK déclenchait un 3e, 4e, … bloc en chaîne infinie.
  frenzySecondBlockTriggered?: string[];
  // On the Ball en attente : un joueur adverse peut réagir avant la passe.
  pendingOnTheBall?: {
    passerTeam: TeamId;
    pendingPassMove: { type: 'PASS'; playerId: string; targetId: string };
    reactivePlayers: string[];
  };
  // Condition météo active pour ce match (persistée depuis le pré-match)
  weatherCondition?: { condition: string; description: string };
  // État pré-match (setup, kickoff, inducements, etc.)
  preMatch?: PreMatchState;
}

/** État de la séquence pré-match (fans, météo, journeymen, inducements, kickoff) */
export interface PreMatchState {
  phase: 'idle' | 'fans' | 'weather' | 'journeymen' | 'inducements' | 'prayers' | 'kicking-team' | 'setup' | 'kickoff' | 'kickoff-sequence';
  currentCoach: TeamId;
  legalSetupPositions: Position[];
  placedPlayers: string[];
  kickingTeam: TeamId;
  receivingTeam: TeamId;
  fanFactor?: {
    teamA: { d3: number; dedicatedFans: number; total: number };
    teamB: { d3: number; dedicatedFans: number; total: number };
  };
  weatherType?: string;
  weather?: {
    total: number;
    condition: string;
    description: string;
  };
  journeymen?: {
    teamA: { count: number; players: string[] };
    teamB: { count: number; players: string[] };
  };
  inducements?: {
    teamA: { pettyCash: number; treasurySpent: number; items: Array<{ slug: string; displayName: string; cost: number; quantity: number; starPlayerSlug?: string }> };
    teamB: { pettyCash: number; treasurySpent: number; items: Array<{ slug: string; displayName: string; cost: number; quantity: number; starPlayerSlug?: string }> };
  };
  prayers?: {
    underdogTeam: TeamId;
    ctvDifference: number;
    rolls: { dice: number; result: string; description: string }[];
  };
  kickoffStep?: 'place-ball' | 'kick-deviation' | 'kickoff-event';
  ballPosition?: Position | null;
  kickDeviation?: { d8: number; d6: number; direction: string } | null;
  kickoffEvent?: { dice: number; event: string; description: string } | null;
  finalBallPosition?: Position;
}

export interface DiceResult {
  // Lot audit round 4 : ajout 'gfi' (Going For It) qui etait abusivement
  // taggue 'dodge' as never dans move-handlers.ts. Le UI peut maintenant
  // discriminer GFI vs dodge pour des messages corrects.
  type: 'dodge' | 'pickup' | 'pass' | 'catch' | 'armor' | 'block' | 'landing' | 'gaze' | 'vomit' | 'gfi' | 'leap';
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
  | 'PROJECTILE_VOMIT'
  | 'STAB'
  | 'CHAINSAW'
  | 'BALL_AND_CHAIN'
  | 'BOMB_THROW';

export type Move =
  | { type: 'MOVE'; playerId: string; to: Position }
  | { type: 'LEAP'; playerId: string; to: Position }
  | { type: 'END_TURN' }
  | { type: 'END_PLAYER_TURN'; playerId: string }
  | { type: 'DODGE'; playerId: string; from: Position; to: Position }
  | { type: 'BLOCK'; playerId: string; targetId: string }
  | { type: 'MULTI_BLOCK'; playerId: string; firstTargetId: string; secondTargetId: string }
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
  | { type: 'STAB'; playerId: string; targetId: string }
  | { type: 'CHAINSAW'; playerId: string; targetId: string }
  | { type: 'BALL_AND_CHAIN'; playerId: string }
  | { type: 'BOMB_THROW'; playerId: string; target: Position }
  | { type: 'DUMP_OFF_CHOOSE'; passerId: string; receiverId: string | null }
  | { type: 'KICKOFF_SOLID_DEFENCE'; positions: Array<{ playerId: string; position: Position }> }
  | { type: 'KICKOFF_HIGH_KICK'; playerId: string | null }
  | { type: 'KICKOFF_QUICK_SNAP'; moves: Array<{ playerId: string; to: Position }> }
  | { type: 'KICKOFF_BLITZ_RESOLVE'; playerIds?: string[] }
  | { type: 'ON_THE_BALL_MOVE'; playerId: string; to: Position }
  | { type: 'ON_THE_BALL_DECLINE' };

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
