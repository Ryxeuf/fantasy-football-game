"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import StarPlayerSelector from "../../../components/StarPlayerSelector";
import SkillTooltip from "../components/SkillTooltip";
import { useLanguage } from "../../../contexts/LanguageContext";

type Position = {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
};

type Roster = {
  slug: string;
  name: string;
};

export default function NewTeamBuilder() {
  const { t, language } = useLanguage();
  // Initialiser les valeurs directement depuis l'URL
  const [rosterId, setRosterId] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('roster') || "skaven";
    }
    return "skaven";
  });
  
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('name') || "";
    }
    return "";
  });
  
  const [teamValue, setTeamValue] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get('teamValue');
      return value ? parseInt(value) : 1000;
    }
    return 1000;
  });
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedStarPlayers, setSelectedStarPlayers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loadingRosters, setLoadingRosters] = useState(true);

  // Charger la liste des rosters depuis l'API selon la langue
  useEffect(() => {
    const lang = language === "en" ? "en" : "fr";
    const API_BASE_PUBLIC = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
    
    fetch(`${API_BASE_PUBLIC}/api/rosters?lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        const rostersList = (data.rosters || []).map((r: { slug: string; name: string }) => ({
          slug: r.slug,
          name: r.name,
        }));
        setRosters(rostersList);
        setLoadingRosters(false);
        
        // Vérifier que le rosterId actuel est dans la liste, sinon utiliser le premier
        if (rostersList.length > 0) {
          setRosterId((currentRosterId) => {
            const currentRoster = rostersList.find(r => r.slug === currentRosterId);
            return currentRoster ? currentRosterId : rostersList[0].slug;
          });
        }
      })
      .catch((err) => {
        console.error("Erreur lors du chargement des rosters:", err);
        setLoadingRosters(false);
      });
  }, [language]);

  // Charger les positions du roster sélectionné
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${API_BASE}/team/rosters/${rosterId}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.roster.positions || []);
        const init: Record<string, number> = {};
        (d.roster.positions || []).forEach((p: Position) => {
          init[p.slug] = p.min || 0;
        });
        setCounts(init);
      })
      .catch(() => setError(t.teams.errorLoadingRoster));
  }, [rosterId, t]);

  const total = useMemo(
    () =>
      Object.entries(counts).reduce(
        (acc, [k, c]) =>
          acc + (positions.find((p) => p.slug === k)?.cost || 0) * (c || 0),
        0,
      ),
    [counts, positions],
  );
  const totalPlayers = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  // Calculer le coût des Star Players (sera mis à jour par le composant)
  const starPlayersCost = useMemo(() => {
    // Le coût sera calculé dans le composant StarPlayerSelector
    // Pour l'instant on ne l'utilise pas ici car le composant gère déjà la validation
    return 0;
  }, [selectedStarPlayers]);

  const totalPlayersWithStars = useMemo(
    () => totalPlayers + selectedStarPlayers.length,
    [totalPlayers, selectedStarPlayers],
  );

  function change(slug: string, delta: number) {
    setCounts((prev) => {
      const pos = positions.find((p) => p.slug === slug);
      const currentCount = prev[slug] || 0;
      const next = Math.max(
        pos?.min ?? 0,
        Math.min(pos?.max ?? 16, currentCount + delta),
      );
      
      return { ...prev, [slug]: next };
    });
  }

  async function submit() {
    try {
      setError(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/team/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          name,
          roster: rosterId,
          teamValue,
          choices: Object.entries(counts).map(([slug, count]) => ({
            key: slug,
            count,
          })),
          starPlayers: selectedStarPlayers, // ✨ Ajout des Star Players
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `${t.teams.error} ${res.status}`);
      window.location.href = `/me/teams/${json.team.id}`;
    } catch (e: any) {
      setError(e.message || t.teams.error);
    }
  }

  return (
    <div className="w-full p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t.teams.createTeamTitle}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid gap-3">
        <input
          className="border p-2 rounded"
          placeholder={t.teams.teamNamePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="border p-2 w-48"
            value={rosterId}
            onChange={(e) => setRosterId(e.target.value)}
            disabled={loadingRosters}
          >
            {loadingRosters ? (
              <option value="">{t.common.loading}</option>
            ) : (
              rosters.map((roster) => (
                <option key={roster.slug} value={roster.slug}>
                  {roster.name}
                </option>
              ))
            )}
          </select>
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
              value={teamValue}
              onChange={(e) => setTeamValue(parseInt(e.target.value) || 1000)}
            />
          </div>
        </div>
      </div>
      <div className="rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">{t.teams.position}</th>
              <th className="text-left p-2">{t.teams.cost}</th>
              <th className="text-left p-2">{t.teams.min}</th>
              <th className="text-left p-2">{t.teams.max}</th>
              <th className="text-left p-2">{t.teams.skills}</th>
              <th className="text-left p-2">{t.teams.quantity}</th>
              <th className="text-left p-2">{t.teams.actions}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.slug} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{p.displayName}</td>
                <td className="p-2">{p.cost}k</td>
                <td className="p-2">{p.min}</td>
                <td className="p-2">{p.max}</td>
                <td className="p-2">
                  <SkillTooltip 
                    skillsString={p.skills} 
                    position={p.slug}
                    className="text-xs"
                  />
                </td>
                <td className="p-2">{counts[p.slug] || 0}</td>
                <td className="p-2">
                  <button
                    className="px-2 py-1 border mr-2 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => change(p.slug, -1)}
                    disabled={(counts[p.slug] || 0) <= (p.min || 0)}
                  >
                    -
                  </button>
                  <button
                    className={`px-2 py-1 border rounded ${
                      (counts[p.slug] || 0) >= (p.max || 16) || 
                      total + p.cost > teamValue 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'hover:bg-gray-100 transition-colors'
                    }`}
                    onClick={() => change(p.slug, 1)}
                    disabled={(counts[p.slug] || 0) >= (p.max || 16) || total + p.cost > teamValue}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StarPlayerSelector
        roster={rosterId}
        selectedStarPlayers={selectedStarPlayers}
        onSelectionChange={setSelectedStarPlayers}
        currentPlayerCount={totalPlayers}
        availableBudget={(teamValue - total) * 1000}
      />

      <div className="rounded border bg-gray-50 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
          <div>
            <div className="text-gray-600">{t.teams.playersCost}</div>
            <div className="font-semibold text-lg">{total}{t.teams.kpo}</div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.totalBudget}</div>
            <div className="font-semibold text-lg">{teamValue}{t.teams.kpo}</div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.remainingBudget}</div>
            <div className={`font-semibold text-lg ${teamValue - total < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {teamValue - total}{t.teams.kpo}
            </div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.totalPlayers}</div>
            <div className={`font-semibold text-lg ${totalPlayersWithStars < 11 || totalPlayersWithStars > 16 ? 'text-red-600' : 'text-green-600'}`}>
              {totalPlayersWithStars} / 16
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {totalPlayersWithStars < 11 && (
              <div className="text-red-600 text-sm">
                ⚠️ {t.teams.needMinPlayers.replace("{count}", totalPlayersWithStars.toString())}
              </div>
            )}
            {totalPlayersWithStars > 16 && (
              <div className="text-red-600 text-sm">
                ⚠️ {t.teams.maxPlayersExceeded.replace("{count}", totalPlayersWithStars.toString())}
              </div>
            )}
            {totalPlayersWithStars >= 11 && totalPlayersWithStars <= 16 && (
              <div className="text-green-600 text-sm">
                ✅ {t.teams.validTeam.replace("{players}", totalPlayers.toString()).replace("{stars}", selectedStarPlayers.length.toString())}
              </div>
            )}
          </div>
          <button
            className="px-6 py-3 bg-emerald-600 text-white rounded font-medium disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            onClick={submit}
            disabled={totalPlayersWithStars < 11 || totalPlayersWithStars > 16}
          >
            {t.teams.createTeamButton}
          </button>
        </div>
      </div>
    </div>
  );
}
