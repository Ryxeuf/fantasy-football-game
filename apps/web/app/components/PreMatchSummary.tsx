"use client";

import type { ExtendedGameState } from "@bb/game-engine";

interface PreMatchSummaryProps {
  state: ExtendedGameState;
}

/**
 * Displays the results of the automated pre-match sequence:
 * fan factor, weather, and journeymen info.
 * Shown above the inducements selector during the inducements phase.
 */
export default function PreMatchSummary({ state }: PreMatchSummaryProps) {
  const { preMatch, teamNames } = state;
  const hasFanFactor = !!preMatch?.fanFactor;
  const hasWeather = !!preMatch?.weather;
  const hasJourneymen = !!preMatch?.journeymen;

  if (!hasFanFactor && !hasWeather && !hasJourneymen) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-4">
      <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide text-center">
          Sequence pre-match
        </h3>

        {/* Fan Factor */}
        {hasFanFactor && (
          <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
            <span className="text-gray-500 font-medium">Fan Factor</span>
            <div className="flex gap-4">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {teamNames.teamA}: {preMatch.fanFactor!.teamA.total}{" "}
                <span className="text-gray-400">
                  (D3:{preMatch.fanFactor!.teamA.d3} + Fans:{preMatch.fanFactor!.teamA.dedicatedFans})
                </span>
              </span>
              <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">
                {teamNames.teamB}: {preMatch.fanFactor!.teamB.total}{" "}
                <span className="text-gray-400">
                  (D3:{preMatch.fanFactor!.teamB.d3} + Fans:{preMatch.fanFactor!.teamB.dedicatedFans})
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Weather */}
        {hasWeather && (
          <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
            <span className="text-gray-500 font-medium">Meteo</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-medium">
                2D6={preMatch.weather!.total}: {preMatch.weather!.condition}
              </span>
              <span className="text-xs text-gray-400">
                {preMatch.weather!.description}
              </span>
            </div>
          </div>
        )}

        {/* Journeymen */}
        {hasJourneymen && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Joueurs de passage</span>
            <div className="flex gap-4 text-xs">
              {preMatch.journeymen!.teamA.count > 0 ? (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded">
                  {teamNames.teamA}: +{preMatch.journeymen!.teamA.count}
                </span>
              ) : (
                <span className="text-gray-400">{teamNames.teamA}: aucun</span>
              )}
              {preMatch.journeymen!.teamB.count > 0 ? (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded">
                  {teamNames.teamB}: +{preMatch.journeymen!.teamB.count}
                </span>
              ) : (
                <span className="text-gray-400">{teamNames.teamB}: aucun</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
