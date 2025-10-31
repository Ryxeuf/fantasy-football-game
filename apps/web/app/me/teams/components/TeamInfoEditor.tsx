"use client";
import { useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import { getRerollCost } from "@bb/game-engine";

interface TeamInfo {
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  roster?: string; // Roster pour calculer le coût des relances
}

interface TeamInfoEditorProps {
  teamId: string;
  initialInfo: TeamInfo;
  onUpdate: (info: TeamInfo) => void;
  disabled?: boolean;
  roster?: string;
  initialBudgetK?: number; // en milliers (k po)
  playersCost?: number; // en po
}

export default function TeamInfoEditor({ 
  teamId, 
  initialInfo, 
  onUpdate, 
  disabled = false,
  roster,
  initialBudgetK = 0,
  playersCost = 0,
}: TeamInfoEditorProps) {
  const [info, setInfo] = useState<TeamInfo>(initialInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const rerollCost = getRerollCost((info.roster || roster || ''));
  const [success, setSuccess] = useState(false);

  // Calculs en temps réel
  const { staffCost, rerollsCost, fansCost, rosterTotal, treasury } = useMemo(() => {
    const rerolls = (info.rerolls || 0) * rerollCost;
    const cheer = (info.cheerleaders || 0) * 10000;
    const assistants = (info.assistants || 0) * 10000;
    const apo = info.apothecary ? 50000 : 0;
    const fansCount = typeof info.dedicatedFans === 'number' ? info.dedicatedFans : 1;
    const fans = Math.max(0, fansCount - 1) * 10000;
    const staff = rerolls + cheer + assistants + apo + fans;
    const total = (playersCost || 0) + staff;
    const treasuryPo = (initialBudgetK || 0) * 1000 - total;
    return { staffCost: staff, rerollsCost: rerolls, fansCost: fans, rosterTotal: total, treasury: treasuryPo };
  }, [info, rerollCost, playersCost, initialBudgetK]);

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
        {/* Récap en temps réel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-700 font-medium">Coût joueurs</div>
            <div className="text-2xl font-bold text-purple-900">{Math.round((playersCost || 0)/1000)}k po</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 font-medium">VE (valeur d'équipe)</div>
            <div className="text-2xl font-bold text-blue-900">{Math.round(rosterTotal/1000)}k po</div>
          </div>
          <div className={`text-center p-4 rounded-lg border ${treasury >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}> 
            <div className={`text-sm font-medium ${treasury >= 0 ? 'text-green-700' : 'text-red-700'}`}>Trésorerie restante</div>
            <div className={`text-2xl font-bold ${treasury >= 0 ? 'text-green-900' : 'text-red-900'}`}>{Math.round(treasury/1000)}k po</div>
          </div>
        </div>

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
                Présent
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
            • Relances : {rerollCost.toLocaleString()} po chacune (coût variable selon l'équipe)
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
