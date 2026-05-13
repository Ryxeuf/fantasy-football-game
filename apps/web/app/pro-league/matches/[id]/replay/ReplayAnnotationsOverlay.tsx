/**
 * Lot 3.E.3 — overlay SVG on-pitch pour le replay full-driver.
 *
 * Rendu absolu par-dessus le `<GameBoardWithDugouts>` (qui occupe son
 * conteneur en aspect-ratio `15:26`). Le SVG utilise `viewBox` aligné
 * sur la grille BB de manière à ce qu'une `Position {x, y}` se projete
 * naturellement :
 *
 *   svg coords = (pos.y, pos.x)   // BB-board est rendu verticalement
 *
 * Le board Pixi positionne :
 *   pixel.x = pos.y * cs
 *   pixel.y = pos.x * cs
 *   width   = state.height * cs   (15 cases visible-width)
 *   height  = state.width  * cs   (26 cases visible-height)
 *
 * On reproduit ce mapping ici via `viewBox="0 0 boardW boardH"` avec
 * boardW = state.height = 15 et boardH = state.width = 26.
 */

"use client";

import type { Position } from "@bb/game-engine";

import type { ReplayAnnotation } from "../../../../lib/replay-annotations";

interface ReplayAnnotationsOverlayProps {
  readonly annotations: readonly ReplayAnnotation[];
  readonly boardWidth: number; // state.width  (typiquement 26)
  readonly boardHeight: number; // state.height (typiquement 15)
}

const TEAM_COLORS: Record<"A" | "B", { stroke: string; fill: string }> = {
  A: { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.25)" },
  B: { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.25)" },
};

function colorFor(team: "A" | "B" | null): { stroke: string; fill: string } {
  if (team === "A" || team === "B") return TEAM_COLORS[team];
  return { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.25)" };
}

/** Projection BB→SVG : `(pos.x, pos.y)` BB → `(pos.y + 0.5, pos.x + 0.5)` SVG.
 *  Le +0.5 centre l'ancrage sur le centre de la case. */
function project(pos: Position): { sx: number; sy: number } {
  return { sx: pos.y + 0.5, sy: pos.x + 0.5 };
}

function MovementArrow({
  from,
  to,
  team,
  variant,
  index,
}: {
  from: Position;
  to: Position;
  team: "A" | "B" | null;
  variant: "MOVE" | "LEAP" | "DODGE";
  index: number;
}): JSX.Element {
  const a = project(from);
  const b = project(to);
  const { stroke } = colorFor(team);
  const dash = variant === "LEAP" ? "0.3 0.2" : variant === "DODGE" ? "0.15 0.15" : undefined;
  return (
    <g data-testid={`replay-annot-movement-${index}`}>
      <line
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={stroke}
        strokeWidth={0.12}
        strokeDasharray={dash}
        markerEnd={`url(#replay-arrow-${team ?? "n"})`}
        opacity={0.85}
      />
    </g>
  );
}

function BlitzArrow({
  from,
  to,
  targetPos,
  team,
  index,
}: {
  from: Position;
  to: Position;
  targetPos: Position;
  team: "A" | "B" | null;
  index: number;
}): JSX.Element {
  const a = project(from);
  const b = project(to);
  const t = project(targetPos);
  const { stroke, fill } = colorFor(team);
  return (
    <g data-testid={`replay-annot-blitz-${index}`}>
      <line
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={stroke}
        strokeWidth={0.15}
        markerEnd={`url(#replay-arrow-${team ?? "n"})`}
      />
      <circle
        cx={t.sx}
        cy={t.sy}
        r={0.45}
        stroke={stroke}
        strokeWidth={0.08}
        fill={fill}
      />
    </g>
  );
}

function BlockHalo({
  attackerPos,
  targetPositions,
  team,
  variant,
  index,
}: {
  attackerPos: Position;
  targetPositions: readonly Position[];
  team: "A" | "B" | null;
  variant: "BLOCK" | "MULTI_BLOCK" | "FOUL";
  index: number;
}): JSX.Element {
  const atk = project(attackerPos);
  const isFoul = variant === "FOUL";
  const { stroke, fill } = isFoul
    ? { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.3)" }
    : colorFor(team);
  return (
    <g data-testid={`replay-annot-block-${index}`}>
      <circle
        cx={atk.sx}
        cy={atk.sy}
        r={0.45}
        stroke={stroke}
        strokeWidth={0.08}
        fill="transparent"
      />
      {targetPositions.map((t, i) => {
        const p = project(t);
        return (
          <g key={i}>
            <circle
              cx={p.sx}
              cy={p.sy}
              r={0.45}
              stroke={stroke}
              strokeWidth={0.1}
              fill={fill}
            />
            <line
              x1={atk.sx}
              y1={atk.sy}
              x2={p.sx}
              y2={p.sy}
              stroke={stroke}
              strokeWidth={0.07}
              opacity={0.7}
            />
          </g>
        );
      })}
    </g>
  );
}

function PassLine({
  from,
  to,
  team,
  variant,
  index,
}: {
  from: Position;
  to: Position;
  team: "A" | "B" | null;
  variant: "PASS" | "HANDOFF" | "BOMB_THROW";
  index: number;
}): JSX.Element {
  const a = project(from);
  const b = project(to);
  const { stroke } = colorFor(team);
  const color = variant === "BOMB_THROW" ? "#fbbf24" : stroke;
  return (
    <g data-testid={`replay-annot-pass-${index}`}>
      <line
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={color}
        strokeWidth={0.12}
        strokeDasharray="0.4 0.25"
        markerEnd={`url(#replay-arrow-${team ?? "n"})`}
      />
      <circle cx={a.sx} cy={a.sy} r={0.18} fill={color} />
      <circle cx={b.sx} cy={b.sy} r={0.18} fill={color} stroke="white" strokeWidth={0.04} />
    </g>
  );
}

function ArrowMarker({ id, color }: { id: string; color: string }): JSX.Element {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="4"
      markerHeight="4"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

export default function ReplayAnnotationsOverlay({
  annotations,
  boardWidth,
  boardHeight,
}: ReplayAnnotationsOverlayProps): JSX.Element {
  return (
    <svg
      data-testid="replay-annotations-overlay"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${boardHeight} ${boardWidth}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <ArrowMarker id="replay-arrow-A" color={TEAM_COLORS.A.stroke} />
        <ArrowMarker id="replay-arrow-B" color={TEAM_COLORS.B.stroke} />
        <ArrowMarker id="replay-arrow-n" color="#94a3b8" />
      </defs>
      {annotations.map((annot, i) => {
        switch (annot.kind) {
          case "movement":
            return (
              <MovementArrow
                key={i}
                index={i}
                from={annot.from}
                to={annot.to}
                team={annot.team}
                variant={annot.variant}
              />
            );
          case "blitz":
            return (
              <BlitzArrow
                key={i}
                index={i}
                from={annot.from}
                to={annot.to}
                targetPos={annot.targetPos}
                team={annot.team}
              />
            );
          case "block":
            return (
              <BlockHalo
                key={i}
                index={i}
                attackerPos={annot.attackerPos}
                targetPositions={annot.targetPositions}
                team={annot.team}
                variant={annot.variant}
              />
            );
          case "pass":
            return (
              <PassLine
                key={i}
                index={i}
                from={annot.from}
                to={annot.to}
                team={annot.team}
                variant={annot.variant}
              />
            );
          default:
            return null;
        }
      })}
    </svg>
  );
}
