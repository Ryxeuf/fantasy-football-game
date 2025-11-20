"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../auth-client";

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
  status: string;
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
  userParticipatingTeamIds?: string[];
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

export default function AdminCupManagePage() {
  const router = useRouter();
  const params = useParams();
  const cupId = params.id as string;
  const [cup, setCup] = useState<Cup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  useEffect(() => {
    if (cupId) {
      loadCup();
    }
  }, [cupId]);

  const loadCup = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      const user = me?.user;
      const roles: string[] | undefined = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
          ? [user.role]
          : undefined;
      if (!roles || !roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      const { cup: data } = await fetchJSON(`/cup/${cupId}`);
      setCup(data);
      setSelectedStatus(data.status);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!cup || !selectedStatus) return;
    if (selectedStatus === cup.status) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir changer le statut de "${cup.status}" à "${selectedStatus}" ?`)) {
      return;
    }
    
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/status`, { status: selectedStatus });
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour du statut");
    }
  };

  const handleRemoveTeam = async (teamId: string, teamName: string) => {
    if (!cup) return;
    if (!confirm(`Êtes-vous sûr de vouloir retirer l'équipe "${teamName}" de cette coupe ?`)) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/unregister`, { teamId, force: true });
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors du retrait de l'équipe");
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
          onClick={() => router.push("/admin/cups")}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
        >
          Retour à la liste
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
            onClick={() => router.push("/admin/cups")}
            className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
          >
            ← Retour à la liste
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
              Gestion de la coupe : {cup.name}
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
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Créée par <span className="font-medium">{cup.creator.coachName}</span>
            {" • "}
            {cup.participantCount} équipe{cup.participantCount > 1 ? "s" : ""}
          </p>
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
                <span className="text-gray-600">Statut actuel :</span>
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
            </div>
          </div>

          {/* Admin Status Management */}
          <div className="pt-4 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Gestion du statut (Admin)
            </h2>
            <div className="flex items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
              >
                <option value="ouverte">Ouverte</option>
                <option value="en_cours">En cours</option>
                <option value="terminee">Terminée</option>
                <option value="archivee">Archivée</option>
              </select>
              <button
                onClick={handleStatusChange}
                disabled={selectedStatus === cup.status}
                className="px-5 py-2 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Changer le statut
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ En tant qu'administrateur, vous pouvez changer le statut sans restrictions
            </p>
          </div>
        </div>
      </div>

      {/* Participants Management */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="pt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Équipes inscrites ({cup.participants.length})
          </h2>
          {cup.participants.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune équipe inscrite pour le moment
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {cup.participants.map((participant) => (
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
                  <button
                    onClick={() => handleRemoveTeam(participant.id, participant.name)}
                    className="mt-2 w-full px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-all"
                  >
                    Retirer l'équipe
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

