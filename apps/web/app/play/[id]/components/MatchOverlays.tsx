"use client";

/**
 * Tous les overlays "actifs pendant le match" affiches au-dessus du
 * board : DiceResultPopup, ActionPickerPopup, ThrowTeamMateIndicator,
 * PlayerActivationBar, ChoicePopups (5 popups), GameChat.
 *
 * Centralise la condition "match en cours" (state.gamePhase / preMatch
 * phase) et les guards pour reduire la duplication dans page.tsx.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0x.
 */

import {
  type ExtendedGameState,
  type Move,
  type RNG,
  clearDiceResult,
  hasPlayerActed,
} from "@bb/game-engine";
import { DiceResultPopup, ActionPickerPopup } from "@bb/ui";
import GameChat from "../../../components/GameChat";
import type { ChatMessage, ChatAck } from "../hooks/useGameChat";
import { ThrowTeamMateIndicator } from "./ThrowTeamMateIndicator";
import { PlayerActivationBar } from "./PlayerActivationBar";
import { ChoicePopups } from "./ChoicePopups";
import { getAvailableActions, type ActivationAction } from "../utils/available-actions";
import type { LegalAction } from "../utils/legal-action";

interface MatchOverlaysProps {
  state: ExtendedGameState;
  legal: readonly LegalAction[];
  isMyTurn: boolean;
  isActiveMatch: boolean;
  myTeamSide: "A" | "B" | null;
  showDicePopup: boolean;
  currentAction: ActivationAction | null;
  throwTeamMateThrownId: string | null;
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => Promise<ChatAck>;
  currentUserId: string | undefined;
  submitMove: (move: Move) => Promise<
    | { success?: boolean; gameState?: ExtendedGameState; isMyTurn?: boolean }
    | null
    | undefined
  >;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  setIsMyTurn: (v: boolean) => void;
  setShowDicePopup: (v: boolean) => void;
  setCurrentAction: (a: ActivationAction | null) => void;
  setThrowTeamMateThrownId: (id: string | null) => void;
  createRNG: () => RNG;
}

export function MatchOverlays({
  state,
  legal,
  isMyTurn,
  isActiveMatch,
  myTeamSide,
  showDicePopup,
  currentAction,
  throwTeamMateThrownId,
  chatMessages,
  sendChatMessage,
  currentUserId,
  submitMove,
  setState,
  setIsMyTurn,
  setShowDicePopup,
  setCurrentAction,
  setThrowTeamMateThrownId,
  createRNG,
}: MatchOverlaysProps) {
  return (
    <>
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
        state.preMatch?.phase !== "setup" && (
          <ActionPickerPopup
            playerName={
              state.players.find((p) => p.id === state.selectedPlayerId)?.name ||
              "Joueur"
            }
            available={getAvailableActions(state, legal, state.selectedPlayerId)}
            onPick={(a) => {
              setThrowTeamMateThrownId(null);
              setCurrentAction(a);
            }}
            onClose={() => setCurrentAction("MOVE")}
          />
        )}
      {currentAction === "THROW_TEAM_MATE" && state.selectedPlayerId && (
        <ThrowTeamMateIndicator
          thrownPlayerId={throwTeamMateThrownId}
          onCancel={() => {
            setThrowTeamMateThrownId(null);
            setCurrentAction(null);
          }}
        />
      )}
      {state.selectedPlayerId &&
        isMyTurn &&
        state.preMatch?.phase !== "setup" &&
        !state.pendingBlock &&
        !state.pendingPushChoice &&
        !state.pendingFollowUpChoice && (
          <PlayerActivationBar
            state={state}
            isActiveMatch={isActiveMatch}
            submitMove={submitMove}
            setState={setState}
            setIsMyTurn={setIsMyTurn}
            createRNG={createRNG}
          />
        )}
      <ChoicePopups
        state={state}
        isMyTurn={isMyTurn}
        myTeamSide={myTeamSide}
        isActiveMatch={isActiveMatch}
        submitMove={submitMove}
        setState={setState}
        setIsMyTurn={setIsMyTurn}
        setShowDicePopup={setShowDicePopup}
        createRNG={createRNG}
      />
      {isActiveMatch && (
        <GameChat
          messages={chatMessages}
          sendMessage={sendChatMessage}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
