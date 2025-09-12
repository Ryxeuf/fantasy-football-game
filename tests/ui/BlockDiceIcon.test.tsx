import React from 'react';
import { render, screen } from '@testing-library/react';
import BlockDiceIcon from '@bb/ui';

describe('BlockDiceIcon', () => {
  const testCases = [
    {
      result: 'PLAYER_DOWN' as const,
      expectedImage: '/images/blocking_dice/player_down.png',
      expectedAlt: 'Player Down! - L\'attaquant est mis au sol'
    },
    {
      result: 'BOTH_DOWN' as const,
      expectedImage: '/images/blocking_dice/both_down.png',
      expectedAlt: 'Both Down - Les deux joueurs sont mis au sol'
    },
    {
      result: 'PUSH_BACK' as const,
      expectedImage: '/images/blocking_dice/push_back.png',
      expectedAlt: 'Push Back - La cible est repoussée d\'1 case'
    },
    {
      result: 'STUMBLE' as const,
      expectedImage: '/images/blocking_dice/stumble.png',
      expectedAlt: 'Stumble - Si la cible utilise Dodge, cela devient Push ; sinon, c\'est POW!'
    },
    {
      result: 'POW' as const,
      expectedImage: '/images/blocking_dice/pow.png',
      expectedAlt: 'POW! - La cible est repoussée puis mise au sol'
    }
  ];

  testCases.forEach(({ result, expectedImage, expectedAlt }) => {
    it(`devrait afficher la bonne image pour ${result}`, () => {
      render(<BlockDiceIcon result={result} />);
      
      const img = screen.getByAltText(expectedAlt);
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expectedImage);
      expect(img).toHaveAttribute('title', expectedAlt);
    });
  });

  it('devrait utiliser la taille par défaut de 24px', () => {
    render(<BlockDiceIcon result="PUSH_BACK" />);
    
    const img = screen.getByAltText('Push Back - La cible est repoussée d\'1 case');
    expect(img).toHaveStyle({ width: '24px', height: '24px' });
  });

  it('devrait utiliser une taille personnalisée', () => {
    render(<BlockDiceIcon result="PUSH_BACK" size={48} />);
    
    const img = screen.getByAltText('Push Back - La cible est repoussée d\'1 case');
    expect(img).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('devrait appliquer les classes CSS personnalisées', () => {
    render(<BlockDiceIcon result="PUSH_BACK" className="custom-class" />);
    
    const img = screen.getByAltText('Push Back - La cible est repoussée d\'1 case');
    expect(img).toHaveClass('inline-block', 'custom-class');
  });

  it('devrait avoir les bonnes propriétés de style', () => {
    render(<BlockDiceIcon result="PUSH_BACK" />);
    
    const img = screen.getByAltText('Push Back - La cible est repoussée d\'1 case');
    expect(img).toHaveStyle({ 
      objectFit: 'contain'
    });
  });
});
