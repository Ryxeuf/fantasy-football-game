"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api-client";

interface LiveMatch {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  score: { teamA: number; teamB: number };
  half: number;
  turn: number;
  spectatorCount: number;
  teamA: { coachName: string; teamName: string; rosterName: string } | null;
  teamB: { coachName: string; teamName: string; rosterName: string } | null;
}

export default function SpectateLobbyPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
        setError("Connexion requise");
        setLoading(false);
        return;
      }
      const data = await apiRequest<{ matches: LiveMatch[] }>("/match/live");
      setMatches(data.matches || []);
      setLoading(false);
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Chargement des matchs en direct...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <a
            href="/lobby"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retour au lobby
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Matchs en direct
          </h1>
          <a
            href="/lobby"
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Retour au lobby
          </a>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 text-lg mb-2">
              Aucun match en cours pour le moment
            </p>
            <p className="text-gray-400 text-sm">
              Les matchs en cours apparaitront ici. Revenez plus tard !
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <a
                key={match.id}
                href={`/spectate/${match.id}`}
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="text-right flex-1">
                        <p className="font-semibold text-gray-800">
                          {match.teamA?.teamName || "Equipe A"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {match.teamA?.coachName || ""}
                        </p>
                      </div>

                      <div className="text-center px-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {match.score.teamA} - {match.score.teamB}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {match.status === "active"
                            ? `Mi-temps ${match.half} — Tour ${match.turn}`
                            : "Setup en cours"}
                        </div>
                      </div>

                      <div className="text-left flex-1">
                        <p className="font-semibold text-gray-800">
                          {match.teamB?.teamName || "Equipe B"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {match.teamB?.coachName || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">
                      {match.spectatorCount} spectateur
                      {match.spectatorCount !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      En direct
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
