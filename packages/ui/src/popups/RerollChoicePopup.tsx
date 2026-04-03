import React from "react";

interface RerollChoicePopupProps {
  playerName: string;
  rollType: "dodge" | "pickup" | "gfi";
  teamRerollsLeft: number;
  onChoose: (useReroll: boolean) => void;
  onClose: () => void;
}

const rollTypeLabels: Record<RerollChoicePopupProps["rollType"], string> = {
  dodge: "Esquive",
  pickup: "Ramassage",
  gfi: "Going for it",
};

export default function RerollChoicePopup({
  playerName,
  rollType,
  teamRerollsLeft,
  onChoose,
  onClose,
}: RerollChoicePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Relance disponible</h3>
          <div className="text-sm text-gray-600 mb-2">
            {playerName} a raté son jet de {rollTypeLabels[rollType]}
          </div>
          <div className="text-sm text-gray-500 mb-6">
            Relances restantes : {teamRerollsLeft}
          </div>

          <div className="flex gap-4 justify-center mb-6">
            <button
              onClick={() => onChoose(true)}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex flex-col items-center min-w-[140px]"
            >
              <div className="text-lg mb-1">🎲</div>
              <div className="text-sm font-semibold">Utiliser la relance</div>
            </button>

            <button
              onClick={() => onChoose(false)}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex flex-col items-center min-w-[140px]"
            >
              <div className="text-lg mb-1">✗</div>
              <div className="text-sm font-semibold">Refuser</div>
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            Une seule relance par tour est autorisée
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
