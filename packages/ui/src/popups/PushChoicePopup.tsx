import React from 'react';

interface PushChoicePopupProps {
  attackerName: string;
  targetName: string;
  availableDirections: Array<{ x: number; y: number }>;
  onChoose: (direction: { x: number; y: number }) => void;
  onClose: () => void;
}

export default function PushChoicePopup({ 
  attackerName, 
  targetName, 
  availableDirections, 
  onChoose, 
  onClose 
}: PushChoicePopupProps) {
  // Mapping des directions vers des descriptions et des flèches
  const getDirectionInfo = (dir: { x: number; y: number }) => {
    if (dir.x === 0 && dir.y === -1) return { label: 'Nord', arrow: '↑' };
    if (dir.x === 0 && dir.y === 1) return { label: 'Sud', arrow: '↓' };
    if (dir.x === -1 && dir.y === 0) return { label: 'Ouest', arrow: '←' };
    if (dir.x === 1 && dir.y === 0) return { label: 'Est', arrow: '→' };
    if (dir.x === -1 && dir.y === -1) return { label: 'Nord-Ouest', arrow: '↖' };
    if (dir.x === 1 && dir.y === -1) return { label: 'Nord-Est', arrow: '↗' };
    if (dir.x === -1 && dir.y === 1) return { label: 'Sud-Ouest', arrow: '↙' };
    if (dir.x === 1 && dir.y === 1) return { label: 'Sud-Est', arrow: '↘' };
    return { label: `(${dir.x}, ${dir.y})`, arrow: '?' };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Choix de direction de poussée</h3>
          <div className="text-sm text-gray-600 mb-4">
            {attackerName} doit choisir dans quelle direction pousser {targetName}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {availableDirections.map((direction, idx) => {
              const { label, arrow } = getDirectionInfo(direction);
              return (
                <button
                  key={idx}
                  onClick={() => onChoose(direction)}
                  className="px-4 py-3 border rounded-lg hover:bg-gray-50 flex flex-col items-center justify-center min-h-[60px]"
                  title={`Pousser vers ${label}`}
                >
                  <div className="text-2xl mb-1">{arrow}</div>
                  <div className="text-xs text-gray-600">{label}</div>
                </button>
              );
            })}
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
