import React from "react";
import BlockDiceIcon from "./BlockDiceIcon";
import type { BlockResult } from "@bb/game-engine";

export default function DiceTestComponent() {
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
              {result === "PLAYER_DOWN" && "Player Down!"}
              {result === "BOTH_DOWN" && "Both Down"}
              {result === "PUSH_BACK" && "Push Back"}
              {result === "STUMBLE" && "Stumble"}
              {result === "POW" && "POW!"}
            </h3>
            <p className="text-xs text-gray-600">
              {result === "PLAYER_DOWN" && "L'attaquant est mis au sol"}
              {result === "BOTH_DOWN" && "Les deux joueurs sont mis au sol"}
              {result === "PUSH_BACK" && "La cible est repoussée d'1 case"}
              {result === "STUMBLE" &&
                "Si la cible utilise Dodge, cela devient Push ; sinon, c'est POW!"}
              {result === "POW" && "La cible est repoussée puis mise au sol"}
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
