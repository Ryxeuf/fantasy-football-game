"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { PlayerDetails, DiceResultPopup, GameScoreboard, ActionPickerPopup, GameBoardWithDugouts } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, clearDiceResult, hasPlayerActed, type GameState, type Position, type Move, setupPreMatch, setupPreMatchWithTeams, startMatchFromPreMatch, enterSetupPhase, placePlayerInSetup, type ExtendedGameState, type Player, type TeamId, type ActionType, createLogEntry, initializeDugouts } from "@bb/game-engine";
import { API_BASE } from "../../auth-client";

// Ajouter fonction normalize après imports
function normalizeState(state: any): ExtendedGameState {
  if (state && typeof state.playerActions === 'object' && state.playerActions !== null && typeof state.playerActions.has !== 'function') {
    state.playerActions = new Map(Object.entries(state.playerActions || {}));
  }
  if (state && typeof state.teamBlitzCount === 'object' && state.teamBlitzCount !== null && typeof state.teamBlitzCount.has !== 'function') {
    state.teamBlitzCount = new Map(Object.entries(state.teamBlitzCount || {}));
  }
  return state as ExtendedGameState;
}

// Ajouter une fonction helper avant le composant, après normalizeState (ligne ~16)
function createDemoExtendedState(teamAName: string, teamBName: string): ExtendedGameState {
  const dugouts = initializeDugouts(); // Assumer importé si besoin
  
  // Joueurs démo équipe A (11 joueurs)
  const teamAPlayers: Player[] = [
    { id: 'A1', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A2', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A2', number: 2, position: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block'], pm: 7, hasBall: false, state: 'active' },
    // ... Ajouter 9 autres pour A (similaire, numbers 3-11)
    { id: 'A3', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A4', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A4', number: 4, position: 'Thrower', ma: 6, st: 2, ag: 3, pa: 4, av: 8, skills: ['Pass'], pm: 6, hasBall: false, state: 'active' },
    { id: 'A5', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A5', number: 5, position: 'Catcher', ma: 8, st: 2, ag: 3, pa: 4, av: 7, skills: ['Catch'], pm: 8, hasBall: false, state: 'active' },
    { id: 'A6', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A7', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A7', number: 7, position: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block'], pm: 7, hasBall: false, state: 'active' },
    { id: 'A8', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A9', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A10', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'A11', team: 'A' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur A11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
  ];

  // Joueurs démo équipe B (similaire, 11 joueurs)
  const teamBPlayers: Player[] = [
    { id: 'B1', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B1', number: 1, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B2', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B2', number: 2, position: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block'], pm: 7, hasBall: false, state: 'active' },
    // ... Ajouter 9 autres pour B (similaire à A, numbers 3-11)
    { id: 'B3', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B3', number: 3, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B4', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B4', number: 4, position: 'Thrower', ma: 6, st: 2, ag: 3, pa: 4, av: 8, skills: ['Pass'], pm: 6, hasBall: false, state: 'active' },
    { id: 'B5', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B5', number: 5, position: 'Catcher', ma: 8, st: 2, ag: 3, pa: 4, av: 7, skills: ['Catch'], pm: 8, hasBall: false, state: 'active' },
    { id: 'B6', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B6', number: 6, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B7', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B7', number: 7, position: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block'], pm: 7, hasBall: false, state: 'active' },
    { id: 'B8', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B8', number: 8, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B9', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B9', number: 9, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B10', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B10', number: 10, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
    { id: 'B11', team: 'B' as TeamId, pos: { x: -1, y: -1 }, name: 'Joueur B11', number: 11, position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], pm: 6, hasBall: false, state: 'active' },
  ];

  const allPlayers = [...teamAPlayers, ...teamBPlayers];

  // Placer tous en réserves
  allPlayers.forEach(player => {
    const teamId = player.team;
    const dugout = dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
    dugout.zones.reserves.players.push(player.id);
  });

  const baseState = {
    width: 26,
    height: 15,
    players: allPlayers,
    ball: undefined,
    currentPlayer: 'A',
    turn: 0,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: new Map<string, ActionType>(),
    teamBlitzCount: new Map<TeamId, number>(),
    half: 0,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: teamAName, teamB: teamBName },
    gameLog: [createLogEntry('info', `Phase pré-match démo - ${teamAName} vs ${teamBName}`)],
  };

  return {
    ...baseState,
    preMatch: {
      phase: 'idle' as const,
      currentCoach: 'A' as TeamId,
      legalSetupPositions: [], // Sera mis à jour quand enterSetupPhase appelé
      placedPlayers: [],
      kickingTeam: 'B' as TeamId,
      receivingTeam: 'A' as TeamId,
    },
  } as ExtendedGameState;
}

export default function PlayByIdPage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  useEffect(() => {
    (async () => {
      const matchToken = localStorage.getItem("match_token");
      if (matchToken) return;
      try {
        const authToken = localStorage.getItem("auth_token");
        if (!authToken) { window.location.href = "/lobby"; return; }
        const res = await fetch(`${API_BASE}/match/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ matchId }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.matchToken) {
          localStorage.setItem("match_token", data.matchToken as string);
        } else {
          window.location.href = "/lobby";
        }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, []);

  // Bloquer l'accès si le match n'est pas encore actif
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) { window.location.href = "/lobby"; return; }
      const res = await fetch(`${API_BASE}/match/${matchId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
      if (!res.ok) { window.location.href = "/lobby"; return; }
      const status = data?.status;
      // Autoriser 'active', 'prematch' et 'prematch-setup'. Sinon, renvoyer vers la salle d'attente de ce match
      if (status !== 'active' && status !== 'prematch' && status !== 'prematch-setup') {
        window.location.href = `/waiting/${matchId}`;
        return;
      }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, [matchId]);

  const [state, setState] = useState<ExtendedGameState | null>(null);
  const [stateSource, setStateSource] = useState<'server' | 'fallback' | null>(null);
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);
  const [teamNameA, setTeamNameA] = useState<string | undefined>(undefined); // local
  const [teamNameB, setTeamNameB] = useState<string | undefined>(undefined); // visiteur
  const [userName, setUserName] = useState<string | undefined>(undefined);

  // Ajouter state pour selectedFromReserve (pour setup)
  const [selectedFromReserve, setSelectedFromReserve] = useState<string | null>(null);

  // Ajouter state après selectedFromReserve
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  function showSetupError(msg: string) {
    setSetupError(msg);
    setTimeout(() => setSetupError(null), 2500);
  }

  function getMySide(ext: ExtendedGameState): 'A' | 'B' | null {
    if (!teamNameA || !teamNameB) return null;
    return teamNameA === ext.teamNames.teamA ? 'A' : 'B';
  }

  function validatePlacement(ext: ExtendedGameState, playerId: string, pos: Position): string | null {
    // Phase
    if (ext.preMatch?.phase !== 'setup') return 'Placement uniquement en phase de configuration';
    const player = ext.players.find(p => p.id === playerId);
    if (!player) return 'Joueur introuvable';
    const mySide = getMySide(ext);
    if (mySide && mySide !== ext.preMatch.currentCoach) return "Ce n'est pas votre tour de placer";
    if (mySide && player.team !== mySide) return "Vous ne pouvez placer que vos joueurs";
    // Position légale
    const legal = ext.preMatch.legalSetupPositions.some(p => p.x === pos.x && p.y === pos.y);
    if (!legal) return 'Position illégale: hors de votre moitié (jusqu\'à la LOS)';
    
    // Vérifier qu'aucun autre joueur n'occupe déjà cette position
    // Simuler la position du joueur pour vérifier les conflits
    const simulatedPlayers = ext.players.map(p => p.id === playerId ? { ...p, pos } : p);
    const existingPlayerAtPos = simulatedPlayers.find(p => p.pos.x === pos.x && p.pos.y === pos.y && p.id !== playerId);
    if (existingPlayerAtPos) {
      return 'Position déjà occupée par un autre joueur';
    }
    
    // Max 11
    const teamId = player.team;
    const onPitch = ext.players.filter(p => p.team === teamId && p.pos.x >= 0).length;
    if (onPitch >= 11) return 'Maximum 11 joueurs sur le terrain';
    // Wide zones
    const isLeftWZ = (y: number) => y >= 0 && y <= 2;
    const isRightWZ = (y: number) => y >= 12 && y <= 14;
    const teamPlayersAfter = ext.players.map(p => p.id === playerId ? { ...p, pos } : p).filter(p => p.team === teamId && p.pos.x >= 0);
    const leftCount = teamPlayersAfter.filter(p => isLeftWZ(p.pos.y)).length;
    const rightCount = teamPlayersAfter.filter(p => isRightWZ(p.pos.y)).length;
    if (leftCount > 2) return 'Maximum 2 joueurs dans la large zone gauche';
    if (rightCount > 2) return 'Maximum 2 joueurs dans la large zone droite';
    // LOS (vérifier à partir de l'avant-dernier joueur)
    if (teamPlayersAfter.length >= 9) {
      const isOnLos = (x: number) => (teamId === 'A' ? x === 12 : x === 13);
      const losCount = teamPlayersAfter.filter(p => isOnLos(p.pos.x)).length;
      const remainingPlayers = 11 - teamPlayersAfter.length;
      const minLosRequired = 3;
      
      // Si on n'a pas assez de joueurs sur la LOS et qu'il ne reste pas assez de joueurs pour atteindre 3
      if (losCount < minLosRequired && (losCount + remainingPlayers) < minLosRequired) {
        return 'Au moins 3 joueurs doivent être sur la LOS';
      }
    }
    return null;
  }

  // useEffect pour charger les noms d'équipes et coaches via /details (prioritaire, indépendant)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        // 1) Tenter avec match_token d'abord
        const matchToken = localStorage.getItem("match_token");
        let data: any = {};
        if (matchToken) {
          const res = await fetch(`${API_BASE}/match/details`, { headers: { "X-Match-Token": matchToken } });
          data = await res.json().catch(() => ({} as any));
          if (res.ok && data) {
            setTeamNameA(data?.local?.teamName || undefined);
            setTeamNameB(data?.visitor?.teamName || undefined);
            return;
          }
        }
        // 2) Fallback auth
        const res = await fetch(`${API_BASE}/match/${matchId}/details`, { headers: { Authorization: `Bearer ${token}` } });
        data = await res.json().catch(() => ({} as any));
        if (res.ok && data) {
          setTeamNameA(data?.local?.teamName || undefined);
          setTeamNameB(data?.visitor?.teamName || undefined);
        }
      } catch (e) {
        console.error('Failed to load team names:', e);
        // Fallback démo si échec total
        setTeamNameA('Équipe Locale');
        setTeamNameB('Équipe Visiteuse');
      }
    })();
  }, [matchId]); // Seulement matchId, pas de teamNames dans deps

  // Nouveau useEffect pour charger l'état du jeu (dépend des teamNames pour fallback)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/state`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.gameState) {
          const normalized = normalizeState(data.gameState);
          setState(normalized);
          setStateSource('server');
          console.log('State players length:', normalized.players.length);
          return;
        }
      } catch (e) {
        console.error('Failed to load game state:', e);
      }
      // Fallback: charger les équipes et setup prematch avec vrais data
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setState(setupPreMatchWithTeams([], [], 'Équipe Locale', 'Équipe Visiteuse'));
          setStateSource('fallback');
          return;
        }
        const teamsRes = await fetch(`${API_BASE}/match/${matchId}/teams`, { headers: { Authorization: `Bearer ${token}` } });
        const teamsData = await teamsRes.json().catch(() => ({} as any));
        if (teamsRes.ok && (teamsData.teamA || (teamsData.local && teamsData.visitor))) {
          // Supporte anciens et nouveaux formats
          const a = teamsData.teamA || teamsData.local;
          const b = teamsData.teamB || teamsData.visitor;
          const teamAName = teamNameA || a.teamName || 'Équipe Locale';
          const teamBName = teamNameB || b.teamName || 'Équipe Visiteuse';
          setState(normalizeState(setupPreMatchWithTeams(a.players || [], b.players || [], teamAName, teamBName)));
          setStateSource('fallback');
          console.log('Fallback players length:', (a.players || []).length + (b.players || []).length);
          return;
        }
      } catch (e) {
        console.error('Failed to load teams for prematch:', e);
      }
      // Dernier fallback: démo, mais avec teamNames si disponibles
      const demoState = setupPreMatchWithTeams([], [], teamNameA || 'Équipe Locale', teamNameB || 'Équipe Visiteuse');
      if (teamNameA) demoState.teamNames.teamA = teamNameA;
      if (teamNameB) demoState.teamNames.teamB = teamNameB;
      setState(demoState);
      setStateSource('fallback');
    })();
  }, [matchId, teamNameA, teamNameB]); // Dépend des teamNames pour utiliser les bons noms dans fallback

  // Charger le résumé (tour/mi-temps/score) depuis l'API pour refléter l'état en base
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data) return;

        // Ne pas écraser half/turn si en phase pré-match (half=0)
        setState((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            half: prev.half === 0 ? 0 : (typeof data.half === "number" ? data.half : prev.half),
            turn: prev.half === 0 ? 0 : (typeof data.turn === "number" ? data.turn : prev.turn),
            score: {
              teamA: typeof data?.score?.teamA === "number" ? data.score.teamA : prev.score.teamA,
              teamB: typeof data?.score?.teamB === "number" ? data.score.teamB : prev.score.teamB,
            },
            // IMPORTANT: ne pas écraser les teamNames absolus A/B déjà présents dans l'état
          } as any;
          if (prev.half === 0) {
            (updated as any).preMatch = prev.preMatch;
          }
          return updated as ExtendedGameState;
        });
      } catch {
        // noop: on garde l'état courant (démo) si l'API échoue
      }
    })();
  }, [matchId]); // Retiré teamNameA/B des deps pour éviter loops

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.user?.name) {
          setUserName(data.user.name as string);
        } else if (res.ok && data?.user?.email) {
          setUserName(data.user.email as string);
        }
      } catch {}
    })();
  }, []);

  const legal = useMemo(() => {
    if (!state) return [];
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === 'setup') {
      // En setup, legal moves = positions pour placer selectedFromReserve
      if (selectedFromReserve) {
        return extState.preMatch.legalSetupPositions.map(p => ({ type: 'PLACE' as const, playerId: selectedFromReserve, to: p } as any));
      }
      return []; // Pas de moves sans sélection
    }
    return getLegalMoves(state);
  }, [state, selectedFromReserve]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> => m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return legal.filter((m) => isMove(m, state.selectedPlayerId!)).map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  // Ajouter handlers après onCellClick
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    const ext = state as ExtendedGameState | null;
    if (!ext || ext.preMatch?.phase !== 'setup') return;
    // Autoriser uniquement le coach courant et ses joueurs
    const isMyTeam = (() => {
      // On déduit mon côté via teamNameA/B comparés à state.teamNames
      if (!teamNameA || !teamNameB) return true; // fallback permissif
      const mySide: 'A' | 'B' = teamNameA === ext.teamNames.teamA ? 'A' : 'B';
      const playerTeam = ext.players.find(p => p.id === playerId)?.team;
      return mySide === ext.preMatch.currentCoach && playerTeam === mySide;
    })();
    if (!isMyTeam) return;
    
    // Permettre de déplacer les joueurs déjà placés ou ceux en réserves
    const player = ext.players.find(p => p.id === playerId);
    if (!player) return;
    
    e.dataTransfer.setData('text/plain', playerId);
    setDraggedPlayerId(playerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permettre drop
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!state || !draggedPlayerId || !boardRef.current) return;

    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase !== 'setup') return;
    // Bloquer si je ne suis pas le coach courant
    if (teamNameA && teamNameB) {
      const mySide: 'A' | 'B' = teamNameA === extState.teamNames.teamA ? 'A' : 'B';
      if (mySide !== extState.preMatch.currentCoach) { setDraggedPlayerId(null); showSetupError("Ce n'est pas votre tour de placer"); return; }
      const playerTeam = extState.players.find(p => p.id === draggedPlayerId)?.team;
      if (playerTeam !== mySide) { setDraggedPlayerId(null); showSetupError('Vous ne pouvez placer que vos joueurs'); return; }
    }

    // Utiliser rect du board (Pixi container)
    const rect = boardRef.current.getBoundingClientRect();
    const nativeEvent = e.nativeEvent;
    const x = nativeEvent.clientX - rect.left;
    const y = nativeEvent.clientY - rect.top;
    const cellSize = 28;
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    if (gridX >= 0 && gridX < state.height && gridY >= 0 && gridY < state.width) {
      const pos: Position = { x: gridY, y: gridX };

      const err = validatePlacement(extState, draggedPlayerId, pos);
      if (err) { showSetupError(err); setDraggedPlayerId(null); return; }

      const newState = placePlayerInSetup(extState, draggedPlayerId, pos);
      if (newState === extState) { showSetupError('Placement refusé'); }
      setState(newState);
      if ((newState as ExtendedGameState).preMatch.placedPlayers.length === 11) {
        setDraggedPlayerId(null);
      }
    }
    setDraggedPlayerId(null);
  };

  // Modifier onCellClick pour ignorer si dragging (déjà géré par drop)
  function onCellClick(pos: Position) {
    if (draggedPlayerId) return; // Ignorer clic si dragging en cours
    if (!state) return;
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === 'setup') {
      // Mode setup : placer selectedFromReserve sur pos si légal
      if (selectedFromReserve) {
        const err = validatePlacement(extState, selectedFromReserve, pos);
        if (err) { showSetupError(err); setSelectedFromReserve(null); return; }
        const newState = placePlayerInSetup(extState, selectedFromReserve, pos);
        setState(newState);
        if (newState.preMatch.placedPlayers.length === 11) {
          // TODO: Switch coach ou kickoff
          setSelectedFromReserve(null);
        }
        setSelectedFromReserve(null); // Deselect après placement
        return;
      }
      // Sinon, clic sur terrain vide : ignore ou deselect
      setSelectedFromReserve(null);
      return;
    }
    // Logique normale pour match en cours
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
      setCurrentAction(null);
      setSelectedFromReserve(null);
      return;
    }
    if (state.selectedPlayerId) {
      const candidate = legal.find((m) => m.type === "MOVE" && m.playerId === state.selectedPlayerId && m.to.x === pos.x && m.to.y === pos.y);
      if (candidate && candidate.type === "MOVE" && (currentAction === "MOVE" || currentAction === "BLITZ" || currentAction === null)) {
        setState((s) => {
          if (!s) return null;
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          if (s2.lastDiceResult) setShowDicePopup(true);
          setSelectedFromReserve(null);
          return s2 as ExtendedGameState;
        });
      }
    }
  }

  // Modifier onPlayerClick pour sélection en setup
  const handleEndTurn = useMemo(() => {
    if (!state || state.half <= 0) return undefined; // Changé <= 0 pour cacher en prematch
    return () => setState((s) => s ? applyMove(s, { type: "END_TURN" }, createRNG()) as ExtendedGameState : null);
  }, [state]);

  // Modifier handleStartSetup pour entrer en setup
  const handleStartSetup = useMemo(() => {
    if (state?.half !== 0) return undefined;
    return () => {
      setState((s) => {
        if (!s || s.half !== 0) return s;
        // Déterminer receivingTeam (placeholder 'A' pour local)
        const receivingTeam = 'A' as const;
        const setupState = enterSetupPhase(s as ExtendedGameState, receivingTeam);
        return setupState;
      });
    };
  }, [state]);

  // Afficher compteur en setup
  {state && ((state as ExtendedGameState).preMatch?.phase === 'setup') && (
    <div className="flex justify-center mt-2">
      <span className="text-sm text-gray-600">
        Joueurs placés: {((state as ExtendedGameState).preMatch?.placedPlayers?.length || 0)} / 11
      </span>
    </div>
  )}

  // Si setup fini, bouton passer
  {state && ((state as ExtendedGameState).preMatch?.phase === 'setup' && (state as ExtendedGameState).preMatch?.placedPlayers?.length === 11) && (
    <div className="flex justify-center mt-4">
      <button 
        onClick={() => {
          // TODO: Appel API pour switch coach ou kickoff
          setState((s) => {
            if (!s) return s;
            // Placeholder: passe à kickoff
            const kickoffState = { ...s, preMatch: { ...s.preMatch, phase: 'kickoff' as const } };
            kickoffState.half = 1;
            kickoffState.turn = 1;
            return kickoffState as ExtendedGameState;
          });
        }} 
        className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
      >
        Lancer le kick-off
      </button>
    </div>
  )}

  const localSide = useMemo(() => {
    if (!state || !teamNameA || !teamNameB || !state.teamNames) {
      return undefined;
    }
    return teamNameA === state.teamNames.teamA ? 'A' : 'B';
  }, [state, teamNameA, teamNameB]);

  if (!state) {
    return <div className="flex items-center justify-center min-h-screen">Chargement de la partie...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <GameScoreboard
        state={state}
        leftTeamName={state.teamNames.teamA}
        rightTeamName={state.teamNames.teamB}
        localSide={localSide}
        userName={userName}
        {...(state?.half > 0 ? { onEndTurn: handleEndTurn } : {})}
      />
      {/* Wrapper pour éléments pré-match, à l'intérieur du container principal */}
      <div className="pt-32"> {/* Augmenté de pt-24 à pt-32 pour espace bouton */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-4 mb-6"> {/* Wrapper centralisé pour pré-match */}
            {/* Statut pré-match (si half=0) */}
            {state && state.half === 0 && stateSource === 'server' && (
              <div className="text-center text-sm text-gray-600 bg-gray-100 p-2 rounded w-full max-w-md">
                <div>Phase pré-match</div>
                <div>
                  Receveuse : {state.preMatch?.receivingTeam === 'A' ? state.teamNames.teamA : state.teamNames.teamB} ({state.preMatch?.receivingTeam})
                </div>
                <div>
                  Au tour de {(state.preMatch?.currentCoach === 'A' ? state.teamNames.teamA : state.teamNames.teamB)} de placer ses joueurs
                </div>
                {setupError && (
                  <div className="mt-2 px-3 py-2 bg-red-100 text-red-700 rounded border border-red-300">
                    {setupError}
                  </div>
                )}
              </div>
            )}
            
            {/* Bouton débuter si idle */}
            {state?.half === 0 && state.preMatch?.phase === 'idle' && handleStartSetup && (
              <div className="flex justify-center">
                <button 
                  onClick={handleStartSetup} 
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Débuter la configuration des joueurs
                </button>
              </div>
            )}
            
            {/* Compteur si setup */}
            {state && state.preMatch?.phase === 'setup' && (
              <div className="text-sm text-gray-600">
                Joueurs placés: {state.preMatch.placedPlayers.length} / 11
              </div>
            )}
            
            {/* Bouton kick-off si 11 placés */}
            {state && state.preMatch?.phase === 'setup' && state.preMatch.placedPlayers.length === 11 && (
              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    // TODO: Appel API pour switch coach ou kickoff
                    setState((s) => {
                      if (!s) return s;
                      // Placeholder: passe à kickoff
                      const kickoffState = { ...s, preMatch: { ...s.preMatch, phase: 'kickoff' as const } };
                      kickoffState.half = 1;
                      kickoffState.turn = 1;
                      return kickoffState as ExtendedGameState;
                    });
                  }} 
                  className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                >
                  Lancer le kick-off
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col lg:flex-row items-start gap-6 mb-6" onDragOver={handleDragOver} onDrop={handleDrop}>
            {/* Board et sidebar */}
            <div className="flex-1 flex justify-center">
              <GameBoardWithDugouts 
                state={state} 
                onCellClick={onCellClick} 
                legalMoves={draggedPlayerId && (state as ExtendedGameState).preMatch?.phase === 'setup' ? (state as ExtendedGameState).preMatch.legalSetupPositions : movesForSelected} 
                blockTargets={[]} 
                selectedPlayerId={state.selectedPlayerId || undefined} 
                placedPlayers={(state as ExtendedGameState).preMatch?.placedPlayers || []} // Nouvelle prop
                onPlayerClick={(playerId) => {
                  if (!state) return;
                  const extState = state as ExtendedGameState;
                  if (extState.preMatch?.phase === 'setup') {
                    const player = state.players.find((p) => p.id === playerId);
                    if (player && player.team === extState.preMatch.currentCoach) {
                      // Permettre de sélectionner les joueurs déjà placés ou ceux en réserves
                      if (!draggedPlayerId) {
                        setSelectedFromReserve(playerId);
                      }
                      return;
                    }
                    return; // Ignore autres en setup
                  }
                  // Logique normale
                  const player = state.players.find((p) => p.id === playerId);
                  if (player && player.team === state.currentPlayer) {
                    setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
                    setCurrentAction(null);
                    setSelectedFromReserve(null);
                  }
                }}
                onDragStart={handleDragStart} // Nouvelle prop
                boardContainerRef={boardRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            </div>
            <div className="w-full lg:w-auto">
              {state.selectedPlayerId && (
                <PlayerDetails variant="sidebar" player={state.players.find((p) => p.id === state.selectedPlayerId) || null} onClose={() => setState((s) => s ? ({ ...s, selectedPlayerId: null }) : null)} />
              )}
            </div>
          </div>
        </div>
      </div>
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup result={state.lastDiceResult} onClose={() => { setShowDicePopup(false); setState((s) => s ? clearDiceResult(s) as ExtendedGameState : null); }} />
      )}
      {state.selectedPlayerId && currentAction === null && !hasPlayerActed(state, state.selectedPlayerId) && (
        <ActionPickerPopup playerName={state.players.find(p => p.id === state.selectedPlayerId)?.name || 'Joueur'} available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]} onPick={(a) => setCurrentAction(a)} onClose={() => setCurrentAction("MOVE")} />
      )}
    </div>
  );
}


