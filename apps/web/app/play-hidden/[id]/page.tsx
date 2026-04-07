"use client";
import { useMemo, useState, useRef } from "react";
import {
  DiceResultPopup,
  GameScoreboard,
  ActionPickerPopup,
  BlockChoicePopup,
  PushChoicePopup,
  FollowUpChoicePopup,
  RerollChoicePopup,
  ApothecaryChoicePopup,
  GameBoardWithDugouts,
  ToastProvider,
} from "@bb/ui";
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
import { useGameMoves } from "./hooks/useGameMoves";
import { useGameSocket } from "./hooks/useGameSocket";
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
import { useTurnNotification } from "./hooks/useTurnNotification";

/** Renders nothing — just fires turn notification side-effects inside ToastProvider. */
function TurnNotificationListener({ isMyTurn, isActiveMatch }: { isMyTurn: boolean; isActiveMatch: boolean }) {
  useTurnNotification({ isMyTurn, isActiveMatch });
  return null;
}

// Normalise un état reçu du serveur
function normalizeState(state: any): ExtendedGameState {
  if (!state) return state;
  if (!state.playerActions) state.playerActions = {};
  if (!state.teamBlitzCount) state.teamBlitzCount = {};
  if (!state.teamFoulCount) state.teamFoulCount = {};
  if (!state.matchStats) state.matchStats = {};
  if (typeof state.width !== "number") state.width = 26;
  if (typeof state.height !== "number") state.height = 15;
  if (state.preMatch?.phase === "setup") state.selectedPlayerId = null;
  return state as ExtendedGameState;
}

