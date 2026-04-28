"use client";
import { useState } from "react";
import { API_BASE } from "../../../auth-client";
import { apiRequest } from "../../../lib/api-client";
import { getRerollCost, getDisplayName } from "@bb/game-engine";

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

interface TeamData {
  id: string;
  roster: string;
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  players: Array<{ id: string; number: number; dead: boolean; name: string }>;
}

interface TreasuryPurchasePanelProps {
  team: TeamData;
  availablePositions: AvailablePosition[];
  onPurchaseComplete: () => void;
}

type PurchaseType = "player" | "reroll" | "cheerleader" | "assistant" | "apothecary" | "dedicated_fan";

async function postPurchase(teamId: string, body: Record<string, unknown>) {
  // S25.5w — apiRequest unwrap l'enveloppe ApiResponse<T>
  return apiRequest<{ team: unknown; purchase: { type: string; cost: number; description: string } }>(
    `/team/${teamId}/purchase`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export default function TreasuryPurchasePanel({
  team,
  availablePositions,
  onPurchaseComplete,
}: TreasuryPurchasePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHirePlayer, setShowHirePlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState({ position: "", name: "", number: 1 });

  const treasury = team.treasury;
  const rerollCostDouble = getRerollCost(team.roster) * 2;
  const alivePlayers = team.players.filter(p => !p.dead);

  const getNextAvailableNumber = (): number => {
    const usedNumbers = new Set(alivePlayers.map(p => p.number));
    for (let i = 1; i <= 99; i++) {
      if (!usedNumbers.has(i)) return i;
    }
    return 1;
  };

  const handlePurchase = async (type: PurchaseType, extra?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await postPurchase(team.id, { type, ...extra });
      setSuccess(result.purchase?.description || "Achat effectué");
      setTimeout(() => setSuccess(null), 4000);
      onPurchaseComplete();
      if (type === "player") {
        setShowHirePlayer(false);
        setPlayerForm({ position: "", name: "", number: getNextAvailableNumber() });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de l'achat";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (treasury <= 0) {
    return null;
  }

  const staffItems: Array<{
    type: PurchaseType;
    label: string;
    cost: number;
    current: number | boolean;
    max: number;
    disabled: boolean;
  }> = [
    {
      type: "reroll",
      label: "Relance",
      cost: rerollCostDouble,
      current: team.rerolls,
      max: 8,
      disabled: team.rerolls >= 8 || treasury < rerollCostDouble,
    },
    {
      type: "cheerleader",
      label: "Cheerleader",
      cost: 10000,
      current: team.cheerleaders,
      max: 12,
      disabled: team.cheerleaders >= 12 || treasury < 10000,
    },
    {
      type: "assistant",
      label: "Assistant",
      cost: 10000,
      current: team.assistants,
      max: 6,
      disabled: team.assistants >= 6 || treasury < 10000,
    },
    {
      type: "apothecary",
      label: "Apothicaire",
      cost: 50000,
      current: team.apothecary,
      max: 1,
      disabled: team.apothecary || treasury < 50000,
    },
    {
      type: "dedicated_fan",
      label: "Fan Devoue",
      cost: 10000,
      current: team.dedicatedFans,
      max: 6,
      disabled: team.dedicatedFans >= 6 || treasury < 10000,
    },
  ];

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold text-amber-900">Achats entre matchs</h3>
        <p className="text-sm text-amber-700 mt-1">
          Utilisez votre tresorerie pour recruter des joueurs et ameliorer votre equipe
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Treasury display */}
        <div className="text-center p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
          <div className="text-sm text-amber-700 font-medium">Tresorerie disponible</div>
          <div className="text-3xl font-bold text-amber-900">
            {Math.round(treasury / 1000)}k po
          </div>
          <div className="text-xs text-amber-600 mt-1">
            ({treasury.toLocaleString()} po)
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Hire player */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Recruter un joueur</h4>
            <button
              onClick={() => {
                setShowHirePlayer(!showHirePlayer);
                if (!showHirePlayer) {
                  setPlayerForm({ position: "", name: "", number: getNextAvailableNumber() });
                }
              }}
              disabled={alivePlayers.length >= 16}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {showHirePlayer ? "Annuler" : `Recruter (${alivePlayers.length}/16)`}
            </button>
          </div>

          {showHirePlayer && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={playerForm.position}
                  onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Selectionner une position</option>
                  {availablePositions
                    .filter(pos => pos.canAdd)
                    .map(pos => {
                      const canAfford = treasury >= pos.cost;
                      return (
                        <option key={pos.key} value={pos.key} disabled={!canAfford}>
                          {pos.name} ({pos.currentCount}/{pos.maxCount}) - {pos.cost / 1000}k po
                          {!canAfford ? " (fonds insuffisants)" : ""}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={playerForm.name}
                    onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Nom du joueur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={playerForm.number}
                    onChange={(e) => setPlayerForm({ ...playerForm, number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-center font-mono"
                  />
                </div>
              </div>
              {playerForm.position && (() => {
                const pos = availablePositions.find(p => p.key === playerForm.position);
                if (!pos) return null;
                return (
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <div className="text-sm">
                      <span className="font-medium">{pos.name}</span>
                      <span className="text-gray-500 ml-2">
                        MA:{pos.stats.ma} ST:{pos.stats.st} AG:{pos.stats.ag} PA:{pos.stats.pa || "-"} AV:{pos.stats.av}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-700">
                      {pos.cost / 1000}k po
                    </span>
                  </div>
                );
              })()}
              <button
                onClick={() => handlePurchase("player", {
                  position: playerForm.position,
                  name: playerForm.name.trim(),
                  number: playerForm.number,
                })}
                disabled={loading || !playerForm.position || !playerForm.name.trim()}
                className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {loading ? "Recrutement..." : "Recruter avec la tresorerie"}
              </button>
            </div>
          )}
        </div>

        {/* Staff purchases */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Ameliorations d'equipe</h4>
          <div className="space-y-2">
            {staffItems.map((item) => (
              <div
                key={item.type}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {typeof item.current === "boolean"
                      ? (item.current ? "Deja present" : "Non present")
                      : `${item.current}/${item.max}`}
                    {" — "}
                    {Math.round(item.cost / 1000)}k po
                    {item.type === "reroll" && (
                      <span className="text-amber-600 ml-1">(cout double apres creation)</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handlePurchase(item.type)}
                  disabled={loading || item.disabled}
                  className="px-4 py-2 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? "..." : "Acheter"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
          <div className="font-semibold mb-1">Regles d'achat entre matchs</div>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>Les relances coutent le double apres la creation de l'equipe</li>
            <li>La tresorerie provient des gains de match</li>
            <li>Maximum 16 joueurs vivants par equipe</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
