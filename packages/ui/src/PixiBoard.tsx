"use client";
import * as React from "react";
import { Stage, Container, Graphics, Text } from "@pixi/react";
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
  const width = state.height * cellSize; // 15 * cellSize = 420
  const height = state.width * cellSize; // 26 * cellSize = 728

  console.log("Terrain dimensions:", {
    stateWidth: state.width,
    stateHeight: state.height,
    cellSize,
    width,
    height,
  });

  // Fonction pour gérer les clics sur le terrain
  const handleStageClick = (event: any) => {
    if (!onCellClick) return;

    // Dans Pixi.js avec React, l'événement a une structure différente
    // event.nativeEvent contient les informations de la souris
    const nativeEvent = event.nativeEvent;
    if (!nativeEvent) return;

    // Obtenir les coordonnées relatives au canvas
    const rect = event.currentTarget.getBoundingClientRect();
    const x = nativeEvent.clientX - rect.left;
    const y = nativeEvent.clientY - rect.top;

    // Convertir les coordonnées de la souris en position de grille
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    // Vérifier que la position est dans les limites du terrain
    if (
      gridX >= 0 &&
      gridX < state.height &&
      gridY >= 0 &&
      gridY < state.width
    ) {
      // Créer la position (orientation verticale : inverser x et y)
      const position: Position = {
        x: gridY, // Inverser x et y pour l'orientation verticale
        y: gridX,
      };

      console.log("Clic sur la cellule:", {
        gridX,
        gridY,
        position,
        clientX: nativeEvent.clientX,
        clientY: nativeEvent.clientY,
      });
      onCellClick(position);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Canvas Pixi.js */}
      <Stage
        width={width}
        height={height}
        options={{ backgroundColor: 0x6b8e23 }}
        onPointerDown={handleStageClick}
      >
        <Container>
          {/* Fond vert kaki du terrain principal */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.beginFill(0x6b8e23); // Vert kaki pour tout le terrain
              g.drawRect(0, 0, width, height);
              g.endFill();
            }}
          />

          {/* Zone de TOUCHDOWN en haut (équipe A - rouge et blanc) - 1 case de hauteur */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();

              // Motif en damier rouge et blanc clair pour l'équipe A
              const tdHeight = cellSize; // 1 case de hauteur
              const squareSize = cellSize / 2;
              const tdWidth = width; // Largeur complète du terrain

              for (let x = 0; x < tdWidth; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isRed = (x / squareSize + y / squareSize) % 2 === 0;
                  g.beginFill(isRed ? 0xff0000 : 0xf5f5f5); // Rouge et blanc clair pour l'équipe A
                  g.drawRect(x, y, squareSize, squareSize);
                  g.endFill();
                }
              }

              // Bordure noire
              g.lineStyle(2, 0x000000, 1);
              g.drawRect(0, 0, tdWidth, tdHeight);
            }}
          />

          {/* Zone de TOUCHDOWN en bas (équipe B - bleu et blanc) - 1 case de hauteur */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();

              // Motif en damier bleu et blanc clair pour l'équipe B
              const tdHeight = cellSize; // 1 case de hauteur
              const squareSize = cellSize / 2;
              const startY = height - tdHeight;
              const tdWidth = width; // Largeur complète du terrain

              for (let x = 0; x < tdWidth; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isBlue = (x / squareSize + y / squareSize) % 2 === 0;
                  g.beginFill(isBlue ? 0x0000ff : 0xf5f5f5); // Bleu et blanc clair pour l'équipe B
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
              g.lineStyle(3, 0xffffff, 1);
              g.drawRect(0, 0, cellSize * 4, height);
            }}
          />

          {/* Couloir latéral droit (4 cases de large) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              const rightX = width - cellSize * 4;
              // g.beginFill(0x6B8E23, 0.9); // Vert kaki pour les couloirs (même couleur que le terrain)
              // g.drawRect(rightX, 0, cellSize * 4, height);
              // g.endFill();

              // Bordure blanche
              g.lineStyle(3, 0xffffff, 1);
              g.drawRect(rightX, 0, cellSize * 4, height);
            }}
          />

          {/* Ligne centrale (Line of Scrimmage) - jaune */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(4, 0xffff00, 1); // Jaune, épaisseur 4

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
              g.lineStyle(1, 0xcccccc, 0.3); // Gris clair, très transparent

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
              g.lineStyle(2, 0x00ff00, 1); // Vert, épaisseur 2
              g.beginFill(0x00ff00, 0.3); // Vert transparent

              legalMoves.forEach((move) => {
                // legalMoves est déjà un tableau de Position[] (les positions 'to' des mouvements légaux)
                // Orientation verticale : inverser x et y
                const x = move.y * cellSize;
                const y = move.x * cellSize;
                g.drawRect(x, y, cellSize, cellSize);
              });

              g.endFill();
            }}
          />

          {/* Joueurs */}
          {state.players.map((player) => {
            const isSelected = player.id === selectedPlayerId;
            const isCurrentTeam = player.team === state.currentPlayer;

            return (
              <React.Fragment key={player.id}>
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();

                    // Position (orientation verticale : inverser x et y)
                    const x = player.pos.y * cellSize + cellSize / 2;
                    const y = player.pos.x * cellSize + cellSize / 2;
                    const radius = cellSize / 2 - 2;

                    // Cercle du joueur
                    // Joueurs sonnés en gris, sinon couleur d'équipe
                    const playerColor = player.stunned 
                      ? 0x808080 // Gris pour joueurs sonnés
                      : (player.team === "A" ? 0xff0000 : 0x0000ff); // Rouge pour équipe A, Bleu pour équipe B
                    g.beginFill(playerColor);
                    g.drawCircle(x, y, radius);
                    g.endFill();

                    // Bordure - améliorée pour la sélection
                    if (isSelected) {
                      // Bordure jaune épaisse pour le joueur sélectionné
                      g.lineStyle(4, 0xffff00, 1);
                      g.drawCircle(x, y, radius + 2);

                      // Halo de sélection
                      g.lineStyle(2, 0xffff00, 0.5);
                      g.drawCircle(x, y, radius + 8);
                    } else {
                      // Bordure blanche normale
                      g.lineStyle(3, 0xffffff, 1);
                      g.drawCircle(x, y, radius);
                    }

                    // Indicateur de tour actuel
                    if (isCurrentTeam) {
                      g.lineStyle(2, 0x00ff00, 1); // Vert pour le tour actuel
                      g.drawCircle(x, y, radius + 3);
                    }

                    // Indicateur de balle
                    if (player.hasBall) {
                      // Cercle doré pour indiquer que le joueur a la balle
                      g.lineStyle(3, 0xffd700, 1); // Or
                      g.drawCircle(x, y, radius + 5);
                      
                      // Petit cercle intérieur pour la balle
                      g.beginFill(0xffd700, 0.8);
                      g.drawCircle(x, y, 4);
                      g.endFill();
                    }
                  }}
                />

                {/* Numéro du joueur au centre */}
                <Text
                  x={player.pos.y * cellSize + cellSize / 2}
                  y={player.pos.x * cellSize + cellSize / 2}
                  text={player.id}
                  anchor={{ x: 0.5, y: 0.5 }}
                  style={
                    {
                      align: "center",
                      breakWords: false,
                      dropShadow: false,
                      dropShadowAlpha: 1,
                      dropShadowAngle: 0,
                      dropShadowBlur: 0,
                      dropShadowColor: 0x000000,
                      dropShadowDistance: 0,
                      fill: player.stunned ? 0x000000 : 0xffffff, // Noir sur gris, blanc sur couleur d'équipe
                      fontFamily: "Arial",
                      fontSize: Math.max(12, cellSize / 3),
                      fontStyle: "normal",
                      fontVariant: "normal",
                      fontWeight: "normal",
                      leading: 0,
                      letterSpacing: 0,
                      lineHeight: 0,
                      lineJoin: "miter",
                      miterLimit: 10,
                      padding: 0,
                      stroke: player.stunned ? 0xffffff : 0x000000, // Contour blanc sur gris, noir sur couleur d'équipe
                      strokeThickness: 2,
                      textBaseline: "alphabetic",
                      trim: false,
                      whiteSpace: "pre",
                      wordWrap: false,
                      wordWrapWidth: 0,
                      fillGradientType: 0,
                      fillGradientStops: [],
                      styleID: 0,
                    } as any
                  }
                />

                {/* Badge des points de mouvement */}
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();
                    const r = cellSize / 4;
                    const bx = player.pos.y * cellSize + cellSize - r;
                    const by = player.pos.x * cellSize + r;
                    // Badge plus visible pour joueurs sonnés
                    g.beginFill(player.stunned ? 0xffffff : 0x000000, player.stunned ? 0.9 : 0.7);
                    g.drawCircle(bx, by, r);
                    g.endFill();
                  }}
                />
                <Text
                  x={player.pos.y * cellSize + cellSize - cellSize / 4}
                  y={player.pos.x * cellSize + cellSize / 4}
                  text={String(player.pm)}
                  anchor={{ x: 0.5, y: 0.5 }}
                  style={
                    {
                      fill: player.stunned ? 0x000000 : 0xffffff, // Noir sur fond blanc, blanc sur fond noir
                      fontSize: Math.max(10, cellSize / 4),
                      fontFamily: "Arial",
                    } as any
                  }
                />
              </React.Fragment>
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
                g.beginFill(0x8b4513); // Marron
                g.drawCircle(x, y, radius);
                g.endFill();

                // Bordure blanche
                g.lineStyle(2, 0xffffff, 1);
                g.drawCircle(x, y, radius);

                // Lignes de la balle
                g.lineStyle(1, 0xffffff, 1);
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
      <div
        style={{
          border: "2px solid #333",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h3>Debug Info:</h3>
        <p>
          <strong>Pixi.js Status:</strong> ✅ Actif
        </p>
        <p>
          <strong>Dimensions:</strong> {width} x {height} pixels
        </p>
        <p>
          <strong>Grille:</strong> {state.width} x {state.height} cases
        </p>
        <p>
          <strong>Taille case:</strong> {cellSize} pixels
        </p>
        <p>
          <strong>Joueurs:</strong> {state.players.length}
        </p>
        <p>
          <strong>Balle:</strong> ({state.ball?.x}, {state.ball?.y})
        </p>
        <p>
          <strong>Tour:</strong> {state.turn} - Joueur: {state.currentPlayer}
        </p>
        <p>
          <strong>Mouvements légaux:</strong> {legalMoves.length}
        </p>
        <p>
          <strong>Joueur sélectionné:</strong> {selectedPlayerId || "Aucun"}
        </p>
        <p>
          <strong>Interactivité:</strong> ✅ Clics activés
        </p>
      </div>
    </div>
  );
}
