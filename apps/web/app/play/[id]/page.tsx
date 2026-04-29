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
  type TerrainSkinId,
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
import { KickoffSequencePanel } from "./components/KickoffSequencePanel";
import { SetupPhasePanel } from "./components/SetupPhasePanel";
import { ThrowTeamMateIndicator } from "./components/ThrowTeamMateIndicator";
import { PlayerActivationBar } from "./components/PlayerActivationBar";
import {
  TurnStatusBanner,
  PreMatchSetupBanner,
} from "./components/TopStatusBanners";
import { normalizeState } from "./utils/normalize-state";
import * as kickoffActions from "./utils/kickoff-actions";
import { applyOrSubmitMove } from "./utils/apply-or-submit-move";
import { getAvailableActions } from "./utils/available-actions";
import { handlePlayerClick } from "./utils/handle-player-click";
import { handleSetupDragStart } from "./utils/handle-drag-start";
import { handleSetupDrop } from "./utils/handle-drop";
import { handleSetupCellClick } from "./utils/handle-setup-cell-click";
import { handleThrowTeamMateClick } from "./utils/handle-throw-team-mate-click";
import { handleBlockClick } from "./utils/handle-block-click";
import { validateSetupPlacement } from "./utils/validate-setup";
import { getMySide, validatePlacement } from "./utils/setup-validation";
import { type LegalAction } from "./utils/legal-action";
import { ForfeitWarning } from "../../components/ForfeitWarning";
import GameChat from "../../components/GameChat";
import {
  TurnNotificationListener,
  SoundEffectsListener,
  SoundToggleButton,
} from "./components/InGameListeners";
import { useGameChat } from "./hooks/useGameChat";

