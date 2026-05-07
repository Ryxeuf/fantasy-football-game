"use client";

import { Container, Graphics, Stage, Text } from "@pixi/react";
// Pixi v7 (@pixi/react@7) — on type via `any` car @pixi/graphics est
// résolu indirectement par pnpm sans entrée explicite dans le tsconfig.
// Le runtime fonctionne ; on évite juste le dance de dépendances.
import { useCallback, useEffect, useState } from "react";

import {
  PRO_LEAGUE_FIELD_YARDS,
  type ProLeagueFieldState,
} from "../../../../lib/pro-league-field-state";

/**
 * Visualisation Pixi abstraite du field Pro League — sprint 1.B.3.
 *
 * Affiche un terrain BB-like avec :
 *  - Yard lines tous les 5 yards.
 *  - End zones colorées (home gauche, away droite).
 *  - Indicateur de balle au yardline courant.
 *  - Flèche de direction du drive.
 *  - Flash overlay (vert sur TD, rouge sur CASUALTY, violet sur NUFFLE).
 *
 * La sim Pro League étant hybride yards-level (pas de positions
 * individuelles), cette visu reste volontairement abstraite. Pour une
 * visu joueur-par-joueur il faudrait un sim full driver.
 */

const FIELD_WIDTH = 720;
const FIELD_HEIGHT = 240;
const MARGIN = 24;
const PLAY_WIDTH = FIELD_WIDTH - MARGIN * 2;
const PLAY_HEIGHT = FIELD_HEIGHT - MARGIN * 2;
/** Longueur d'1 yard en pixels (PLAY_WIDTH / 26). */
const YARD_PX = PLAY_WIDTH / PRO_LEAGUE_FIELD_YARDS;

const COLOR_FIELD = 0x1f3a1f; // dark green
const COLOR_LINE = 0x4a6a4a;
const COLOR_LINE_BOLD = 0xa8c8a8;
const COLOR_HOME_END = 0xb91c1c;
const COLOR_AWAY_END = 0x1d4ed8;
const COLOR_BALL = 0xfacc15;
const COLOR_BALL_OUTLINE = 0x1c1917;
const COLOR_FLASH_TD = 0x16a34a;
const COLOR_FLASH_CAS = 0xdc2626;
const COLOR_FLASH_NUFFLE = 0x9333ea;

interface FlashState {
  readonly color: number;
  readonly key: number;
}

const FLASH_DURATION_MS = 900;

interface ProLeagueFieldProps {
  readonly fieldState: ProLeagueFieldState;
  /** Largeur CSS du conteneur. La hauteur s'ajuste avec un ratio 3:1. */
  readonly width?: number;
}

function drawFieldBackground(g: any): void {
  g.clear();
  // Background terrain.
  g.beginFill(COLOR_FIELD);
  g.drawRoundedRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 8);
  g.endFill();

  // End zones.
  g.beginFill(COLOR_HOME_END, 0.6);
  g.drawRect(0, 0, MARGIN, FIELD_HEIGHT);
  g.endFill();
  g.beginFill(COLOR_AWAY_END, 0.6);
  g.drawRect(FIELD_WIDTH - MARGIN, 0, MARGIN, FIELD_HEIGHT);
  g.endFill();

  // Yard lines tous les 5 yards.
  for (let y = 0; y <= PRO_LEAGUE_FIELD_YARDS; y += 1) {
    const x = MARGIN + y * YARD_PX;
    const isBold = y % 5 === 0;
    g.lineStyle(isBold ? 2 : 1, isBold ? COLOR_LINE_BOLD : COLOR_LINE, 0.8);
    g.moveTo(x, MARGIN);
    g.lineTo(x, FIELD_HEIGHT - MARGIN);
  }

  // Bordures play area.
  g.lineStyle(2, 0x000000, 0.4);
  g.drawRect(MARGIN, MARGIN, PLAY_WIDTH, PLAY_HEIGHT);
}

