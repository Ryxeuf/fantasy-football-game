"use client";

/**
 * Pile des popups de decision in-match :
 * - Block (choix du resultat de blocage)
 * - Push (choix de la direction de poussee)
 * - FollowUp (l'attaquant suit ou non)
 * - Reroll (utiliser le team reroll sur un jet en attente)
 * - Apothecary (utiliser l'apothicaire sur une blessure / casualty)
 *
 * `onSubmitMove` encapsule la logique de dispatch (online vs local) et la
 * gestion de `setShowDicePopup` cote page.tsx ; ce composant ne fait
 * que la presentation et l'invocation du callback avec le bon `Move`.
 *
 * Extrait de play/[id]/page.tsx dans le cadre du refactor S26.0i.
 */

import {
  BlockChoicePopup,
  PushChoicePopup,
  FollowUpChoicePopup,
  RerollChoicePopup,
  ApothecaryChoicePopup,
} from "@bb/ui";
import { type ExtendedGameState, type Move } from "@bb/game-engine";
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
} from "../hooks/useBlockPopups";

export interface DecisionPopupsLayerProps {
  state: ExtendedGameState;
  isMyTurn: boolean;
  myTeamSide: "A" | "B" | null;
  onSubmitMove: (move: Move, opts?: { showDiceOnResult?: boolean }) => void;
}

export function DecisionPopupsLayer({
  state,
  isMyTurn,
  myTeamSide,
  onSubmitMove,
}: DecisionPopupsLayerProps) {
  return (
    <>
      {shouldShowBlockPopup(state) && state.pendingBlock && (
        <BlockChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingBlock!.attackerId)?.name ||
            "Attaquant"
          }
          defenderName={
            state.players.find((p) => p.id === state.pendingBlock!.targetId)?.name ||
            "Défenseur"
          }
          chooser={state.pendingBlock.chooser}
          options={state.pendingBlock.options}
          onChoose={(result) =>
            onSubmitMove(buildBlockChooseMove(state.pendingBlock!, result), {
              showDiceOnResult: true,
            })
          }
          onClose={() => {}}
        />
      )}
      {shouldShowPushPopup(state) && state.pendingPushChoice && (
        <PushChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingPushChoice!.attackerId)?.name ||
            "Attaquant"
          }
          targetName={
            state.players.find((p) => p.id === state.pendingPushChoice!.targetId)?.name ||
            "Défenseur"
          }
          availableDirections={state.pendingPushChoice.availableDirections}
          onChoose={(direction) =>
            onSubmitMove(buildPushChooseMove(state.pendingPushChoice!, direction))
          }
          onClose={() => {}}
        />
      )}
      {shouldShowFollowUpPopup(state) && state.pendingFollowUpChoice && (
        <FollowUpChoicePopup
          attackerName={
            state.players.find((p) => p.id === state.pendingFollowUpChoice!.attackerId)?.name ||
            "Attaquant"
          }
          targetName={
            state.players.find((p) => p.id === state.pendingFollowUpChoice!.targetId)?.name ||
            "Défenseur"
          }
          targetNewPosition={state.pendingFollowUpChoice.targetNewPosition}
          targetOldPosition={state.pendingFollowUpChoice.targetOldPosition}
          onChoose={(followUp) =>
            onSubmitMove(buildFollowUpChooseMove(state.pendingFollowUpChoice!, followUp))
          }
          onClose={() => {}}
        />
      )}
      {shouldShowRerollPopup(state) && state.pendingReroll && isMyTurn && (
        <RerollChoicePopup
          rollType={state.pendingReroll.rollType}
          playerName={
            state.players.find((p) => p.id === state.pendingReroll!.playerId)?.name || "Joueur"
          }
          teamRerollsLeft={
            myTeamSide === "A" ? state.teamRerolls.teamA : state.teamRerolls.teamB
          }
          onChoose={(useReroll) =>
            onSubmitMove(buildRerollChooseMove(useReroll), { showDiceOnResult: true })
          }
        />
      )}
      {state.pendingApothecary && isMyTurn && (
        <ApothecaryChoicePopup
          playerName={
            state.players.find((p) => p.id === state.pendingApothecary!.playerId)?.name ||
            "Joueur"
          }
          injuryType={state.pendingApothecary.injuryType}
          casualtyOutcome={state.pendingApothecary.originalCasualtyOutcome}
          onChoose={(useApothecary) =>
            onSubmitMove(buildApothecaryChooseMove(useApothecary))
          }
        />
      )}
    </>
  );
}
