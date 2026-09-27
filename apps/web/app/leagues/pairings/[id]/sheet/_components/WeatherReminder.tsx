"use client";

import type { SheetWeatherView } from "../weather";

interface ChangingWeatherKickoff {
  id: string;
  meta?: { half?: number; turn?: number } | null;
}

/**
 * Rappel de la météo d'avant-match dans l'onglet « En cours » : ses effets
 * jouent tout le match, et c'est pendant la saisie qu'on en a besoin.
 */
export function WeatherReminder({
  weather,
  changingWeather,
  onEditPreMatch,
}: {
  weather: SheetWeatherView | null;
  /** Coups d'envoi « Météo capricieuse » déjà saisis. */
  changingWeather: ReadonlyArray<ChangingWeatherKickoff>;
  /** Absent si l'utilisateur ne peut pas modifier l'avant-match. */
  onEditPreMatch?: () => void;
}) {
  return (
    <div
      data-testid="weather-reminder"
      className="mb-3 rounded border-l-4 border-sky-500 bg-sky-50 px-3 py-2 text-xs text-slate-700"
    >
      {weather ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-nuffle-anthracite">
              🌦️ Météo : {weather.condition}
            </span>
            {weather.tableName && (
              <span className="text-[11px] text-slate-500">
                (table {weather.tableName})
              </span>
            )}
          </div>
          {weather.effects.length > 0 ? (
            <ul
              data-testid="weather-reminder-effects"
              className="mt-1 list-disc space-y-0.5 pl-4"
            >
              {weather.effects.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1" data-testid="weather-reminder-none">
              Aucun modificateur de jeu.
            </p>
          )}
          {weather.description && (
            <p className="mt-1 text-[11px] italic text-slate-500">
              {weather.description}
            </p>
          )}
        </>
      ) : (
        <p data-testid="weather-reminder-missing">
          🌦️ Aucune météo saisie à l&apos;avant-match.
        </p>
      )}

      {changingWeather.length > 0 && (
        <p
          data-testid="weather-reminder-changed"
          className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-800"
        >
          ⚠️ Météo capricieuse saisie au coup d&apos;envoi
          {changingWeather
            .map((k) =>
              k.meta?.half
                ? ` (MT ${k.meta.half}${k.meta.turn ? `, T${k.meta.turn}` : ""})`
                : "",
            )
            .join("")}{" "}
          : la météo a été relancée, mettez-la à jour dans l&apos;avant-match.
          {onEditPreMatch && (
            <>
              {" "}
              <button
                type="button"
                onClick={onEditPreMatch}
                data-testid="weather-reminder-edit"
                className="font-semibold underline"
              >
                Modifier la météo
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
