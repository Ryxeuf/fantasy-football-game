import React from "react";

interface ActionPickerPopupProps {
  playerName: string;
  available: Array<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL">;
  onPick: (
    action: "MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL",
  ) => void;
  onClose: () => void;
}

export default function ActionPickerPopup({
  playerName,
  available,
  onPick,
  onClose,
}: ActionPickerPopupProps) {
  const actions = available;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-xl font-bold mb-2 text-center">Choisir l'action</h3>
        <div className="text-sm text-gray-600 text-center mb-4">
          {playerName}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {actions.map((a) => (
            <button
              key={a}
              onClick={() => onPick(a)}
              className="px-4 py-3 border rounded-lg hover:bg-gray-50 text-sm font-semibold"
            >
              {label(a)}
            </button>
          ))}
        </div>
        <div className="text-center">
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function label(a: ActionPickerPopupProps["available"][number]) {
  switch (a) {
    case "MOVE":
      return "Mouvement";
    case "BLOCK":
      return "Blocage";
    case "BLITZ":
      return "Blitz";
    case "PASS":
      return "Passe";
    case "HANDOFF":
      return "Transmission";
    case "FOUL":
      return "Faute";
  }
}
