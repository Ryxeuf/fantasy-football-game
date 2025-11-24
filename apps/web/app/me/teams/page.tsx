"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";
import { useLanguage } from "../../contexts/LanguageContext";

type Team = {
  id: string;
  name: string;
  roster: string;
  ruleset?: string;
  createdAt: string;
};

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">{t.teams.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {teams.length > 0 && (
        <p className="text-xs text-gray-500">{t.teams.rulesetInfoList}</p>
      )}
      
      {/* Liste des équipes existantes */}
      {teams.length > 0 && (
        <div className="grid gap-3">
          {teams.map((team) => (
            <a
              key={team.id}
              className="rounded border p-4 bg-white hover:shadow transition-shadow active:scale-[0.98]"
              href={`/me/teams/${team.id}`}
            >
              <div className="font-semibold text-base sm:text-lg">{team.name}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {t.teams.roster}: {rosterNames[team.roster] || team.roster}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 mt-2">
                {t.teams.rulesetBadge.replace(
                  "{label}",
                  team.ruleset === "season_3" ? t.teams.rulesetSeason3 : t.teams.rulesetSeason2,
                )}
              </div>
            </a>
          ))}
        </div>
      )}
      
      {/* Bloc de création d'équipe */}
      <div className="rounded border p-4 sm:p-6 bg-white">
        <p className="mb-4 text-sm sm:text-base">{t.teams.createNewTeamMessage}</p>
        <a
          className="inline-block w-full sm:w-auto px-4 py-2.5 bg-emerald-600 text-white rounded text-center hover:bg-emerald-700 transition-colors font-medium"
          href="/me/teams/new"
        >
          {t.teams.openBuilder}
        </a>
      </div>
    </div>
  );
}
