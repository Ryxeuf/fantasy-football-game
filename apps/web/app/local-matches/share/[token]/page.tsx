"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../auth-client";

type LocalMatch = {
  id: string;
  name: string | null;
  status: string;
  shareToken: string | null;
  teamA: {
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
  };
  teamB: {
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
  } | null;
  cup: {
    id: string;
    name: string;
    status: string;
  } | null;
  teamAOwnerValidated: boolean;
  teamBOwnerValidated: boolean;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
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

export default function ShareLocalMatchPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [localMatch, setLocalMatch] = useState<LocalMatch | null>(null);
  const [myTeams, setMyTeams] = useState<Array<{ id: string; name: string; roster: string }>>([]);
  const [selectedTeamBId, setSelectedTeamBId] = useState("");
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userTeamOwnership, setUserTeamOwnership] = useState<{
    isTeamAOwner: boolean;
    isTeamBOwner: boolean;
  } | null>(null);

  useEffect(() => {
    checkAuth();
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMatch();
    } else {
      loadMatch();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && localMatch) {
      checkUserOwnership();
    }
  }, [isAuthenticated, localMatch]);

  const checkAuth = async () => {
    try {
      const me = await fetchJSON("/auth/me");
      setIsAuthenticated(!!me?.user);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const checkUserOwnership = async () => {
    if (!localMatch) return;
    try {
      const me = await fetchJSON("/auth/me");
      if (me?.user) {
        setUserTeamOwnership({
          isTeamAOwner: localMatch.teamA.owner.id === me.user.id,
          isTeamBOwner: localMatch.teamB.owner.id === me.user.id,
        });
      }
    } catch {
      setUserTeamOwnership(null);
    }
  };

  const loadMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchData, teamsData] = await Promise.all([
        fetchJSON(`/local-match/share/${token}`),
        isAuthenticated ? fetchJSON("/team/mine").catch(() => ({ teams: [] })) : Promise.resolve({ teams: [] }),
      ]);
      setLocalMatch(matchData.localMatch);
      if (teamsData.teams) {
        setMyTeams(teamsData.teams);
      }
    } catch (e: any) {
      console.error("Erreur lors du chargement:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/local-matches/share/${token}`);
      return;
    }

    // Si teamBId est null, le second joueur doit sélectionner son équipe
    if (!localMatch?.teamB && !selectedTeamBId) {
      setError("Veuillez sélectionner votre équipe");
      return;
    }

    setValidating(true);
    setError(null);
    try {
      const { localMatch: updated } = await postJSON(`/local-match/share/${token}/validate`, {
        teamBId: !localMatch?.teamB ? selectedTeamBId : undefined,
      });
      setLocalMatch(updated);
      
      if (updated.status === "in_progress") {
        // Rediriger vers la page du match
        setTimeout(() => {
          router.push(`/local-matches/${updated.id}`);
        }, 2000);
      }
    } catch (e: any) {
      console.error("Erreur lors de la validation:", e);
      setError(e.message || "Erreur lors de la validation");
    } finally {
      setValidating(false);
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

  if (error && !localMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 rounded-lg p-6 text-center">
            <p className="text-lg font-semibold mb-2">Erreur</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!localMatch) {
    return null;
  }

  const userCanValidate = isAuthenticated && userTeamOwnership && 
    ((userTeamOwnership.isTeamAOwner && !localMatch.teamAOwnerValidated) ||
     (userTeamOwnership.isTeamBOwner && !localMatch.teamBOwnerValidated));

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-nuffle-anthracite mb-6">
          Invitation à un match local
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-nuffle-anthracite mb-2">
              {localMatch.name || "Match sans nom"}
            </h2>
            {localMatch.cup && (
              <p className="text-sm text-gray-600">
                Coupe : {localMatch.cup.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Équipe A</p>
              <p className="font-semibold text-nuffle-anthracite">
                {localMatch.teamA.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {localMatch.teamA.roster}
              </p>
              <p className="text-xs text-gray-500">
                {localMatch.teamA.owner.coachName}
              </p>
              {localMatch.teamAOwnerValidated && (
                <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  ✓ Validé
                </span>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Équipe B</p>
              {localMatch.teamB ? (
                <>
                  <p className="font-semibold text-nuffle-anthracite">
                    {localMatch.teamB.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {localMatch.teamB.roster}
                  </p>
                  <p className="text-xs text-gray-500">
                    {localMatch.teamB.owner.coachName}
                  </p>
                  {localMatch.teamBOwnerValidated && (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      ✓ Validé
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  En attente de sélection par le second joueur
                </p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Créé par : {localMatch.creator.coachName}
            </p>
            <p className="text-sm text-gray-600">
              Statut :{" "}
              <span className="font-semibold">
                {localMatch.status === "waiting_for_player"
                  ? "En attente de validation"
                  : localMatch.status === "in_progress"
                  ? "En cours"
                  : localMatch.status}
              </span>
            </p>
          </div>

          {localMatch.status === "waiting_for_player" && (
            <div className="border-t pt-4">
              {!isAuthenticated ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    Vous devez être connecté pour valider votre participation.
                  </p>
                  <button
                    onClick={() => router.push(`/login?redirect=/local-matches/share/${token}`)}
                    className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
                  >
                    Se connecter
                  </button>
                </div>
              ) : (!localMatch.teamB && !userTeamOwnership?.isTeamAOwner) ? (
                <div>
                  <p className="text-sm text-gray-700 mb-4">
                    Sélectionnez votre équipe pour compléter ce match :
                  </p>
                  <select
                    value={selectedTeamBId}
                    onChange={(e) => setSelectedTeamBId(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-nuffle-anthracite rounded-lg border border-gray-300 mb-4"
                  >
                    <option value="">Sélectionner votre équipe</option>
                    {myTeams
                      .filter(team => team.id !== localMatch.teamA.id) // Exclure l'équipe A
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.roster})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleValidate}
                    disabled={validating || !selectedTeamBId}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {validating ? "Validation..." : "Valider ma participation"}
                  </button>
                </div>
              ) : userCanValidate ? (
                <div>
                  <p className="text-sm text-gray-700 mb-4">
                    Vous êtes propriétaire d'une des équipes de ce match. Validez votre participation pour que le match puisse commencer.
                  </p>
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {validating ? "Validation..." : "Valider ma participation"}
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Vous avez déjà validé votre participation. En attente de la validation de l'autre joueur...
                  </p>
                </div>
              )}
            </div>
          )}

          {localMatch.status === "in_progress" && (
            <div className="border-t pt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800 mb-2">
                  ✓ Les deux joueurs ont validé leur participation. Le match peut commencer !
                </p>
              </div>
              <button
                onClick={() => router.push(`/local-matches/${localMatch.id}`)}
                className="w-full px-6 py-3 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
              >
                Accéder au match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

