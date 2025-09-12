import React from 'react';
import { 
  useDiceNotifications,
  setDiceNotificationCallback,
  setBlockDiceNotificationCallback,
  makeRNG,
  type DiceResult,
  type BlockResult
} from '@bb/game-engine';

export const DiceNotificationDemo: React.FC = () => {
  const { showDiceResult, showBlockDiceResult, showCustomDiceResult } = useDiceNotifications();
  const rng = makeRNG('demo-seed');

  // Configuration des callbacks pour le game-engine
  React.useEffect(() => {
    setDiceNotificationCallback((playerName: string, diceResult: DiceResult) => {
      showDiceResult(playerName, diceResult);
    });

    setBlockDiceNotificationCallback((playerName: string, blockResult: BlockResult) => {
      showBlockDiceResult(playerName, blockResult);
    });

    return () => {
      setDiceNotificationCallback(null);
      setBlockDiceNotificationCallback(null);
    };
  }, [showDiceResult, showBlockDiceResult]);

  const handleD6Roll = () => {
    const result = Math.floor(rng() * 6) + 1;
    showCustomDiceResult('Joueur Test', result, 0, false, 'D6');
  };

  const handle2D6Roll = () => {
    const die1 = Math.floor(rng() * 6) + 1;
    const die2 = Math.floor(rng() * 6) + 1;
    const result = die1 + die2;
    showCustomDiceResult('Joueur Test', result, 0, false, '2D6');
  };

  const handleDodgeRoll = () => {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = 4; // AG 4
    const success = diceRoll >= targetNumber;
    
    const diceResult: DiceResult = {
      type: 'dodge',
      diceRoll,
      targetNumber,
      success,
      modifiers: 0,
    };
    
    showDiceResult('Joueur Test', diceResult);
  };

  const handlePickupRoll = () => {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = 3; // AG 3
    const success = diceRoll >= targetNumber;
    
    const diceResult: DiceResult = {
      type: 'pickup',
      diceRoll,
      targetNumber,
      success,
      modifiers: 0,
    };
    
    showDiceResult('Joueur Test', diceResult);
  };

  const handleArmorRoll = () => {
    const diceRoll = Math.floor(rng() * 6) + 1;
    const targetNumber = 8; // AV 8
    const success = diceRoll >= targetNumber;
    
    const diceResult: DiceResult = {
      type: 'armor',
      diceRoll,
      targetNumber,
      success,
      modifiers: 0,
    };
    
    showDiceResult('Joueur Test', diceResult);
  };

  const handleBlockDiceRoll = () => {
    const roll = Math.floor(rng() * 6) + 1;
    let blockResult: BlockResult;
    
    switch (roll) {
      case 1:
        blockResult = 'PLAYER_DOWN';
        break;
      case 2:
        blockResult = 'BOTH_DOWN';
        break;
      case 3:
        blockResult = 'PUSH_BACK';
        break;
      case 4:
        blockResult = 'STUMBLE';
        break;
      case 5:
        blockResult = 'POW';
        break;
      case 6:
        blockResult = 'PUSH_BACK';
        break;
      default:
        blockResult = 'PUSH_BACK';
    }
    
    showBlockDiceResult('Joueur Test', blockResult);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Test des Notifications de Dés</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          onClick={handleD6Roll}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          D6
        </button>
        
        <button
          onClick={handle2D6Roll}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          2D6
        </button>
        
        <button
          onClick={handleDodgeRoll}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Esquive
        </button>
        
        <button
          onClick={handlePickupRoll}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
        >
          Ramassage
        </button>
        
        <button
          onClick={handleArmorRoll}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Armure
        </button>
        
        <button
          onClick={handleBlockDiceRoll}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
        >
          Blocage
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Cliquez sur les boutons pour tester les différents types de notifications de dés.</p>
        <p>Les notifications apparaîtront en haut à droite de l'écran.</p>
      </div>
    </div>
  );
};
