import React from 'react';

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
                <BlockFaceIcon result={opt} />
              </button>
            ))}
          </div>

          <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function BlockFaceIcon({ result }: { result: BlockResult }) {
  // Icônes SVG simplifiées inspirées des faces officielles
  const size = 56;
  const common = "rounded-md shadow-inner";
  switch (result) {
    case 'PLAYER_DOWN':
      return (
        <div className={`bg-white border-2 border-black ${common}`} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 64 64" width={40} height={40} aria-label="Skull">
            <circle cx="32" cy="28" r="16" fill="#000" />
            <circle cx="26" cy="26" r="3" fill="#fff" />
            <circle cx="38" cy="26" r="3" fill="#fff" />
            <rect x="26" y="34" width="12" height="4" rx="1" fill="#fff" />
          </svg>
        </div>
      );
    case 'BOTH_DOWN':
      return (
        <div className={`bg-white border-2 border-black ${common}`} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 64 64" width={40} height={40} aria-label="Both Down">
            <g fill="#000">
              <path d="M18 14 h12 v12 H18z" />
              <path d="M34 14 h12 v12 H34z" />
              <path d="M18 30 h12 v12 H18z" />
              <path d="M34 30 h12 v12 H34z" />
            </g>
          </svg>
        </div>
      );
    case 'PUSH_BACK':
      return (
        <div className={`bg-white border-2 border-black ${common}`} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 64 64" width={40} height={40} aria-label="Push">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#000" />
              </marker>
            </defs>
            <line x1="12" y1="32" x2="52" y2="32" stroke="#000" strokeWidth="6" markerEnd="url(#arrow)" />
          </svg>
        </div>
      );
    case 'STUMBLE':
      return (
        <div className={`bg-white border-2 border-black ${common}`} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 64 64" width={40} height={40} aria-label="Dodge/POW">
            <circle cx="22" cy="32" r="10" fill="#000" />
            <path d="M38 18 L46 46 L30 38 L52 28 Z" fill="#000" />
          </svg>
        </div>
      );
    case 'POW':
      return (
        <div className={`bg-white border-2 border-black ${common}`} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 64 64" width={40} height={40} aria-label="POW">
            <polygon points="32,6 38,22 56,24 42,34 46,52 32,42 18,52 22,34 8,24 26,22" fill="#000" />
          </svg>
        </div>
      );
  }
  return null;
}


