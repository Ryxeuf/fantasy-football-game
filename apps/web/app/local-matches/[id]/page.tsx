"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../auth-client";
import {
  GameBoardWithDugouts,
  GameScoreboard,
  PlayerDetails,
} from "@bb/ui";
import type { ExtendedGameState } from "@bb/game-engine";

type LocalMatch = {
  id: string;
  name: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  shareToken: string | null;
  teamAOwnerValidated: boolean;
  teamBOwnerValidated: boolean;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  teamA: {
    id: string;
    name: string;
    roster: string;
    players: Array<{
      id: string;
      name: string;
      position: string;
      number: number;
      ma: number;
      st: number;
      ag: number;
      pa: number;
      av: number;
      skills: string;
    }>;
    owner: {
      id: string;
      coachName: string;
    };
  };
  teamB: {
    id: string;
    name: string;
    roster: string;
    players: Array<{
      id: string;
      name: string;
      position: string;
      number: number;
      ma: number;
      st: number;
      ag: number;
      pa: number;
      av: number;
      skills: string;
    }>;
    owner: {
      id: string;
      coachName: string;
    };
  };
  cup: {
    id: string;
    name: string;
    status: string;
  } | null;
  gameState: ExtendedGameState | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
};

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function postJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function putJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

function normalizeState(state: any): ExtendedGameState {
  if (
    state &&
    typeof state.playerActions === "object" &&
    state.playerActions !== null &&
    typeof state.playerActions.has !== "function"
  ) {
    state.playerActions = new Map(Object.entries(state.playerActions || {}));
  }
  if (
    state &&
    typeof state.teamBlitzCount === "object" &&
    state.teamBlitzCount !== null &&
    typeof state.teamBlitzCount.has !== "function"
  ) {
    state.teamBlitzCount = new Map(Object.entries(state.teamBlitzCount || {}));
  }

  if (state && (typeof state.width !== "number" || typeof state.height !== "number")) {
    state.width = 26;
    state.height = 15;
  }

  if (state && state.preMatch && state.preMatch.phase === "setup") {
    state.selectedPlayerId = null;
  }

  return state as ExtendedGameState;
}

