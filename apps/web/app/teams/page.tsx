"use client";
import { TEAM_ROSTERS } from "@bb/game-engine";
import Link from "next/link";

export default function TeamsListPage() {
  const teams = Object.entries(TEAM_ROSTERS).map(([slug, data]) => ({
    slug,
    ...data,
  }));

  // Trier par tier puis par nom
  const sortedTeams = teams.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier.localeCompare(b.tier);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Toutes les Équipes</h1>
        <p className="text-gray-600">
          Liste complète des équipes de Blood Bowl disponibles
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
              <div>Budget: {team.budget}k po</div>
              <div>{team.positions.length} positions disponibles</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Total Équipes</div>
          <div className="text-2xl font-bold text-blue-900">{teams.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Tier I</div>
          <div className="text-2xl font-bold text-green-900">
            {teams.filter(t => t.tier === "I").length}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 font-medium">Tier II</div>
          <div className="text-2xl font-bold text-yellow-900">
            {teams.filter(t => t.tier === "II").length}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm text-orange-600 font-medium">Tier III</div>
          <div className="text-2xl font-bold text-orange-900">
            {teams.filter(t => t.tier === "III").length}
          </div>
        </div>
      </div>
    </div>
  );
}
