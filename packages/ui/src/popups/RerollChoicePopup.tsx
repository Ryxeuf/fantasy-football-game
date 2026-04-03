import React from "react";

interface RerollChoicePopupProps {
  rollType: "dodge" | "pickup" | "gfi";
  playerName: string;
  teamRerollsLeft: number;
  onChoose: (useReroll: boolean) => void;
}

const rollTypeLabels: Record<string, string> = {
  dodge: "Esquive",
  pickup: "Ramassage",
  gfi: "Going For It",
};

export default function RerollChoicePopup({
  rollType,
  playerName,
  teamRerollsLeft,
  onChoose,
}: RerollChoicePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Relance disponible !</h3>
          <div className="text-sm text-gray-600 mb-2">
            {playerName} a raté son jet de{" "}
            <span className="font-semibold">{rollTypeLabels[rollType] || rollType}</span>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            Relances restantes : {teamRerollsLeft}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onChoose(true)}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold"
            >
              Relancer
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
