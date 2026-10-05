import React from "react";
import { useToast, Toast } from "./Toaster";
import { BLOCK_DIE_FACE_INFO, DiceResult, BlockResult } from "@bb/game-engine";
import BlockDiceIcon from "./BlockDiceIcon";
import { SkinnedPipFace } from "../dice/DieFaces";

/** Le jet, dessiné dans le thème de dés courant (points, chiffré au-delà de 6). */
function RollIcon({ value }: { readonly value: number }) {
  return <SkinnedPipFace value={value} label={`Jet : ${value}`} className="h-7 w-7" />;
}

/** La face du Dé de Blocage, dans le thème de dés courant. */
function BlockFaceIcon({ result }: { readonly result: BlockResult }) {
  return <BlockDiceIcon result={result} size={28} />;
}

interface DiceNotificationProps {
  playerName: string;
  diceResult: DiceResult;
  onClose?: () => void;
}

export const DiceNotification: React.FC<DiceNotificationProps> = ({
  playerName,
  diceResult,
  onClose,
}) => {
  const { addToast } = useToast();

  React.useEffect(() => {
    const toast = createDiceToast(playerName, diceResult);
    addToast(toast);

    if (onClose) {
      onClose();
    }
  }, [playerName, diceResult, addToast, onClose]);

  return null; // Ce composant ne rend rien, il utilise le système de toast
};

function createDiceToast(
  playerName: string,
  diceResult: DiceResult,
): Omit<Toast, "id"> {
  switch (diceResult.type) {
    case "dodge":
      return {
        type: diceResult.success ? "success" : "error",
        title: `Jet d'esquive - ${playerName}`,
        message: `Résultat: ${diceResult.diceRoll} (cible: ${diceResult.targetNumber}) ${diceResult.success ? "✅ Réussi" : "❌ Échoué"}`,
        icon: <RollIcon value={diceResult.diceRoll} />,
        duration: 3000,
      };

    case "pickup":
      return {
        type: diceResult.success ? "success" : "error",
        title: `Jet de ramassage - ${playerName}`,
        message: `Résultat: ${diceResult.diceRoll} (cible: ${diceResult.targetNumber}) ${diceResult.success ? "✅ Réussi" : "❌ Échoué"}`,
        icon: <RollIcon value={diceResult.diceRoll} />,
        duration: 3000,
      };

    case "armor":
      return {
        type: diceResult.success ? "success" : "error",
        title: `Jet d'armure - ${playerName}`,
        message: `Résultat: ${diceResult.diceRoll} (cible: ${diceResult.targetNumber}) ${diceResult.success ? "✅ Réussi" : "❌ Échoué"}`,
        icon: <RollIcon value={diceResult.diceRoll} />,
        duration: 3000,
      };

    case "block":
      return {
        type: "info",
        title: `Dé de blocage - ${playerName}`,
        message: `Résultat: ${diceResult.diceRoll} (cible: ${diceResult.targetNumber}) ${diceResult.success ? "✅ Réussi" : "❌ Échoué"}`,
        icon: <RollIcon value={diceResult.diceRoll} />,
        duration: 3000,
      };

    default:
      return {
        type: "info",
        title: `Jet de dé - ${playerName}`,
        message: `Résultat: ${diceResult.diceRoll}`,
        icon: <RollIcon value={diceResult.diceRoll} />,
        duration: 2000,
      };
  }
}

// Composant pour les dés de blocage spécifiques
interface BlockDiceNotificationProps {
  playerName: string;
  blockResult: BlockResult;
  onClose?: () => void;
}

export const BlockDiceNotification: React.FC<BlockDiceNotificationProps> = ({
  playerName,
  blockResult,
  onClose,
}) => {
  const { addToast } = useToast();

  React.useEffect(() => {
    const toast = createBlockDiceToast(playerName, blockResult);
    addToast(toast);

    if (onClose) {
      onClose();
    }
  }, [playerName, blockResult, addToast, onClose]);

  return null;
};

function createBlockDiceToast(
  playerName: string,
  blockResult: BlockResult,
): Omit<Toast, "id"> {
  const getResultMessage = (result: BlockResult) =>
    BLOCK_DIE_FACE_INFO[result].nameFr;

  const getToastType = (result: BlockResult): Toast["type"] => {
    switch (result) {
      case "POW":
        return "success";
      case "PLAYER_DOWN":
        return "error";
      case "BOTH_DOWN":
        return "warning";
      case "PUSH_BACK":
      case "STUMBLE":
      default:
        return "info";
    }
  };

  return {
    type: getToastType(blockResult),
    title: `Dé de blocage - ${playerName}`,
    message: getResultMessage(blockResult),
    icon: <BlockFaceIcon result={blockResult} />,
    duration: 4000,
  };
}

// Hook utilitaire pour les notifications de dés
export const useDiceNotifications = () => {
  const { addToast } = useToast();

  const showDiceResult = (playerName: string, diceResult: DiceResult) => {
    const toast = createDiceToast(playerName, diceResult);
    addToast(toast);
  };

  const showBlockDiceResult = (
    playerName: string,
    blockResult: BlockResult,
  ) => {
    const toast = createBlockDiceToast(playerName, blockResult);
    addToast(toast);
  };

  const showCustomDiceResult = (
    playerName: string,
    diceRoll: number,
    targetNumber: number,
    success: boolean,
    type: string = "dice",
  ) => {
    const toast: Omit<Toast, "id"> = {
      type: success ? "success" : "error",
      title: `Jet de dé - ${playerName}`,
      message: `Résultat: ${diceRoll} (cible: ${targetNumber}) ${success ? "✅ Réussi" : "❌ Échoué"}`,
      icon: <RollIcon value={diceRoll} />,
      duration: 3000,
    };
    addToast(toast);
  };

  return {
    showDiceResult,
    showBlockDiceResult,
    showCustomDiceResult,
  };
};
