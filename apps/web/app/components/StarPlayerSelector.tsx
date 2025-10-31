"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";
import SkillTooltip from "../me/teams/components/SkillTooltip";
import { useLanguage } from "../contexts/LanguageContext";

export interface StarPlayer {
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  hirableBy: string[] | ["all"];
  specialRule?: string;
}

interface StarPlayerSelectorProps {
  roster: string;
  selectedStarPlayers: string[];
  onSelectionChange: (selected: string[]) => void;
  currentPlayerCount: number;
  availableBudget: number; // En po (pas en K po)
  disabled?: boolean;
}

// Paires obligatoires de Star Players
const STAR_PLAYER_PAIRS: Record<string, string> = {
  grak: "crumbleberry",
  crumbleberry: "grak",
  lucien_swift: "valen_swift",
  valen_swift: "lucien_swift",
};

export default function StarPlayerSelector({
  roster,
  selectedStarPlayers,
  onSelectionChange,
  currentPlayerCount,
  availableBudget,
  disabled = false,
}: StarPlayerSelectorProps) {
  const { t } = useLanguage();
  const [availableStarPlayers, setAvailableStarPlayers] = useState<StarPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!roster) return;
    
    setLoading(true);
    setError(null);
    
    const token = localStorage.getItem("auth_token");
    fetch(`${API_BASE}/star-players/available/${roster}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setAvailableStarPlayers(data.starPlayers || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || t.teams.errorLoading);
        setLoading(false);
      });
  }, [roster, t]);

  const handleToggle = (slug: string) => {
    if (disabled) return;

    const isCurrentlySelected = selectedStarPlayers.includes(slug);
    let newSelection = [...selectedStarPlayers];

    if (isCurrentlySelected) {
      // Déselectionner
      newSelection = newSelection.filter((s) => s !== slug);
      
      // Si c'est une paire, déselectionner aussi le partenaire
      const partner = STAR_PLAYER_PAIRS[slug];
      if (partner && newSelection.includes(partner)) {
        newSelection = newSelection.filter((s) => s !== partner);
      }
    } else {
      // Sélectionner
      newSelection.push(slug);
      
      // Si c'est une paire, sélectionner aussi le partenaire
      const partner = STAR_PLAYER_PAIRS[slug];
      if (partner && !newSelection.includes(partner)) {
        newSelection.push(partner);
      }
    }

    onSelectionChange(newSelection);
  };

  const calculateTotalCost = () => {
    return selectedStarPlayers.reduce((sum, slug) => {
      const sp = availableStarPlayers.find((p) => p.slug === slug);
      return sum + (sp?.cost || 0);
    }, 0);
  };

  const totalCost = calculateTotalCost();
  const totalPlayers = currentPlayerCount + selectedStarPlayers.length;
  const budgetExceeded = totalCost > availableBudget;
  const playerLimitExceeded = totalPlayers > 16;

  const canSelectMore = (sp: StarPlayer): boolean => {
    if (selectedStarPlayers.includes(sp.slug)) return true;
    
    // Vérifier la limite de joueurs
    const partner = STAR_PLAYER_PAIRS[sp.slug];
    const additionalPlayers = partner ? 2 : 1;
    if (currentPlayerCount + selectedStarPlayers.length + additionalPlayers > 16) {
      return false;
    }

    // Vérifier le budget
    const partnerCost = partner 
      ? availableStarPlayers.find((p) => p.slug === partner)?.cost || 0 
      : 0;
    const totalAdditionalCost = sp.cost + partnerCost;
    if (totalCost + totalAdditionalCost > availableBudget) {
      return false;
    }

    return true;
  };

  const isPaired = (slug: string): boolean => {
    return slug in STAR_PLAYER_PAIRS;
  };

  const getPartnerName = (slug: string): string | null => {
    const partnerSlug = STAR_PLAYER_PAIRS[slug];
    if (!partnerSlug) return null;
    
    const partner = availableStarPlayers.find((p) => p.slug === partnerSlug);
    return partner?.displayName || partnerSlug;
  };

  if (loading) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-gray-500">{t.teams.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (availableStarPlayers.length === 0) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-gray-500">
          {t.teams.noStarPlayersAvailable}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">⭐ {t.teams.starPlayersAvailable}</h3>
        <div className="text-sm text-gray-600">
          {selectedStarPlayers.length} {t.teams.selected}
        </div>
      </div>

      {(budgetExceeded || playerLimitExceeded) && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {budgetExceeded && (
            <div>⚠️ {t.teams.budgetExceeded.replace("{amount}", ((totalCost - availableBudget) / 1000).toFixed(0))}</div>
          )}
          {playerLimitExceeded && (
            <div>⚠️ {t.teams.playerLimitExceeded.replace("{count}", totalPlayers.toString())}</div>
          )}
        </div>
      )}

      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
        <div className="flex justify-between">
          <span>{t.teams.totalStarPlayersCost}</span>
          <span className="font-semibold">{(totalCost / 1000).toFixed(0)}{t.teams.kpo}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.teams.totalPlayersCount}</span>
          <span className="font-semibold">{totalPlayers} / 16</span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {availableStarPlayers.map((sp) => {
          const isSelected = selectedStarPlayers.includes(sp.slug);
          const canSelect = canSelectMore(sp);
          const paired = isPaired(sp.slug);
          const partnerName = paired ? getPartnerName(sp.slug) : null;

          return (
            <div
              key={sp.slug}
              className={`border rounded p-3 transition-colors ${
                isSelected
                  ? "bg-emerald-50 border-emerald-300"
                  : canSelect
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(sp.slug)}
                  disabled={disabled || (!isSelected && !canSelect)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{sp.displayName}</span>
                      {paired && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {t.teams.pairWith.replace("{partner}", partnerName || "")}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-emerald-700">
                      {(sp.cost / 1000).toFixed(0)}K po
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                    <span>MA {sp.ma}</span>
                    <span>ST {sp.st}</span>
                    <span>AG {sp.ag}+</span>
                    {sp.pa !== null && <span>PA {sp.pa}+</span>}
                    <span>AV {sp.av}+</span>
                  </div>

                  {expandedPlayer === sp.slug && (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="text-gray-700">
                        <span className="font-medium">{t.teams.skills}</span>
                        <div className="mt-1">
                          <SkillTooltip 
                            skillsString={sp.skills}
                            className="text-xs"
                          />
                        </div>
                      </div>
                      {sp.specialRule && (
                        <div className="text-gray-700">
                          <span className="font-medium">{t.teams.specialRule}</span>{" "}
                          {sp.specialRule}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setExpandedPlayer(expandedPlayer === sp.slug ? null : sp.slug)
                    }
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    {expandedPlayer === sp.slug ? t.teams.hideDetails : t.teams.showDetails}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedStarPlayers.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm text-gray-600">
            <strong>{t.teams.selectedStarPlayers}</strong>
            <ul className="mt-1 space-y-1">
              {selectedStarPlayers.map((slug) => {
                const sp = availableStarPlayers.find((p) => p.slug === slug);
                return (
                  <li key={slug} className="flex justify-between">
                    <span>{sp?.displayName || slug}</span>
                    <span className="font-medium">
                      {sp ? `${(sp.cost / 1000).toFixed(0)}K po` : "?"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