function drawBall(
  g: any,
  ballYardline: number | null,
  drivingTeam: "home" | "away" | null,
): void {
  g.clear();
  if (ballYardline === null) return;
  // Quand l'équipe driving est home, "yardline" est mesurée depuis
  // leur côté (gauche). Pour away, on inverse pour visualiser depuis
  // leur côté (droite).
  const yard =
    drivingTeam === "away" ? PRO_LEAGUE_FIELD_YARDS - ballYardline : ballYardline;
  const x = MARGIN + yard * YARD_PX;
  const y = FIELD_HEIGHT / 2;

  // Direction arrow (subtle).
  const arrowDx = drivingTeam === "away" ? -28 : 28;
  g.lineStyle(2, COLOR_BALL, 0.35);
  g.moveTo(x, y);
  g.lineTo(x + arrowDx, y);
  g.lineTo(x + arrowDx - (arrowDx > 0 ? 6 : -6), y - 4);
  g.moveTo(x + arrowDx, y);
  g.lineTo(x + arrowDx - (arrowDx > 0 ? 6 : -6), y + 4);
  g.lineStyle();

  // Ball.
  g.beginFill(COLOR_BALL);
  g.lineStyle(2, COLOR_BALL_OUTLINE);
  g.drawCircle(x, y, 8);
  g.endFill();
}

function drawFlash(g: any, color: number, alpha: number): void {
  g.clear();
  if (alpha <= 0) return;
  g.beginFill(color, alpha);
  g.drawRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  g.endFill();
}

function flashColorFor(
  type: "TD" | "CASUALTY" | "NUFFLE" | undefined,
): number {
  if (type === "TD") return COLOR_FLASH_TD;
  if (type === "CASUALTY") return COLOR_FLASH_CAS;
  if (type === "NUFFLE") return COLOR_FLASH_NUFFLE;
  return 0x000000;
}

export function ProLeagueField({
  fieldState,
  width = 720,
}: ProLeagueFieldProps): JSX.Element {
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [flashAlpha, setFlashAlpha] = useState(0);

  // Déclenche un flash quand `lastFlash.eventIndex` change.
  useEffect(() => {
    const lf = fieldState.lastFlash;
    if (!lf) return;
    setFlash({ color: flashColorFor(lf.type), key: lf.eventIndex });
    setFlashAlpha(0.55);
    const start = Date.now();
    let raf = 0;
    const step = (): void => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / FLASH_DURATION_MS);
      setFlashAlpha(0.55 * (1 - t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fieldState.lastFlash?.eventIndex, fieldState.lastFlash?.type]);

  const drawBg = useCallback((g: any) => drawFieldBackground(g), []);
  const drawBallG = useCallback(
    (g: any) =>
      drawBall(g, fieldState.ballYardline, fieldState.drivingTeam),
    [fieldState.ballYardline, fieldState.drivingTeam],
  );
  const drawFlashG = useCallback(
    (g: any) => drawFlash(g, flash?.color ?? 0, flashAlpha),
    [flash, flashAlpha],
  );

  // Ratio hauteur 3:1 pour responsive.
  const cssHeight = (width / FIELD_WIDTH) * FIELD_HEIGHT;

  return (
    <div
      data-testid="pro-league-field"
      style={{ width, height: cssHeight, maxWidth: "100%", aspectRatio: "3 / 1" }}
    >
      <Stage
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        options={{ backgroundAlpha: 0, antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <Container>
          <Graphics draw={drawBg} />
          <Graphics draw={drawBallG} />
          <Graphics draw={drawFlashG} />
          <Text
            text={`${fieldState.score.home}`}
            x={MARGIN / 2 + 4}
            y={MARGIN + 4}
            style={
              {
                fontFamily: "monospace",
                fontSize: 18,
                fill: 0xffffff,
                fontWeight: "bold",
              } as unknown as undefined
            }
          />
          <Text
            text={`${fieldState.score.away}`}
            x={FIELD_WIDTH - MARGIN - 4}
            y={MARGIN + 4}
            anchor={{ x: 1, y: 0 }}
            style={
              {
                fontFamily: "monospace",
                fontSize: 18,
                fill: 0xffffff,
                fontWeight: "bold",
              } as unknown as undefined
            }
          />
        </Container>
      </Stage>
    </div>
  );
}

export default ProLeagueField;
