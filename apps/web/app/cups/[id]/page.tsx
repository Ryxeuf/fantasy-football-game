"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../auth-client";

type Cup = {
  id: string;
  name: string;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  creatorId: string;
  validated: boolean;
  isPublic: boolean;
  status: string; // "ouverte", "en_cours", "terminee", "archivee"
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
      email: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
  isCreator?: boolean;
  hasTeamParticipating?: boolean;
  userParticipatingTeamIds?: string[]; // Liste des IDs des équipes de l'utilisateur qui participent
};

type Team = {
  id: string;
  name: string;
  roster: string;
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

export default function CupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cupId = params.id as string;
  const [cup, setCup] = useState<Cup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  useEffect(() => {
    if (cupId) {
      loadCup();
      loadTeams();
    }
  }, [cupId]);

  const loadTeams = async () => {
    try {
      const { teams: data } = await fetchJSON("/team/mine");
      setTeams(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des équipes:", e);
    }
  };

  const loadCup = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (!me?.user) {
        window.location.href = "/login";
        return;
      }
      const { cup: data } = await fetchJSON(`/cup/${cupId}`);
      setCup(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!cup || !selectedTeamId) {
      setError("Veuillez sélectionner une équipe");
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/register`, { teamId: selectedTeamId });
      setSelectedTeamId("");
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'inscription");
    }
  };

  const handleUnregister = async (teamId: string) => {
    if (!cup) return;
    if (!confirm("Êtes-vous sûr de vouloir retirer cette équipe de la coupe ?")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/unregister`, { teamId });
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors du retrait de l'équipe");
    }
  };

  const handleValidate = async () => {
    if (!cup) return;
    if (!confirm("Êtes-vous sûr de vouloir valider cette coupe ? Cela fermera les inscriptions.")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/validate`, {});
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la validation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !cup) {
    return (
      <div className="w-full p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <span>⚠️</span>
          <span className="ml-2">{error}</span>
        </div>
        <button
          onClick={() => router.push("/cups")}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
        >
          Retour aux coupes
        </button>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/cups")}
            className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
          >
            ← Retour aux coupes
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
              {cup.name}
            </h1>
            {cup.status === "ouverte" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Ouverte
              </span>
            )}
            {cup.status === "en_cours" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                En cours
              </span>
            )}
            {cup.status === "terminee" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Terminée
              </span>
            )}
            {cup.status === "archivee" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Archivée
              </span>
            )}
            {cup.isCreator && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/20 text-nuffle-bronze">
                Créateur
              </span>
            )}
            {!cup.isPublic && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                🔒 Privée
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Créée par <span className="font-medium">{cup.creator.coachName}</span>
            {" • "}
            {cup.participantCount} équipe{cup.participantCount > 1 ? "s" : ""}
          </p>
          {!cup.isPublic && cup.isCreator && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                🔗 Lien de partage pour cette coupe privée :
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/cups/${cup.id}`}
                  className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/cups/${cup.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Lien copié dans le presse-papiers !");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Copier
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Cup Details */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Informations
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Créée le :</span>
                <span className="font-medium">
                  {new Date(cup.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Statut :</span>
                <span className="font-medium">
                  {cup.status === "ouverte" && "Ouverte aux inscriptions"}
                  {cup.status === "en_cours" && "En cours"}
                  {cup.status === "terminee" && "Terminée"}
                  {cup.status === "archivee" && "Archivée"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Visibilité :</span>
                <span className="font-medium">
                  {cup.isPublic ? (
                    <span className="text-green-700">Publique</span>
                  ) : (
                    <span className="text-gray-700">Privée</span>
                  )}
                </span>
              </div>
              {cup.isCreator && cup.status !== "archivee" && cup.status !== "ouverte" && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  {cup.status === "terminee" ? (
                    <>
                      <span className="text-gray-600">Archiver la coupe :</span>
                      <button
                        onClick={async () => {
                          if (!confirm("Êtes-vous sûr de vouloir archiver cette coupe ? Cette action est irréversible.")) {
                            return;
                          }
                          try {
                            await postJSON(`/cup/${cupId}/status`, { status: "archivee" });
                            loadCup();
                          } catch (err: any) {
                            setError(err.message || "Erreur lors de l'archivage");
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all"
                      >
                        Archiver
                      </button>
                    </>
                  ) : cup.status === "en_cours" ? (
                    <>
                      <span className="text-gray-600">Terminer la coupe :</span>
                      <button
                        onClick={async () => {
                          if (!confirm("Êtes-vous sûr de vouloir terminer cette coupe ?")) {
                            return;
                          }
                          try {
                            await postJSON(`/cup/${cupId}/status`, { status: "terminee" });
                            loadCup();
                          } catch (err: any) {
                            setError(err.message || "Erreur lors de la mise à jour du statut");
                          }
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-all"
                      >
                        Terminer la coupe
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Équipes inscrites ({cup.participants.length})
            </h2>
            {cup.participants.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucune équipe inscrite pour le moment
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {cup.participants.map((participant) => {
                  const isMyTeam = cup.userParticipatingTeamIds?.includes(participant.id) || false;
                  return (
                    <div
                      key={participant.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative"
                    >
                      <div className="font-medium text-gray-900">
                        {participant.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {participant.roster} • {participant.owner.coachName}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {participant.owner.email}
                      </div>
                      {isMyTeam && cup.status === "ouverte" && !cup.validated && (
                        <button
                          onClick={() => handleUnregister(participant.id)}
                          className="mt-2 w-full px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-all"
                        >
                          Retirer mon équipe
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {cup.isCreator && cup.status === "ouverte" && !cup.validated && (
          <button
            onClick={handleValidate}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all"
          >
            Fermer les inscriptions
          </button>
        )}
        {!cup.hasTeamParticipating && cup.status === "ouverte" && teams.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Choisir une équipe à inscrire
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              >
                <option value="">-- Sélectionner une équipe --</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.roster})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRegister}
                disabled={!selectedTeamId}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Inscrire l'équipe
              </button>
            </div>
          </div>
        )}
        {cup.hasTeamParticipating && (
          <div className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium">
            ✓ Une de vos équipes est inscrite à cette coupe
          </div>
        )}
        {teams.length === 0 && !cup.hasTeamParticipating && cup.status === "ouverte" && (
          <div className="text-sm text-gray-600 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="mb-2">Vous devez créer une équipe pour participer à une coupe.</p>
            <a
              href="/me/teams/new"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Créer une équipe →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

