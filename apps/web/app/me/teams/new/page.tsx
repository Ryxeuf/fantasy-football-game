"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import StarPlayerSelector from "../../../components/StarPlayerSelector";
import SkillTooltip from "../components/SkillTooltip";

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

export default function NewTeamBuilder() {
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
      .catch(() => setError("Impossible de charger le roster"));
  }, [rosterId]);

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
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      window.location.href = `/me/teams/${json.team.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Créer une équipe</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid gap-3">
        <input
          className="border p-2"
          placeholder="Nom de l'équipe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="border p-2 w-48"
            value={rosterId}
            onChange={(e) => setRosterId(e.target.value)}
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
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valeur d'équipe (kpo)
            </label>
            <input
              type="number"
              min="100"
              max="2000"
              step="50"
              className="border p-2 w-full"
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
              <th className="text-left p-2">Poste</th>
              <th className="text-left p-2">Coût</th>
              <th className="text-left p-2">Min</th>
              <th className="text-left p-2">Max</th>
              <th className="text-left p-2">Compétences</th>
              <th className="text-left p-2">Qté</th>
              <th className="text-left p-2">Actions</th>
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
                    className="px-2 py-1 border mr-2"
                    onClick={() => change(p.slug, -1)}
                    disabled={(counts[p.slug] || 0) <= (p.min || 0)}
                  >
                    -
                  </button>
                  <button
                    className={`px-2 py-1 border ${
                      (counts[p.slug] || 0) >= (p.max || 16) || 
                      total + p.cost > teamValue 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'hover:bg-gray-100'
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
            <div className="text-gray-600">Coût joueurs</div>
            <div className="font-semibold text-lg">{total}K po</div>
          </div>
          <div>
            <div className="text-gray-600">Budget total</div>
            <div className="font-semibold text-lg">{teamValue}K po</div>
          </div>
          <div>
            <div className="text-gray-600">Budget restant</div>
            <div className={`font-semibold text-lg ${teamValue - total < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {teamValue - total}K po
            </div>
          </div>
          <div>
            <div className="text-gray-600">Joueurs total</div>
            <div className={`font-semibold text-lg ${totalPlayersWithStars < 11 || totalPlayersWithStars > 16 ? 'text-red-600' : 'text-green-600'}`}>
              {totalPlayersWithStars} / 16
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {totalPlayersWithStars < 11 && (
              <div className="text-red-600 text-sm">
                ⚠️ Il vous faut au moins 11 joueurs (actuellement {totalPlayersWithStars})
              </div>
            )}
            {totalPlayersWithStars > 16 && (
              <div className="text-red-600 text-sm">
                ⚠️ Maximum 16 joueurs autorisés (actuellement {totalPlayersWithStars})
              </div>
            )}
            {totalPlayersWithStars >= 11 && totalPlayersWithStars <= 16 && (
              <div className="text-green-600 text-sm">
                ✅ Équipe valide ({totalPlayers} joueurs + {selectedStarPlayers.length} Star Players)
              </div>
            )}
          </div>
          <button
            className="px-6 py-3 bg-emerald-600 text-white rounded font-medium disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            onClick={submit}
            disabled={totalPlayersWithStars < 11 || totalPlayersWithStars > 16}
          >
            Créer l'équipe
          </button>
        </div>
      </div>
    </div>
  );
}
