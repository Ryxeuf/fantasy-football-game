import React from "react";

interface ApothecaryChoicePopupProps {
  playerName: string;
  injuryType: "ko" | "casualty";
  casualtyOutcome?: string;
  onChoose: (useApothecary: boolean) => void;
}

const casualtyLabels: Record<string, string> = {
  badly_hurt: "Gravement blessé",
  seriously_hurt: "Sérieusement blessé",
  serious_injury: "Blessure sérieuse",
  lasting_injury: "Blessure permanente",
  dead: "Mort",
};

export default function ApothecaryChoicePopup({
  playerName,
  injuryType,
  casualtyOutcome,
  onChoose,
}: ApothecaryChoicePopupProps) {
  const injuryLabel =
    injuryType === "ko"
      ? "KO"
      : casualtyLabels[casualtyOutcome ?? ""] ?? casualtyOutcome ?? "Casualty";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Apothicaire disponible !</h3>
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-semibold">{playerName}</span> est{" "}
            <span className="font-semibold text-red-600">{injuryLabel}</span>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            {injuryType === "ko"
              ? "L'apothicaire peut remettre le joueur en réserves."
              : "L'apothicaire peut relancer le résultat de blessure et garder le meilleur."}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onChoose(true)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
            >
              Utiliser l&apos;apothicaire
            </button>
            <button
              onClick={() => onChoose(false)}
              className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Refuser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
