"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../auth-client";

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

export default function CupsPage() {
  const router = useRouter();
  const [cups, setCups] = useState<Cup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCupName, setNewCupName] = useState("");
  const [newCupIsPublic, setNewCupIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTeamForRegistration, setSelectedTeamForRegistration] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCups();
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const { teams: data } = await fetchJSON("/team/mine");
      setTeams(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des équipes:", e);
    }
  };

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (!me?.user) {
        window.location.href = "/login";
        return;
      }
      const { cups: data } = await fetchJSON("/cup");
      // Récupérer les équipes de l'utilisateur pour vérifier s'il a une équipe inscrite
      const { teams: userTeams } = await fetchJSON("/team/mine");
      const userTeamIds = new Set(userTeams.map((t: Team) => t.id));
      
      // Enrichir avec les informations de l'utilisateur connecté
      const enrichedCups = data.map((cup: Cup) => ({
        ...cup,
        isCreator: cup.creatorId === me.user.id,
        hasTeamParticipating: cup.participants.some(
          (p) => userTeamIds.has(p.id),
        ),
      }));
      setCups(enrichedCups);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCupName.trim()) {
      setError("Le nom de la coupe est requis");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await postJSON("/cup", { 
        name: newCupName.trim(),
        isPublic: newCupIsPublic
      });
      setNewCupName("");
      setNewCupIsPublic(true);
      setShowCreateForm(false);
      
      // Si la coupe est privée, rediriger vers la page de la coupe avec le lien
      if (!newCupIsPublic && response.cup) {
        router.push(`/cups/${response.cup.id}`);
      } else {
        loadCups();
      }
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleRegister = async (cupId: string) => {
    const teamId = selectedTeamForRegistration[cupId];
    if (!teamId) {
      setError("Veuillez sélectionner une équipe");
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/register`, { teamId });
      setSelectedTeamForRegistration({ ...selectedTeamForRegistration, [cupId]: "" });
      loadCups();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'inscription");
    }
  };

  const handleValidate = async (cupId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir fermer les inscriptions de cette coupe ?")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/validate`, {});
      loadCups();
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

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🏆 Coupes
          </h1>
          <p className="text-sm text-gray-600">
            Créez ou inscrivez-vous à une coupe
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/cups/archived"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
          >
            📦 Coupes archivées
          </a>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>+</span>
            <span>Nouvelle coupe</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Créer une nouvelle coupe</h2>
          <form onSubmit={handleCreateCup} className="space-y-4">
            <div>
              <label htmlFor="cupName" className="block text-sm font-medium text-gray-700 mb-2">
                Nom de la coupe *
              </label>
              <input
                id="cupName"
                type="text"
                value={newCupName}
                onChange={(e) => setNewCupName(e.target.value)}
                placeholder="Ex: Coupe de Printemps 2024"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCupIsPublic}
                  onChange={(e) => setNewCupIsPublic(e.target.checked)}
                  className="rounded border-gray-300 text-nuffle-gold focus:ring-nuffle-gold"
                />
                <span className="text-sm text-gray-700">
                  Coupe publique (visible dans la liste)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Si désactivé, la coupe sera privée et nécessitera un lien direct pour y accéder
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Création..." : "Créer la coupe"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCupName("");
                  setError(null);
                }}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cups List */}
      <div className="grid gap-4">
        {cups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Aucune coupe disponible</p>
            <p className="text-sm text-gray-400 mt-2">
              Créez la première coupe pour commencer !
            </p>
          </div>
        ) : (
          cups.map((cup) => (
            <div
              key={cup.id}
              className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-nuffle-anthracite">
                      {cup.name}
                    </h2>
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
                    {!cup.isPublic && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        🔒 Privée
                      </span>
                    )}
                    {cup.isCreator && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/20 text-nuffle-bronze">
                        Créateur
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Créée par <span className="font-medium">{cup.creator.coachName}</span>
                    {" • "}
                    {cup.participantCount} participant{cup.participantCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Créée le {new Date(cup.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Participants List */}
              {cup.participants.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Équipes inscrites ({cup.participants.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cup.participants.map((participant) => (
                      <span
                        key={participant.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                        title={`${participant.name} (${participant.roster}) - ${participant.owner.coachName}`}
                      >
                        {participant.name} ({participant.owner.coachName})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                {cup.isCreator && cup.status === "ouverte" && !cup.validated && (
                  <button
                    onClick={() => handleValidate(cup.id)}
                    className="px-4 py-2 bg-nuffle-gold text-white rounded-lg text-sm font-medium hover:bg-nuffle-gold/90 transition-all"
                  >
                    Fermer les inscriptions
                  </button>
                )}
                {!cup.hasTeamParticipating && cup.status === "ouverte" && teams.length > 0 && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Choisir une équipe
                      </label>
                      <select
                        value={selectedTeamForRegistration[cup.id] || ""}
                        onChange={(e) => setSelectedTeamForRegistration({ ...selectedTeamForRegistration, [cup.id]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                      >
                        <option value="">-- Sélectionner une équipe --</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.roster})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleRegister(cup.id)}
                      disabled={!selectedTeamForRegistration[cup.id]}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Inscrire l'équipe
                    </button>
                  </div>
                )}
                {cup.hasTeamParticipating && (
                  <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                    ✓ Une de vos équipes est inscrite
                  </div>
                )}
                {teams.length === 0 && !cup.hasTeamParticipating && cup.status === "ouverte" && (
                  <div className="text-sm text-gray-600">
                    <p className="mb-2">Vous devez créer une équipe pour participer à une coupe.</p>
                    <a
                      href="/me/teams/new"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Créer une équipe →
                    </a>
                  </div>
                )}
                <button
                  onClick={() => router.push(`/cups/${cup.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
                >
                  Voir les détails
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

