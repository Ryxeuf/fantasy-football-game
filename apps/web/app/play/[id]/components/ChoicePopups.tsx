"use client";

/**
 * Composant qui groupe les 5 popups de choix declenches par le moteur
 * pendant un match : Block / Push / FollowUp / Reroll / Apothecary.
 *
 * Toutes les soumissions de Move passent par applyOrSubmitMove
 * (factorise en S26.0i) ; les popups ne s'occupent que des donnees
 * d'affichage (noms, options).
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0u.
 */

import {
  type ExtendedGameState,
  type Move,
  type RNG,
} from "@bb/game-engine";
import {
  buildBlockChooseMove,
  buildPushChooseMove,
  buildFollowUpChooseMove,
  buildRerollChooseMove,
  buildApothecaryChooseMove,
  shouldShowBlockPopup,
  shouldShowPushPopup,
  shouldShowFollowUpPopup,
  shouldShowRerollPopup,
} from "../hooks/useBlockPopups";
import {
  BlockChoicePopup,
  PushChoicePopup,
  FollowUpChoicePopup,
  RerollChoicePopup,
  ApothecaryChoicePopup,
} from "@bb/ui";
import { applyOrSubmitMove } from "../utils/apply-or-submit-move";

interface ChoicePopupsProps {
  state: ExtendedGameState;
  isMyTurn: boolean;
  myTeamSide: "A" | "B" | null;
  isActiveMatch: boolean;
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
  createRNG: () => RNG;
}

export function ChoicePopups({
  state,
  isMyTurn,
  myTeamSide,
  isActiveMatch,
  submitMove,
  setState,
  setIsMyTurn,
  setShowDicePopup,
  createRNG,
}: ChoicePopupsProps) {
  const submitOptions = {
    isActiveMatch,
    submitMove,
    setState,
    setIsMyTurn,
    createRNG,
  };

  return (
    <>
      {shouldShowBlockPopup(state) && state.pendingBlock && (
        <BlockChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingBlock!.attackerId)
              ?.name || "Attaquant"
          }
          defenderName={
            state.players.find((p) => p.id === state.pendingBlock!.targetId)
              ?.name || "Défenseur"
          }
          chooser={state.pendingBlock.chooser}
          options={state.pendingBlock.options}
          onChoose={(result) => {
            applyOrSubmitMove({
              ...submitOptions,
              move: buildBlockChooseMove(state.pendingBlock!, result),
              withDicePopup: true,
              setShowDicePopup,
            });
          }}
          onClose={() => {}}
        />
      )}
      {shouldShowPushPopup(state) && state.pendingPushChoice && (
        <PushChoicePopup
          attackerName={
            state.players.find(
              (p) => p.id === state.pendingPushChoice!.attackerId,
            )?.name || "Attaquant"
          }
          targetName={
            state.players.find(
              (p) => p.id === state.pendingPushChoice!.targetId,
            )?.name || "Défenseur"
          }
          availableDirections={state.pendingPushChoice.availableDirections}
          onChoose={(direction) => {
            applyOrSubmitMove({
              ...submitOptions,
              move: buildPushChooseMove(state.pendingPushChoice!, direction),
            });
          }}
          onClose={() => {}}
        />
      )}
      {shouldShowFollowUpPopup(state) && state.pendingFollowUpChoice && (
        <FollowUpChoicePopup
          attackerName={
            state.players.find(
              (p) => p.id === state.pendingFollowUpChoice!.attackerId,
            )?.name || "Attaquant"
          }
          targetName={
            state.players.find(
              (p) => p.id === state.pendingFollowUpChoice!.targetId,
            )?.name || "Défenseur"
          }
          targetNewPosition={state.pendingFollowUpChoice.targetNewPosition}
          targetOldPosition={state.pendingFollowUpChoice.targetOldPosition}
          onChoose={(followUp) => {
            applyOrSubmitMove({
              ...submitOptions,
              move: buildFollowUpChooseMove(
                state.pendingFollowUpChoice!,
                followUp,
              ),
            });
          }}
          onClose={() => {}}
        />
      )}
      {shouldShowRerollPopup(state) && state.pendingReroll && isMyTurn && (
        <RerollChoicePopup
          rollType={state.pendingReroll.rollType}
          playerName={
            state.players.find((p) => p.id === state.pendingReroll!.playerId)
              ?.name || "Joueur"
          }
          teamRerollsLeft={
            myTeamSide === "A"
              ? state.teamRerolls.teamA
              : state.teamRerolls.teamB
          }
          onChoose={(useReroll) => {
            applyOrSubmitMove({
              ...submitOptions,
              move: buildRerollChooseMove(useReroll),
              withDicePopup: true,
              setShowDicePopup,
            });
          }}
        />
      )}
      {state.pendingApothecary && isMyTurn && (
        <ApothecaryChoicePopup
          playerName={
            state.players.find((p) => p.id === state.pendingApothecary!.playerId)
              ?.name || "Joueur"
          }
          injuryType={state.pendingApothecary.injuryType}
          casualtyOutcome={state.pendingApothecary.originalCasualtyOutcome}
          onChoose={(useApothecary) => {
            applyOrSubmitMove({
              ...submitOptions,
              move: buildApothecaryChooseMove(useApothecary),
            });
          }}
        />
      )}
    </>
  );
}
