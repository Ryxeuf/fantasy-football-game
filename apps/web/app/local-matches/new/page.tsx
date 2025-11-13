"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../../auth-client";

type Team = {
  id: string;
  name: string;
  roster: string;
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

async function postJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

type Cup = {
  id: string;
  name: string;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
    team?: {
      id: string;
      name: string;
      roster: string;
      owner: {
        id: string;
        coachName: string;
      };
    };
  }>;
};

export default function NewLocalMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cupId = searchParams.get("cupId");
  
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [cupTeams, setCupTeams] = useState<Array<{
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
  }>>([]);
  const [cup, setCup] = useState<Cup | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [myTeamId, setMyTeamId] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");

  useEffect(() => {
    loadData();
  }, [cupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, cupData] = await Promise.all([
        fetchJSON("/team/mine"),
        cupId ? fetchJSON(`/cup/${cupId}`).catch(() => null) : Promise.resolve(null),
      ]);
      
      setMyTeams(teamsData.teams || []);
      
      if (cupData?.cup) {
        setCup(cupData.cup);
        // Extraire les équipes participantes de la coupe
        const teams = cupData.cup.participants.map((p: any) => {
          // Si le participant a une propriété team, utiliser team
          if (p.team) {
            return {
              id: p.team.id,
              name: p.team.name,
              roster: p.team.roster,
              owner: p.team.owner,
            };
          }
          // Sinon, utiliser directement les propriétés du participant
          return {
            id: p.id,
            name: p.name,
            roster: p.roster,
            owner: p.owner,
          };
        });
        setCupTeams(teams);
      }
    } catch (e: any) {
      console.error("Erreur lors du chargement:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!myTeamId) {
      setError("Veuillez sélectionner votre équipe");
      return;
    }

    // Si c'est une coupe, l'équipe adverse est requise
    if (cupId && !opponentTeamId) {
      setError("Veuillez sélectionner l'équipe adverse");
      return;
    }

    // Si c'est une coupe, vérifier que les équipes sont différentes
    if (cupId && myTeamId === opponentTeamId) {
      setError("Les deux équipes doivent être différentes");
      return;
    }

    setCreating(true);
    try {
      // Déterminer teamAId et teamBId
      // Si pas de coupe, on met notre équipe en teamA et teamB sera null (sera rempli par le second joueur)
      // Si coupe, on met notre équipe et l'équipe adverse
      const teamAId = myTeamId;
      const teamBId = cupId ? opponentTeamId : null;

      const { localMatch } = await postJSON("/local-match", {
        name: name.trim() || undefined,
        teamAId,
        teamBId,
        cupId: cupId || undefined,
      });
      router.push(`/local-matches/${localMatch.id}`);
    } catch (e: any) {
      console.error("Erreur lors de la création:", e);
      setError(e.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-nuffle-anthracite mb-6">
          Créer une partie offline
        </h1>
        {cup && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Coupe :</span> {cup.name}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Seules les équipes participantes à cette coupe sont disponibles
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {!cupId && myTeams.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-nuffle-anthracite text-lg mb-4">
              Vous devez avoir au moins une équipe pour créer une partie offline
            </p>
            <button
              onClick={() => router.push("/me/teams/new")}
              className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
            >
              Créer une équipe
            </button>
          </div>
        ) : cupId && (myTeams.length === 0 || cupTeams.length < 2) ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-nuffle-anthracite text-lg mb-4">
              {myTeams.length === 0 
                ? "Vous devez avoir au moins une équipe participant à cette coupe"
                : "Il faut au moins 2 équipes participantes dans cette coupe pour créer un match"}
            </p>
            {myTeams.length === 0 && (
              <button
                onClick={() => router.push("/me/teams/new")}
                className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
              >
                Créer une équipe
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-medium text-nuffle-anthracite mb-2">
                Nom de la partie (optionnel)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-white text-nuffle-anthracite rounded-lg border border-gray-300"
                placeholder="Ex: Match amical"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-nuffle-anthracite mb-2">
                Mon équipe *
              </label>
              <select
                value={myTeamId}
                onChange={(e) => setMyTeamId(e.target.value)}
                required
                className="w-full px-4 py-2 bg-white text-nuffle-anthracite rounded-lg border border-gray-300"
              >
                <option value="">Sélectionner votre équipe</option>
                {(cupId ? myTeams.filter(t => cupTeams.some(ct => ct.id === t.id)) : myTeams).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.roster})
                  </option>
                ))}
              </select>
            </div>

            {cupId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-nuffle-anthracite mb-2">
                  Équipe adverse *
                </label>
                <select
                  value={opponentTeamId}
                  onChange={(e) => setOpponentTeamId(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white text-nuffle-anthracite rounded-lg border border-gray-300"
                >
                  <option value="">Sélectionner l'équipe adverse</option>
                  {cupTeams
                    .filter(team => team.id !== myTeamId) // Exclure notre équipe
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.roster}) - {team.owner.coachName}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  Les deux équipes doivent appartenir à des joueurs différents
                </p>
              </div>
            )}

            {!cupId && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note :</strong> L'équipe adverse sera déterminée par le second joueur qui validera sa participation via le lien de partage.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors disabled:opacity-50"
              >
                {creating ? "Création..." : "Créer la partie"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 bg-white/20 text-nuffle-gold rounded-lg font-semibold hover:bg-white/30 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