export default function PlayByIdPage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  // État du jeu centralisé via hook
  const {
    state, stateSource, matchStatus, myTeamSide, isMyTurn,
    teamNameA, teamNameB, userName,
    setState, setMatchStatus, setMyTeamSide, setIsMyTurn,
  } = useGameState(matchId);

  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<
    "MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null
  >(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);

  // WebSocket connection for real-time move submission
  const { submitMove: wsSubmitMove } = useGameSocket(matchId, {
    onStateUpdate: (data) => {
      setState(normalizeState(data.gameState));
    },
  });

  const { submitMove, submitting: moveSubmitting } = useGameMoves(matchId, {
    wsSubmitMove,
  });

  // Helper : est-ce que le match est en phase active (coups envoyés au serveur) ?
  const isActiveMatch = matchStatus === "active";

  // Ajouter state pour selectedFromReserve (pour setup)
  const [selectedFromReserve, setSelectedFromReserve] = useState<string | null>(
    null,
  );

  // Ajouter state après selectedFromReserve
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [currentCellSize, setCurrentCellSize] = useState(28);
  const [setupError, setSetupError] = useState<string | null>(null);

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

    // Utiliser rect du board (Pixi container)
    const rect = boardRef.current.getBoundingClientRect();
    const nativeEvent = e.nativeEvent;
    const x = nativeEvent.clientX - rect.left;
    const y = nativeEvent.clientY - rect.top;
    const gridX = Math.floor(x / currentCellSize);
    const gridY = Math.floor(y / currentCellSize);

    if (
      gridX >= 0 &&
      gridX < state.height &&
      gridY >= 0 &&
      gridY < state.width
    ) {
      const pos: Position = { x: gridY, y: gridX };

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

      console.log("Ballon placé:", responseData.message);
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

      console.log("Déviation calculée:", responseData.message);
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

      console.log("Événement résolu:", responseData.message);
    } catch (error) {
      console.error("Erreur lors de la résolution de l'événement:", error);
    }
  };

  // Fonction pour valider le placement et sauvegarder en base
  const handleValidatePlacement = async () => {
    if (!state) return;
    const extState = state as ExtendedGameState;

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

      // Afficher un message de succès
      if (responseData.message) {
        console.log("Validation réussie:", responseData.message);
        console.log("Nouvelle phase:", normalizedState.preMatch?.phase);
        console.log("Coach actuel:", normalizedState.preMatch?.currentCoach);
      }
    } catch (error) {
      console.error("Erreur lors de la validation du placement:", error);
      showSetupError("Erreur lors de la sauvegarde du placement");
    }
  };

  // Modifier onCellClick pour ignorer si dragging (déjà géré par drop)
  function onCellClick(pos: Position) {
    if (draggedPlayerId) return; // Ignorer clic si dragging en cours
    if (!state) return;
    // Bloquer si match actif et pas mon tour (ou soumission en cours)
    if (isActiveMatch && (!isMyTurn || moveSubmitting)) return;
    const extState = state as ExtendedGameState;
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
    console.log("onCellClick - player found:", {
      player: !!player,
      playerId: player?.id,
      team: player?.team,
      currentPlayer: state.currentPlayer,
      phase: extState.preMatch?.phase,
    });
    if (
      player &&
      player.team === state.currentPlayer &&
      (!extState.preMatch || (extState.preMatch.phase as string) !== "setup")
    ) {
      console.log("Setting selectedPlayerId from onCellClick:", player.id);
      setState((s) => (s ? { ...s, selectedPlayerId: player.id } : null));
      setCurrentAction(null);
      setSelectedFromReserve(null);
      return;
    }
    if (
      state.selectedPlayerId &&
      (!extState.preMatch || (extState.preMatch.phase as string) !== "setup")
    ) {
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
  }, [state, isActiveMatch]);



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
    <div className="min-h-screen bg-gray-100">
      <GameScoreboard
        state={state}
        leftTeamName={state.teamNames?.teamA}
        rightTeamName={state.teamNames?.teamB}
        localSide={localSide}
        userName={userName}
        {...(state?.half > 0 && (!isActiveMatch || isMyTurn) ? { onEndTurn: handleEndTurn } : {})}
      />
      {/* Bandeau de statut de tour (match actif uniquement) */}
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
      {/* Wrapper pour éléments pré-match, à l'intérieur du container principal */}
      <div className="pt-32">
        {" "}
        {/* Augmenté de pt-24 à pt-32 pour espace bouton */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            {" "}
            {/* Wrapper centralisé pour pré-match */}
            {/* Statut pré-match (si half=0) */}
            {state && state.half === 0 && stateSource === "server" && (
              <div className="text-center text-sm text-gray-600 bg-gray-100 p-2 rounded w-full max-w-md">
                {state.preMatch?.phase === "kickoff" ? (
                  <div>
                    <div className="text-lg font-bold text-green-600 mb-2">🎉 Le match commence !</div>
                    <div>Phase kickoff terminée</div>
                    <div>
                      Équipe qui frappe :{" "}
                      {state.preMatch?.kickingTeam === "A"
                        ? state.teamNames.teamA
                        : state.teamNames.teamB}
                    </div>
                    <div>
                      Équipe qui reçoit :{" "}
                      {state.preMatch?.receivingTeam === "A"
                        ? state.teamNames.teamA
                        : state.teamNames.teamB}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Le match va commencer automatiquement...
                    </div>
                  </div>
                ) : (
                  <div>
                    <div>Phase pré-match</div>
                    <div>
                      Receveuse :{" "}
                      {state.preMatch?.receivingTeam === "A"
                        ? state.teamNames.teamA
                        : state.teamNames.teamB}{" "}
                      ({state.preMatch?.receivingTeam})
                    </div>
                    <div className="font-semibold">
                      Au tour de{" "}
                      <span className={`px-2 py-1 rounded text-white ${
                        state.preMatch?.currentCoach === "A" ? "bg-gray-600" : "bg-gray-700"
                      }`}>
                        {state.preMatch?.currentCoach === "A"
                          ? state.teamNames.teamA
                          : state.teamNames.teamB}
                      </span>{" "}
                      de placer ses joueurs
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Joueurs placés: {state.players?.filter(p => p.team === state.preMatch?.currentCoach && p.pos.x >= 0).length || 0}/11
                    </div>
                    {setupError && (
                      <div className="mt-2 px-3 py-2 bg-red-100 text-red-700 rounded border border-red-300">
                        {setupError}
                      </div>
                    )}
                    {/* Bouton de validation ou message d'attente */}
                    {(() => {
                      const currentCoach = state.preMatch?.currentCoach;
                      const playersOnField = state.players?.filter(p => p.team === currentCoach && p.pos.x >= 0).length || 0;
                      const mySide = getMySide(state as ExtendedGameState);

                      if (mySide && mySide !== currentCoach) {
                        return (
                          <div className="mt-3 px-3 py-2 bg-yellow-50 text-yellow-700 rounded border border-yellow-300 text-sm">
                            En attente du placement adverse...
                          </div>
                        );
                      }

                      if (playersOnField === 11 && mySide === currentCoach) {
                        return (
                          <div className="mt-3">
                            <button
                              onClick={handleValidatePlacement}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              Valider le placement
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })()}
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
                  console.log("onPlayerClick called:", {
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
                        console.log("Setting selectedFromReserve:", playerId);
                        setSelectedFromReserve(playerId);
                      }
                      return;
                    }
                    console.log("Ignoring player click in setup phase");
                    return; // Ignore autres en setup
                  }
                  // Logique normale (seulement si pas en phase setup)
                  const player = state.players.find((p) => p.id === playerId);
                  if (
                    player &&
                    player.team === state.currentPlayer &&
                    (!extState.preMatch ||
                      (extState.preMatch.phase as string) !== "setup")
                  ) {
                    console.log("Setting selectedPlayerId:", playerId);
                    setState((s) =>
                      s ? { ...s, selectedPlayerId: player.id } : null,
                    );
                    setCurrentAction(null);
                    setSelectedFromReserve(null);
                  } else {
                    console.log("Not setting selectedPlayerId:", {
                      player: !!player,
                      teamMatch: player?.team === state.currentPlayer,
                      preMatch: !!extState.preMatch,
                      phase: extState.preMatch?.phase,
                    });
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
              />
            </div>
            {/* PlayerDetails is now integrated in GameBoardWithDugouts */}
          </div>

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
        (state as ExtendedGameState).preMatch?.phase !== "setup" && (
          <ActionPickerPopup
            playerName={
              state.players.find((p) => p.id === state.selectedPlayerId)
                ?.name || "Joueur"
            }
            available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]}
            onPick={(a) => setCurrentAction(a)}
            onClose={() => setCurrentAction("MOVE")}
          />
        )}
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
