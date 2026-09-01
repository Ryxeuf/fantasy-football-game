import React from "react";
import BlockDiceIcon from "./BlockDiceIcon";
import { BLOCK_DIE_FACE_INFO, type BlockResult } from "@bb/game-engine";

export default function DiceTestComponent() {
  // Les cinq icones du de, dans l'ordre du livre.
  const diceResults: BlockResult[] = [
    "PLAYER_DOWN",
    "BOTH_DOWN",
    "PUSH_BACK",
    "STUMBLE",
    "POW",
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">
        Test des images de dés de blocage
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {diceResults.map((result, index) => (
          <div
            key={index}
            className="text-center p-4 border border-gray-300 rounded-lg bg-gray-50"
          >
            <div className="mb-2">
              <BlockDiceIcon result={result} size={64} className="mx-auto" />
            </div>
            <h3 className="font-semibold text-sm mb-1">
              {BLOCK_DIE_FACE_INFO[result].nameFr}
            </h3>
            <p className="text-[11px] text-gray-500 mb-1">
              {BLOCK_DIE_FACE_INFO[result].faces === 1
                ? "1 face"
                : `${BLOCK_DIE_FACE_INFO[result].faces} faces`}
            </p>
            <p className="text-xs text-gray-600">
              {BLOCK_DIE_FACE_INFO[result].effectFr}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">
          Instructions de test :
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Vérifiez que toutes les images s'affichent correctement</li>
          <li>• Testez le survol pour voir les descriptions</li>
          <li>
            • Lancez une action de blocage dans le jeu pour voir les images en
            action
          </li>
          <li>• Vérifiez que les images apparaissent dans le log de jeu</li>
        </ul>
      </div>
    </div>
  );
}
