"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { TEAM_ROSTERS } from "@bb/game-engine";

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

export default function MyTeamsPage() {
  const { t, language } = useLanguage();
  const [teams, setTeams] = useState<any[]>([]);
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roster, setRoster] = useState("skaven");
  const [teamValue, setTeamValue] = useState(1000);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        const { teams } = await fetchJSON("/team/mine");
        setTeams(teams);
        
        // Charger les noms des rosters depuis l'API selon la langue
        const lang = language === "en" ? "en" : "fr";
        try {
          const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
          const rostersResponse = await fetch(`${API_BASE}/api/rosters?lang=${lang}`);
          if (rostersResponse.ok) {
            const rostersData = await rostersResponse.json();
            const namesMap: Record<string, string> = {};
            rostersData.rosters.forEach((r: { slug: string; name: string }) => {
              namesMap[r.slug] = r.name;
            });
            setRosterNames(namesMap);
          }
        } catch (err) {
          console.error("Erreur lors du chargement des noms de rosters:", err);
        }
      } catch (e: any) {
        setError(e.message || t.teams.error);
      }
    })();
  }, [t, language]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t.teams.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="rounded border p-4 bg-white">
        <h2 className="font-semibold mb-2">{t.teams.createTeam}</h2>
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <input
              className="border p-2 flex-1 rounded"
              placeholder={t.teams.teamNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          {/* Grille de sélection des équipes avec tiers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.teams.selectRoster || "Sélectionner un roster"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Object.entries(TEAM_ROSTERS).map(([slug, teamData]) => {
                const isSelected = roster === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setRoster(slug)}
                    className={`
                      rounded-xl border-2 p-4 text-left transition-all
                      ${isSelected 
                        ? 'bg-blue-600 border-blue-700 text-white' 
                        : 'bg-white border-blue-200 text-blue-900 hover:border-blue-400 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="font-semibold text-sm mb-1">{teamData.name}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${
                        isSelected ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        Tier {teamData.tier}
                      </span>
                      {teamData.naf && (
                        <span className={`px-2 py-0.5 rounded ${
                          isSelected ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          NAF
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.teams.teamValue}
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                step="50"
                className="border p-2 w-full rounded"
                placeholder={t.teams.teamValuePlaceholder}
                value={teamValue}
                onChange={(e) => setTeamValue(parseInt(e.target.value) || 1000)}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t.teams.budgetInfo}
              </p>
            </div>
            <div className="flex items-end">
              <a
                className="px-4 py-2 bg-emerald-600 text-white rounded text-center hover:bg-emerald-700 transition-colors"
                href={`/me/teams/new?name=${encodeURIComponent(name)}&roster=${roster}&teamValue=${teamValue}`}
              >
                {t.teams.openBuilder}
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        {teams.map((team) => (
          <a
            key={team.id}
            className="rounded border p-4 bg-white hover:shadow transition-shadow"
            href={`/me/teams/${team.id}`}
          >
            <div className="font-semibold">{team.name}</div>
            <div className="text-sm text-gray-600">{t.teams.roster}: {rosterNames[team.roster] || team.roster}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
