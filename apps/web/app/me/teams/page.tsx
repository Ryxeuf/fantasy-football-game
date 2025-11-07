"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";
import { useLanguage } from "../../contexts/LanguageContext";

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
    <div className="w-full p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t.teams.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      
      {/* Liste des équipes existantes */}
      {teams.length > 0 && (
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
      )}
      
      {/* Bloc de création d'équipe */}
      <div className="rounded border p-4 bg-white">
        <p className="mb-4">{t.teams.createNewTeamMessage}</p>
        <a
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded text-center hover:bg-emerald-700 transition-colors"
          href="/me/teams/new"
        >
          {t.teams.openBuilder}
        </a>
      </div>
    </div>
  );
}
