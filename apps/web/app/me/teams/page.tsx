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
  const { t } = useLanguage();
  const [teams, setTeams] = useState<any[]>([]);
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
      } catch (e: any) {
        setError(e.message || t.teams.error);
      }
    })();
  }, [t]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t.teams.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="rounded border p-4 bg-white">
        <h2 className="font-semibold mb-2">{t.teams.createTeam}</h2>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="border p-2 flex-1 rounded"
              placeholder={t.teams.teamNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="border p-2"
              value={roster}
              onChange={(e) => setRoster(e.target.value)}
            >
              <option value="skaven">Skavens</option>
              <option value="lizardmen">Hommes-Lézards</option>
              <option value="wood_elf">Elfes Sylvains</option>
              <option value="dark_elf">Elfes Noirs</option>
              <option value="dwarf">Nains</option>
              <option value="goblin">Gobelins</option>
              <option value="undead">Morts-Vivants</option>
              <option value="chaos_renegade">Renégats du Chaos</option>
              <option value="ogre">Ogres</option>
              <option value="halfling">Halflings</option>
              <option value="underworld">Bas-Fonds</option>
              <option value="chaos_chosen">Élus du Chaos</option>
              <option value="imperial_nobility">Noblesse Impériale</option>
              <option value="necromantic_horror">Horreurs Nécromantiques</option>
              <option value="orc">Orques</option>
              <option value="nurgle">Nurgle</option>
              <option value="old_world_alliance">Alliance du Vieux Monde</option>
              <option value="elven_union">Union Elfique</option>
              <option value="human">Humains</option>
              <option value="black_orc">Orques Noirs</option>
              <option value="snotling">Snotlings</option>
            </select>
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
            <div className="text-sm text-gray-600">{t.teams.roster}: {team.roster}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
