import type { CoachEloSnapshot } from "./types";

interface CoachEloChartProps {
  snapshots: CoachEloSnapshot[];
  /** Optional window size used to label the section (defaults to "90 jours"). */
  windowLabel?: string;
}

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 200;
const PADDING_X = 24;
const PADDING_Y = 16;
const PLOT_WIDTH = VIEWBOX_WIDTH - PADDING_X * 2;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - PADDING_Y * 2;

interface PlottedPoint {
  x: number;
  y: number;
  rating: number;
  recordedAt: string;
}

function plotPoints(snapshots: CoachEloSnapshot[]): {
  points: PlottedPoint[];
  minRating: number;
  maxRating: number;
} {
  const ratings = snapshots.map((s) => s.rating);
  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);
  const ratingRange = maxRating - minRating;

  const times = snapshots.map((s) => new Date(s.recordedAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime;

  const points: PlottedPoint[] = snapshots.map((snap, idx) => {
    const t = new Date(snap.recordedAt).getTime();
    const xRatio = timeRange === 0
      ? snapshots.length === 1
        ? 0.5
        : idx / Math.max(1, snapshots.length - 1)
      : (t - minTime) / timeRange;
    const yRatio = ratingRange === 0 ? 0.5 : (snap.rating - minRating) / ratingRange;
    return {
      x: PADDING_X + xRatio * PLOT_WIDTH,
      // SVG Y grows downward — invert so higher rating = higher on screen.
      y: PADDING_Y + (1 - yRatio) * PLOT_HEIGHT,
      rating: snap.rating,
      recordedAt: snap.recordedAt,
    };
  });

  return { points, minRating, maxRating };
}

function formatLastRecorded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * S26.3n — Courbe ELO 90j sur `/coach/{slug}`.
 *
 * Composant serveur (pas de "use client") qui consomme les snapshots
 * deja recuperes par la page via `getCoachEloHistory` cote serveur.
 * Trace une polyline SVG inline — pas de dependance charting pour
 * preserver le bundle. Les axes ne sont pas etiquetes ; un encart
 * texte (`coach-elo-chart-stats`) donne le min/max et le dernier
 * rating pour rester accessible aux lecteurs d'ecran.
 */
export default function CoachEloChart({
  snapshots,
  windowLabel = "90 jours",
}: CoachEloChartProps): JSX.Element | null {
  if (snapshots.length === 0) return null;

  const { points, minRating, maxRating } = plotPoints(snapshots);
  const last = snapshots[snapshots.length - 1];
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <section
      data-testid="coach-elo-chart"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
      aria-label={`Courbe ELO sur ${windowLabel}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-nuffle-anthracite">
          Courbe ELO ({windowLabel})
        </h2>
        <p
          data-testid="coach-elo-chart-summary"
          className="text-sm text-gray-600"
        >
          Dernier rating <span className="font-semibold">{last.rating}</span>{" "}
          sur {snapshots.length} match{snapshots.length > 1 ? "s" : ""}
        </p>
      </div>
      <p
        data-testid="coach-elo-chart-stats"
        className="text-xs text-gray-500 mt-1"
      >
        Min {minRating} - Max {maxRating} - Dernier point{" "}
        {formatLastRecorded(last.recordedAt)}
      </p>
      <svg
        data-testid="coach-elo-chart-svg"
        role="img"
        aria-label="Evolution ELO"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="mt-3 w-full h-auto"
        preserveAspectRatio="none"
      >
        <rect
          x={PADDING_X}
          y={PADDING_Y}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="#fafafa"
          stroke="#e5e7eb"
        />
        {points.length >= 2 && (
          <polyline
            data-testid="coach-elo-chart-line"
            points={polylinePoints}
            fill="none"
            stroke="#b45309"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, idx) => (
          <circle
            key={`${p.recordedAt}-${idx}`}
            data-testid="coach-elo-chart-point"
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#b45309"
          />
        ))}
      </svg>
    </section>
  );
}
