"use client";

import { weatherVisual, type SheetWeatherView } from "../weather";
import { WeatherScene } from "./WeatherScene";

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
  effectsEnabled = true,
  onToggleEffects,
}: {
  weather: SheetWeatherView | null;
  /** Coups d'envoi « Météo capricieuse » déjà saisis. */
  changingWeather: ReadonlyArray<ChangingWeatherKickoff>;
  /** Absent si l'utilisateur ne peut pas modifier l'avant-match. */
  onEditPreMatch?: () => void;
  /** Ambiance graphique (pluie, brouillard…) affichée. */
  effectsEnabled?: boolean;
  /** Absent : pas d'interrupteur. */
  onToggleEffects?: () => void;
}) {
  const showScene = Boolean(weather) && effectsEnabled;
  return (
    <div
      data-testid="weather-reminder"
      className="relative isolate mb-3 overflow-hidden rounded border-l-4 border-sky-500 bg-sky-50 px-3 py-2 text-xs text-slate-700"
    >
      {showScene && weather && (
        <div className="absolute inset-0 -z-10">
          <WeatherScene visual={weatherVisual(weather.condition)} />
        </div>
      )}
      {weather && onToggleEffects && (
        <button
          type="button"
          onClick={onToggleEffects}
          aria-pressed={effectsEnabled}
          data-testid="weather-effects-toggle"
          title={
            effectsEnabled
              ? "Masquer l'ambiance météo"
              : "Afficher l'ambiance météo"
          }
          className="float-right ml-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-white"
        >
          {effectsEnabled ? "✨ Effets : on" : "✨ Effets : off"}
        </button>
      )}
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
            <p className="mt-1 text-[11px] italic text-slate-600">
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
