"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

type Season = "season_2" | "season_3";
type Tier = "all" | "I" | "II" | "III" | "IV";

export default function TeamsListPage() {
  const { language, t } = useLanguage();
  const [teams, setTeams] = useState<Array<{ slug: string; name: string; budget: number; tier: string; naf: boolean; positions: any[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season>("season_3");
  const [selectedTier, setSelectedTier] = useState<Tier>("all");

  useEffect(() => {
    async function fetchRosters() {
      try {
        setLoading(true);
        const lang = language === "en" ? "en" : "fr";
        const response = await fetch(`${API_BASE}/api/rosters?lang=${lang}&ruleset=${selectedSeason}`);
        if (!response.ok) {
          throw new Error("Erreur lors du chargement des rosters");
        }
        const data = await response.json();
        // Récupérer les détails de chaque roster pour avoir les positions
        const rostersWithDetails = await Promise.all(
          data.rosters.map(async (roster: { slug: string }) => {
            const detailResponse = await fetch(`${API_BASE}/api/rosters/${roster.slug}?lang=${lang}&ruleset=${selectedSeason}`);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              return { ...detailData.roster, slug: roster.slug };
            }
            return { ...roster, positions: [] };
          })
        );
        setTeams(rostersWithDetails);
      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    }
    fetchRosters();
  }, [language, selectedSeason]);

  // Filtrer par tier
  const filteredTeams = selectedTier === "all" 
    ? teams 
    : teams.filter(team => team.tier === selectedTier);

  // Trier par tier puis par nom
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier.localeCompare(b.tier);
    }
    return a.name.localeCompare(b.name);
  });

  // Compter les équipes par tier
  const tierCounts = {
    I: teams.filter(t => t.tier === "I").length,
    II: teams.filter(t => t.tier === "II").length,
    III: teams.filter(t => t.tier === "III").length,
    IV: teams.filter(t => t.tier === "IV").length,
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "I": return "bg-green-100 text-green-800 border-green-200";
      case "II": return "bg-blue-100 text-blue-800 border-blue-200";
      case "III": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "IV": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t.teams.allTeams}</h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.teams.allTeamsDescription}
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-gray-200">
        {/* Filtre par saison */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.teams.filterBySeason}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSeason("season_2")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedSeason === "season_2"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.rulesetSeason2}
            </button>
            <button
              onClick={() => setSelectedSeason("season_3")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedSeason === "season_3"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.rulesetSeason3}
            </button>
          </div>
        </div>

        {/* Filtre par tier */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.teams.filterByTier}
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTier("all")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTier === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.allTiers}
            </button>
            {(["I", "II", "III", "IV"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                disabled={tierCounts[tier] === 0}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedTier === tier
                    ? "bg-blue-600 text-white"
                    : tierCounts[tier] === 0
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Tier {tier} ({tierCounts[tier]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille des équipes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {sortedTeams.map((team) => (
          <Link
            key={team.slug}
            href={`/teams/${team.slug}?ruleset=${selectedSeason}`}
            className="rounded-xl border-2 border-blue-200 bg-white p-6 hover:border-blue-400 hover:shadow-lg transition-all text-left"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-blue-900">
                {team.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`px-2 py-1 rounded border text-xs font-medium ${getTierColor(team.tier)}`}>
                Tier {team.tier}
              </span>
              {team.naf && (
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                  NAF
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              <div>{t.teams.budgetLabel.replace(/\{budget\}/g, team.budget.toString())}</div>
              <div>{t.teams.positionsAvailable.replace(/\{count\}/g, team.positions.length.toString())}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Message si aucune équipe */}
      {sortedTeams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {language === "fr" ? "Aucune équipe trouvée avec ces filtres" : "No teams found with these filters"}
        </div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mt-6 sm:mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">{t.teams.totalTeams}</div>
          <div className="text-2xl font-bold text-blue-900">{teams.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">{t.teams.tierI}</div>
          <div className="text-2xl font-bold text-green-900">{tierCounts.I}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">{t.teams.tierII}</div>
          <div className="text-2xl font-bold text-blue-900">{tierCounts.II}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 font-medium">{t.teams.tierIII}</div>
          <div className="text-2xl font-bold text-yellow-900">{tierCounts.III}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm text-orange-600 font-medium">{t.teams.tierIV}</div>
          <div className="text-2xl font-bold text-orange-900">{tierCounts.IV}</div>
        </div>
      </div>
    </div>
  );
}
