"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../../auth-client";
import SkillTooltip from "../../components/SkillTooltip";
import TeamInfoEditor from "../../components/TeamInfoEditor";
import { 
  getPlayerCost, 
  getDisplayName,
  SKILLS_DEFINITIONS,
  getNextAdvancementPspCost, 
  SURCHARGE_PER_ADVANCEMENT,
  getPositionCategoryAccess,
  type AdvancementType
} from "@bb/game-engine";
import { useLanguage } from "../../../../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [rosterName, setRosterName] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
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

  // UI ajout de compétence
  const [addingSkillFor, setAddingSkillFor] = useState<string | null>(null);
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<"General"|"Agility"|"Strength"|"Passing"|"Mutation"|"Trait"|"">("");
  const [selectedAdvType, setSelectedAdvType] = useState<AdvancementType>('primary');
  const [isRandom, setIsRandom] = useState(false);

  // Gestion du modal d'ajout de joueur - empêcher le scroll de la page et gérer la touche Échap
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

  // Gestion du modal d'ajout de compétence
  useEffect(() => {
    if (addingSkillFor) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setAddingSkillFor(null);
          setSelectedSkillSlug("");
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [addingSkillFor]);

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
        setTeamName(d.team?.name || "");
        
        // Charger le nom du roster depuis l'API selon la langue
        if (d?.team?.roster) {
          const lang = language === "en" ? "en" : "fr";
          try {
            const API_BASE_PUBLIC = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
            const rosterResponse = await fetch(`${API_BASE_PUBLIC}/api/rosters/${d.team.roster}?lang=${lang}`);
            if (rosterResponse.ok) {
              const rosterData = await rosterResponse.json();
              setRosterName(rosterData.roster?.name || d.team.roster);
            } else {
              setRosterName(d.team.roster);
            }
          } catch {
            setRosterName(d.team.roster);
          }
        }
        
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
  }, [id, language]);

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
    
    // Vérifier le nom de l'équipe
    if (!teamName || teamName.trim() === "") {
      errors["teamName"] = "Le nom de l'équipe ne peut pas être vide";
    }
    if (teamName.trim().length > 100) {
      errors["teamName"] = "Le nom de l'équipe ne peut pas dépasser 100 caractères";
    }
    
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
        name: teamName.trim(),
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

    // Vérifier le budget avant d'ajouter le joueur
    const selectedPosition = availablePositions.find(pos => pos.key === newPlayerForm.position);
    if (selectedPosition) {
      const currentTotalCost = players.reduce((total, player) => {
        return total + getPlayerCost(player.position, team?.roster || '');
      }, 0);
      
      const newTotalCost = currentTotalCost + selectedPosition.cost;
      const budgetInPo = (team?.initialBudget || 0) * 1000; // Convertir le budget de kpo en po
      if (newTotalCost > budgetInPo) {
        setError(`Budget dépassé ! Coût actuel: ${Math.round(currentTotalCost / 1000)}k po, nouveau coût: ${Math.round(newTotalCost / 1000)}k po, budget: ${team?.initialBudget || 0}k po`);
        return;
      }
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
      <div className="w-full p-6">
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
    <div className="w-full p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-4">Modifier l'équipe</h1>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'équipe
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                if (validationErrors["teamName"]) {
                  const newErrors = { ...validationErrors };
                  delete newErrors["teamName"];
                  setValidationErrors(newErrors);
                }
              }}
              className={`w-full max-w-md px-3 py-2 border rounded ${
                validationErrors["teamName"] ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Nom de l'équipe"
            />
            {validationErrors["teamName"] && (
              <div className="text-xs text-red-600 mt-1">
                {validationErrors["teamName"]}
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-500 mt-1">
            Roster: <span className="font-semibold">{rosterName || team?.roster || ''}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Budget initial: <span className="font-semibold">{team?.initialBudget?.toLocaleString()}k po</span>
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

      {validationErrors.teamName && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {validationErrors.teamName}
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
                title={players.length >= 16 ? "Maximum 16 joueurs par équipe" : "Ajouter un nouveau joueur"}
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
              <span className="w-3 h-3 border-2 border-orange-400 bg-blue-100 rounded"></span>
              Compétences acquises
            </span>
            <span className="ml-4 text-gray-600">
              Joueurs: {players.length}/16
            </span>
            <span className="ml-4 text-gray-600">
              Coût actuel: {Math.round(players.reduce((total, player: any) => {
                const base = getPlayerCost(player.position, team?.roster || '');
                let adv = 0; try { const a = JSON.parse(player.advancements || '[]'); adv = a.reduce((s: number, x: any) => {
                  const type = x?.type as keyof typeof SURCHARGE_PER_ADVANCEMENT | undefined;
                  return s + (type && SURCHARGE_PER_ADVANCEMENT[type] ? SURCHARGE_PER_ADVANCEMENT[type] : 0);
                }, 0); } catch {}
                return total + base + adv;
              }, 0) / 1000)}k po
            </span>
            <span className="ml-4 text-gray-600">
              Budget: {team?.initialBudget?.toLocaleString()}k po
            </span>
            <span className={`ml-4 ${players.reduce((total, player: any) => {
              const base = getPlayerCost(player.position, team?.roster || '');
              let adv = 0; try { const a = JSON.parse(player.advancements || '[]'); adv = a.reduce((s: number, x: any) => s + (x?.type === 'secondary' ? SURCHARGE_PER_ADVANCEMENT.secondary : SURCHARGE_PER_ADVANCEMENT.primary), 0); } catch {}
              return total + base + adv;
            }, 0) > (team?.initialBudget || 0) * 1000 ? 'text-red-600' : 'text-green-600'}`}>
              Restant: {Math.round(((team?.initialBudget || 0) * 1000 - players.reduce((total, player: any) => {
                const base = getPlayerCost(player.position, team?.roster || '');
                let adv = 0; try { const a = JSON.parse(player.advancements || '[]'); adv = a.reduce((s: number, x: any) => {
                  const type = x?.type as keyof typeof SURCHARGE_PER_ADVANCEMENT | undefined;
                  return s + (type && SURCHARGE_PER_ADVANCEMENT[type] ? SURCHARGE_PER_ADVANCEMENT[type] : 0);
                }, 0); } catch {}
                return total + base + adv;
              }, 0)) / 1000)}k po
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">#</th>
                <th className="text-left p-4 font-medium text-gray-900 w-48">Nom</th>
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
              {players.sort((a, b) => a.number - b.number).map((player, index) => (
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
                      className={`px-3 py-2 border rounded w-full ${
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
                  <td className="p-4 text-gray-600">{getDisplayName(player.position)}</td>
                  <td className="p-4 text-center font-mono text-sm">
                    {(() => {
                      const base = getPlayerCost(player.position, data?.roster || '');
                      let adv = 0; try { const a = JSON.parse((player as any).advancements || '[]'); adv = a.reduce((s: number, x: any) => {
                        const type = x?.type as keyof typeof SURCHARGE_PER_ADVANCEMENT | undefined;
                        return s + (type && SURCHARGE_PER_ADVANCEMENT[type] ? SURCHARGE_PER_ADVANCEMENT[type] : 0);
                      }, 0); } catch {}
                      return `${Math.round((base + adv)/1000)}k po`;
                    })()}
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddingSkillFor(player.id)}
                        className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                      >
                        + Compétence
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(player.id)}
                        disabled={players.length <= 11}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        title={players.length <= 11 ? "Une équipe doit avoir au minimum 11 joueurs" : "Supprimer ce joueur"}
                      >
                        Supprimer
                      </button>
                    </div>
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
              <div className="grid grid-cols-1 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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

      {/* Modal d'ajout de compétence - Version moderne */}
      {addingSkillFor && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAddingSkillFor(null);
              setSelectedSkillSlug("");
            }
          }}
        >
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {(() => {
              const player = players.find(p => p.id === addingSkillFor)! as any;
              let advCount = 0;
              try { advCount = JSON.parse(player.advancements || '[]')?.length || 0; } catch {}
              
              // Déterminer le type d'avancement réel (avec random ou non)
              const actualAdvType: AdvancementType = isRandom 
                ? (selectedAdvType === 'primary' ? 'random-primary' : 'random-secondary')
                : (selectedAdvType === 'primary' ? 'primary' : 'secondary');
              
              const psp = getNextAdvancementPspCost(advCount, actualAdvType);
              const surchargeK = (SURCHARGE_PER_ADVANCEMENT[actualAdvType] / 1000);
              const access = getPositionCategoryAccess(player.position);
              // Déterminer le type d'accès (primary ou secondary) en fonction du type d'avancement
              const categoryAccessType = (actualAdvType === 'random-primary' || actualAdvType === 'primary') ? 'primary' : 'secondary';
              const allowedCategories = categoryAccessType === 'primary' ? access.primary : access.secondary;
              
              // Catégories avec leurs codes et couleurs
              const categoryConfig: Record<string, { code: string; name: string; color: string; bgColor: string }> = {
                'General': { code: 'G', name: 'Générale', color: 'text-blue-700', bgColor: 'bg-blue-100 hover:bg-blue-200' },
                'Agility': { code: 'A', name: 'Agilité', color: 'text-green-700', bgColor: 'bg-green-100 hover:bg-green-200' },
                'Strength': { code: 'S', name: 'Force', color: 'text-red-700', bgColor: 'bg-red-100 hover:bg-red-200' },
                'Passing': { code: 'P', name: 'Passe', color: 'text-purple-700', bgColor: 'bg-purple-100 hover:bg-purple-200' },
                'Mutation': { code: 'M', name: 'Mutation', color: 'text-orange-700', bgColor: 'bg-orange-100 hover:bg-orange-200' },
                'Trait': { code: 'T', name: 'Traits', color: 'text-indigo-700', bgColor: 'bg-indigo-100 hover:bg-indigo-200' },
              };

              // Compétences disponibles filtrées
              const availableSkills = SKILLS_DEFINITIONS
                .filter(s => allowedCategories.includes(s.category as any))
                .filter(s => !selectedCategory || s.category === selectedCategory);

              const selectedSkill = selectedSkillSlug ? SKILLS_DEFINITIONS.find(s => s.slug === selectedSkillSlug) : null;
              const currentSkills = (player.skills || '').split(',').filter(Boolean);

              return (
                <>
                  {/* En-tête avec gradient */}
                  <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 text-white relative">
                    <button
                      onClick={() => { setAddingSkillFor(null); setSelectedSkillSlug(""); setIsRandom(false); }}
                      className="absolute top-4 right-4 text-white/80 hover:text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all text-2xl font-light"
                      aria-label="Fermer"
                    >
                      ×
                    </button>
                    
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                        <span className="text-2xl font-bold">#{player.number}</span>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">{player.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-blue-100">
                          <span className="font-medium">{getDisplayName(player.position)}</span>
                          <span className="text-blue-200">•</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                            {advCount > 0 ? `Expérimenté (${advCount})` : 'Recrue'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Badge de compétence sélectionnée */}
                    {selectedSkill && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="font-semibold">{selectedSkill.nameFr}</span>
                        <span className="text-blue-200 text-sm">•</span>
                        <span className="text-sm text-blue-100">
                          {selectedAdvType === 'primary' ? 'Primaire' : 'Secondaire'} • {psp} SPP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Corps de la modal */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Sélecteur Type d'avancement */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Type d'avancement</span>
                        {/* Toggle Random */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm text-gray-600">Au hasard</span>
                          <div 
                            onClick={() => { setIsRandom(!isRandom); setSelectedSkillSlug(""); }}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              isRandom ? 'bg-purple-600' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              isRandom ? 'transform translate-x-6' : ''
                            }`}></div>
                          </div>
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setSelectedAdvType('primary'); setSelectedSkillSlug(""); setSelectedCategory(""); }}
                          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                            selectedAdvType === 'primary'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isRandom ? 'Aléatoire Primaire' : 'Primaire'}
                          <span className="block text-xs font-normal mt-1 opacity-90">
                            {isRandom ? `${getNextAdvancementPspCost(advCount, 'random-primary')} SPP` : `${getNextAdvancementPspCost(advCount, 'primary')} SPP`}
                          </span>
                        </button>
                        <button
                          onClick={() => { setSelectedAdvType('secondary'); setSelectedSkillSlug(""); setSelectedCategory(""); }}
                          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                            selectedAdvType === 'secondary'
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isRandom ? 'Aléatoire Secondaire' : 'Secondaire'}
                          <span className="block text-xs font-normal mt-1 opacity-90">
                            {isRandom ? `${getNextAdvancementPspCost(advCount, 'random-secondary')} SPP` : `${getNextAdvancementPspCost(advCount, 'secondary')} SPP`}
                          </span>
                        </button>
                      </div>
                      {isRandom && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          <span className="font-semibold">ℹ️</span> Les compétences choisies au hasard coûtent moins en SPP et augmentent moins la valeur d'équipe (VE) : +10k pour Primaire aléatoire, +20k pour Secondaire aléatoire (au lieu de +20k/+40k pour les choix spécifiques).
                        </div>
                      )}
                    </div>

                    {/* Filtres de catégories */}
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Catégorie</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { setSelectedCategory(""); setSelectedSkillSlug(""); }}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                            !selectedCategory
                              ? 'bg-gray-800 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Toutes
                        </button>
                        {allowedCategories.map((cat) => {
                          const config = categoryConfig[cat as string];
                          if (!config) return null;
                          return (
                            <button
                              key={cat}
                              onClick={() => { setSelectedCategory(cat as "General"|"Agility"|"Strength"|"Passing"|"Mutation"|"Trait"|""); setSelectedSkillSlug(""); }}
                              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                                selectedCategory === cat
                                  ? `${config.bgColor} ${config.color} shadow-md scale-105`
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-xs font-bold">
                                {config.code}
                              </span>
                              {config.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Informations de coût */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-600">Coût PSP: </span>
                          <span className="text-xl font-bold text-blue-700">{psp}</span>
                        </div>
                        <div className="text-sm text-gray-500">•</div>
                        <div>
                          <span className="text-sm text-gray-600">Surcoût VE: </span>
                          <span className="text-xl font-bold text-indigo-700">+{surchargeK}k</span>
                        </div>
                      </div>
                    </div>

                    {/* Grille de compétences ou bouton aléatoire */}
                    {selectedCategory && (
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">
                          {categoryConfig[selectedCategory]?.name || selectedCategory} - {psp} SPP
                        </h3>
                        {isRandom ? (
                          <div className="flex flex-col items-center justify-center py-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-dashed border-purple-300">
                            <div className="text-4xl mb-4">🎲</div>
                            <p className="text-gray-700 mb-4 text-center">
                              Cliquez sur "Lancer les dés" pour sélectionner une compétence aléatoirement dans cette catégorie.
                            </p>
                            <button
                              onClick={() => {
                                // Sélectionner une compétence aléatoire parmi celles disponibles et non possédées
                                const availableInCategory = availableSkills.filter(s => !currentSkills.includes(s.slug));
                                if (availableInCategory.length > 0) {
                                  const randomIndex = Math.floor(Math.random() * availableInCategory.length);
                                  setSelectedSkillSlug(availableInCategory[randomIndex].slug);
                                }
                              }}
                              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30"
                            >
                              🎲 Lancer les dés
                            </button>
                            {selectedSkill && (
                              <div className="mt-6 p-4 bg-white rounded-lg border-2 border-purple-400 shadow-md">
                                <div className="font-bold text-lg text-purple-700 mb-2">
                                  Compétence sélectionnée :
                                </div>
                                <div className="text-xl font-semibold">{selectedSkill.nameFr}</div>
                                <div className="text-sm text-gray-600 mt-2">{selectedSkill.description}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {availableSkills.map((skill) => {
                              const config = categoryConfig[skill.category];
                              const isOwned = currentSkills.includes(skill.slug);
                              const isSelected = selectedSkillSlug === skill.slug;
                              
                              return (
                                <button
                                  key={skill.slug}
                                  onClick={() => {
                                    if (!isOwned) {
                                      setSelectedSkillSlug(skill.slug);
                                    }
                                  }}
                                  disabled={isOwned}
                                  className={`
                                    relative px-4 py-3 rounded-xl border-2 transition-all text-left
                                    ${isOwned 
                                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60' 
                                      : isSelected
                                      ? `${config?.bgColor || 'bg-blue-100'} ${config?.color || 'text-blue-700'} border-blue-500 shadow-lg scale-105`
                                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md'
                                    }
                                  `}
                                  title={isOwned ? 'Compétence déjà acquise' : skill.description}
                                >
                                  {isOwned && (
                                    <span className="absolute top-1 right-1 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                                      ✓
                                    </span>
                                  )}
                                  <div className="font-semibold text-sm mb-1">{skill.nameFr}</div>
                                  {isSelected && (
                                    <div className="absolute bottom-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {!selectedCategory && (
                      <div className="text-center py-12 text-gray-400">
                        <div className="text-4xl mb-4">🎯</div>
                        <p className="text-lg">Sélectionnez une catégorie pour voir les compétences disponibles</p>
                      </div>
                    )}
                  </div>

                  {/* Footer avec actions */}
                  <div className="border-t border-gray-200 px-8 py-4 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => { 
                        setAddingSkillFor(null); 
                        setSelectedSkillSlug(""); 
                        setIsRandom(false);
                      }}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      disabled={!selectedSkillSlug || !selectedCategory}
                      onClick={async () => {
                        try {
                          const currentSkills = (player.skills || '').split(',').filter(Boolean);
                          if (currentSkills.includes(selectedSkillSlug)) return;
                          const newSkills = [...currentSkills, selectedSkillSlug].join(',');
                          let currentAdv: any[] = [];
                          try { currentAdv = JSON.parse(player.advancements || '[]'); } catch {}
                          const newAdv = [...currentAdv, { 
                            skillSlug: selectedSkillSlug, 
                            type: actualAdvType, 
                            isRandom: isRandom,
                            at: Date.now() 
                          }];
                          await putJSON(`/team/${id}/players/${player.id}/skills`, { skills: newSkills, advancements: newAdv });
                          setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, skills: newSkills, advancements: JSON.stringify(newAdv) } as any : p));
                          setAddingSkillFor(null);
                          setSelectedSkillSlug("");
                          setIsRandom(false);
                        } catch (e: any) {
                          alert(e?.message || "Erreur lors de l'ajout de la compétence");
                        }
                      }}
                      className="px-8 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-green-500/30 disabled:shadow-none"
                    >
                      {isRandom ? 'Ajouter la compétence (aléatoire)' : 'Ajouter la compétence'}
                    </button>
                  </div>
                </>
              );
            })()}
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
            roster: team.roster,
          }}
          roster={team.roster}
          initialBudgetK={team.initialBudget || 0}
          playersCost={(team.players || []).reduce((total: number, player: any) => {
            const base = getPlayerCost(player.position, team.roster);
            let adv = 0; try { const a = JSON.parse(player.advancements || '[]'); adv = a.reduce((s: number, x: any) => {
              const type = x?.type as keyof typeof SURCHARGE_PER_ADVANCEMENT | undefined;
              return s + (type && SURCHARGE_PER_ADVANCEMENT[type] ? SURCHARGE_PER_ADVANCEMENT[type] : (x?.type === 'secondary' ? SURCHARGE_PER_ADVANCEMENT.secondary : SURCHARGE_PER_ADVANCEMENT.primary));
            }, 0); } catch {}
            return total + base + adv;
          }, 0)}
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

