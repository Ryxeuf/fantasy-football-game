'use client';
import * as React from "react";
import { Stage, Container, Graphics } from "@pixi/react";
import type { Graphics as PixiGraphics } from "@pixi/graphics";
import type { GameState, Position } from "@bb/game-engine";

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  cellSize?: number;
  legalMoves?: Position[];
  selectedPlayerId?: string | null;
};

export default function PixiBoard({
  state,
  onCellClick,
  cellSize = 28,
  legalMoves = [],
  selectedPlayerId,
}: Props) {
  // Orientation verticale : largeur devient hauteur et vice versa
  const width = state.height * cellSize;  // 15 * cellSize = 420
  const height = state.width * cellSize;  // 26 * cellSize = 728

  console.log('Terrain dimensions:', { 
    stateWidth: state.width, 
    stateHeight: state.height, 
    cellSize, 
    width, 
    height 
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Canvas Pixi.js */}
      <Stage width={width} height={height} options={{ backgroundColor: 0x6B8E23 }}>
        <Container>
          {/* Fond vert kaki du terrain principal */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.beginFill(0x6B8E23); // Vert kaki pour tout le terrain
              g.drawRect(0, 0, width, height);
              g.endFill();
            }}
          />
          
          {/* Zone de TOUCHDOWN en haut (rouge et blanc clair) - 1 case de hauteur */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              
              // Motif en damier rouge et blanc clair
              const tdHeight = cellSize; // 1 case de hauteur
              const squareSize = cellSize / 2;
              const tdWidth = width; // Largeur complète du terrain
              
              for (let x = 0; x < tdWidth; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isRed = ((x / squareSize) + (y / squareSize)) % 2 === 0;
                  g.beginFill(isRed ? 0xFF0000 : 0xF5F5F5); // Rouge et blanc clair
                  g.drawRect(x, y, squareSize, squareSize);
                  g.endFill();
                }
              }
              
              // Bordure noire
              g.lineStyle(2, 0x000000, 1);
              g.drawRect(0, 0, tdWidth, tdHeight);
            }}
          />
          
          {/* Zone de TOUCHDOWN en bas (rouge et blanc clair) - 1 case de hauteur */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              
              // Motif en damier rouge et blanc clair
              const tdHeight = cellSize; // 1 case de hauteur
              const squareSize = cellSize / 2;
              const startY = height - tdHeight;
              const tdWidth = width; // Largeur complète du terrain
              
              for (let x = 0; x < tdWidth; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isRed = ((x / squareSize) + (y / squareSize)) % 2 === 0;
                  g.beginFill(isRed ? 0xFF0000 : 0xF5F5F5); // Rouge et blanc clair
                  g.drawRect(x, startY + y, squareSize, squareSize);
                  g.endFill();
                }
              }
              
              // Bordure noire
              g.lineStyle(2, 0x000000, 1);
              g.drawRect(0, startY, tdWidth, tdHeight);
            }}
          />
          
          {/* Couloir latéral gauche (4 cases de large) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              // g.beginFill(0x6B8E23, 0.9); // Vert kaki pour les couloirs (même couleur que le terrain)
              // g.drawRect(0, 0, cellSize * 4, height);
              // g.endFill();
              
              // Bordure blanche
              g.lineStyle(3, 0xFFFFFF, 1);
              g.drawRect(0, 0, cellSize * 4, height);
            }}
          />
          
          {/* Couloir latéral droit (4 cases de large) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              const rightX = width - (cellSize * 4);
              // g.beginFill(0x6B8E23, 0.9); // Vert kaki pour les couloirs (même couleur que le terrain)
              // g.drawRect(rightX, 0, cellSize * 4, height);
              // g.endFill();
              
              // Bordure blanche
              g.lineStyle(3, 0xFFFFFF, 1);
              g.drawRect(rightX, 0, cellSize * 4, height);
            }}
          />
          
          {/* Ligne centrale (Line of Scrimmage) - jaune */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(4, 0xFFFF00, 1); // Jaune, épaisseur 4
              
              // Ligne centrale au milieu (y = 13, car 26/2 = 13)
              const centerY = 13 * cellSize;
              g.moveTo(0, centerY);
              g.lineTo(width, centerY);
            }}
          />
          
          {/* Grille de cellules (plus subtile) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(1, 0xCCCCCC, 0.3); // Gris clair, très transparent
              
              // Lignes verticales
              for (let x = 0; x <= state.height; x++) {
                const xPos = x * cellSize;
                g.moveTo(xPos, 0);
                g.lineTo(xPos, height);
              }
              
              // Lignes horizontales
              for (let y = 0; y <= state.width; y++) {
                const yPos = y * cellSize;
                g.moveTo(0, yPos);
                g.lineTo(width, yPos);
              }
            }}
          />
          
          {/* Mouvements légaux (cases surbrillées) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(2, 0x00FF00, 1); // Vert, épaisseur 2
              g.beginFill(0x00FF00, 0.3); // Vert transparent
              
              legalMoves.forEach(move => {
                if (move.type === 'MOVE' && move.to) {
                  // Orientation verticale : inverser x et y
                  const x = move.to.y * cellSize;
                  const y = move.to.x * cellSize;
                  g.drawRect(x, y, cellSize, cellSize);
                }
              });
              
              g.endFill();
            }}
          />
          
          {/* Joueurs */}
          {state.players.map(player => {
            const isSelected = player.id === selectedPlayerId;
            const isCurrentTeam = player.team === state.currentPlayer;
            
            return (
              <Graphics
                key={player.id}
                draw={(g: PixiGraphics) => {
                  g.clear();
                  
                  // Position (orientation verticale : inverser x et y)
                  const x = player.pos.y * cellSize + cellSize / 2;
                  const y = player.pos.x * cellSize + cellSize / 2;
                  const radius = cellSize / 2 - 2;
                  
                  // Cercle du joueur
                  g.beginFill(player.team === 'A' ? 0xFF0000 : 0x0000FF); // Rouge pour équipe A, Bleu pour équipe B
                  g.drawCircle(x, y, radius);
                  g.endFill();
                  
                  // Bordure
                  g.lineStyle(3, isSelected ? 0xFFFF00 : 0xFFFFFF, 1); // Jaune si sélectionné, blanc sinon
                  g.drawCircle(x, y, radius);
                  
                  // Indicateur de tour actuel
                  if (isCurrentTeam) {
                    g.lineStyle(2, 0x00FF00, 1); // Vert pour le tour actuel
                    g.drawCircle(x, y, radius + 3);
                  }
                }}
              />
            );
          })}
          
          {/* Balle */}
          {state.ball && (
            <Graphics
              draw={(g: PixiGraphics) => {
                g.clear();
                
                // Position (orientation verticale : inverser x et y)
                const x = state.ball!.y * cellSize + cellSize / 2;
                const y = state.ball!.x * cellSize + cellSize / 2;
                const radius = cellSize / 3;
                
                // Cercle de la balle
                g.beginFill(0x8B4513); // Marron
                g.drawCircle(x, y, radius);
                g.endFill();
                
                // Bordure blanche
                g.lineStyle(2, 0xFFFFFF, 1);
                g.drawCircle(x, y, radius);
                
                // Lignes de la balle
                g.lineStyle(1, 0xFFFFFF, 1);
                g.moveTo(x - radius, y);
                g.lineTo(x + radius, y);
                g.moveTo(x, y - radius);
                g.lineTo(x, y + radius);
              }}
            />
          )}
        </Container>
      </Stage>
      
      {/* Boîte de debug */}
      <div style={{ 
        border: "2px solid #333", 
        padding: "15px", 
        backgroundColor: "#f5f5f5",
        borderRadius: "8px"
      }}>
        <h3>Debug Info:</h3>
        <p><strong>Pixi.js Status:</strong> ✅ Actif</p>
        <p><strong>Dimensions:</strong> {width} x {height} pixels</p>
        <p><strong>Grille:</strong> {state.width} x {state.height} cases</p>
        <p><strong>Taille case:</strong> {cellSize} pixels</p>
        <p><strong>Joueurs:</strong> {state.players.length}</p>
        <p><strong>Balle:</strong> ({state.ball?.x}, {state.ball?.y})</p>
        <p><strong>Tour:</strong> {state.turn} - Joueur: {state.currentPlayer}</p>
        <p><strong>Mouvements légaux:</strong> {legalMoves.length}</p>
        <p><strong>Joueur sélectionné:</strong> {selectedPlayerId || 'Aucun'}</p>
      </div>
    </div>
  );
}

