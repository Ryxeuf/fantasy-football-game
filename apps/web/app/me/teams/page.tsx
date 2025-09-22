"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`);
  return res.json();
}

export default function MyTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roster, setRoster] = useState("skaven");

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) { window.location.href = "/login"; return; }
        const { teams } = await fetchJSON("/team/mine");
        setTeams(teams);
      } catch (e: any) { setError(e.message || "Erreur"); }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Mes équipes</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="rounded border p-4 bg-white">
        <h2 className="font-semibold mb-2">Créer une équipe</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input className="border p-2 flex-1" placeholder="Nom de l'équipe" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="border p-2" value={roster} onChange={(e) => setRoster(e.target.value)}>
            <option value="skaven">Skavens</option>
            <option value="lizardmen">Hommes-Lézards</option>
          </select>
          <a className="px-4 py-2 bg-emerald-600 text-white rounded text-center" href={`/me/teams/new?name=${encodeURIComponent(name)}&roster=${roster}`}>Ouvrir le builder</a>
        </div>
      </div>
      <div className="grid gap-3">
        {teams.map((t) => (
          <a key={t.id} className="rounded border p-4 bg-white hover:shadow" href={`/me/teams/${t.id}`}>
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-gray-600">Roster: {t.roster}</div>
          </a>
        ))}
      </div>
    </div>
  );
}


