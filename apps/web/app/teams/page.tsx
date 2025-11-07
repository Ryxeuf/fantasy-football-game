"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

export default function TeamsListPage() {
  const { language, t } = useLanguage();
  const [teams, setTeams] = useState<Array<{ slug: string; name: string; budget: number; tier: string; naf: boolean; positions: any[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRosters() {
      try {
        setLoading(true);
        const lang = language === "en" ? "en" : "fr";
        const response = await fetch(`${API_BASE}/api/rosters?lang=${lang}`);
        if (!response.ok) {
          throw new Error("Erreur lors du chargement des rosters");
        }
        const data = await response.json();
        // Récupérer les détails de chaque roster pour avoir les positions
        const rostersWithDetails = await Promise.all(
          data.rosters.map(async (roster: { slug: string }) => {
            const detailResponse = await fetch(`${API_BASE}/api/rosters/${roster.slug}?lang=${lang}`);
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
  }, [language]);

  // Trier par tier puis par nom
  const sortedTeams = teams.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier.localeCompare(b.tier);
    }
    return a.name.localeCompare(b.name);
  });

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
    <div className="w-full p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t.teams.allTeams}</h1>
        <p className="text-gray-600">
          {t.teams.allTeamsDescription}
        </p>
      </div>

      {/* Grille des équipes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedTeams.map((team) => (
          <Link
            key={team.slug}
            href={`/teams/${team.slug}`}
            className="rounded-xl border-2 border-blue-200 bg-white p-6 hover:border-blue-400 hover:shadow-lg transition-all text-left"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-blue-900">
                {team.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                Tier {team.tier}
              </span>
              {team.naf && (
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                  NAF
                </span>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              <div>{t.teams.budgetLabel.replace(/\{budget\}/g, team.budget.toString())}</div>
              <div>{t.teams.positionsAvailable.replace(/\{count\}/g, team.positions.length.toString())}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">{t.teams.totalTeams}</div>
          <div className="text-2xl font-bold text-blue-900">{teams.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">{t.teams.tierI}</div>
          <div className="text-2xl font-bold text-green-900">
            {teams.filter(t => t.tier === "I").length}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 font-medium">{t.teams.tierII}</div>
          <div className="text-2xl font-bold text-yellow-900">
            {teams.filter(t => t.tier === "II").length}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm text-orange-600 font-medium">{t.teams.tierIII}</div>
          <div className="text-2xl font-bold text-orange-900">
            {teams.filter(t => t.tier === "III").length}
          </div>
        </div>
      </div>
    </div>
  );
}
