"use client";
import * as React from "react";
import { Stage, Container, Graphics, Text } from "@pixi/react";
import type { Graphics as PixiGraphics } from "@pixi/graphics";
import type { GameState, Position, Player, TackleZoneHeatmap, ReachableCell, PassRangeBand } from "@bb/game-engine";
import { resolveTeamFillColor, type TeamRostersMap, type TeamColorOverridesMap } from "./team-color-resolver";
import { useAnimatedPositions } from "./useAnimatedPositions";
import { useBlockEffects } from "./useBlockEffects";
import { useTouchdownEffects } from "./useTouchdownEffects";
import { useInjuryEffects } from "./useInjuryEffects";
import { useDiceEffects } from "./useDiceEffects";

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

/* ── Viewport constants ─────────────────────────────────────────────── */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_SPEED = 0.1; // scale delta per wheel tick

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
  /** Tackle zone heatmap data */
  tackleZoneHeatmap?: TackleZoneHeatmap;
  /** Whether to show the tackle zone overlay */
  showTackleZones?: boolean;
  /** Reachable cells for the selected player (movement range) */
  reachableCells?: ReachableCell[];
  /** Whether to show the movement range overlay */
  showReachability?: boolean;
  /** Pass range bands for the ball carrier */
  passRangeBands?: PassRangeBand[];
  /** Whether to show the pass range overlay */
  showPassRange?: boolean;
  /**
   * H.6 — optional per-team roster slugs used to look up team-specific
   * colors (and, in a later sub-task, sprite sheets). When omitted, players
   * fall back to the legacy red/blue team A/B palette.
   */
  teamRosters?: TeamRostersMap;
  /** H.6 — optional explicit color override per team (bypasses rosterSlug lookup). */
  teamColorOverrides?: TeamColorOverridesMap;
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
  tackleZoneHeatmap,
  showTackleZones = false,
  reachableCells = [],
  showReachability = false,
  passRangeBands = [],
  showPassRange = false,
  teamRosters,
  teamColorOverrides,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [responsiveCellSize, setResponsiveCellSize] = React.useState(cellSize);

  /* ── Viewport state (zoom + pan) ──────────────────────────────────── */
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const isPanningRef = React.useRef(false);
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const offsetStartRef = React.useRef({ x: 0, y: 0 });
  const spaceHeldRef = React.useRef(false);

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

  /* ── Animation tweens ────────────────────────────────────────────── */
  const anim = useAnimatedPositions(state.players ?? [], state.ball);
  const blockFx = useBlockEffects(state.players ?? []);
  const tdFx = useTouchdownEffects(state.gameLog ?? [], safeWidth, safeHeight);
  const injuryFx = useInjuryEffects(state.players ?? [], state.casualtyResults ?? {});
  const diceFx = useDiceEffects(state.gameLog ?? []);

  /* ── Zoom: mouse wheel ────────────────────────────────────────────── */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      // Cursor position relative to the stage (pixel coords)
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      setScale((prev: number) => {
        const direction = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + direction * ZOOM_SPEED));
        // Adjust offset so the point under the cursor stays fixed
        const ratio = next / prev;
        setOffset((o: { x: number; y: number }) => ({
          x: cursorX - ratio * (cursorX - o.x),
          y: cursorY - ratio * (cursorY - o.y),
        }));
        return next;
      });
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  /* ── Pan: Space+drag or middle-click drag ─────────────────────────── */
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        spaceHeldRef.current = true;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        // End any pan in progress
        isPanningRef.current = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Middle-click (button 1) or Space+left-click to start panning
      const isMiddle = e.button === 1;
      const isSpaceLeft = spaceHeldRef.current && e.button === 0;
      if (isMiddle || isSpaceLeft) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        offsetStartRef.current = { ...offset };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [offset],
  );

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  }, []);

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, []);

  /* ── Reset viewport ───────────────────────────────────────────────── */
  const handleResetViewport = React.useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const isDefaultViewport = scale === 1 && offset.x === 0 && offset.y === 0;

  /* ── Stage click → grid coordinate conversion (accounts for zoom/pan) */
  const handleStageClick = (event: any) => {
    // Ignore clicks while panning
    if (isPanningRef.current || spaceHeldRef.current) return;

    const nativeEvent = event.nativeEvent;
    if (!nativeEvent) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pixelX = (nativeEvent.clientX ?? nativeEvent.touches?.[0]?.clientX) - rect.left;
    const pixelY = (nativeEvent.clientY ?? nativeEvent.touches?.[0]?.clientY) - rect.top;

    // Convert from screen-space to board-space (account for zoom + pan offset)
    const boardX = (pixelX - offset.x) / scale;
    const boardY = (pixelY - offset.y) / scale;

    const gridX = Math.floor(boardX / cs);
    const gridY = Math.floor(boardY / cs);

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
      ref={(el: HTMLDivElement | null) => {
        // Merge both refs
        (containerRef as any).current = el;
        if (ref && typeof ref === "object") (ref as any).current = el;
      }}
      className="w-full max-w-[480px] mx-auto relative"
      style={{ cursor: spaceHeldRef.current || isPanningRef.current ? "grab" : undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
    >
      <Stage
        width={width}
        height={height}
        options={{ backgroundColor: 0x6b8e23 }}
        onPointerDown={handleStageClick}
      >
        <Container scale={scale} x={offset.x} y={offset.y}>
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

          {/* Tackle zone heatmap overlay */}
          {showTackleZones && tackleZoneHeatmap && (
            <Graphics
              draw={(g: PixiGraphics) => {
                g.clear();
                const hm = tackleZoneHeatmap;
                for (let x = 0; x < hm.width; x++) {
                  for (let y = 0; y < hm.height; y++) {
                    const cell = hm.cells[x][y];
                    if (cell.teamA === 0 && cell.teamB === 0) continue;

                    let color: number;
                    let intensity: number;
                    if (cell.contested) {
                      // Purple for contested zones
                      color = 0x9933ff;
                      intensity = Math.max(cell.teamA, cell.teamB);
                    } else if (cell.teamA > 0) {
                      // Red for team A
                      color = 0xff3333;
                      intensity = cell.teamA;
                    } else {
                      // Blue for team B
                      color = 0x3366ff;
                      intensity = cell.teamB;
                    }

                    const alpha = Math.min(0.7, intensity * 0.15);
                    g.beginFill(color, alpha);
                    g.drawRect(y * cs, x * cs, cs, cs);
                    g.endFill();
                  }
                }
              }}
            />
          )}

          {/* Movement range overlay (reachability) */}
          {showReachability && reachableCells.length > 0 && (
            <Graphics
              draw={(g: PixiGraphics) => {
                g.clear();
                // Find max cost to normalize alpha
                let maxCost = 1;
                for (const cell of reachableCells) {
                  if (cell.cost > maxCost) maxCost = cell.cost;
                }
                for (const cell of reachableCells) {
                  // Cyan for normal, yellow for GFI cells
                  const color = cell.needsGfi ? 0xffaa00 : 0x00ccff;
                  // Alpha fades with distance (closer = brighter)
                  const alpha = 0.15 + 0.25 * (1 - cell.cost / (maxCost + 1));
                  g.beginFill(color, alpha);
                  g.drawRect(cell.pos.y * cs, cell.pos.x * cs, cs, cs);
                  g.endFill();
                }
              }}
            />
          )}

          {/* Pass range bands overlay */}
          {showPassRange && passRangeBands.length > 0 && (
            <Graphics
              draw={(g: PixiGraphics) => {
                g.clear();
                const bandColors: Record<string, { color: number; alpha: number }> = {
                  quick: { color: 0x00cc44, alpha: 0.18 },
                  short: { color: 0xffcc00, alpha: 0.14 },
                  long: { color: 0xff6600, alpha: 0.12 },
                  bomb: { color: 0xff2222, alpha: 0.10 },
                };
                for (const band of passRangeBands) {
                  const style = bandColors[band.range];
                  if (!style) continue;
                  g.beginFill(style.color, style.alpha);
                  for (const pos of band.positions) {
                    g.drawRect(pos.y * cs, pos.x * cs, cs, cs);
                  }
                  g.endFill();
                  // Draw subtle border lines between bands
                  g.lineStyle(1, style.color, style.alpha * 1.5);
                  for (const pos of band.positions) {
                    g.drawRect(pos.y * cs, pos.x * cs, cs, cs);
                  }
                }
              }}
            />
          )}

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
            // Use animated position if available, else actual position
            const animPos = anim.players[player.id];
            const posX = animPos ? animPos.x : player.pos.x;
            const posY = animPos ? animPos.y : player.pos.y;

            // Block effect overlay (shake + flash)
            const fx = blockFx.overlays[player.id];
            const shakeX = fx ? fx.shakeX : 0;
            const shakeY = fx ? fx.shakeY : 0;

            return (
              <React.Fragment key={player.id}>
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();
                    const x = posY * cs + cs / 2 + shakeX;
                    const y = posX * cs + cs / 2 + shakeY;
                    const radius = cs / 2 - 2;

                    const playerColor = resolveTeamFillColor(
                      player,
                      teamRosters,
                      teamColorOverrides,
                    );
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

                    // Block impact flash ring
                    if (fx && fx.flashAlpha > 0) {
                      g.lineStyle(3, fx.flashColor, fx.flashAlpha);
                      g.drawCircle(x, y, radius + 4);
                      g.beginFill(fx.flashColor, fx.flashAlpha * 0.3);
                      g.drawCircle(x, y, radius);
                      g.endFill();
                    }
                  }}
                />

                {/* Initiales du joueur */}
                <Text
                  x={posY * cs + cs / 2 + shakeX}
                  y={posX * cs + cs / 2 + shakeY}
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
                    const bx = posY * cs + cs - r + shakeX;
                    const by = posX * cs + r + shakeY;
                    g.beginFill(
                      player.stunned ? 0xeeeeee : 0x111111,
                      0.85,
                    );
                    g.drawCircle(bx, by, r);
                    g.endFill();
                  }}
                />
                <Text
                  x={posY * cs + cs - cs * 0.2 + shakeX}
                  y={posX * cs + cs * 0.2 + shakeY}
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
                const ballPos = anim.ball ?? state.ball!;
                const x = ballPos.y * cs + cs / 2;
                const y = ballPos.x * cs + cs / 2;
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

          {/* Touchdown flash + particles */}
          {tdFx.overlay && (
            <>
              {/* Endzone flash overlay */}
              <Graphics
                draw={(g: PixiGraphics) => {
                  g.clear();
                  const alpha = tdFx.overlay!.flashAlpha;
                  if (alpha <= 0) return;
                  const flashColor = tdFx.overlay!.scoringTeam === "A" ? 0xffd700 : 0xffd700;
                  // Flash the scoring endzone
                  if (tdFx.overlay!.scoringTeam === "A") {
                    // Team A endzone is at the bottom (y = height - cs)
                    g.beginFill(flashColor, alpha);
                    g.drawRect(0, height - cs, width, cs);
                    g.endFill();
                  } else {
                    // Team B endzone is at the top (y = 0)
                    g.beginFill(flashColor, alpha);
                    g.drawRect(0, 0, width, cs);
                    g.endFill();
                  }
                  // Also flash the full board very subtly
                  g.beginFill(flashColor, alpha * 0.15);
                  g.drawRect(0, 0, width, height);
                  g.endFill();
                }}
              />
              {/* Particles */}
              <Graphics
                draw={(g: PixiGraphics) => {
                  g.clear();
                  for (const p of tdFx.overlay!.particles) {
                    if (p.alpha <= 0) continue;
                    const px = p.y * cs + cs / 2;
                    const py = p.x * cs + cs / 2;
                    g.beginFill(p.color, p.alpha);
                    g.drawCircle(px, py, p.size);
                    g.endFill();
                  }
                }}
              />
            </>
          )}

          {/* Injury icons (KO / casualty / dead) */}
          {injuryFx.icons.map((icon) => (
            <React.Fragment key={`injury-${icon.playerId}`}>
              {/* Icon background circle */}
              <Graphics
                draw={(g: PixiGraphics) => {
                  g.clear();
                  if (icon.alpha <= 0) return;
                  const x = icon.posY * cs + cs / 2;
                  const y = icon.posX * cs + cs / 2 + icon.offsetY * cs;
                  const radius = cs * 0.35;
                  g.beginFill(0x000000, icon.alpha * 0.6);
                  g.drawCircle(x, y, radius);
                  g.endFill();
                  g.lineStyle(2, icon.color, icon.alpha);
                  g.drawCircle(x, y, radius);
                }}
              />
              {/* Icon label text */}
              <Text
                x={icon.posY * cs + cs / 2}
                y={icon.posX * cs + cs / 2 + icon.offsetY * cs}
                text={icon.label}
                anchor={{ x: 0.5, y: 0.5 }}
                alpha={icon.alpha}
                style={
                  {
                    align: "center",
                    fill: icon.color,
                    fontFamily: "Arial",
                    fontSize: icon.iconType === "ko" ? Math.max(10, cs * 0.35) : Math.max(12, cs * 0.45),
                    fontWeight: "bold",
                    stroke: 0x000000,
                    strokeThickness: Math.max(2, cs * 0.08),
                  } as any
                }
              />
            </React.Fragment>
          ))}

          {/* Animated dice overlay */}
          {diceFx.dice.map((die, idx) => {
            if (die.alpha <= 0) return null;
            const dieSize = Math.max(28, cs * 1.4);
            const dieX = width / 2 - dieSize / 2 + idx * (dieSize + 8);
            const dieY = cs * 1.5;
            const cornerRadius = dieSize * 0.15;
            const pipRadius = dieSize * 0.08;
            const borderColor = die.success === true ? 0x00cc44 : die.success === false ? 0xff3333 : 0xffffff;

            return (
              <React.Fragment key={`dice-${idx}`}>
                {/* Die body: rounded rectangle with shadow */}
                <Graphics
                  draw={(g: PixiGraphics) => {
                    g.clear();
                    // Shadow
                    g.beginFill(0x000000, die.alpha * 0.3);
                    g.drawRoundedRect(dieX + 2, dieY + 2, dieSize, dieSize, cornerRadius);
                    g.endFill();
                    // Die body
                    g.beginFill(0xffffff, die.alpha);
                    g.drawRoundedRect(dieX, dieY, dieSize, dieSize, cornerRadius);
                    g.endFill();
                    // Border (success = green, fail = red, neutral = white)
                    g.lineStyle(2, borderColor, die.alpha);
                    g.drawRoundedRect(dieX, dieY, dieSize, dieSize, cornerRadius);

                    // Draw pips based on display value
                    g.beginFill(0x111111, die.alpha);
                    const cx = dieX + dieSize / 2;
                    const cy = dieY + dieSize / 2;
                    const off = dieSize * 0.25; // offset from center for pip placement
                    const v = die.displayValue;

                    // Center pip (1, 3, 5)
                    if (v === 1 || v === 3 || v === 5) {
                      g.drawCircle(cx, cy, pipRadius);
                    }
                    // Top-left + bottom-right (2, 3, 4, 5, 6)
                    if (v >= 2) {
                      g.drawCircle(cx - off, cy - off, pipRadius);
                      g.drawCircle(cx + off, cy + off, pipRadius);
                    }
                    // Top-right + bottom-left (4, 5, 6)
                    if (v >= 4) {
                      g.drawCircle(cx + off, cy - off, pipRadius);
                      g.drawCircle(cx - off, cy + off, pipRadius);
                    }
                    // Middle-left + middle-right (6)
                    if (v === 6) {
                      g.drawCircle(cx - off, cy, pipRadius);
                      g.drawCircle(cx + off, cy, pipRadius);
                    }

                    g.endFill();
                  }}
                />
                {/* Roll description text below die */}
                {!die.isTumbling && (
                  <Text
                    x={dieX + dieSize / 2}
                    y={dieY + dieSize + 6}
                    text={die.message.length > 30 ? die.message.slice(0, 30) + "..." : die.message}
                    anchor={{ x: 0.5, y: 0 }}
                    alpha={die.alpha}
                    style={
                      {
                        align: "center",
                        fill: borderColor,
                        fontFamily: "Arial",
                        fontSize: Math.max(8, cs * 0.28),
                        fontWeight: "bold",
                        stroke: 0x000000,
                        strokeThickness: Math.max(2, cs * 0.08),
                      } as any
                    }
                  />
                )}
              </React.Fragment>
            );
          })}
        </Container>
      </Stage>

      {/* ── Viewport controls (HTML overlay) ────────────────────────── */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
        {/* Zoom level indicator */}
        {!isDefaultViewport && (
          <span className="text-[10px] text-white bg-black/50 rounded px-1.5 py-0.5 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
        )}
        {/* Reset button — only visible when viewport is not at default */}
        {!isDefaultViewport && (
          <button
            onClick={handleResetViewport}
            className="bg-gray-900/80 hover:bg-gray-900 text-white text-xs font-medium rounded px-2 py-1.5 shadow-lg backdrop-blur-sm transition-colors select-none"
            title="Réinitialiser le zoom (1:1)"
          >
            ↺ 1:1
          </button>
        )}
        {/* Zoom in / out buttons */}
        <div className="flex gap-0.5">
          <button
            onClick={() => {
              setScale((s: number) => {
                const next = Math.min(MAX_SCALE, s + ZOOM_SPEED);
                // Zoom toward center
                const cx = width / 2;
                const cy = height / 2;
                const ratio = next / s;
                setOffset((o: { x: number; y: number }) => ({
                  x: cx - ratio * (cx - o.x),
                  y: cy - ratio * (cy - o.y),
                }));
                return next;
              });
            }}
            className="bg-gray-900/80 hover:bg-gray-900 text-white text-sm font-bold rounded-l px-2 py-1 shadow-lg backdrop-blur-sm transition-colors select-none"
            title="Zoom avant"
          >
            +
          </button>
          <button
            onClick={() => {
              setScale((s: number) => {
                const next = Math.max(MIN_SCALE, s - ZOOM_SPEED);
                const cx = width / 2;
                const cy = height / 2;
                const ratio = next / s;
                setOffset((o: { x: number; y: number }) => ({
                  x: cx - ratio * (cx - o.x),
                  y: cy - ratio * (cy - o.y),
                }));
                return next;
              });
            }}
            className="bg-gray-900/80 hover:bg-gray-900 text-white text-sm font-bold rounded-r px-2 py-1 shadow-lg backdrop-blur-sm transition-colors select-none"
            title="Zoom arrière"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}
