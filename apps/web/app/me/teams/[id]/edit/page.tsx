"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../../auth-client";
import SkillTooltip from "../../components/SkillTooltip";
import TeamInfoEditor from "../../components/TeamInfoEditor";

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

export default function TeamEditPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
        setData(d);
        setPlayers(d.team?.players || []);
      } catch (e: any) {
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
          <h2 className="text-lg font-semibold">Modification des joueurs</h2>
          <div className="text-sm text-gray-600 mt-1">
            Vous pouvez modifier le nom et le numéro de chaque joueur
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
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">#</th>
                <th className="text-left p-4 font-medium text-gray-900">Nom</th>
                <th className="text-left p-4 font-medium text-gray-900">Position</th>
                <th className="text-left p-4 font-medium text-gray-900">MA</th>
                <th className="text-left p-4 font-medium text-gray-900">ST</th>
                <th className="text-left p-4 font-medium text-gray-900">AG</th>
                <th className="text-left p-4 font-medium text-gray-900">PA</th>
                <th className="text-left p-4 font-medium text-gray-900">AV</th>
                <th className="text-left p-4 font-medium text-gray-900">Compétences</th>
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
                  <td className="p-4 text-gray-600">{player.position}</td>
                  <td className="p-4 text-center font-mono">{player.ma}</td>
                  <td className="p-4 text-center font-mono">{player.st}</td>
                  <td className="p-4 text-center font-mono">{player.ag}</td>
                  <td className="p-4 text-center font-mono">{player.pa}</td>
                  <td className="p-4 text-center font-mono">{player.av}</td>
                  <td className="p-4">
                    <SkillTooltip 
                      skillsString={player.skills} 
                      teamName={team.roster}
                      position={player.position}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informations d'équipe */}
      {team && (
        <TeamInfoEditor
          teamId={team.id}
          initialInfo={{
            treasury: team.treasury || 0,
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
        </div>
      </div>
    </div>
  );
}

