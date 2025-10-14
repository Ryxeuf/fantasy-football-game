"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../../auth-client";
import SkillTooltip from "../../components/SkillTooltip";
import TeamInfoEditor from "../../components/TeamInfoEditor";
import { getPlayerCost } from "@bb/game-engine";
import { getPositionDisplayName } from "../../utils/position-utils";

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

async function putJSON(path: string, body: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

interface Player {
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
}

interface AvailablePosition {
  key: string;
  name: string;
  cost: number;
  currentCount: number;
  maxCount: number;
  canAdd: boolean;
  stats: {
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
    skills: string;
  };
}

export default function TeamEditPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [availablePositions, setAvailablePositions] = useState<AvailablePosition[]>([]);
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [newPlayerForm, setNewPlayerForm] = useState({
    position: '',
    name: '',
    number: 1
  });

  // Gestion du modal - empêcher le scroll de la page et gérer la touche Échap
  useEffect(() => {
    if (showAddPlayerForm) {
      // Empêcher le scroll de la page
      document.body.style.overflow = 'hidden';
      
      // Gérer la touche Échap
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAddPlayerForm(false);
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showAddPlayerForm]);

  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/")[3]
      : "";

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        const d = await fetchJSON(`/team/${id}`);
        console.log("Données équipe chargées:", d);
        setData(d);
        setPlayers(d.team?.players || []);
        
        // Charger les positions disponibles
        const positionsData = await fetchJSON(`/team/${id}/available-positions`);
        console.log("Positions disponibles:", positionsData);
        setAvailablePositions(positionsData.availablePositions || []);
      } catch (e: any) {
        console.error("Erreur lors du chargement:", e);
        setError(e.message || "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const team = data?.team;
  const match = data?.currentMatch;
  const canEdit = !match || (match.status !== "pending" && match.status !== "active");

  // Rediriger si l'équipe ne peut pas être modifiée
  useEffect(() => {
    if (!loading && !canEdit) {
      window.location.href = `/me/teams/${id}`;
    }
  }, [loading, canEdit, id]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Vérifier les noms non vides
    players.forEach((player, index) => {
      if (!player.name || player.name.trim() === "") {
        errors[`name_${index}`] = "Le nom ne peut pas être vide";
      }
    });

    // Vérifier les numéros uniques et valides
    const numbers = players.map(p => p.number);
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      errors["numbers"] = "Les numéros de joueurs doivent être uniques";
    }

    players.forEach((player, index) => {
      if (player.number < 1 || player.number > 99 || !Number.isInteger(player.number)) {
        errors[`number_${index}`] = "Le numéro doit être un entier entre 1 et 99";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await putJSON(`/team/${id}`, {
        players: players.map(p => ({
          id: p.id,
          name: p.name.trim(),
          number: p.number
        }))
      });
      
      // Rediriger vers la page de visualisation
      window.location.href = `/me/teams/${id}`;
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handlePlayerChange = (index: number, field: keyof Player, value: string | number) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    setPlayers(newPlayers);
    
    // Effacer l'erreur de validation pour ce champ
    const errorKey = `${field}_${index}`;
    if (validationErrors[errorKey]) {
      const newErrors = { ...validationErrors };
      delete newErrors[errorKey];
      setValidationErrors(newErrors);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce joueur ?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/team/${id}/players/${playerId}`, {
        method: "DELETE",
        headers: {
          Authorization: localStorage.getItem("auth_token") ? `Bearer ${localStorage.getItem("auth_token")}` : "",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la suppression");
      }

      // Recharger les données
      const d = await fetchJSON(`/team/${id}`);
      setData(d);
      setPlayers(d.team?.players || []);
      
      const positionsData = await fetchJSON(`/team/${id}/available-positions`);
      setAvailablePositions(positionsData.availablePositions || []);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression du joueur");
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerForm.position || !newPlayerForm.name.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/team/${id}/players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: localStorage.getItem("auth_token") ? `Bearer ${localStorage.getItem("auth_token")}` : "",
        },
        body: JSON.stringify(newPlayerForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'ajout du joueur");
      }

      // Recharger les données
      const d = await fetchJSON(`/team/${id}`);
      setData(d);
      setPlayers(d.team?.players || []);
      
      const positionsData = await fetchJSON(`/team/${id}/available-positions`);
      setAvailablePositions(positionsData.availablePositions || []);

      // Réinitialiser le formulaire
      setNewPlayerForm({ position: '', name: '', number: 1 });
      setShowAddPlayerForm(false);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'ajout du joueur");
    }
  };

  const getNextAvailableNumber = () => {
    const usedNumbers = players.map(p => p.number);
    for (let i = 1; i <= 99; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }
    return 1;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return null; // Redirection en cours
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Modifier l'équipe</h1>
          <div className="text-lg text-gray-600 mt-1">{team?.name}</div>
          <div className="text-sm text-gray-500 mt-1">
            Roster: <span className="capitalize">{team?.roster}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <a
            href={`/me/teams/${id}`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {validationErrors.numbers && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {validationErrors.numbers}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Modification des joueurs</h2>
              <div className="text-sm text-gray-600 mt-1">
                Vous pouvez modifier le nom et le numéro de chaque joueur, ou ajouter/supprimer des joueurs
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  console.log("Clic sur ajouter joueur, players.length:", players.length);
                  const nextNumber = getNextAvailableNumber();
                  console.log("Prochain numéro disponible:", nextNumber);
                  setNewPlayerForm({ position: '', name: '', number: nextNumber });
                  setShowAddPlayerForm(true);
                }}
                disabled={players.length >= 16}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                + Ajouter un joueur ({players.length}/16)
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 border border-gray-300 bg-blue-100 rounded"></span>
              Compétences de base
            </span>
            <span className="ml-4 inline-flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-yellow-400 bg-blue-100 rounded"></span>
              Compétences acquises
            </span>
            <span className="ml-4 text-gray-600">
              Joueurs: {players.length}/16
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">#</th>
                <th className="text-left p-4 font-medium text-gray-900">Nom</th>
                <th className="text-left p-4 font-medium text-gray-900">Position</th>
                <th className="text-left p-4 font-medium text-gray-900">Coût</th>
                <th className="text-left p-4 font-medium text-gray-900">MA</th>
                <th className="text-left p-4 font-medium text-gray-900">ST</th>
                <th className="text-left p-4 font-medium text-gray-900">AG</th>
                <th className="text-left p-4 font-medium text-gray-900">PA</th>
                <th className="text-left p-4 font-medium text-gray-900">AV</th>
                <th className="text-left p-4 font-medium text-gray-900">Compétences</th>
                <th className="text-left p-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {players.map((player, index) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={player.number}
                      onChange={(e) => handlePlayerChange(index, "number", parseInt(e.target.value) || 0)}
                      className={`w-16 px-2 py-1 border rounded text-center font-mono ${
                        validationErrors[`number_${index}`] ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {validationErrors[`number_${index}`] && (
                      <div className="text-xs text-red-600 mt-1">
                        {validationErrors[`number_${index}`]}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => handlePlayerChange(index, "name", e.target.value)}
                      className={`px-2 py-1 border rounded w-full ${
                        validationErrors[`name_${index}`] ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Nom du joueur"
                    />
                    {validationErrors[`name_${index}`] && (
                      <div className="text-xs text-red-600 mt-1">
                        {validationErrors[`name_${index}`]}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-gray-600">{getPositionDisplayName(player.position)}</td>
                  <td className="p-4 text-center font-mono text-sm">
                    {getPlayerCost(player.position, data?.roster || '').toLocaleString()} po
                  </td>
                  <td className="p-4 text-center font-mono">{player.ma}</td>
                  <td className="p-4 text-center font-mono">{player.st}</td>
                  <td className="p-4 text-center font-mono">{player.ag}</td>
                  <td className="p-4 text-center font-mono">{player.pa}</td>
                  <td className="p-4 text-center font-mono">{player.av}</td>
                  <td className="p-4">
                    <SkillTooltip 
                      skillsString={player.skills} 
                      teamName={team?.roster}
                      position={player.position}
                    />
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      disabled={players.length <= 11}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      title={players.length <= 11 ? "Une équipe doit avoir au minimum 11 joueurs" : "Supprimer ce joueur"}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ajout de joueur */}
      {showAddPlayerForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Fermer le modal si on clique sur l'arrière-plan
            if (e.target === e.currentTarget) {
              setShowAddPlayerForm(false);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-50 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Ajouter un nouveau joueur</h3>
              <button
                onClick={() => setShowAddPlayerForm(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                aria-label="Fermer le modal"
                title="Fermer (Échap)"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <select
                    value={newPlayerForm.position}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  >
                    <option value="">Sélectionner une position</option>
                    {availablePositions
                      .filter(pos => pos.canAdd)
                      .map(pos => (
                        <option key={pos.key} value={pos.key}>
                          {pos.name} ({pos.currentCount}/{pos.maxCount}) - {pos.cost}k po
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du joueur
                  </label>
                  <input
                    type="text"
                    value={newPlayerForm.name}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom du joueur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={newPlayerForm.number}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Aperçu des statistiques */}
              {newPlayerForm.position && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium text-gray-900 mb-2">Aperçu des statistiques :</h4>
                  {(() => {
                    const position = availablePositions.find(p => p.key === newPlayerForm.position);
                    if (!position) return null;
                    
                    return (
                      <div className="grid grid-cols-6 gap-4 text-sm">
                        <div><span className="font-medium">MA:</span> {position.stats.ma}</div>
                        <div><span className="font-medium">ST:</span> {position.stats.st}</div>
                        <div><span className="font-medium">AG:</span> {position.stats.ag}</div>
                        <div><span className="font-medium">PA:</span> {position.stats.pa}</div>
                        <div><span className="font-medium">AV:</span> {position.stats.av}</div>
                        <div><span className="font-medium">Compétences:</span> {position.stats.skills || "Aucune"}</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-3 mt-6 justify-end">
                <button
                  onClick={() => setShowAddPlayerForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddPlayer}
                  disabled={!newPlayerForm.position || !newPlayerForm.name.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Ajouter le joueur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Informations d'équipe */}
      {team && (
        <TeamInfoEditor
          teamId={team.id}
          initialInfo={{
            rerolls: team.rerolls || 0,
            cheerleaders: team.cheerleaders || 0,
            assistants: team.assistants || 0,
            apothecary: team.apothecary || false,
            dedicatedFans: team.dedicatedFans || 1,
          }}
          onUpdate={(info) => {
            setData((prev: any) => ({
              ...prev,
              team: { ...prev.team, ...info }
            }));
          }}
          disabled={!canEdit}
        />
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
        <div className="font-semibold">ℹ️ Informations</div>
        <div className="text-sm mt-1">
          • Les statistiques (MA, ST, AG, PA, AV) et les compétences ne peuvent pas être modifiées
          <br />
          • Les numéros de joueurs doivent être uniques et compris entre 1 et 99
          <br />
          • Tous les joueurs doivent avoir un nom
          <br />
          • Une équipe doit avoir entre 11 et 16 joueurs (règles Blood Bowl)
          <br />
          • Chaque position a des limites min/max selon le roster
          <br />
          • Vous pouvez ajouter/supprimer des joueurs tant que l'équipe n'est pas engagée dans un match
        </div>
      </div>
    </div>
  );
}

