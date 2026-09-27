"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { PredictionPicker } from "./PredictionPicker";
import {
  ELIGIBILITY_MESSAGES,
  GRADE_LABELS,
  GROUP_LABELS,
  PREDICTION_PICKS,
  describePrediction,
  formatClosesAt,
  pickLabel,
  pickShare,
  pointsLabel,
  type PairingPredictionsView,
  type PredictionGrade,
} from "./predictions";

/**
 * Une rencontre vue sous l'angle des pronostics : état (ouverte, close,
 * jouée), pronostic du lecteur et sa note, saisie quand elle est permise,
 * et — seulement une fois la rencontre CLOSE — la répartition des choix et,
 * sur la page complète, la liste nominative. Avant la clôture, le serveur
 * n'envoie rien des autres : il n'y a rien à masquer ici.
 */

interface PredictionPairingCardProps {
  pairing: PairingPredictionsView;
  onChanged: () => void;
  /** Liste nominative des pronostics après clôture (page complète). */
  showOthers?: boolean;
}

const GRADE_STYLES: Readonly<Record<PredictionGrade, string>> = {
  pending: "bg-gray-100 text-gray-700",
  void: "bg-gray-100 text-gray-500",
  exact: "bg-emerald-100 text-emerald-800",
  outcome: "bg-emerald-50 text-emerald-700",
  wrong: "bg-red-50 text-red-700",
};

function GradeBadge({ grade, points }: { grade: PredictionGrade; points: number }) {
  const settled = grade === "exact" || grade === "outcome" || grade === "wrong";
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded ${GRADE_STYLES[grade]}`}
    >
      {GRADE_LABELS[grade]}
      {settled ? ` · ${pointsLabel(points)}` : ""}
    </span>
  );
}

function StatusChip({ pairing }: { pairing: PairingPredictionsView }) {
  if (pairing.result) {
    const label =
      pairing.result.outcome === "void" ||
      pairing.result.homeScore === null ||
      pairing.result.awayScore === null
        ? "Non jouée"
        : `Score ${pairing.result.homeScore}-${pairing.result.awayScore}`;
    return (
      <span className="text-xs font-medium text-nuffle-anthracite">{label}</span>
    );
  }
  if (pairing.closed) {
    return <span className="text-xs text-gray-500">Pronostics clos</span>;
  }
  const closesAt = formatClosesAt(pairing.closesAt);
  return (
    <span className="text-xs text-emerald-700">
      {closesAt ? `Ouvert jusqu'au ${closesAt}` : "Ouvert"}
    </span>
  );
}

export function PredictionPairingCard({
  pairing,
  onChanged,
  showOthers = false,
}: PredictionPairingCardProps) {
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const { home, away } = pairing;

  const handleClose = useCallback(async () => {
    setClosing(true);
    setCloseError(null);
    try {
      await apiRequest(`/leagues/pairings/${pairing.id}/predictions/close`, {
        method: "POST",
      });
      onChanged();
    } catch (e: unknown) {
      setCloseError(e instanceof Error ? e.message : "Clôture impossible");
    } finally {
      setClosing(false);
    }
  }, [pairing.id, onChanged]);

  const message =
    pairing.eligibility === "ok" ||
    pairing.eligibility === "closed" ||
    pairing.eligibility === "predictions-off"
      ? null
      : ELIGIBILITY_MESSAGES[pairing.eligibility];

  return (
    <li
      data-testid={`prediction-pairing-${pairing.id}`}
      className="rounded-md border border-gray-200 bg-white p-3 space-y-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{home.name}</span>
          <span className="text-gray-400"> vs </span>
          <span className="font-medium">{away.name}</span>
        </div>
        <StatusChip pairing={pairing} />
      </div>

      {pairing.myPrediction ? (
        <div
          data-testid={`prediction-mine-${pairing.id}`}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span className="text-gray-600">Ton pronostic :</span>
          <span className="font-medium">
            {describePrediction(pairing.myPrediction, home.name, away.name)}
          </span>
          {pairing.closed ? (
            <GradeBadge
              grade={pairing.myPrediction.grade}
              points={pairing.myPrediction.points}
            />
          ) : null}
        </div>
      ) : null}

      {pairing.eligibility === "ok" ? (
        <PredictionPicker pairing={pairing} onChanged={onChanged} />
      ) : null}

      {message ? (
        <p
          data-testid={`prediction-eligibility-${pairing.id}`}
          className="text-xs text-gray-500"
        >
          {message}
        </p>
      ) : null}

      {pairing.distribution && pairing.distribution.total > 0 ? (
        <p
          data-testid={`prediction-distribution-${pairing.id}`}
          className="text-xs text-gray-600"
        >
          {PREDICTION_PICKS.map(
            (pick) =>
              `${pickLabel(pick, home.name, away.name)} ${pickShare(pairing.distribution!, pick)} %`,
          ).join(" · ")}{" "}
          ({pairing.distribution.total} pronostic
          {pairing.distribution.total > 1 ? "s" : ""})
        </p>
      ) : null}

      {showOthers && pairing.predictions && pairing.predictions.length > 0 ? (
        <ul
          data-testid={`prediction-others-${pairing.id}`}
          className="text-xs divide-y divide-gray-100 border-t border-gray-100"
        >
          {pairing.predictions.map((p) => (
            <li
              key={p.userId}
              className={`flex flex-wrap items-center justify-between gap-2 py-1 ${
                p.isViewer ? "font-medium" : ""
              }`}
            >
              <span>
                {p.displayName}{" "}
                <span className="text-gray-400">({GROUP_LABELS[p.group]})</span>
              </span>
              <span className="flex items-center gap-2">
                {describePrediction(p, home.name, away.name)}
                <GradeBadge grade={p.grade} points={p.points} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pairing.canClose && !pairing.closed ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid={`prediction-close-${pairing.id}`}
            disabled={closing}
            onClick={handleClose}
            className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
          >
            Clore les pronostics de cette rencontre
          </button>
          {closeError ? (
            <span role="alert" className="text-xs text-red-700">
              {closeError}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
