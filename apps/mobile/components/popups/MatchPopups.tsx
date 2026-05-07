import type { GameState, Move, BlockResult } from "@bb/game-engine";
import BlockChoicePopup from "./BlockChoicePopup";
import PushChoicePopup from "./PushChoicePopup";
import FollowUpChoicePopup from "./FollowUpChoicePopup";
import RerollChoicePopup from "./RerollChoicePopup";
import {
  shouldShowBlockPopup,
  shouldShowPushPopup,
  shouldShowFollowUpPopup,
  shouldShowRerollPopup,
  buildBlockChooseMove,
  buildPushChooseMove,
  buildFollowUpChooseMove,
  buildRerollChooseMove,
} from "../../lib/block-popups";
import { useTranslation } from "../../lib/i18n-context";

interface MatchPopupsProps {
  state: GameState;
  isMyTurn: boolean;
  submitMove: (move: Move) => void;
}

function playerName(state: GameState, id: string, fallback: string): string {
  return state.players.find((p) => p.id === id)?.name || fallback;
}

export default function MatchPopups({
  state,
  isMyTurn,
  submitMove,
}: MatchPopupsProps) {
  const { t } = useTranslation();
  const attackerFallback = t("popups.fallbacks.attacker");
  const defenderFallback = t("popups.fallbacks.defender");
  const playerFallback = t("popups.fallbacks.player");

  return (
    <>
      {state.pendingBlock && (
        <BlockChoicePopup
          visible={shouldShowBlockPopup(state)}
          attackerName={playerName(state, state.pendingBlock.attackerId, attackerFallback)}
          defenderName={playerName(state, state.pendingBlock.targetId, defenderFallback)}
          chooser={state.pendingBlock.chooser}
          options={state.pendingBlock.options as BlockResult[]}
          onChoose={(result) =>
            submitMove(buildBlockChooseMove(state.pendingBlock!, result))
          }
          onClose={() => {}}
        />
      )}

      {state.pendingPushChoice && (
        <PushChoicePopup
          visible={shouldShowPushPopup(state)}
          attackerName={playerName(state, state.pendingPushChoice.attackerId, attackerFallback)}
          targetName={playerName(state, state.pendingPushChoice.targetId, defenderFallback)}
          availableDirections={state.pendingPushChoice.availableDirections}
          onChoose={(direction) =>
            submitMove(buildPushChooseMove(state.pendingPushChoice!, direction))
          }
          onClose={() => {}}
        />
      )}

      {state.pendingFollowUpChoice && (
        <FollowUpChoicePopup
          visible={shouldShowFollowUpPopup(state)}
          attackerName={playerName(state, state.pendingFollowUpChoice.attackerId, attackerFallback)}
          targetName={playerName(state, state.pendingFollowUpChoice.targetId, defenderFallback)}
          targetNewPosition={state.pendingFollowUpChoice.targetNewPosition}
          onChoose={(followUp) =>
            submitMove(
              buildFollowUpChooseMove(state.pendingFollowUpChoice!, followUp),
            )
          }
          onClose={() => {}}
        />
      )}

      {state.pendingReroll && isMyTurn && (
        <RerollChoicePopup
          visible={shouldShowRerollPopup(state)}
          rollType={state.pendingReroll.rollType}
          playerName={playerName(state, state.pendingReroll.playerId, playerFallback)}
          teamRerollsLeft={
            state.pendingReroll.team === "A"
              ? state.teamRerolls?.teamA ?? 0
              : state.teamRerolls?.teamB ?? 0
          }
          onChoose={(useReroll) =>
            submitMove(buildRerollChooseMove(useReroll))
          }
          onClose={() => {}}
        />
      )}
    </>
  );
}
