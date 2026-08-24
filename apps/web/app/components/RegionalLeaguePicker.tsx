"use client";

/**
 * Sélecteur de Ligue régionale, posé dans les flux de CRÉATION d'équipe.
 *
 * Une équipe appartient à UNE Ligue, choisie en construisant sa Liste
 * d'Équipe : c'est elle qui débloque les Star Players recrutables et les
 * Coups de Pouce accessibles. Le composant ne s'affiche que s'il y a
 * quelque chose à dire :
 *  - plusieurs options → boutons radio, choix obligatoire ;
 *  - une seule option → rappel en lecture seule (Ligue imposée) ;
 *  - aucune option → rien.
 *
 * Les libellés (`name`, `grantLabels`) sont déjà localisés par l'API
 * (`/api/rosters`), ce composant ne traduit que son propre habillage.
 */

import { useLanguage } from "../contexts/LanguageContext";

export interface RegionalLeagueOptionView {
  readonly slug: string;
  readonly name: string;
  /** Slugs des règles régionales acquises avec cette Ligue. */
  readonly grants?: readonly string[];
  /** Libellés localisés de ces règles (ex. « Favori de Khorne »). */
  readonly grantLabels?: readonly string[];
}

interface RegionalLeaguePickerProps {
  readonly options: readonly RegionalLeagueOptionView[];
  readonly value: string | null;
  readonly onChange: (slug: string) => void;
  /** Affiche l'invite « choisis une Ligue » (après une tentative de submit). */
  readonly showRequiredHint?: boolean;
  readonly disabled?: boolean;
}

export default function RegionalLeaguePicker({
  options,
  value,
  onChange,
  showRequiredHint = false,
  disabled = false,
}: RegionalLeaguePickerProps) {
  const { t } = useLanguage();

  if (options.length === 0) return null;

  const label = t.teams.regionalLeague ?? "Ligue régionale";

  // Ligue unique : rien à demander, on informe.
  if (options.length === 1) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
        data-testid="regional-league-imposed"
      >
        <div className="font-medium text-gray-700">{label}</div>
        <div className="mt-1 text-gray-900">{options[0].name}</div>
        <div className="mt-1 text-xs text-gray-500">
          {t.teams.regionalLeagueImposed ?? "Ligue imposée par le roster"}
        </div>
      </div>
    );
  }

  const missing = showRequiredHint && !value;

  return (
    <fieldset
      className={`rounded-lg border p-3 ${
        missing ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
      }`}
      data-testid="regional-league-picker"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-semibold text-gray-800">
        {t.teams.regionalLeagueChoose ?? "Choisis ta Ligue régionale"}
      </legend>
      <p className="mb-2 text-xs text-gray-600">
        {t.teams.regionalLeagueHelp ??
          "Elle détermine les Star Players recrutables et les Coups de Pouce accessibles. Ce choix est définitif."}
      </p>
      <div className="space-y-2">
        {options.map((option) => {
          const grants = option.grantLabels ?? [];
          return (
            <label
              key={option.slug}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm transition-colors ${
                value === option.slug
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
              data-testid={`regional-league-option-${option.slug}`}
            >
              <input
                type="radio"
                className="mt-1"
                name="regional-league"
                value={option.slug}
                checked={value === option.slug}
                onChange={() => onChange(option.slug)}
              />
              <span>
                <span className="font-medium text-gray-900">{option.name}</span>
                {grants.length > 0 && (
                  <span className="block text-xs text-amber-700">
                    {(
                      t.teams.regionalLeagueGrants ?? "Apporte : {grants}"
                    ).replace("{grants}", grants.join(", "))}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {missing && (
        <p className="mt-2 text-xs font-medium text-red-700" role="alert">
          {t.teams.regionalLeagueRequired ??
            "Choisis une Ligue régionale pour continuer"}
        </p>
      )}
    </fieldset>
  );
}
