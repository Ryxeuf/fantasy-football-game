"use client";
import * as React from "react";
import { Stage, Container, Graphics, Text } from "@pixi/react";
import type { Graphics as PixiGraphics } from "@pixi/graphics";
import type { GameState, Position, Player } from "@bb/game-engine";

/** Extract up to 2 initials from a player's name (e.g. "Grim Ironjaw" -> "GI") */
function getInitials(player: Player): string {
  if (!player.name) return String(player.number);
  const parts = player.name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Single word: take first 2 letters
  return player.name.slice(0, 2).toUpperCase();
}

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  onPlayerClick?: (playerId: string) => void;
  cellSize?: number;
  legalMoves?: Position[];
  blockTargets?: Position[];
  selectedPlayerId?: string | null;
  selectedForRepositioning?: string | null;
  ref?: React.RefObject<HTMLDivElement>;
  /** Called when the responsive cell size changes (for drop coordinate math) */
  onCellSizeChange?: (cellSize: number) => void;
};

export default function PixiBoard({
  state,
  onCellClick,
  onPlayerClick,
  cellSize = 28,
  legalMoves = [],
  blockTargets = [],
  selectedPlayerId,
  selectedForRepositioning,
  ref,
  onCellSizeChange,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [responsiveCellSize, setResponsiveCellSize] = React.useState(cellSize);

  // Orientation verticale : largeur devient hauteur et vice versa
  const safeWidth = typeof state.width === "number" && !isNaN(state.width) ? state.width : 26;
  const safeHeight = typeof state.height === "number" && !isNaN(state.height) ? state.height : 15;

  // Auto-scale to fit container width
  React.useEffect(() => {
    function updateSize() {
      const el = containerRef.current;
      if (!el) return;
      const containerWidth = el.clientWidth;
      if (containerWidth <= 0) return;
      // Board width = safeHeight * cellSize (15 cells wide)
      const maxCellSize = Math.floor(containerWidth / safeHeight);
      // Clamp between 18 (min usable) and the prop cellSize
      const newCellSize = Math.max(18, Math.min(maxCellSize, cellSize));
      setResponsiveCellSize(newCellSize);
      onCellSizeChange?.(newCellSize);
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [cellSize, safeHeight]);

  const cs = responsiveCellSize;
  const width = safeHeight * cs;
  const height = safeWidth * cs;

  const handleStageClick = (event: any) => {
    const nativeEvent = event.nativeEvent;
    if (!nativeEvent) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (nativeEvent.clientX ?? nativeEvent.touches?.[0]?.clientX) - rect.left;
    const y = (nativeEvent.clientY ?? nativeEvent.touches?.[0]?.clientY) - rect.top;

    const gridX = Math.floor(x / cs);
    const gridY = Math.floor(y / cs);

    if (gridX >= 0 && gridX < safeHeight && gridY >= 0 && gridY < safeWidth) {
      const position: Position = { x: gridY, y: gridX };

      const playerAtPosition = state.players?.find(
        (p) => p.pos.x === position.x && p.pos.y === position.y,
      );

      if (playerAtPosition && onPlayerClick) {
        onPlayerClick(playerAtPosition.id);
      } else if (onCellClick) {
        onCellClick(position);
      }
    }
  };

  return (
    <div
      ref={(el) => {
        // Merge both refs
        (containerRef as any).current = el;
        if (ref && typeof ref === "object") (ref as any).current = el;
      }}
      className="w-full max-w-[480px] mx-auto"
    >
      <Stage
        width={width}
        height={height}
        options={{ backgroundColor: 0x6b8e23 }}
        onPointerDown={handleStageClick}
      >
        <Container>
          {/* Fond vert kaki */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.beginFill(0x6b8e23);
              g.drawRect(0, 0, width, height);
              g.endFill();
            }}
          />

          {/* Zone de TOUCHDOWN en haut (equipe A) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              const tdHeight = cs;
              const squareSize = cs / 2;
              for (let x = 0; x < width; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isRed = (x / squareSize + y / squareSize) % 2 === 0;
                  g.beginFill(isRed ? 0xff0000 : 0xf5f5f5);
                  g.drawRect(x, y, squareSize, squareSize);
                  g.endFill();
                }
              }
              g.lineStyle(2, 0x000000, 1);
              g.drawRect(0, 0, width, tdHeight);
            }}
          />

          {/* Zone de TOUCHDOWN en bas (equipe B) */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              const tdHeight = cs;
              const squareSize = cs / 2;
              const startY = height - tdHeight;
              for (let x = 0; x < width; x += squareSize) {
                for (let y = 0; y < tdHeight; y += squareSize) {
                  const isBlue = (x / squareSize + y / squareSize) % 2 === 0;
                  g.beginFill(isBlue ? 0x0000ff : 0xf5f5f5);
                  g.drawRect(x, startY + y, squareSize, squareSize);
                  g.endFill();
                }
              }
              g.lineStyle(2, 0x000000, 1);
              g.drawRect(0, startY, width, tdHeight);
            }}
          />

          {/* Couloir lateral gauche */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(3, 0xffffff, 1);
              g.drawRect(0, 0, cs * 4, height);
            }}
          />

          {/* Couloir lateral droit */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(3, 0xffffff, 1);
              g.drawRect(width - cs * 4, 0, cs * 4, height);
            }}
          />

          {/* Ligne centrale */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(4, 0xffff00, 1);
              const centerY = 13 * cs;
              g.moveTo(0, centerY);
              g.lineTo(width, centerY);
            }}
          />

          {/* Grille */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(1, 0xcccccc, 0.3);
              for (let x = 0; x <= safeHeight; x++) {
                g.moveTo(x * cs, 0);
                g.lineTo(x * cs, height);
              }
              for (let y = 0; y <= safeWidth; y++) {
                g.moveTo(0, y * cs);
                g.lineTo(width, y * cs);
              }
            }}
          />

          {/* Mouvements legaux */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(2, 0x00ff00, 1);
              g.beginFill(0x00ff00, 0.3);
              legalMoves.forEach((move) => {
                g.drawRect(move.y * cs, move.x * cs, cs, cs);
              });
              g.endFill();
            }}
          />

          {/* Cibles de blocage */}
          <Graphics
            draw={(g: PixiGraphics) => {
              g.clear();
              g.lineStyle(2, 0xff0000, 1);
              g.beginFill(0xff0000, 0.25);
              blockTargets.forEach((pos) => {
                g.drawRect(pos.y * cs, pos.x * cs, cs, cs);
              });
              g.endFill();
            }}
          />

          {/* Joueurs */}
          {state.players?.map((player) => {
            const isSelected = player.id === selectedPlayerId;
            const isSelectedForRepositioning = player.id === selectedForRepositioning;
            const isCurrentTeam = player.team === state.currentPlayer;
            const initials = getInitials(player);

            return (
              <React.Fragment key={player.id}>
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();
                    const x = player.pos.y * cs + cs / 2;
                    const y = player.pos.x * cs + cs / 2;
                    const radius = cs / 2 - 2;

                    const playerColor = player.stunned
                      ? 0x808080
                      : player.team === "A"
                        ? 0xcc2222
                        : 0x2255cc;
                    g.beginFill(playerColor);
                    g.drawCircle(x, y, radius);
                    g.endFill();

                    if (isSelected) {
                      g.lineStyle(3, 0xffff00, 1);
                      g.drawCircle(x, y, radius + 2);
                      g.lineStyle(2, 0xffff00, 0.4);
                      g.drawCircle(x, y, radius + 6);
                    } else if (isSelectedForRepositioning) {
                      g.lineStyle(3, 0xff8800, 1);
                      g.drawCircle(x, y, radius + 2);
                      g.lineStyle(2, 0xff8800, 0.4);
                      g.drawCircle(x, y, radius + 6);
                    } else {
                      g.lineStyle(2, 0xffffff, 0.9);
                      g.drawCircle(x, y, radius);
                    }

                    if (isCurrentTeam && !isSelected) {
                      g.lineStyle(1, 0x00ff00, 0.7);
                      g.drawCircle(x, y, radius + 3);
                    }

                    if (player.hasBall) {
                      g.lineStyle(3, 0xffd700, 1);
                      g.drawCircle(x, y, radius + 5);
                      g.beginFill(0xffd700, 0.8);
                      g.drawCircle(x, y, 3);
                      g.endFill();
                    }
                  }}
                />

                {/* Initiales du joueur */}
                <Text
                  x={player.pos.y * cs + cs / 2}
                  y={player.pos.x * cs + cs / 2}
                  text={initials}
                  anchor={{ x: 0.5, y: 0.5 }}
                  style={
                    {
                      align: "center",
                      fill: player.stunned ? 0x333333 : 0xffffff,
                      fontFamily: "Arial",
                      fontSize: Math.max(9, cs * 0.32),
                      fontWeight: "bold",
                      stroke: player.stunned ? 0xcccccc : 0x000000,
                      strokeThickness: Math.max(1, cs * 0.06),
                      letterSpacing: 0,
                    } as any
                  }
                />

                {/* Badge PM (points de mouvement) */}
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();
                    const r = cs * 0.2;
                    const bx = player.pos.y * cs + cs - r;
                    const by = player.pos.x * cs + r;
                    g.beginFill(
                      player.stunned ? 0xeeeeee : 0x111111,
                      0.85,
                    );
                    g.drawCircle(bx, by, r);
                    g.endFill();
                  }}
                />
                <Text
                  x={player.pos.y * cs + cs - cs * 0.2}
                  y={player.pos.x * cs + cs * 0.2}
                  text={String(player.pm)}
                  anchor={{ x: 0.5, y: 0.5 }}
                  style={
                    {
                      fill: player.stunned ? 0x333333 : 0xffffff,
                      fontSize: Math.max(8, cs * 0.22),
                      fontFamily: "Arial",
                      fontWeight: "bold",
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
                const x = state.ball!.y * cs + cs / 2;
                const y = state.ball!.x * cs + cs / 2;
                const radius = cs / 3;

                g.beginFill(0x8b4513);
                g.drawCircle(x, y, radius);
                g.endFill();

                g.lineStyle(2, 0xffffff, 1);
                g.drawCircle(x, y, radius);

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
    </div>
  );
}
