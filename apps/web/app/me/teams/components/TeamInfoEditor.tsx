"use client";
import { useState } from "react";
import { API_BASE } from "../../../auth-client";

interface TeamInfo {
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

interface TeamInfoEditorProps {
  teamId: string;
  initialInfo: TeamInfo;
  onUpdate: (info: TeamInfo) => void;
  disabled?: boolean;
}

export default function TeamInfoEditor({ 
  teamId, 
  initialInfo, 
  onUpdate, 
  disabled = false 
}: TeamInfoEditorProps) {
  const [info, setInfo] = useState<TeamInfo>(initialInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/team/${teamId}/info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(info),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }

      const result = await response.json();
      onUpdate(info);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const updateInfo = (field: keyof TeamInfo, value: number | boolean) => {
    setInfo(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold">Informations d'équipe</h3>
        <p className="text-sm text-gray-600 mt-1">
          Configurez les ressources de votre équipe selon les règles Blood Bowl
        </p>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✅ Informations sauvegardées avec succès
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trésorerie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trésorerie (pièces d'or)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={info.treasury}
              onChange={(e) => updateInfo("treasury", parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Pièces d'or non dépensées lors de la création d'équipe
            </p>
          </div>

          {/* Relances */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Relances (0-8)
            </label>
            <input
              type="number"
              min="0"
              max="8"
              value={info.rerolls}
              onChange={(e) => updateInfo("rerolls", parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre de relances d'équipe disponibles
            </p>
          </div>

          {/* Cheerleaders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cheerleaders (0-12)
            </label>
            <input
              type="number"
              min="0"
              max="12"
              value={info.cheerleaders}
              onChange={(e) => updateInfo("cheerleaders", parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              10k po chacune, max 12
            </p>
          </div>

          {/* Assistants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assistants (0-6)
            </label>
            <input
              type="number"
              min="0"
              max="6"
              value={info.assistants}
              onChange={(e) => updateInfo("assistants", parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              10k po chacun, max 6
            </p>
          </div>

          {/* Apothicaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Apothicaire
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={info.apothecary}
                onChange={(e) => updateInfo("apothecary", e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-100"
              />
              <span className="text-sm text-gray-700">
                {info.apothecary ? "Présent" : "Absent"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              50k po, max 1 par équipe
            </p>
          </div>

          {/* Fans Dévoués */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fans Dévoués (1-6)
            </label>
            <input
              type="number"
              min="1"
              max="6"
              value={info.dedicatedFans}
              onChange={(e) => updateInfo("dedicatedFans", parseInt(e.target.value) || 1)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              10k po chacun au-dessus du premier (gratuit)
            </p>
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={disabled || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>

        {/* Informations sur les coûts */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
          <div className="font-semibold">ℹ️ Informations sur les coûts</div>
          <div className="text-sm mt-1">
            • Relances : coût variable selon l'équipe (voir liste d'équipe)
            <br />
            • Cheerleaders : 10k po chacune (max 12)
            <br />
            • Assistants : 10k po chacun (max 6)
            <br />
            • Apothicaire : 50k po (max 1)
            <br />
            • Fans Dévoués : 10k po chacun au-dessus du premier (gratuit)
          </div>
        </div>
      </div>
    </div>
  );
}
