import React from 'react';

type BlockResult = "PLAYER_DOWN" | "BOTH_DOWN" | "PUSH_BACK" | "STUMBLE" | "POW";

interface BlockDiceIconProps {
  result: BlockResult;
  size?: number;
  className?: string;
}

export default function BlockDiceIcon({ result, size = 24, className = "" }: BlockDiceIconProps) {
  // Mapping des résultats vers les noms de fichiers d'images
  const getImagePath = (result: BlockResult): string => {
    switch (result) {
      case 'PLAYER_DOWN':
        return '/images/blocking_dice/player_down.png';
      case 'BOTH_DOWN':
        return '/images/blocking_dice/both_down.png';
      case 'PUSH_BACK':
        return '/images/blocking_dice/push_back.png';
      case 'STUMBLE':
        return '/images/blocking_dice/stumble.png';
      case 'POW':
        return '/images/blocking_dice/pow.png';
      default:
        return '/images/blocking_dice/player_down.png';
    }
  };

  // Mapping des résultats vers des descriptions en français
  const getDescription = (result: BlockResult): string => {
    switch (result) {
      case 'PLAYER_DOWN':
        return 'Player Down! - L\'attaquant est mis au sol';
      case 'BOTH_DOWN':
        return 'Both Down - Les deux joueurs sont mis au sol';
      case 'PUSH_BACK':
        return 'Push Back - La cible est repoussée d\'1 case';
      case 'STUMBLE':
        return 'Stumble - Si la cible utilise Dodge, cela devient Push ; sinon, c\'est POW!';
      case 'POW':
        return 'POW! - La cible est repoussée puis mise au sol';
      default:
        return 'Résultat de blocage';
    }
  };

  return (
    <img 
      src={getImagePath(result)} 
      alt={getDescription(result)}
      title={getDescription(result)}
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={`inline-block ${className}`}
    />
  );
}
