import React from "react";
import { DiceResult } from "@bb/game-engine";

interface DiceResultPopupProps {
  result: DiceResult;
  onClose: () => void;
}

export default function DiceResultPopup({
  result,
  onClose,
}: DiceResultPopupProps) {
  const getDiceTypeLabel = (type: DiceResult["type"]) => {
    switch (type) {
      case "dodge":
        return "Jet d'esquive";
      case "pickup":
        return "Récupération de balle";
      case "pass":
        return "Passe";
      case "catch":
        return "Réception";
      default:
        return "Jet de dés";
    }
  };

  const getSuccessMessage = (result: DiceResult) => {
    if (result.success) {
      return "✅ Réussi !";
    } else {
      return "❌ Échec !";
    }
  };

  const getFailureConsequence = (result: DiceResult) => {
    if (!result.success) {
      switch (result.type) {
        case "dodge":
          return "TURNOVER !";
        case "pickup":
          return "Balle perdue !";
        case "pass":
          return "Passe interceptée !";
        case "catch":
          return "Balle au sol !";
        default:
          return "Action échouée !";
      }
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-4">
            {getDiceTypeLabel(result.type)}
          </h3>

          <div className="mb-4">
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {result.diceRoll}
            </div>
            <div className="text-sm text-gray-600">
              Jet: {result.diceRoll} / Cible: {result.targetNumber}+ (AG du
              joueur)
            </div>
            {result.modifiers !== 0 && (
              <div className="text-sm text-gray-500">
                Modificateurs: {result.modifiers > 0 ? "+" : ""}
                {result.modifiers}
              </div>
            )}
          </div>

          <div className="mb-4">
            <div
              className={`text-lg font-semibold ${
                result.success ? "text-green-600" : "text-red-600"
              }`}
            >
              {getSuccessMessage(result)}
            </div>
            {!result.success && (
              <div className="text-red-500 font-bold mt-2">
                {getFailureConsequence(result)}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {result.success ? "Continuer" : "Fin du tour"}
          </button>
        </div>
      </div>
    </div>
  );
}