export default function LocalMatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  const [localMatch, setLocalMatch] = useState<LocalMatch | null>(null);
  const [gameState, setGameState] = useState<ExtendedGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    loadLocalMatch();
  }, [matchId]);

  const loadLocalMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { localMatch: data } = await fetchJSON(`/local-match/${matchId}`);
      setLocalMatch(data);
      if (data.gameState) {
        setGameState(normalizeState(data.gameState));
      }
    } catch (e: any) {
      console.error("Erreur lors du chargement:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setError(null);
    try {
      const { localMatch: updated, gameState: newGameState } = await postJSON(
        `/local-match/${matchId}/start`,
        {},
      );
      setLocalMatch(updated);
      if (newGameState) {
        setGameState(normalizeState(newGameState));
      }
    } catch (e: any) {
      console.error("Erreur lors du démarrage:", e);
      setError(e.message || "Erreur lors du démarrage");
    }
  };

  const handleSaveState = async () => {
    if (!gameState) return;
    setSaving(true);
    try {
      const scoreTeamA = gameState.score?.teamA || 0;
      const scoreTeamB = gameState.score?.teamB || 0;
      await putJSON(`/local-match/${matchId}/state`, {
        gameState,
        scoreTeamA,
        scoreTeamB,
      });
      alert("État sauvegardé avec succès");
    } catch (e: any) {
      console.error("Erreur lors de la sauvegarde:", e);
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!gameState) return;
    const scoreTeamA = gameState.score?.teamA || 0;
    const scoreTeamB = gameState.score?.teamB || 0;
    
    if (!confirm(`Terminer la partie avec le score ${scoreTeamA} - ${scoreTeamB} ?`)) {
      return;
    }

    try {
      const { localMatch: updated } = await postJSON(
        `/local-match/${matchId}/complete`,
        {
          scoreTeamA,
          scoreTeamB,
        },
      );
      setLocalMatch(updated);
      alert("Partie terminée avec succès");
    } catch (e: any) {
      console.error("Erreur lors de la finalisation:", e);
      setError(e.message || "Erreur lors de la finalisation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!localMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Partie introuvable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-nuffle-anthracite">
              {localMatch.name || "Partie offline"}
            </h1>
            <p className="text-gray-600 mt-1">
              {localMatch.teamA.name} vs {localMatch.teamB.name}
            </p>
            {localMatch.cup && (
              <p className="text-sm text-gray-600">
                Coupe: {localMatch.cup.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {localMatch.status === "pending" && (
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
              >
                Démarrer la partie
              </button>
            )}
            {localMatch.status === "in_progress" && (
              <>
                <button
                  onClick={handleSaveState}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  Terminer la partie
                </button>
              </>
            )}
            {localMatch.status === "completed" && (
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                Terminée: {localMatch.scoreTeamA} - {localMatch.scoreTeamB}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {localMatch.status === "pending" && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-nuffle-anthracite text-lg mb-4">
              La partie n'a pas encore été démarrée
            </p>
            <p className="text-gray-600 mb-4">
              Cliquez sur "Démarrer la partie" pour commencer
            </p>
          </div>
        )}

        {localMatch.status === "waiting_for_player" && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-nuffle-anthracite mb-4">
                En attente de validation des joueurs
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Équipe A</p>
                  <p className="font-semibold text-nuffle-anthracite">
                    {localMatch.teamA.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {localMatch.teamA.owner.coachName}
                  </p>
                  {localMatch.teamAOwnerValidated ? (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      ✓ Validé
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      En attente
                    </span>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Équipe B</p>
                  <p className="font-semibold text-nuffle-anthracite">
                    {localMatch.teamB.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {localMatch.teamB.owner.coachName}
                  </p>
                  {localMatch.teamBOwnerValidated ? (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      ✓ Validé
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      En attente
                    </span>
                  )}
                </div>
              </div>
            </div>
            {localMatch.shareToken && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-nuffle-anthracite mb-3">
                  Lien de partage
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Partagez ce lien avec le second joueur pour qu'il puisse valider sa participation :
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/local-matches/share/${localMatch.shareToken}`}
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/local-matches/share/${localMatch.shareToken}`;
                      navigator.clipboard.writeText(url);
                      alert("Lien copié dans le presse-papiers !");
                    }}
                    className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {localMatch.status === "in_progress" && gameState && (
          <div className="space-y-4">
            <GameScoreboard
              teamAName={gameState.teamNames.teamA}
              teamBName={gameState.teamNames.teamB}
              scoreA={gameState.score.teamA}
              scoreB={gameState.score.teamB}
              turn={gameState.turn}
              half={gameState.half}
              currentPlayer={gameState.currentPlayer}
            />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <GameBoardWithDugouts
                  gameState={gameState}
                  onPlayerClick={(playerId) => setSelectedPlayerId(playerId)}
                  selectedPlayerId={selectedPlayerId}
                />
              </div>
              <div>
                {selectedPlayerId && (
                  <PlayerDetails
                    player={
                      gameState.players.find((p) => p.id === selectedPlayerId) ||
                      null
                    }
                  />
                )}
              </div>
            </div>
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded">
              <p className="font-semibold mb-2">Mode Offline</p>
              <p className="text-sm">
                Cette partie se joue en mode offline. N'oubliez pas de sauvegarder régulièrement votre progression.
              </p>
            </div>
          </div>
        )}

        {localMatch.status === "completed" && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-nuffle-anthracite mb-4">
              Partie terminée
            </h2>
            <p className="text-4xl font-bold text-nuffle-anthracite mb-4">
              {localMatch.scoreTeamA} - {localMatch.scoreTeamB}
            </p>
            <p className="text-gray-600">
              {localMatch.completedAt &&
                `Terminée le ${new Date(localMatch.completedAt).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

