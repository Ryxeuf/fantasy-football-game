import React from "react";
import type { GameState } from "@bb/game-engine";

interface GameScoreboardProps {
  state: GameState;
  onEndTurn: () => void;
}

export default function GameScoreboard({ state, onEndTurn }: GameScoreboardProps) {
  const getTeamColor = (team: "A" | "B") => {
    return team === "A" ? "bg-red-600" : "bg-blue-600";
  };

  const getTeamTextColor = (team: "A" | "B") => {
    return team === "A" ? "text-red-600" : "text-blue-600";
  };

  const getCurrentTeamName = () => {
    return state.currentPlayer === "A" ? state.teamNames.teamA : state.teamNames.teamB;
  };

  const getCurrentTeamColor = () => {
    return state.currentPlayer === "A" ? "red" : "blue";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl">
      {/* Barre principale du scoreboard */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Informations de jeu à gauche */}
        <div className="flex items-center space-x-6">
          {/* Mi-temps */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-gray-300 mb-1">
              Mi-temps
            </div>
            <div className="text-2xl font-bold">
              {state.half}
            </div>
          </div>

          {/* Tour */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-gray-300 mb-1">
              Tour
            </div>
            <div className="text-2xl font-bold">
              {state.turn}
            </div>
          </div>

          {/* Équipe active */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-gray-300 mb-1">
              Équipe active
            </div>
            <div className={`text-lg font-bold ${getTeamTextColor(state.currentPlayer)}`}>
              {getCurrentTeamName()}
            </div>
          </div>
        </div>

        {/* Score au centre */}
        <div className="flex items-center space-x-8">
          {/* Équipe A */}
          <div className="text-center">
            <div className="text-sm text-gray-300 mb-1">
              {state.teamNames.teamA}
            </div>
            <div className={`text-4xl font-black ${getTeamTextColor("A")}`}>
              {state.score.teamA}
            </div>
          </div>

          {/* Séparateur */}
          <div className="text-2xl font-bold text-gray-400">
            -
          </div>

          {/* Équipe B */}
          <div className="text-center">
            <div className="text-sm text-gray-300 mb-1">
              {state.teamNames.teamB}
            </div>
            <div className={`text-4xl font-black ${getTeamTextColor("B")}`}>
              {state.score.teamB}
            </div>
          </div>
        </div>

        {/* Actions à droite */}
        <div className="flex items-center space-x-4">
          {/* Indicateur de turnover */}
          {state.isTurnover && (
            <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
              TURNOVER !
            </div>
          )}

          {/* Bouton fin de tour */}
          <button
            onClick={onEndTurn}
            className={`px-6 py-2 rounded-lg font-bold text-white transition-all duration-200 ${
              state.isTurnover
                ? "bg-red-600 hover:bg-red-700"
                : `bg-${getCurrentTeamColor()}-600 hover:bg-${getCurrentTeamColor()}-700`
            } shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            {state.isTurnover ? "Tour terminé" : "Fin du tour"}
          </button>
        </div>
      </div>

      {/* Barre de statut en bas */}
      <div className="bg-black bg-opacity-30 px-6 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            {/* Statut du ballon */}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-gray-300">
                {state.ball ? "Ballon en jeu" : "Ballon hors jeu"}
              </span>
            </div>

            {/* Joueur sélectionné */}
            {state.selectedPlayerId && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-300">
                  Joueur sélectionné: {state.selectedPlayerId}
                </span>
              </div>
            )}
          </div>

          {/* Informations de jeu */}
          <div className="text-gray-400">
            Blood Bowl Fantasy Football
          </div>
        </div>
      </div>
    </div>
  );
}
