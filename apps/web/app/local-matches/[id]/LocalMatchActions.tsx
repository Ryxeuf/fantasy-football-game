"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../../auth-client";

type ActionType = "passe" | "reception" | "td" | "blocage" | "blitz" | "transmission" | "aggression" | "sprint" | "esquive" | "apothicaire" | "interception";

// Icônes pour les types d'actions
const ActionIcons: Record<ActionType, string> = {
  passe: "🏈",
  reception: "✋",
  td: "🏆",
  blocage: "💥",
  blitz: "⚡",
  transmission: "🔄",
  aggression: "👊",
  sprint: "💨",
  esquive: "🌀",
  apothicaire: "💉",
  interception: "🛡️",
};

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
  playerState: string | null;
  armorBroken: boolean;
  opponentState: string | null;
  passType: string | null;
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
    playerState: "" as string,
    armorBroken: false,
    opponentState: "" as string,
    passType: "" as string,
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

    // Trouver l'adversaire si nécessaire (pour blocage, blitz, agression)
    let opponentId: string | null = null;
    let opponentName: string | null = null;
    
    const actionsWithOpponent = ["blocage", "blitz", "aggression"];
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

    // Traiter les champs spécifiques pour blitz et blocage
    let armorBroken = false;
    let opponentState: string | null = null;
    if (["blitz", "blocage"].includes(formData.actionType)) {
      armorBroken = formData.armorBroken;
      if (armorBroken && formData.opponentState) {
        opponentState = formData.opponentState;
      }
    }

    // Traiter le type de passe
    let passType: string | null = null;
    if (formData.actionType === "passe" && formData.passType) {
      passType = formData.passType;
    }

    // Traiter l'état du joueur en cas d'échec
    // Sauf pour passe, transmission, réception, apothicaire, interception
    const actionsWithoutPlayerState = ["passe", "transmission", "reception", "apothicaire", "interception"];
    let playerState: string | null = null;
    if (formData.fumble && !actionsWithoutPlayerState.includes(formData.actionType) && formData.playerState) {
      playerState = formData.playerState;
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
        playerState,
        armorBroken,
        opponentState,
        passType,
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
        playerState: "",
        armorBroken: false,
        opponentState: "",
        passType: "",
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
      case "transmission":
        return "Transmission";
      case "aggression":
        return "Agression";
      case "sprint":
        return "Sprint";
      case "esquive":
        return "Esquive";
      case "apothicaire":
        return "Apothicaire";
      case "interception":
        return "Interception";
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
      case "transmission":
        return "bg-cyan-100 text-cyan-800";
      case "aggression":
        return "bg-red-100 text-red-800";
      case "sprint":
      case "esquive":
        return "bg-purple-100 text-purple-800";
      case "apothicaire":
        return "bg-indigo-100 text-indigo-800";
      case "interception":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const currentTeam = formData.playerTeam === "A" ? teamA : teamB;
  const opponentTeam = formData.opponentTeam === "A" ? teamA : teamB;

  // Vérifier que les équipes ont des joueurs
  // S'assurer que les joueurs sont bien chargés avant de les utiliser
  const currentTeamPlayers = Array.isArray(currentTeam?.players) && currentTeam.players.length > 0 
    ? currentTeam.players 
    : (currentTeam?.players === undefined ? [] : []);
  const opponentTeamPlayers = Array.isArray(opponentTeam?.players) && opponentTeam.players.length > 0
    ? opponentTeam.players
    : (opponentTeam?.players === undefined ? [] : []);

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
    <div className="space-y-6">
      {/* Header avec style scoreboard */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-6 shadow-2xl border-4 border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-white tracking-wider uppercase">
            📊 Actions de la partie
          </h2>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border-2 border-white/20">
              <div className="text-xs text-gray-300 uppercase tracking-wider">Mi-temps</div>
              <div className="text-2xl font-bold text-white">{formData.half}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border-2 border-white/20">
              <div className="text-xs text-gray-300 uppercase tracking-wider">Tour</div>
              <div className="text-2xl font-bold text-white">{formData.turn}</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border-2 border-red-500 text-red-700 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout d'action - style carte de jeu */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-6 shadow-xl border-2 border-gray-200 relative overflow-hidden">
        {/* Effet de terrain en arrière-plan */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,0,0,0.1) 20px, rgba(0,0,0,0.1) 21px),
                              repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.1) 20px, rgba(0,0,0,0.1) 21px)`,
          }}></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-4xl">{ActionIcons[formData.actionType]}</div>
            <h3 className="text-2xl font-bold text-gray-900">Ajouter une action</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sélecteurs de mi-temps et tour - style scoreboard */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border-2 border-gray-700 shadow-lg">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Mi-temps
                </label>
                <select
                  value={formData.half}
                  onChange={(e) =>
                    setFormData({ ...formData, half: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-bold text-lg text-gray-900 focus:ring-4 focus:ring-nuffle-gold focus:border-nuffle-gold transition-all cursor-pointer hover:border-nuffle-gold"
                >
                  <option value={1}>1ère mi-temps</option>
                  <option value={2}>2ème mi-temps</option>
                </select>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border-2 border-gray-700 shadow-lg">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Tour
                </label>
                <select
                  value={formData.turn}
                  onChange={(e) =>
                    setFormData({ ...formData, turn: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-bold text-lg text-gray-900 focus:ring-4 focus:ring-nuffle-gold focus:border-nuffle-gold transition-all cursor-pointer hover:border-nuffle-gold"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
                    <option key={t} value={t}>
                      Tour {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type d'action - carte visuelle */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                Type d'action
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {(["passe", "reception", "td", "blocage", "blitz", "transmission", "aggression", "sprint", "esquive", "apothicaire", "interception"] as ActionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        actionType: type,
                        opponentId: "",
                      })
                    }
                    className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 active:scale-95 ${
                      formData.actionType === type
                        ? "bg-gradient-to-br from-nuffle-gold to-nuffle-bronze border-nuffle-gold shadow-lg scale-105"
                        : "bg-white border-gray-300 hover:border-nuffle-gold hover:shadow-md"
                    }`}
                  >
                    <div className="text-3xl mb-2">{ActionIcons[type]}</div>
                    <div className={`text-xs font-semibold ${
                      formData.actionType === type ? "text-white" : "text-gray-700"
                    }`}>
                      {getActionTypeLabel(type)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type de passe - affiché uniquement pour les passes */}
            {formData.actionType === "passe" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                  Type de passe
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: "", label: "Standard", icon: "🏈" },
                    { value: "rapide", label: "Rapide", icon: "⚡" },
                    { value: "courte", label: "Courte", icon: "📏" },
                    { value: "longue", label: "Longue", icon: "📐" },
                    { value: "longue_bombe", label: "Longue bombe", icon: "💣" },
                  ].map((pass) => (
                    <button
                      key={pass.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, passType: pass.value })
                      }
                      className={`p-3 rounded-xl border-2 transition-all transform hover:scale-105 ${
                        formData.passType === pass.value
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 text-white shadow-lg"
                          : "bg-white border-gray-300 hover:border-blue-400 text-gray-700"
                      }`}
                    >
                      <div className="text-2xl mb-1">{pass.icon}</div>
                      <div className="text-xs font-semibold">{pass.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Équipe et Joueur - style carte de joueur */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                Joueur
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
                  <label className="block text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                    Équipe
                  </label>
                  <select
                    value={formData.playerTeam}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        playerTeam: e.target.value as "A" | "B",
                        playerId: "",
                      })
                    }
                    className={`w-full px-4 py-3 rounded-lg font-semibold text-gray-900 border-2 transition-all ${
                      formData.playerTeam === "A"
                        ? "border-red-500 bg-red-50"
                        : "border-blue-500 bg-blue-50"
                    } focus:ring-4 focus:ring-nuffle-gold`}
                  >
                    <option value="A" className="bg-white">{teamA.name} (A)</option>
                    <option value="B" className="bg-white">{teamB.name} (B)</option>
                  </select>
                </div>

                <div className={`bg-gradient-to-br rounded-xl p-4 border-2 ${
                  formData.playerTeam === "A"
                    ? "from-red-50 to-red-100 border-red-200"
                    : "from-blue-50 to-blue-100 border-blue-200"
                }`}>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Sélectionner un joueur
                  </label>
                  {currentTeamPlayers.length === 0 ? (
                    <div className="w-full px-4 py-3 border-2 border-red-300 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
                      ⚠️ Aucun joueur disponible
                    </div>
                  ) : (
                    <select
                      value={formData.playerId}
                      onChange={(e) =>
                        setFormData({ ...formData, playerId: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-lg font-semibold text-gray-900 border-2 transition-all ${
                        formData.playerTeam === "A"
                          ? "border-red-500 bg-white focus:border-red-600"
                          : "border-blue-500 bg-white focus:border-blue-600"
                      } focus:ring-4 focus:ring-nuffle-gold`}
                      required
                    >
                      <option value="">Choisir un joueur...</option>
                      {currentTeamPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number} - {player.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {["blocage", "blitz", "aggression"].includes(formData.actionType) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                  Adversaire
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                    <label className="block text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">
                      Équipe adverse
                    </label>
                    <select
                      value={formData.opponentTeam}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          opponentTeam: e.target.value as "A" | "B",
                          opponentId: "",
                        })
                      }
                      className={`w-full px-4 py-3 rounded-lg font-semibold text-gray-900 border-2 transition-all ${
                        formData.opponentTeam === "A"
                          ? "border-red-500 bg-red-50"
                          : "border-blue-500 bg-blue-50"
                      } focus:ring-4 focus:ring-nuffle-gold`}
                    >
                      <option value="A" className="bg-white">{teamA.name} (A)</option>
                      <option value="B" className="bg-white">{teamB.name} (B)</option>
                    </select>
                  </div>

                  <div className={`bg-gradient-to-br rounded-xl p-4 border-2 ${
                    formData.opponentTeam === "A"
                      ? "from-red-50 to-red-100 border-red-200"
                      : "from-blue-50 to-blue-100 border-blue-200"
                  }`}>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Sélectionner l'adversaire
                    </label>
                    <select
                      value={formData.opponentId}
                      onChange={(e) =>
                        setFormData({ ...formData, opponentId: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-lg font-semibold text-gray-900 border-2 transition-all ${
                        formData.opponentTeam === "A"
                          ? "border-red-500 bg-white focus:border-red-600"
                          : "border-blue-500 bg-white focus:border-blue-600"
                      } focus:ring-4 focus:ring-nuffle-gold`}
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
              </div>
            )}

            {/* Champs spécifiques pour blitz et blocage */}
            {["blitz", "blocage"].includes(formData.actionType) && (
              <div className="md:col-span-2 space-y-4">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border-2 border-yellow-300">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.armorBroken}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          armorBroken: e.target.checked,
                          opponentState: e.target.checked ? formData.opponentState : "",
                        })
                      }
                      className="w-6 h-6 text-yellow-600 border-2 border-gray-400 rounded focus:ring-4 focus:ring-yellow-500 cursor-pointer transform group-hover:scale-110 transition-transform"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🛡️</span>
                      <span className="text-lg font-bold text-gray-900">
                        Armure passée
                      </span>
                    </div>
                  </label>
                </div>

                {formData.armorBroken && (
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-300">
                    <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                      État de l'adversaire
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "", label: "Aucun", icon: "➖" },
                        { value: "sonne", label: "Sonné", icon: "😵" },
                        { value: "ko", label: "KO", icon: "💤" },
                        { value: "elimine", label: "Éliminé", icon: "💀" },
                      ].map((state) => (
                        <button
                          key={state.value}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, opponentState: state.value })
                          }
                          className={`p-3 rounded-xl border-2 transition-all transform hover:scale-105 ${
                            formData.opponentState === state.value
                              ? "bg-gradient-to-br from-red-500 to-red-600 border-red-600 text-white shadow-lg"
                              : "bg-white border-gray-300 hover:border-red-400 text-gray-700"
                          }`}
                        >
                          <div className="text-2xl mb-1">{state.icon}</div>
                          <div className="text-xs font-semibold">{state.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Résultat du dé et Fumble */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-300">
                <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
                  🎲 Résultat du dé (2D6)
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
                  placeholder="2-12"
                  className="w-full px-4 py-3 border-2 border-purple-400 rounded-lg font-bold text-xl text-center text-gray-900 focus:ring-4 focus:ring-purple-500 focus:border-purple-600"
                />
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-300 flex items-center justify-center">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.fumble}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fumble: e.target.checked,
                        playerState: e.target.checked ? formData.playerState : "",
                      })
                    }
                    className="w-6 h-6 text-red-600 border-2 border-gray-400 rounded focus:ring-4 focus:ring-red-500 cursor-pointer transform group-hover:scale-110 transition-transform"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💥</span>
                    <span className="text-lg font-bold text-gray-900">
                      Échec (Fumble)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* État du joueur en cas d'échec */}
            {formData.fumble && !["passe", "transmission", "reception", "apothicaire", "interception"].includes(formData.actionType) && (
              <div className="md:col-span-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-300">
                <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                  État du joueur (en cas d'échec)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: "", label: "Aucun", icon: "✅" },
                    { value: "sonne", label: "Sonné", icon: "😵" },
                    { value: "ko", label: "KO", icon: "💤" },
                    { value: "elimine", label: "Éliminé", icon: "💀" },
                  ].map((state) => (
                    <button
                      key={state.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, playerState: state.value })
                      }
                      className={`p-3 rounded-xl border-2 transition-all transform hover:scale-105 ${
                        formData.playerState === state.value
                          ? "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-600 text-white shadow-lg"
                          : "bg-white border-gray-300 hover:border-orange-400 text-gray-700"
                      }`}
                    >
                      <div className="text-2xl mb-1">{state.icon}</div>
                      <div className="text-xs font-semibold">{state.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleAddAction}
              disabled={saving || !formData.playerId}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-3 border-2 border-green-800"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>✅</span>
                  <span>Enregistrer l'action</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des actions - style timeline de match */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-6 shadow-xl border-2 border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📋</span>
          <h3 className="text-2xl font-bold text-gray-900">Actions enregistrées</h3>
          {actions.length > 0 && (
            <span className="ml-auto px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-full font-bold text-sm">
              {actions.length} action{actions.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
            <p className="text-gray-600 font-semibold">Chargement des actions...</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">🏈</div>
            <p className="text-gray-600 font-semibold text-lg">Aucune action enregistrée</p>
            <p className="text-gray-500 text-sm mt-2">Les actions apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-nuffle-gold hover:shadow-lg transition-all transform hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Informations principales */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {/* Badge mi-temps et tour */}
                      <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white px-3 py-1 rounded-lg font-bold text-sm">
                          MT{action.half}
                        </div>
                        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white px-3 py-1 rounded-lg font-bold text-sm">
                          T{action.turn}
                        </div>
                      </div>
                      
                      {/* Type d'action avec icône */}
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${getActionTypeColor(action.actionType)}`}>
                        <span className="text-lg">{ActionIcons[action.actionType]}</span>
                        <span>{getActionTypeLabel(action.actionType)}</span>
                      </div>
                    </div>

                    {/* Joueur */}
                    <div className="mb-2">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                        action.playerTeam === "A"
                          ? "bg-red-100 text-red-800 border-2 border-red-300"
                          : "bg-blue-100 text-blue-800 border-2 border-blue-300"
                      }`}>
                        <span className="text-lg">👤</span>
                        <span>{action.playerName}</span>
                        <span className="text-xs opacity-75">({action.playerTeam})</span>
                      </div>
                    </div>

                    {/* Détails supplémentaires */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {action.opponentName && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs font-semibold border border-orange-300">
                          <span>⚔️</span>
                          <span>vs {action.opponentName}</span>
                        </div>
                      )}
                      
                      {action.diceResult !== null && action.diceResult !== undefined && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold border border-purple-300">
                          <span>🎲</span>
                          <span className="font-mono">{action.diceResult}</span>
                        </div>
                      )}
                      
                      {action.armorBroken && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-semibold border border-green-300">
                          <span>🛡️</span>
                          <span>Armure passée</span>
                        </div>
                      )}
                      
                      {action.fumble && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-semibold border border-red-300">
                          <span>💥</span>
                          <span>Fumble</span>
                        </div>
                      )}
                      
                      {action.passType && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold border border-blue-300">
                          <span>🏈</span>
                          <span>
                            {action.passType === "rapide" ? "Rapide" :
                             action.passType === "courte" ? "Courte" :
                             action.passType === "longue" ? "Longue" :
                             action.passType === "longue_bombe" ? "Longue bombe" :
                             action.passType}
                          </span>
                        </div>
                      )}
                      
                      {action.opponentState && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-semibold border border-red-300">
                          <span>😵</span>
                          <span>
                            {action.opponentState === "sonne" ? "Sonné" :
                             action.opponentState === "ko" ? "KO" :
                             action.opponentState === "elimine" ? "Éliminé" :
                             action.opponentState}
                          </span>
                        </div>
                      )}
                      
                      {action.playerState && (
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs font-semibold border border-orange-300">
                          <span>⚠️</span>
                          <span>
                            {action.playerState === "sonne" ? "Sonné" :
                             action.playerState === "ko" ? "KO" :
                             action.playerState === "elimine" ? "Éliminé" :
                             action.playerState}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bouton supprimer */}
                  <button
                    onClick={() => handleDeleteAction(action.id)}
                    className="px-4 py-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg font-semibold transition-all transform hover:scale-110 border-2 border-red-300 hover:border-red-600"
                    title="Supprimer cette action"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

