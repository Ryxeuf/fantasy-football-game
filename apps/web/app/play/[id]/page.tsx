"use client";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  DiceResultPopup,
  GameScoreboard,
  ActionPickerPopup,
  BlockChoicePopup,
  PushChoicePopup,
  FollowUpChoicePopup,
  RerollChoicePopup,
  ApothecaryChoicePopup,
  GameLog,
  ToastProvider,
} from "@bb/ui";

// GameBoardWithDugouts pulls in the entire Pixi.js + @pixi/react bundle.
// It uses Canvas APIs that don't exist on the server, so disable SSR and
// let Next.js emit it as a separate chunk that only ships when the user
// actually opens an online match.
const GameBoardWithDugouts = dynamic(
  () => import("@bb/ui").then((m) => m.GameBoardWithDugouts),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[2/1] bg-gray-900 text-gray-400 flex items-center justify-center rounded-lg">
        Chargement du plateau…
      </div>
    ),
  },
);
import {
  getLegalMoves,
  applyMove,
  makeRNG,
  clearDiceResult,
  hasPlayerActed,
  type Position,
  type Move,
  placePlayerInSetup,
  type ExtendedGameState,
  type Player,
  type TeamId,
} from "@bb/game-engine";
import { API_BASE } from "../../auth-client";
import { webLog } from "../../lib/log";
import { useGameMoves } from "./hooks/useGameMoves";
// useGameSocket is now called only inside useGameState to avoid duplicate connections
import { useGameState } from "./hooks/useGameState";
import {
  shouldShowBlockPopup,
  shouldShowPushPopup,
  shouldShowFollowUpPopup,
  shouldShowRerollPopup,
  buildBlockChooseMove,
  buildPushChooseMove,
  buildFollowUpChooseMove,
  buildRerollChooseMove,
  buildApothecaryChooseMove,
  computeBlockTargets,
} from "./hooks/useBlockPopups";
import PostMatchSPP from "../../components/PostMatchSPP";
import MatchEndScreen from "../../components/MatchEndScreen";
import PreMatchSummary from "../../components/PreMatchSummary";
import HalftimeTransition from "../../components/HalftimeTransition";
import { InducementsPhaseUI } from "./components/InducementsPhaseUI";
import { normalizeState } from "./utils/normalize-state";
import { ForfeitWarning } from "../../components/ForfeitWarning";
import GameChat from "../../components/GameChat";
import { useTurnNotification } from "./hooks/useTurnNotification";
import { useSoundEffects } from "./hooks/useSoundEffects";
import { useGameChat } from "./hooks/useGameChat";
import { getSoundManager } from "./hooks/sound-manager";

/** Renders nothing — just fires turn notification side-effects inside ToastProvider. */
function TurnNotificationListener({ isMyTurn, isActiveMatch }: { isMyTurn: boolean; isActiveMatch: boolean }) {
  useTurnNotification({ isMyTurn, isActiveMatch });
  return null;
}

/** Renders nothing — just fires sound effect side-effects based on gameLog changes. */
function SoundEffectsListener({ state }: { state: ExtendedGameState | null }) {
  useSoundEffects({ state });
  return null;
}

/** Inducements phase UI for online pre-match.
 *  Each player only sees and submits inducements for their own team.
 *  Submission goes via WebSocket (game:submit-inducements). */

/** Floating mute/unmute toggle button for sound effects. */
function SoundToggleButton() {
  const [muted, setMuted] = useState(() => getSoundManager().isMuted());
  const handleToggle = useCallback(() => {
    const newMuted = getSoundManager().toggleMuted();
    setMuted(newMuted);
  }, []);
  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-4 right-4 z-50 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
      title={muted ? "Activer le son" : "Couper le son"}
      aria-label={muted ? "Activer le son" : "Couper le son"}
    >
      {muted ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );
}

// `normalizeState` extracted to ./utils/normalize-state.ts (S26.0a refactor).

