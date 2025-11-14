"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../../auth-client";

type ActionType = "passe" | "reception" | "td" | "blocage" | "blitz" | "elimination" | "aggression" | "sprint" | "esquive" | "apothicaire";

type LocalMatchAction = {
  id: string;
  half: number;
  turn: number;
  actionType: ActionType;
  playerId: string;
  playerName: string;
  playerTeam: "A" | "B";
  opponentId: string | null;
  opponentName: string | null;
  diceResult: number | null;
  fumble: boolean;
  createdAt: string;
};

type Player = {
  id: string;
  name: string;
  number: number;
};

interface LocalMatchActionsProps {
  matchId: string;
  teamA: {
    id: string;
    name: string;
    players: Player[];
  };
  teamB: {
    id: string;
    name: string;
    players: Player[];
  };
}

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

async function deleteJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function LocalMatchActions({
  matchId,
  teamA,
  teamB,
}: LocalMatchActionsProps) {
  const [actions, setActions] = useState<LocalMatchAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulaire pour ajouter une action
  const [formData, setFormData] = useState({
    half: 1,
    turn: 1,
    actionType: "passe" as ActionType,
    playerId: "",
    playerTeam: "A" as "A" | "B",
    opponentId: "",
    opponentTeam: "A" as "A" | "B",
    diceResult: "" as string | number,
    fumble: false,
  });

  useEffect(() => {
    loadActions();
  }, [matchId]);

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { actions: data } = await fetchJSON(`/local-match/${matchId}/actions`);
      setActions(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des actions:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAction = async () => {
    if (!formData.playerId) {
      setError("Veuillez sélectionner un joueur");
      return;
    }

    // Trouver le joueur sélectionné
    const selectedTeam = formData.playerTeam === "A" ? teamA : teamB;
    const player = selectedTeam?.players?.find((p) => p.id === formData.playerId);
    
    if (!player) {
      setError("Joueur introuvable");
      return;
    }

    // Trouver l'adversaire si nécessaire (pour élimination, blocage, blitz, agression)
    let opponentId: string | null = null;
    let opponentName: string | null = null;
    
    const actionsWithOpponent = ["elimination", "blocage", "blitz", "aggression"];
    if (actionsWithOpponent.includes(formData.actionType) && formData.opponentId) {
      const opponentTeam = formData.opponentTeam === "A" ? teamA : teamB;
      const opponent = opponentTeam?.players?.find((p) => p.id === formData.opponentId);
      if (opponent) {
        opponentId = opponent.id;
        opponentName = opponent.name;
      }
    }

    // Traiter le résultat du dé (2D6 = 2 à 12, mais on accepte n'importe quel nombre positif)
    let diceResult: number | null = null;
    if (formData.diceResult !== "" && formData.diceResult !== null) {
      const diceValue = typeof formData.diceResult === "string" ? parseInt(formData.diceResult, 10) : formData.diceResult;
      if (!isNaN(diceValue) && diceValue >= 1) {
        diceResult = diceValue;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await postJSON(`/local-match/${matchId}/actions`, {
        half: formData.half,
        turn: formData.turn,
        actionType: formData.actionType,
        playerId: player.id,
        playerName: player.name,
        playerTeam: formData.playerTeam,
        opponentId,
        opponentName,
        diceResult,
        fumble: formData.fumble,
      });
      
      // Réinitialiser le formulaire
      setFormData({
        half: 1,
        turn: 1,
        actionType: "passe",
        playerId: "",
        playerTeam: "A",
        opponentId: "",
        opponentTeam: "A",
        diceResult: "",
        fumble: false,
      });
      loadActions();
    } catch (e: any) {
      console.error("Erreur lors de l'ajout de l'action:", e);
      setError(e.message || "Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette action ?")) {
      return;
    }

    try {
      await deleteJSON(`/local-match/${matchId}/actions/${actionId}`);
      loadActions();
    } catch (e: any) {
      console.error("Erreur lors de la suppression:", e);
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "passe":
        return "Passe";
      case "reception":
        return "Réception";
      case "td":
        return "Touchdown";
      case "blocage":
        return "Blocage";
      case "blitz":
        return "Blitz";
      case "elimination":
        return "Élimination";
      case "aggression":
        return "Agression";
      case "sprint":
        return "Sprint";
      case "esquive":
        return "Esquive";
      case "apothicaire":
        return "Apothicaire";
      default:
        return type;
    }
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case "passe":
      case "reception":
        return "bg-blue-100 text-blue-800";
      case "td":
        return "bg-green-100 text-green-800";
      case "blocage":
      case "blitz":
        return "bg-yellow-100 text-yellow-800";
      case "elimination":
      case "aggression":
        return "bg-red-100 text-red-800";
      case "sprint":
      case "esquive":
        return "bg-purple-100 text-purple-800";
      case "apothicaire":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const currentTeam = formData.playerTeam === "A" ? teamA : teamB;
  const opponentTeam = formData.opponentTeam === "A" ? teamA : teamB;

  // Vérifier que les équipes ont des joueurs
  const currentTeamPlayers = Array.isArray(currentTeam?.players) ? currentTeam.players : [];
  const opponentTeamPlayers = Array.isArray(opponentTeam?.players) ? opponentTeam.players : [];

  // Debug: afficher un message si pas de joueurs
  useEffect(() => {
    if (currentTeamPlayers.length === 0 && teamA && teamB) {
      console.warn("Aucun joueur trouvé pour l'équipe sélectionnée", {
        teamA: teamA.name,
        teamB: teamB.name,
        teamAPlayers: teamA.players?.length || 0,
        teamBPlayers: teamB.players?.length || 0,
        currentTeam: formData.playerTeam,
      });
    }
  }, [formData.playerTeam, teamA, teamB, currentTeamPlayers.length]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-nuffle-anthracite mb-4">
          Actions de la partie
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Formulaire d'ajout d'action - toujours visible */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Ajouter une action</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mi-temps
              </label>
              <select
                value={formData.half}
                onChange={(e) =>
                  setFormData({ ...formData, half: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tour
              </label>
              <select
                value={formData.turn}
                onChange={(e) =>
                  setFormData({ ...formData, turn: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'action
              </label>
              <select
                value={formData.actionType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actionType: e.target.value as ActionType,
                    opponentId: "", // Réinitialiser l'adversaire si on change le type
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="passe">Passe</option>
                <option value="reception">Réception</option>
                <option value="td">Touchdown</option>
                <option value="blocage">Blocage</option>
                <option value="blitz">Blitz</option>
                <option value="elimination">Élimination</option>
                <option value="aggression">Agression</option>
                <option value="sprint">Sprint</option>
                <option value="esquive">Esquive</option>
                <option value="apothicaire">Apothicaire</option>
              </select>
            </div>

            {/* Équipe et Joueur sur la même ligne */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Équipe du joueur
                </label>
                <select
                  value={formData.playerTeam}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      playerTeam: e.target.value as "A" | "B",
                      playerId: "", // Réinitialiser le joueur si on change d'équipe
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="A">{teamA.name} (A)</option>
                  <option value="B">{teamB.name} (B)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Joueur
                </label>
                {currentTeamPlayers.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-700 text-sm">
                    ⚠️ Aucun joueur disponible pour cette équipe
                  </div>
                ) : (
                  <select
                    value={formData.playerId}
                    onChange={(e) =>
                      setFormData({ ...formData, playerId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Sélectionner un joueur</option>
                    {currentTeamPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        #{player.number} - {player.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {["elimination", "blocage", "blitz", "aggression"].includes(formData.actionType) && (
              <>
                {/* Équipe et Adversaire sur la même ligne */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Équipe de l'adversaire
                    </label>
                    <select
                      value={formData.opponentTeam}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          opponentTeam: e.target.value as "A" | "B",
                          opponentId: "", // Réinitialiser l'adversaire si on change d'équipe
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="A">{teamA.name} (A)</option>
                      <option value="B">{teamB.name} (B)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adversaire (optionnel)
                    </label>
                    <select
                      value={formData.opponentId}
                      onChange={(e) =>
                        setFormData({ ...formData, opponentId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Aucun adversaire</option>
                      {opponentTeamPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number} - {player.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Résultat du dé et Fumble sur la même ligne */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Résultat du dé (optionnel, 2D6)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.diceResult}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      diceResult: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="2-12 (2D6)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.fumble}
                    onChange={(e) =>
                      setFormData({ ...formData, fumble: e.target.checked })
                    }
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Échec (Fumble)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAddAction}
              disabled={saving || !formData.playerId}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Ajout..." : "Ajouter l'action"}
            </button>
          </div>
        </div>

      {/* Liste des actions */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Actions enregistrées</h3>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Chargement des actions...</p>
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Aucune action enregistrée</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Mi-temps
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Tour
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Joueur
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Adversaire
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Dé
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Fumble
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr
                  key={action.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {action.half}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {action.turn}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getActionTypeColor(
                        action.actionType,
                      )}`}
                    >
                      {getActionTypeLabel(action.actionType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <span
                      className={
                        action.playerTeam === "A"
                          ? "text-red-600 font-semibold"
                          : "text-blue-600 font-semibold"
                      }
                    >
                      {action.playerName} ({action.playerTeam})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {action.opponentName || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {action.diceResult !== null && action.diceResult !== undefined ? (
                      <span className="font-mono font-semibold">{action.diceResult}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {action.fumble ? (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        Oui
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

