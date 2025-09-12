import React from 'react';
import BlockDiceIcon from '../components/BlockDiceIcon';

type BlockResult = "PLAYER_DOWN" | "BOTH_DOWN" | "PUSH_BACK" | "STUMBLE" | "POW";

interface BlockChoicePopupProps {
  attackerName: string;
  defenderName: string;
  chooser: 'attacker' | 'defender';
  options: BlockResult[];
  onChoose: (result: BlockResult) => void;
  onClose: () => void;
}

export default function BlockChoicePopup({ attackerName, defenderName, chooser, options, onChoose, onClose }: BlockChoicePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Choix du dé de blocage</h3>
          <div className="text-sm text-gray-600 mb-4">
            {chooser === 'attacker' ? `${attackerName} choisit` : `${defenderName} choisit`}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onChoose(opt)}
                className="px-3 py-3 border rounded-lg hover:bg-gray-50 flex items-center justify-center"
                title={opt}
              >
                <BlockDiceIcon result={opt} size={48} />
              </button>
            ))}
          </div>

          <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded">Annuler</button>
        </div>
      </div>
    </div>
  );
}