export default function PlayByIdPage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  // État du jeu centralisé via hook
  const {
    state, stateSource, matchStatus, myTeamSide, isMyTurn,
    teamNameA, teamNameB, userName,
    opponentDisconnected, opponentDisconnectedAt,
    turnTimerDeadline, turnTimerSeconds,
    wsConnected, wsReconnecting, wsReconnectAttempt,
    wsSubmitMove, gameSocket,
    setState, setMatchStatus, setMyTeamSide, setIsMyTurn,
  } = useGameState(matchId);

  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<
    | "MOVE"
    | "BLOCK"
    | "BLITZ"
    | "PASS"
    | "HANDOFF"
    | "FOUL"
    | "THROW_TEAM_MATE"
    | null
  >(null);
  const [throwTeamMateThrownId, setThrowTeamMateThrownId] = useState<string | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);

  // Move submission uses the single WebSocket from useGameState (no duplicate connection)
  const { submitMove, submitting: moveSubmitting } = useGameMoves(matchId, {
    wsSubmitMove,
  });

  // In-game chat
  const { messages: chatMessages, sendMessage: sendChatMessage } = useGameChat({
    socket: gameSocket,
    matchId,
  });

  // Extract current user ID from JWT for chat display
  const currentUserId = useMemo(() => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return undefined;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub as string | undefined;
    } catch {
      return undefined;
    }
  }, []);

  // Helper : est-ce que le match est en phase active (coups envoyés au serveur) ?
  const isActiveMatch = matchStatus === "active";

  // B1.7 — suivi local de l'acknowledgement de la mi-temps. Le composant
  // HalftimeTransition s'affiche tant que gamePhase === 'halftime' et que le
  // joueur n'a pas cliqué sur le CTA pour la mi-temps courante.
  const [halftimeDismissedHalf, setHalftimeDismissedHalf] = useState<number | null>(null);

  // Ajouter state pour selectedFromReserve (pour setup)
  const [selectedFromReserve, setSelectedFromReserve] = useState<string | null>(
    null,
  );

  // Ajouter state après selectedFromReserve
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [currentCellSize, setCurrentCellSize] = useState(28);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  function showSetupError(msg: string) {
    setSetupError(msg);
    setTimeout(() => setSetupError(null), 2500);
  }

  function getMySide(ext: ExtendedGameState): "A" | "B" | null {
    if (!teamNameA || !teamNameB) return null;
    return teamNameA === ext.teamNames.teamA ? "A" : "B";
  }

  function validatePlacement(
    ext: ExtendedGameState,
    playerId: string,
    pos: Position,
  ): string | null {
    // Phase
    if (ext.preMatch?.phase !== "setup")
      return "Placement uniquement en phase de configuration";
    const player = ext.players.find((p) => p.id === playerId);
    if (!player) return "Joueur introuvable";
    const mySide = getMySide(ext);
    if (mySide && mySide !== ext.preMatch.currentCoach)
      return "Ce n'est pas votre tour de placer";
    if (mySide && player.team !== mySide)
      return "Vous ne pouvez placer que vos joueurs";
    // Position légale
    const legal = ext.preMatch.legalSetupPositions.some(
      (p) => p.x === pos.x && p.y === pos.y,
    );
    if (!legal)
      return "Position illégale: hors de votre moitié (jusqu'à la LOS)";

    // Vérifier qu'aucun autre joueur n'occupe déjà cette position
    // Simuler la position du joueur pour vérifier les conflits
    const simulatedPlayers = ext.players.map((p) =>
      p.id === playerId ? { ...p, pos } : p,
    );
    const existingPlayerAtPos = simulatedPlayers.find(
      (p) => p.pos.x === pos.x && p.pos.y === pos.y && p.id !== playerId,
    );
    if (existingPlayerAtPos) {
      return "Position déjà occupée par un autre joueur";
    }

    // Max 11 (prendre en compte le repositionnement)
    const teamId = player.team;
    const isRepositioning = player.pos.x >= 0;
    const onPitch = ext.players.filter(
      (p) => p.team === teamId && p.pos.x >= 0,
    ).length;
    // Si on repositionne, on ne compte pas le joueur actuel car il sera déplacé
    const effectiveOnPitch = isRepositioning ? onPitch : onPitch + 1;
    if (effectiveOnPitch > 11) return "Maximum 11 joueurs sur le terrain";
    // Wide zones
    const isLeftWZ = (y: number) => y >= 0 && y <= 2;
    const isRightWZ = (y: number) => y >= 12 && y <= 14;
    const teamPlayersAfter = ext.players
      .map((p) => (p.id === playerId ? { ...p, pos } : p))
      .filter((p) => p.team === teamId && p.pos.x >= 0);
    const leftCount = teamPlayersAfter.filter((p) => isLeftWZ(p.pos.y)).length;
    const rightCount = teamPlayersAfter.filter((p) =>
      isRightWZ(p.pos.y),
    ).length;
    if (leftCount > 2) return "Maximum 2 joueurs dans la large zone gauche";
    if (rightCount > 2) return "Maximum 2 joueurs dans la large zone droite";
    // LOS (vérifier à partir de l'avant-dernier joueur)
    if (teamPlayersAfter.length >= 9) {
      const isOnLos = (x: number) => (teamId === "A" ? x === 12 : x === 13);
      const losCount = teamPlayersAfter.filter((p) => isOnLos(p.pos.x)).length;
      const remainingPlayers = 11 - teamPlayersAfter.length;
      const minLosRequired = 3;

      // Si on n'a pas assez de joueurs sur la LOS et qu'il ne reste pas assez de joueurs pour atteindre 3
      if (
        losCount < minLosRequired &&
        losCount + remainingPlayers < minLosRequired
      ) {
        return "Au moins 3 joueurs doivent être sur la LOS";
      }
    }
    return null;
  }

  const legal = useMemo(() => {
    if (!state) return [];
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === "setup") {
      // En setup, legal moves = positions pour placer selectedFromReserve
      if (selectedFromReserve) {
        return extState.preMatch.legalSetupPositions.map(
          (p) =>
            ({
              type: "PLACE" as const,
              playerId: selectedFromReserve,
              to: p,
            }) as any,
        );
      }
      return []; // Pas de moves sans sélection
    }
    return getLegalMoves(state);
  }, [state, selectedFromReserve]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> =>
    m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return legal
      .filter((m) => isMove(m, state.selectedPlayerId!))
      .map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  const blockTargets = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return computeBlockTargets(state.selectedPlayerId, legal, state.players);
  }, [state?.selectedPlayerId, legal, state?.players]);

  // Ajouter handlers après onCellClick
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    const ext = state as ExtendedGameState | null;
    if (!ext || ext.preMatch?.phase !== "setup") return;
    if (setupSubmitting) return; // Bloquer pendant la soumission
    // Autoriser uniquement le coach courant et ses joueurs
    const isMyTeam = (() => {
      // On déduit mon côté via teamNameA/B comparés à state.teamNames
      if (!teamNameA || !teamNameB) return true; // fallback permissif
      const mySide: "A" | "B" = teamNameA === ext.teamNames.teamA ? "A" : "B";
      const playerTeam = ext.players.find((p) => p.id === playerId)?.team;
      return mySide === ext.preMatch.currentCoach && playerTeam === mySide;
    })();
    if (!isMyTeam) return;

    // Permettre de déplacer les joueurs déjà placés ou ceux en réserves
    const player = ext.players.find((p) => p.id === playerId);
    if (!player) return;

    e.dataTransfer.setData("text/plain", playerId);
    setDraggedPlayerId(playerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permettre drop
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!state || !draggedPlayerId || !boardRef.current) return;

    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase !== "setup") return;
    // Bloquer si je ne suis pas le coach courant
    if (teamNameA && teamNameB) {
      const mySide: "A" | "B" =
        teamNameA === extState.teamNames.teamA ? "A" : "B";
      if (mySide !== extState.preMatch.currentCoach) {
        setDraggedPlayerId(null);
        showSetupError("Ce n'est pas votre tour de placer");
        return;
      }
      const playerTeam = extState.players.find(
        (p) => p.id === draggedPlayerId,
      )?.team;
      if (playerTeam !== mySide) {
        setDraggedPlayerId(null);
        showSetupError("Vous ne pouvez placer que vos joueurs");
        return;
      }
    }

    // Utiliser rect du canvas Pixi (pas le wrapper div qui peut être plus large)
    const canvas = boardRef.current.querySelector('canvas');
    const rect = (canvas || boardRef.current).getBoundingClientRect();
    const nativeEvent = e.nativeEvent;
    const pixelX = nativeEvent.clientX - rect.left;
    const pixelY = nativeEvent.clientY - rect.top;
    // pixelX → colonne (y), pixelY → ligne (x) — même logique que PixiBoard.handleStageClick
    const gridCol = Math.floor(pixelX / currentCellSize);
    const gridRow = Math.floor(pixelY / currentCellSize);

    if (
      gridCol >= 0 &&
      gridCol < state.height &&
      gridRow >= 0 &&
      gridRow < state.width
    ) {
      const pos: Position = { x: gridRow, y: gridCol };

      const err = validatePlacement(extState, draggedPlayerId, pos);
      if (err) {
        showSetupError(err);
        setDraggedPlayerId(null);
        return;
      }

      const result = placePlayerInSetup(extState, draggedPlayerId, pos);
      if (!result.success) {
        showSetupError("Placement refusé");
        setDraggedPlayerId(null);
        return;
      }
      
      const newState = result.state;
      setState(newState);
      if (newState.preMatch.placedPlayers.length === 11) {
        setDraggedPlayerId(null);
      }
    }
    setDraggedPlayerId(null);
  };

  // Fonction pour placer le ballon de kickoff
  const handlePlaceKickoffBall = async (position: Position) => {
    if (!state) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/lobby";
        return;
      }

      const response = await fetch(
        `${API_BASE}/match/${matchId}/place-kickoff-ball`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ position }),
        },
      );

      if (!response.ok) {
        throw new Error("Erreur lors du placement du ballon");
      }

      const responseData = await response.json();
      const normalizedState = normalizeState(responseData.gameState);
      setState(normalizedState);

      webLog.debug("Ballon placé:", responseData.message);
    } catch (error) {
      console.error("Erreur lors du placement du ballon:", error);
    }
  };

  // Fonction pour calculer la déviation
  const handleCalculateDeviation = async () => {
    if (!state) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/lobby";
        return;
      }

      const response = await fetch(
        `${API_BASE}/match/${matchId}/calculate-kick-deviation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Erreur lors du calcul de déviation");
      }

      const responseData = await response.json();
      const normalizedState = normalizeState(responseData.gameState);
      setState(normalizedState);

      webLog.debug("Déviation calculée:", responseData.message);
    } catch (error) {
      console.error("Erreur lors du calcul de déviation:", error);
    }
  };

  // Fonction pour résoudre l'événement de kickoff
  const handleResolveKickoffEvent = async () => {
    if (!state) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/lobby";
        return;
      }

      const response = await fetch(
        `${API_BASE}/match/${matchId}/resolve-kickoff-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la résolution de l'événement");
      }

      const responseData = await response.json();
      const normalizedState = normalizeState(responseData.gameState);
      setState(normalizedState);

      webLog.debug("Événement résolu:", responseData.message);
    } catch (error) {
      console.error("Erreur lors de la résolution de l'événement:", error);
    }
  };

  // Fonction pour valider le placement et sauvegarder en base
  const handleValidatePlacement = async () => {
    if (!state || setupSubmitting) return;
    const extState = state as ExtendedGameState;

    setSetupSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/lobby";
        return;
      }

      // Sauvegarder le placement en base de données
      const response = await fetch(
        `${API_BASE}/match/${matchId}/validate-setup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            placedPlayers: extState.preMatch.placedPlayers,
            playerPositions: extState.players
              .filter((p) => p.pos.x >= 0) // Seulement les joueurs sur le terrain
              .map((p) => ({ playerId: p.id, x: p.pos.x, y: p.pos.y })),
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde du placement");
      }

      // Mettre à jour l'état local
      const responseData = await response.json();
      const normalizedState = normalizeState(responseData.gameState);
      setState(normalizedState);
      if (typeof responseData.isMyTurn === "boolean") setIsMyTurn(responseData.isMyTurn);
      if (responseData.myTeamSide) setMyTeamSide(responseData.myTeamSide);
    } catch (error) {
      console.error("Erreur lors de la validation du placement:", error);
      showSetupError("Erreur lors de la sauvegarde du placement");
    } finally {
      setSetupSubmitting(false);
    }
  };

  // Modifier onCellClick pour ignorer si dragging (déjà géré par drop)
  function onCellClick(pos: Position) {
    if (draggedPlayerId) return; // Ignorer clic si dragging en cours
    if (!state) return;
    const extState = state as ExtendedGameState;

    // Phase kickoff-sequence : placement du ballon par l'équipe qui frappe
    if (extState.preMatch?.phase === "kickoff-sequence" && extState.preMatch?.kickoffStep === "place-ball") {
      if (myTeamSide === extState.preMatch?.kickingTeam) {
        handlePlaceKickoffBall(pos);
      }
      return;
    }

    // Bloquer si match actif et pas mon tour (ou soumission en cours)
    if (isActiveMatch && (!isMyTurn || moveSubmitting)) return;
    // Bloquer les interactions setup quand ce n'est pas mon tour ou soumission en cours
    if (extState.preMatch?.phase === "setup") {
      const mySide = myTeamSide || getMySide(extState);
      if (mySide && mySide !== extState.preMatch.currentCoach) return;
      if (setupSubmitting) return;
    }
    if (extState.preMatch?.phase === "setup") {
      // Mode setup : placer selectedFromReserve sur pos si légal
      if (selectedFromReserve) {
        const err = validatePlacement(extState, selectedFromReserve, pos);
        if (err) {
          showSetupError(err);
          setSelectedFromReserve(null);
          return;
        }
        const result = placePlayerInSetup(extState, selectedFromReserve, pos);
        if (!result.success) {
          showSetupError("Placement refusé");
          setSelectedFromReserve(null);
          return;
        }
        
        const newState = result.state;
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
      // Réinitialiser selectedPlayerId en phase setup
      if (state.selectedPlayerId) {
        setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
      }
      return;
    }
    // Logique normale pour match en cours (seulement si pas en phase setup)
    const player = state.players.find(
      (p) => p.pos.x === pos.x && p.pos.y === pos.y,
    );
    webLog.debug("onCellClick - player found:", {
      player: !!player,
      playerId: player?.id,
      team: player?.team,
      currentPlayer: state.currentPlayer,
      phase: extState.preMatch?.phase,
    });
    if (
      player &&
      player.team === state.currentPlayer &&
      (!extState.preMatch || (extState.preMatch.phase as string) !== "setup") &&
      // En mode THROW_TEAM_MATE, ne PAS re-selectionner un coequipier : il sera traite comme cible a lancer ci-dessous
      !(currentAction === "THROW_TEAM_MATE" && player.id !== state.selectedPlayerId)
    ) {
      webLog.debug("Setting selectedPlayerId from onCellClick:", player.id);
      setState((s) => (s ? { ...s, selectedPlayerId: player.id } : null));
      setCurrentAction(null);
      setThrowTeamMateThrownId(null);
      setSelectedFromReserve(null);
      return;
    }
    if (
      state.selectedPlayerId &&
      (!extState.preMatch || (extState.preMatch.phase as string) !== "setup")
    ) {
      // Handle THROW_TEAM_MATE: 2-click flow (1) coequipier a lancer, (2) case cible
      if (currentAction === "THROW_TEAM_MATE") {
        const clickedPlayer = state.players.find(
          (p) => p.pos.x === pos.x && p.pos.y === pos.y,
        );
        if (!throwTeamMateThrownId) {
          // Phase 1 : selectionner un coequipier lancable
          if (
            clickedPlayer &&
            clickedPlayer.team === state.currentPlayer &&
            clickedPlayer.id !== state.selectedPlayerId &&
            legal.some(
              (m) =>
                m.type === "THROW_TEAM_MATE" &&
                (m as any).playerId === state.selectedPlayerId &&
                (m as any).thrownPlayerId === clickedPlayer.id,
            )
          ) {
            setThrowTeamMateThrownId(clickedPlayer.id);
          }
          return;
        }
        // Phase 2 : selectionner la position cible
        const move = legal.find(
          (m) =>
            m.type === "THROW_TEAM_MATE" &&
            (m as any).playerId === state.selectedPlayerId &&
            (m as any).thrownPlayerId === throwTeamMateThrownId &&
            (m as any).targetPos.x === pos.x &&
            (m as any).targetPos.y === pos.y,
        );
        if (!move) return; // hors portee : ignore
        if (isActiveMatch) {
          submitMove(move).then((result) => {
            if (result?.success && result.gameState) {
              const ns = normalizeState(result.gameState);
              setState(ns);
              setIsMyTurn(result.isMyTurn);
              if (ns.lastDiceResult) setShowDicePopup(true);
            }
          });
        } else {
          setState((s) => {
            if (!s) return null;
            const s2 = applyMove(s, move, createRNG());
            if (s2.lastDiceResult) setShowDicePopup(true);
            return s2 as ExtendedGameState;
          });
        }
        setThrowTeamMateThrownId(null);
        setCurrentAction(null);
        return;
      }

      // Handle BLOCK action: clicking an opponent to initiate a block
      const target = state.players.find(
        (p) =>
          p.team !== state.currentPlayer &&
          p.pos.x === pos.x &&
          p.pos.y === pos.y,
      );
      if (target && (currentAction === "BLOCK" || currentAction === "BLITZ")) {
        const blockMove = legal.find(
          (m) =>
            m.type === "BLOCK" &&
            (m as any).playerId === state.selectedPlayerId &&
            (m as any).targetId === target.id,
        );
        if (blockMove) {
          if (isActiveMatch) {
            submitMove(blockMove).then((result) => {
              if (result?.success && result.gameState) {
                const ns = normalizeState(result.gameState);
                setState(ns);
                setIsMyTurn(result.isMyTurn);
                if (ns.lastDiceResult) setShowDicePopup(true);
              }
            });
          } else {
            setState((s) => {
              if (!s) return null;
              const s2 = applyMove(s, blockMove, createRNG());
              if (s2.lastDiceResult) setShowDicePopup(true);
              return s2 as ExtendedGameState;
            });
          }
          return;
        }
      }

      const candidate = legal.find(
        (m) =>
          m.type === "MOVE" &&
          m.playerId === state.selectedPlayerId &&
          m.to.x === pos.x &&
          m.to.y === pos.y,
      );
      if (
        candidate &&
        candidate.type === "MOVE" &&
        (currentAction === "MOVE" ||
          currentAction === "BLITZ" ||
          currentAction === null)
      ) {
        if (isActiveMatch) {
          // Match actif : envoyer le coup au serveur
          submitMove(candidate).then((result) => {
            if (result?.success && result.gameState) {
              const ns = normalizeState(result.gameState);
              setState(ns);
              setIsMyTurn(result.isMyTurn);
              const p = ns.players.find((pl) => pl.id === (candidate as any).playerId);
              if (!p || p.pm <= 0) setState((s) => s ? { ...s, selectedPlayerId: null } : null);
              if (ns.lastDiceResult) setShowDicePopup(true);
              setSelectedFromReserve(null);
            }
          });
        } else {
          // Pré-match / fallback local
          setState((s) => {
            if (!s) return null;
            let s2 = applyMove(s, candidate, createRNG());
            const p = s2.players.find((pl) => pl.id === candidate.playerId);
            if (!p || p.pm <= 0) s2 = { ...s2, selectedPlayerId: null };
            if (s2.lastDiceResult) setShowDicePopup(true);
            setSelectedFromReserve(null);
            return s2 as ExtendedGameState;
          });
        }
      }
    }
  }

  // Modifier onPlayerClick pour sélection en setup
  const handleEndTurn = useMemo(() => {
    if (!state || state.half <= 0) return undefined; // Changé <= 0 pour cacher en prematch
    if (isActiveMatch) {
      // Match actif : envoyer END_TURN au serveur
      return () => {
        submitMove({ type: "END_TURN" }).then((result) => {
          if (result?.success && result.gameState) {
            setState(normalizeState(result.gameState));
            setIsMyTurn(result.isMyTurn);
          }
        });
      };
    }
    return () =>
      setState((s) =>
        s
          ? (applyMove(
              s,
              { type: "END_TURN" },
              createRNG(),
            ) as ExtendedGameState)
          : null,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isActiveMatch, submitMove, setState, setIsMyTurn]);



  const localSide = useMemo(() => {
    if (!state || !teamNameA || !teamNameB || !state.teamNames) {
      return undefined;
    }
    return teamNameA === state.teamNames.teamA ? "A" : "B";
  }, [state, teamNameA, teamNameB]);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Chargement de la partie...
      </div>
    );
  }

  return (
    <ToastProvider>
    <TurnNotificationListener isMyTurn={isMyTurn} isActiveMatch={isActiveMatch} />
    <SoundEffectsListener state={state} />
    <SoundToggleButton />
    {/* End-of-match results overlay for online matches */}
    {matchStatus === "ended" && state.gamePhase === "ended" && (
      <MatchEndScreen
        matchId={matchId}
        myTeamSide={myTeamSide}
        onClose={() => { window.location.href = "/lobby"; }}
      />
    )}
    {/* B1.7 — Halftime transition overlay (bloquant, CTA requis) */}
    {state?.gamePhase === "halftime" && halftimeDismissedHalf !== state.half && (
      <HalftimeTransition
        state={state}
        onAcknowledge={() => setHalftimeDismissedHalf(state.half)}
      />
    )}
    <div
      className="min-h-screen bg-gray-100"
      data-testid="game-view"
      data-match-status={matchStatus}
      data-game-phase={state?.gamePhase}
      data-prematch-phase={state?.preMatch?.phase}
      data-my-team-side={localSide}
      data-is-my-turn={isMyTurn ? "true" : "false"}
    >
      <GameScoreboard
        state={state}
        leftTeamName={state.teamNames?.teamA}
        rightTeamName={state.teamNames?.teamB}
        localSide={localSide}
        userName={userName}
        wsConnected={wsConnected}
        wsReconnecting={wsReconnecting}
        wsReconnectAttempt={wsReconnectAttempt}
        turnTimerDeadline={turnTimerDeadline ?? undefined}
        turnTimerSeconds={turnTimerSeconds}
        {...(state?.half > 0 && (!isActiveMatch || isMyTurn) ? { onEndTurn: handleEndTurn } : {})}
      />
      {isActiveMatch && (
        <ForfeitWarning
          opponentDisconnected={opponentDisconnected}
          disconnectedAt={opponentDisconnectedAt}
        />
      )}
      {/* Bandeau de statut de tour (match actif) */}
      {isActiveMatch && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-bold flex items-center justify-center gap-4 ${
            isMyTurn
              ? "bg-green-500 text-white"
              : "bg-yellow-400 text-gray-900"
          }`}
        >
          <span>
            {moveSubmitting
              ? "Envoi du coup..."
              : isMyTurn
                ? "C'est votre tour !"
                : "En attente de l'adversaire..."}
          </span>
          {state && state.pendingReroll && isMyTurn && (
            <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs animate-pulse">
              Relance disponible !
            </span>
          )}
          {state && state.pendingApothecary && isMyTurn && (
            <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs animate-pulse">
              Apothicaire disponible !
            </span>
          )}
          {state && state.gamePhase === "ended" && (
            <span className="bg-gray-700 text-white px-2 py-0.5 rounded text-xs">
              Match terminé — {state.score.teamA} - {state.score.teamB}
            </span>
          )}
        </div>
      )}
      {/* Bandeau de statut pré-match (setup) */}
      {!isActiveMatch && matchStatus === "prematch-setup" && state?.preMatch?.phase === "setup" && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 text-center py-3 text-sm font-bold flex items-center justify-center gap-4 transition-colors duration-300 ${
            isMyTurn
              ? "bg-green-600 text-white"
              : "bg-yellow-400 text-gray-900"
          }`}
        >
          <span>
            {isMyTurn
              ? "Placez vos 11 joueurs puis cliquez Prêt !"
              : `En attente du placement de ${state.preMatch.currentCoach === "A" ? state.teamNames.teamA : state.teamNames.teamB}...`}
          </span>
          {!isMyTurn && (
            <span className="inline-block w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}
      {/* Wrapper pour éléments pré-match, à l'intérieur du container principal */}
      <div className="pt-32">
        {" "}
        {/* Augmenté de pt-24 à pt-32 pour espace bouton */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            {" "}
            {/* Wrapper centralisé pour pré-match */}
            {/* Pre-match loading (idle phase, server is running automation) */}
            {state && state.half === 0 && state.preMatch?.phase === "idle" && (
              <div className="w-full max-w-md mx-auto text-center p-6 bg-white border border-gray-200 shadow-sm rounded-lg">
                <div className="text-lg font-bold text-gray-700 mb-2">Preparation du match...</div>
                <p className="text-sm text-gray-500">
                  La sequence pre-match est en cours (fans, meteo, journeymen).
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                </div>
              </div>
            )}
            {/* Pre-match summary (fan factor, weather, journeymen) */}
            {state && state.half === 0 && state.preMatch?.fanFactor && (
              <PreMatchSummary state={state as ExtendedGameState} />
            )}
            {/* Phase inducements */}
            {state && state.half === 0 && state.preMatch?.phase === "inducements" && (
              <InducementsPhaseUI
                matchId={matchId}
                state={state as ExtendedGameState}
                stateSource={stateSource}
                setState={setState}
                myTeamSide={myTeamSide}
                gameSocket={gameSocket}
              />
            )}
            {/* Statut pré-match (si half=0) */}
            {state && state.half === 0 && stateSource === "server" && state.preMatch?.phase !== "inducements" && (
              <div className="text-center text-sm text-gray-600 bg-white border border-gray-200 shadow-sm p-4 rounded-lg w-full max-w-md">
                {/* Résumé du coin toss */}
                {state.preMatch?.kickingTeam && state.preMatch?.receivingTeam && (
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Coin Toss</div>
                    <div className="flex justify-center gap-4 text-xs">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                        Frappe : {state.preMatch.kickingTeam === "A" ? state.teamNames.teamA : state.teamNames.teamB}
                      </span>
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                        Recoit : {state.preMatch.receivingTeam === "A" ? state.teamNames.teamA : state.teamNames.teamB}
                      </span>
                    </div>
                  </div>
                )}

                {state.preMatch?.phase === "kickoff" || state.preMatch?.phase === "kickoff-sequence" ? (
                  <div className="space-y-3">
                    <div className="text-lg font-bold text-green-600 mb-1">Sequence de Kickoff</div>

                    {state.preMatch?.kickoffStep === "place-ball" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          L&apos;equipe qui frappe doit placer le ballon dans la moitie adverse
                          {state.preMatch?.receivingTeam && (
                            <>
                              {" "}(zone de{" "}
                              <span className="font-semibold text-green-700">
                                {state.preMatch.receivingTeam === "A"
                                  ? state.teamNames.teamA
                                  : state.teamNames.teamB}
                              </span>
                              )
                            </>
                          )}
                          .
                        </p>
                        {myTeamSide === state.preMatch?.kickingTeam ? (
                          <p className="text-sm font-semibold text-blue-600">
                            Cliquez sur une case de la moitie adverse pour placer le ballon.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                              <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              En attente du placement du ballon par l&apos;adversaire...
                            </div>
                            <button
                              type="button"
                              onClick={() => window.location.reload()}
                              className="text-xs text-gray-500 underline hover:text-gray-700"
                            >
                              Rien ne se passe ? Rafraichir la page
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {state.preMatch?.kickoffStep === "kick-deviation" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Calcul de la deviation du ballon...</p>
                        <button
                          onClick={handleCalculateDeviation}
                          className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-semibold rounded-lg shadow transition-all"
                        >
                          Calculer la deviation
                        </button>
                      </div>
                    )}

                    {state.preMatch?.kickoffStep === "kickoff-event" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Resolution de l&apos;evenement de kickoff...</p>
                        <button
                          onClick={handleResolveKickoffEvent}
                          className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-semibold rounded-lg shadow transition-all"
                        >
                          Resoudre l&apos;evenement
                        </button>
                      </div>
                    )}

                    {!state.preMatch?.kickoffStep && (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Preparation du kickoff...
                      </div>
                    )}
                  </div>
                ) : state.preMatch?.phase === "setup" ? (
                  <div>
                    {/* Étapes de setup */}
                    <div className="mb-2">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
                        <span className={`px-2 py-0.5 rounded ${
                          state.preMatch.currentCoach === state.preMatch.receivingTeam
                            ? "bg-green-100 text-green-700 font-semibold"
                            : "bg-gray-100 text-gray-500 line-through"
                        }`}>
                          1. {state.preMatch.receivingTeam === "A" ? state.teamNames.teamA : state.teamNames.teamB} place
                        </span>
                        <span className="text-gray-300">&rarr;</span>
                        <span className={`px-2 py-0.5 rounded ${
                          state.preMatch.currentCoach === state.preMatch.kickingTeam
                            ? "bg-green-100 text-green-700 font-semibold"
                            : "bg-gray-100 text-gray-400"
                        }`}>
                          2. {state.preMatch.kickingTeam === "A" ? state.teamNames.teamA : state.teamNames.teamB} place
                        </span>
                        <span className="text-gray-300">&rarr;</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                          3. Kickoff
                        </span>
                      </div>
                    </div>

                    <div className="font-semibold text-gray-800">
                      Au tour de{" "}
                      <span className="px-2 py-1 rounded bg-green-600 text-white">
                        {state.preMatch.currentCoach === "A"
                          ? state.teamNames.teamA
                          : state.teamNames.teamB}
                      </span>{" "}
                      de placer ses joueurs
                    </div>
                    {(() => {
                      const currentCoach = state.preMatch?.currentCoach;
                      const availableCount = state.players?.filter(
                        p => p.team === currentCoach && (!p.state || p.state === "active")
                      ).length || 0;
                      const target = Math.min(11, availableCount);
                      const onFieldCount = state.players?.filter(
                        p => p.team === currentCoach && p.pos.x >= 0
                      ).length || 0;
                      return (
                        <div className="text-xs text-gray-500 mt-1">
                          Joueurs placés : {onFieldCount}/{target}
                        </div>
                      );
                    })()}
                    {setupError && (
                      <div className="mt-2 px-3 py-2 bg-red-100 text-red-700 rounded border border-red-300">
                        {setupError}
                      </div>
                    )}
                    {/* Bouton de validation ou message d'attente */}
                    {(() => {
                      const currentCoach = state.preMatch?.currentCoach;
                      const availableCount = state.players?.filter(
                        p => p.team === currentCoach && (!p.state || p.state === "active")
                      ).length || 0;
                      const target = Math.min(11, availableCount);
                      const playersOnField = state.players?.filter(p => p.team === currentCoach && p.pos.x >= 0).length || 0;
                      const mySide = myTeamSide || getMySide(state as ExtendedGameState);

                      if (mySide && mySide !== currentCoach) {
                        return (
                          <div className="mt-3 px-3 py-2 bg-yellow-50 text-yellow-700 rounded border border-yellow-300 text-sm">
                            En attente du placement adverse...
                          </div>
                        );
                      }

                      if (playersOnField === target && mySide === currentCoach) {
                        return (
                          <div className="mt-3">
                            <button
                              onClick={handleValidatePlacement}
                              disabled={setupSubmitting}
                              className={`px-6 py-3 text-white rounded-lg font-bold text-lg transition-all shadow-md ${
                                setupSubmitting
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-95"
                              }`}
                            >
                              {setupSubmitting ? "Validation..." : "Prêt !"}
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                ) : (
                  <div>
                    <div className="text-gray-500">Phase pré-match en cours...</div>
                  </div>
                )}
              </div>
            )}
            {/* Phase idle: le serveur gère la transition vers setup automatiquement */}
            {/* Compteur si setup */}
            {state && state.preMatch?.phase === "setup" && (
              <div className="text-sm text-gray-600">
                Joueurs placés: {(() => {
                  const currentCoach = state.preMatch?.currentCoach;
                  return state.players?.filter(p => p.team === currentCoach && p.pos.x >= 0).length || 0;
                })()} / 11
              </div>
            )}
            {/* Le kick-off est géré automatiquement par le backend après validation des deux placements */}
          </div>

          <div
            className="flex flex-col lg:flex-row items-start gap-6 mb-6"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Board et sidebar */}
            <div className="flex-1 flex justify-center">
              <GameBoardWithDugouts
                state={state}
                onCellClick={onCellClick}
                legalMoves={
                  draggedPlayerId &&
                  (state as ExtendedGameState).preMatch?.phase === "setup"
                    ? (state as ExtendedGameState).preMatch.legalSetupPositions
                    : movesForSelected
                }
                blockTargets={blockTargets}
                selectedPlayerId={state.selectedPlayerId || undefined}
                selectedForRepositioning={selectedFromReserve}
                placedPlayers={
                  (state as ExtendedGameState).preMatch?.placedPlayers || []
                } // Nouvelle prop
                onPlayerClick={(playerId) => {
                  if (!state) return;
                  const extState = state as ExtendedGameState;
                  webLog.debug("onPlayerClick called:", {
                    playerId,
                    phase: extState.preMatch?.phase,
                    currentCoach: extState.preMatch?.currentCoach,
                  });

                  if (extState.preMatch?.phase === "setup") {
                    const player = state.players.find((p) => p.id === playerId);
                    if (
                      player &&
                      player.team === extState.preMatch.currentCoach
                    ) {
                      // Permettre de sélectionner les joueurs déjà placés ou ceux en réserves
                      if (!draggedPlayerId) {
                        webLog.debug("Setting selectedFromReserve:", playerId);
                        setSelectedFromReserve(playerId);
                      }
                      return;
                    }
                    webLog.debug("Ignoring player click in setup phase");
                    return; // Ignore autres en setup
                  }
                  // Logique normale (seulement si pas en phase setup)
                  const player = state.players.find((p) => p.id === playerId);
                  if (!player) return;

                  // Clic sur un adversaire avec une action Block/Blitz active → traiter comme un clic de cellule
                  if (
                    player.team !== state.currentPlayer &&
                    state.selectedPlayerId &&
                    (currentAction === "BLOCK" || currentAction === "BLITZ" || currentAction === "FOUL")
                  ) {
                    onCellClick(player.pos);
                    return;
                  }

                  // En mode THROW_TEAM_MATE, un clic sur un coequipier doit declencher la selection (pas changer le selectedPlayerId)
                  if (
                    currentAction === "THROW_TEAM_MATE" &&
                    state.selectedPlayerId &&
                    player.team === state.currentPlayer &&
                    player.id !== state.selectedPlayerId
                  ) {
                    onCellClick(player.pos);
                    return;
                  }

                  if (
                    player.team === state.currentPlayer &&
                    (!extState.preMatch ||
                      (extState.preMatch.phase as string) !== "setup")
                  ) {
                    setState((s) =>
                      s ? { ...s, selectedPlayerId: player.id } : null,
                    );
                    setCurrentAction(null);
                    setThrowTeamMateThrownId(null);
                    setSelectedFromReserve(null);
                  }
                }}
                onDragStart={handleDragStart}
                boardContainerRef={boardRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onCellSizeChange={setCurrentCellSize}
                isSetupPhase={
                  (state as ExtendedGameState).preMatch?.phase === "setup"
                }
                initialTerrainSkin={(state as any).terrainSkin || undefined}
              />
            </div>
            {/* PlayerDetails is now integrated in GameBoardWithDugouts */}
          </div>

          {/* Match log below the game board */}
          {state.gameLog && state.gameLog.length > 0 && (
            <div className="mt-2 w-full max-w-5xl mx-auto">
              <GameLog logEntries={state.gameLog} />
            </div>
          )}

          {/* Post-match SPP display when game has ended */}
          {state.gamePhase === "ended" &&
            state.matchStats &&
            Object.keys(state.matchStats).length > 0 &&
            state.matchResult &&
            state.players && (
            <div className="mt-6">
              <PostMatchSPP
                matchStats={state.matchStats}
                matchResult={state.matchResult}
                players={state.players.map((p) => ({
                  id: p.id,
                  team: p.team,
                  name: p.name,
                  number: p.number ?? 0,
                  position: p.position ?? "",
                }))}
                teamAName={teamNameA || state.teamNames?.teamA || "Équipe A"}
                teamBName={teamNameB || state.teamNames?.teamB || "Équipe B"}
              />
            </div>
          )}
        </div>
      </div>
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup
          result={state.lastDiceResult}
          onClose={() => {
            setShowDicePopup(false);
            setState((s) =>
              s ? (clearDiceResult(s) as ExtendedGameState) : null,
            );
          }}
        />
      )}
      {state.selectedPlayerId &&
        currentAction === null &&
        !hasPlayerActed(state, state.selectedPlayerId) &&
        (state as ExtendedGameState).preMatch?.phase !== "setup" && (() => {
          const sp = state.players.find((p) => p.id === state.selectedPlayerId);
          const canThrowTM =
            !!sp &&
            sp.skills.some(
              (s) => s.toLowerCase() === "throw-team-mate",
            ) &&
            legal.some(
              (m) =>
                m.type === "THROW_TEAM_MATE" &&
                (m as any).playerId === state.selectedPlayerId,
            );
          const available: Array<
            "MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | "THROW_TEAM_MATE"
          > = ["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"];
          if (canThrowTM) available.push("THROW_TEAM_MATE");
          return (
            <ActionPickerPopup
              playerName={sp?.name || "Joueur"}
              available={available}
              onPick={(a) => {
                setThrowTeamMateThrownId(null);
                setCurrentAction(a);
              }}
              onClose={() => setCurrentAction("MOVE")}
            />
          );
        })()}
      {/* Indicateur THROW_TEAM_MATE : explique l'etape en cours */}
      {currentAction === "THROW_TEAM_MATE" && state.selectedPlayerId && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-3">
          <span>
            {throwTeamMateThrownId
              ? "Cliquez sur la case d'arrivée"
              : "Cliquez sur le coéquipier à lancer"}
          </span>
          <button
            type="button"
            onClick={() => {
              setThrowTeamMateThrownId(null);
              setCurrentAction(null);
            }}
            className="px-2 py-0.5 bg-purple-900 rounded text-xs hover:bg-purple-950"
          >
            Annuler
          </button>
        </div>
      )}
      {/* Bouton fin d'activation du joueur */}
      {/* Barre d'activation du joueur : PM restants + bouton terminer */}
      {state && state.selectedPlayerId && isMyTurn &&
        (state as ExtendedGameState).preMatch?.phase !== "setup" &&
        !state.pendingBlock && !state.pendingPushChoice && !state.pendingFollowUpChoice && (() => {
          const selectedPlayer = state.players.find(p => p.id === state.selectedPlayerId);
          const hasActed = !!state.playerActions?.[state.selectedPlayerId!];
          if (!selectedPlayer) return null;
          return (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
              {/* Compteur de mouvements restants */}
              <div className="bg-gray-900/90 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-mono flex items-center gap-2">
                <span className="text-xs text-gray-400">PM</span>
                <span className={`font-bold ${selectedPlayer.pm > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedPlayer.pm}/{selectedPlayer.ma}
                </span>
                {(selectedPlayer.gfiUsed ?? 0) < 2 && selectedPlayer.pm <= 0 && (
                  <span className="text-xs text-yellow-400 ml-1">
                    +{2 - (selectedPlayer.gfiUsed ?? 0)} GFI
                  </span>
                )}
              </div>
              {/* Bouton terminer l'activation */}
              {hasActed && (
                <button
                  onClick={() => {
                    const move = { type: 'END_PLAYER_TURN' as const, playerId: state.selectedPlayerId! };
                    if (isActiveMatch) {
                      submitMove(move).then((res) => {
                        if (res?.success && res.gameState) {
                          setState(normalizeState(res.gameState));
                          setIsMyTurn(res.isMyTurn);
                        }
                      });
                    } else {
                      setState((s) => s ? applyMove(s, move, createRNG()) as ExtendedGameState : null);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition-all text-sm"
                >
                  Terminer l&apos;activation
                </button>
              )}
            </div>
          );
        })()}
      {/* Block/Push/FollowUp decision popups */}
      {state && shouldShowBlockPopup(state) && state.pendingBlock && (
        <BlockChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingBlock!.attackerId)?.name || "Attaquant"
          }
          defenderName={
            state.players.find((p) => p.id === state.pendingBlock!.targetId)?.name || "Défenseur"
          }
          chooser={state.pendingBlock.chooser}
          options={state.pendingBlock.options}
          onChoose={(result) => {
            const move = buildBlockChooseMove(state.pendingBlock!, result);
            if (isActiveMatch) {
              submitMove(move).then((res) => {
                if (res?.success && res.gameState) {
                  setState(normalizeState(res.gameState));
                  setIsMyTurn(res.isMyTurn);
                  if (res.gameState.lastDiceResult) setShowDicePopup(true);
                }
              });
            } else {
              setState((s) => {
                if (!s) return null;
                const s2 = applyMove(s, move, createRNG());
                if (s2.lastDiceResult) setShowDicePopup(true);
                return s2 as ExtendedGameState;
              });
            }
          }}
          onClose={() => {}}
        />
      )}
      {state && shouldShowPushPopup(state) && state.pendingPushChoice && (
        <PushChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingPushChoice!.attackerId)?.name || "Attaquant"
          }
          targetName={
            state.players.find((p) => p.id === state.pendingPushChoice!.targetId)?.name || "Défenseur"
          }
          availableDirections={state.pendingPushChoice.availableDirections}
          onChoose={(direction) => {
            const move = buildPushChooseMove(state.pendingPushChoice!, direction);
            if (isActiveMatch) {
              submitMove(move).then((res) => {
                if (res?.success && res.gameState) {
                  setState(normalizeState(res.gameState));
                  setIsMyTurn(res.isMyTurn);
                }
              });
            } else {
              setState((s) => s ? applyMove(s, move, createRNG()) as ExtendedGameState : null);
            }
          }}
          onClose={() => {}}
        />
      )}
      {state && shouldShowFollowUpPopup(state) && state.pendingFollowUpChoice && (
        <FollowUpChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingFollowUpChoice!.attackerId)?.name || "Attaquant"
          }
          targetName={
            state.players.find((p) => p.id === state.pendingFollowUpChoice!.targetId)?.name || "Défenseur"
          }
          targetNewPosition={state.pendingFollowUpChoice.targetNewPosition}
          targetOldPosition={state.pendingFollowUpChoice.targetOldPosition}
          onChoose={(followUp) => {
            const move = buildFollowUpChooseMove(state.pendingFollowUpChoice!, followUp);
            if (isActiveMatch) {
              submitMove(move).then((res) => {
                if (res?.success && res.gameState) {
                  setState(normalizeState(res.gameState));
                  setIsMyTurn(res.isMyTurn);
                }
              });
            } else {
              setState((s) => s ? applyMove(s, move, createRNG()) as ExtendedGameState : null);
            }
          }}
          onClose={() => {}}
        />
      )}
      {/* Reroll decision popup */}
      {state && shouldShowRerollPopup(state) && state.pendingReroll && isMyTurn && (
        <RerollChoicePopup
          rollType={state.pendingReroll.rollType}
          playerName={
            state.players.find((p) => p.id === state.pendingReroll!.playerId)?.name || "Joueur"
          }
          teamRerollsLeft={
            myTeamSide === "A"
              ? state.teamRerolls.teamA
              : state.teamRerolls.teamB
          }
          onChoose={(useReroll) => {
            const move = buildRerollChooseMove(useReroll);
            if (isActiveMatch) {
              submitMove(move).then((res) => {
                if (res?.success && res.gameState) {
                  setState(normalizeState(res.gameState));
                  setIsMyTurn(res.isMyTurn);
                  if (res.gameState.lastDiceResult) setShowDicePopup(true);
                }
              });
            } else {
              setState((s) => {
                if (!s) return null;
                const s2 = applyMove(s, move, createRNG());
                if (s2.lastDiceResult) setShowDicePopup(true);
                return s2 as ExtendedGameState;
              });
            }
          }}
        />
      )}
      {/* In-game chat */}
      {isActiveMatch && (
        <GameChat
          messages={chatMessages}
          sendMessage={sendChatMessage}
          currentUserId={currentUserId}
        />
      )}
      {/* Apothecary decision popup */}
      {state && state.pendingApothecary && isMyTurn && (
        <ApothecaryChoicePopup
          playerName={
            state.players.find((p) => p.id === state.pendingApothecary!.playerId)?.name || "Joueur"
          }
          injuryType={state.pendingApothecary.injuryType}
          casualtyOutcome={state.pendingApothecary.originalCasualtyOutcome}
          onChoose={(useApothecary) => {
            const move = buildApothecaryChooseMove(useApothecary);
            if (isActiveMatch) {
              submitMove(move).then((res) => {
                if (res?.success && res.gameState) {
                  setState(normalizeState(res.gameState));
                  setIsMyTurn(res.isMyTurn);
                }
              });
            } else {
              setState((s) => {
                if (!s) return null;
                return applyMove(s, move, createRNG()) as ExtendedGameState;
              });
            }
          }}
        />
      )}
    </div>
    </ToastProvider>
  );
}
