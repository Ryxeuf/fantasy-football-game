"use client";
import {
  predictionScopeOptions,
  type PredictionCompetition,
  type PredictionScope,
} from "./predictions";

/**
 * Le bloc « Pronostics » d'une ligue ou d'une coupe : qui peut pronostiquer
 * ses rencontres.
 *
 * Servi au formulaire complet et au panneau réduit d'une ligue VERROUILLÉE —
 * la portée ne réécrit aucun point de classement, elle reste donc modifiable
 * une fois la compétition lancée — ainsi qu'à la création et à l'édition
 * d'une coupe (`competition="cup"`, identifiants de test préfixés `cup-`).
 */

interface PredictionsScopeFieldProps {
  value: PredictionScope;
  onChange: (next: PredictionScope) => void;
  /** Visibilité de la ligue : « Tout le monde » s'arrête à qui la voit. */
  isPublic: boolean;
  disabled?: boolean;
  competition?: PredictionCompetition;
}

const PRIVATE_HINTS: Readonly<Record<PredictionCompetition, string>> = {
  league:
    "Ligue privée : « Tout le monde » se limite à ceux qui la voient (commissaire, coachs inscrits — même retirés — et coachs invités).",
  cup: "Coupe privée : « Tout le monde » se limite à ceux qui ont son lien.",
};

export function PredictionsScopeField({
  value,
  onChange,
  isPublic,
  disabled = false,
  competition = "league",
}: PredictionsScopeFieldProps) {
  return (
    <fieldset className="block" data-testid={`${competition}-form-predictions`}>
      <legend className="text-sm font-medium text-gray-700">Pronostics</legend>
      <p className="text-xs text-gray-500 mt-0.5">
        Les pronostiqueurs choisissent l&apos;issue des rencontres à venir
        (3 pts le bon résultat, nul compris, +2 pour le score exact). Un coach
        ne pronostique jamais son propre match.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {predictionScopeOptions(competition).map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex items-start gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${
                checked
                  ? "border-nuffle-gold bg-nuffle-gold/10"
                  : "border-gray-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="predictionsScope"
                data-testid={`${competition}-predictions-scope-${option.value}`}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-gray-500">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {!isPublic && value === "open" ? (
        <p
          data-testid={`${competition}-predictions-private-hint`}
          className="text-xs text-amber-700 mt-1"
        >
          {PRIVATE_HINTS[competition]}
        </p>
      ) : null}
    </fieldset>
  );
}