/** Renders nothing — just fires turn notification side-effects inside ToastProvider. */

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

  // `getMySide` and `validatePlacement` extracted to ./utils/setup-validation.ts (S26.0c).
  function showSetupError(msg: string) {
    setSetupError(msg);
    setTimeout(() => setSetupError(null), 2500);
  }

  const legal = useMemo<LegalAction[]>(() => {
    if (!state) return [];
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === "setup") {
      // En setup, legal moves = positions pour placer selectedFromReserve
      if (selectedFromReserve) {
        return extState.preMatch.legalSetupPositions.map<LegalAction>(
          (p) => ({
            type: "PLACE",
            playerId: selectedFromReserve,
            to: p,
          }),
        );
      }
      return []; // Pas de moves sans sélection
    }
    return getLegalMoves(state);
  }, [state, selectedFromReserve]);
  const isMove = (m: LegalAction, pid: string): m is Extract<Move, { type: "MOVE" }> =>
    m.type === "MOVE" && m.playerId === pid;
  const movesForSelected = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return legal
      .filter((m) => isMove(m, state.selectedPlayerId!))
      .map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  const blockTargets = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    // computeBlockTargets ignore les PLACE synthetiques (S26.0f).
    const realMoves = legal.filter((m): m is Move => m.type !== "PLACE");
    return computeBlockTargets(state.selectedPlayerId, realMoves, state.players);
  }, [state?.selectedPlayerId, legal, state?.players]);

  // Drag handlers (S26.0n — handleDragStart extracted to ./utils/handle-drag-start.ts).
  const handleDragStart = (e: React.DragEvent, playerId: string) =>
    handleSetupDragStart({
      e,
      playerId,
      state: state as ExtendedGameState | null,
      teamNameA,
      teamNameB,
      setupSubmitting,
      setDraggedPlayerId,
    });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permettre drop
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!state) return;
    handleSetupDrop({
      e,
      state: state as ExtendedGameState,
      draggedPlayerId,
      boardEl: boardRef.current,
      teamNameA,
      teamNameB,
      currentCellSize,
      showSetupError,
      setState,
      setDraggedPlayerId,
    });
  };

  // Kickoff handlers extracted to ./utils/kickoff-actions.ts (S26.0d).
  const handlePlaceKickoffBall = (position: Position) =>
    kickoffActions.handlePlaceKickoffBall(matchId, setState, position);
  const handleCalculateDeviation = () =>
    kickoffActions.handleCalculateDeviation(matchId, setState);
  const handleResolveKickoffEvent = () =>
    kickoffActions.handleResolveKickoffEvent(matchId, setState);

  // Fonction pour valider le placement et sauvegarder en base (S26.0e — extracted)
  const handleValidatePlacement = async () => {
    if (!state || setupSubmitting) return;
    const extState = state as ExtendedGameState;

    setSetupSubmitting(true);
    try {
      await validateSetupPlacement({
        matchId,
        extState,
        setState,
        setIsMyTurn,
        setMyTeamSide,
      });
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
    // Phase setup : delegue au util S26.0p
    if (
      handleSetupCellClick({
        pos,
        state: extState,
        myTeamSide,
        teamNameA,
        teamNameB,
        setupSubmitting,
        selectedFromReserve,
        showSetupError,
        setState,
        setSelectedFromReserve,
      })
    ) {
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
      // Handle THROW_TEAM_MATE: 2-click flow (S26.0q — extracted)
      if (
        handleThrowTeamMateClick({
          pos,
          state: extState,
          legal,
          currentAction,
          throwTeamMateThrownId,
          isActiveMatch,
          submitMove,
          setState,
          setIsMyTurn,
          setShowDicePopup,
          setThrowTeamMateThrownId,
          setCurrentAction,
          createRNG,
        })
      ) {
        return;
      }

      // Handle BLOCK action: clicking an opponent to initiate a block (S26.0r — extracted)
      if (
        handleBlockClick({
          pos,
          state: extState,
          legal,
          currentAction,
          isActiveMatch,
          submitMove,
          setState,
          setIsMyTurn,
          setShowDicePopup,
          createRNG,
        })
      ) {
        return;
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
              const p = ns.players.find((pl) => pl.id === candidate.playerId);
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
        <TurnStatusBanner
          state={state as ExtendedGameState | null}
          isMyTurn={isMyTurn}
          moveSubmitting={moveSubmitting}
        />
      )}
      {/* Bandeau de statut pré-match (setup) */}
      {!isActiveMatch && matchStatus === "prematch-setup" && state?.preMatch?.phase === "setup" && (
        <PreMatchSetupBanner state={state as ExtendedGameState} isMyTurn={isMyTurn} />
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
                  <KickoffSequencePanel
                    state={state as ExtendedGameState}
                    myTeamSide={myTeamSide}
                    onCalculateDeviation={handleCalculateDeviation}
                    onResolveKickoffEvent={handleResolveKickoffEvent}
                  />
                ) : state.preMatch?.phase === "setup" ? (
                  <SetupPhasePanel
                    state={state as ExtendedGameState}
                    myTeamSide={myTeamSide}
                    teamNameA={teamNameA}
                    teamNameB={teamNameB}
                    setupError={setupError}
                    setupSubmitting={setupSubmitting}
                    onValidatePlacement={handleValidatePlacement}
                  />
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
                  handlePlayerClick({
                    state: state as ExtendedGameState,
                    playerId,
                    draggedPlayerId,
                    currentAction,
                    setState,
                    setCurrentAction,
                    setThrowTeamMateThrownId,
                    setSelectedFromReserve,
                    onCellClick,
                  });
                }}
                onDragStart={handleDragStart}
                boardContainerRef={boardRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onCellSizeChange={setCurrentCellSize}
                isSetupPhase={
                  (state as ExtendedGameState).preMatch?.phase === "setup"
                }
                initialTerrainSkin={(state as ExtendedGameState).terrainSkin as TerrainSkinId | undefined}
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
        (state as ExtendedGameState).preMatch?.phase !== "setup" && (
          <ActionPickerPopup
            playerName={
              state.players.find((p) => p.id === state.selectedPlayerId)?.name ||
              "Joueur"
            }
            available={getAvailableActions(
              state as ExtendedGameState,
              legal,
              state.selectedPlayerId,
            )}
            onPick={(a) => {
              setThrowTeamMateThrownId(null);
              setCurrentAction(a);
            }}
            onClose={() => setCurrentAction("MOVE")}
          />
        )}
      {/* Indicateur THROW_TEAM_MATE : explique l'etape en cours */}
      {currentAction === "THROW_TEAM_MATE" && state.selectedPlayerId && (
        <ThrowTeamMateIndicator
          thrownPlayerId={throwTeamMateThrownId}
          onCancel={() => {
            setThrowTeamMateThrownId(null);
            setCurrentAction(null);
          }}
        />
      )}
      {/* Bouton fin d'activation du joueur */}
      {/* Barre d'activation du joueur : PM restants + bouton terminer */}
      {state && state.selectedPlayerId && isMyTurn &&
        (state as ExtendedGameState).preMatch?.phase !== "setup" &&
        !state.pendingBlock && !state.pendingPushChoice && !state.pendingFollowUpChoice && (
          <PlayerActivationBar
            state={state as ExtendedGameState}
            isActiveMatch={isActiveMatch}
            submitMove={submitMove}
            setState={setState}
            setIsMyTurn={setIsMyTurn}
            createRNG={createRNG}
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
            applyOrSubmitMove({
              move: buildBlockChooseMove(state.pendingBlock!, result),
              isActiveMatch,
              submitMove,
              setState,
              setIsMyTurn,
              createRNG,
              withDicePopup: true,
              setShowDicePopup,
            });
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
            applyOrSubmitMove({
              move: buildPushChooseMove(state.pendingPushChoice!, direction),
              isActiveMatch,
              submitMove,
              setState,
              setIsMyTurn,
              createRNG,
            });
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
            applyOrSubmitMove({
              move: buildFollowUpChooseMove(state.pendingFollowUpChoice!, followUp),
              isActiveMatch,
              submitMove,
              setState,
              setIsMyTurn,
              createRNG,
            });
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
            applyOrSubmitMove({
              move: buildRerollChooseMove(useReroll),
              isActiveMatch,
              submitMove,
              setState,
              setIsMyTurn,
              createRNG,
              withDicePopup: true,
              setShowDicePopup,
            });
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
