import React from 'react';

interface FollowUpChoicePopupProps {
  attackerName: string;
  targetName: string;
  targetNewPosition: { x: number; y: number };
  targetOldPosition: { x: number; y: number };
  onChoose: (followUp: boolean) => void;
  onClose: () => void;
}

export default function FollowUpChoicePopup({ 
  attackerName, 
  targetName, 
  targetNewPosition,
  targetOldPosition,
  onChoose, 
  onClose 
}: FollowUpChoicePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Choix de suivi (Follow-up)</h3>
          <div className="text-sm text-gray-600 mb-4">
            {attackerName} a repoussé {targetName} vers ({targetNewPosition.x}, {targetNewPosition.y})
          </div>
          <div className="text-sm text-gray-700 mb-6">
            Voulez-vous que {attackerName} suive {targetName} dans la case qu'il vient de quitter ?
          </div>

          <div className="flex gap-4 justify-center mb-6">
            <button
              onClick={() => onChoose(true)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex flex-col items-center min-w-[120px]"
            >
              <div className="text-lg mb-1">✓</div>
              <div className="text-sm">Suivre</div>
            </button>
            
            <button
              onClick={() => onChoose(false)}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 flex flex-col items-center min-w-[120px]"
            >
              <div className="text-lg mb-1">✗</div>
              <div className="text-sm">Ne pas suivre</div>
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            Le suivi est gratuit et ne consomme pas de points de mouvement
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
