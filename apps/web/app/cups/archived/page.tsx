"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ArchivedCupsPage() {
  const router = useRouter();
  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCups();
  }, []);

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (!me?.user) {
        window.location.href = "/login";
        return;
      }
      const { cups: data } = await fetchJSON("/cup/archived");
      setCups(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
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
          <button
            onClick={() => router.push("/cups")}
            className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
          >
            ← Retour aux coupes
          </button>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            📦 Coupes archivées
          </h1>
          <p className="text-sm text-gray-600">
            Coupes auxquelles vous avez participé ou que vous avez créées
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

      {/* Cups List */}
      <div className="grid gap-4">
        {cups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Aucune coupe archivée</p>
            <p className="text-sm text-gray-400 mt-2">
              Les coupes archivées auxquelles vous avez participé apparaîtront ici
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Archivée
                    </span>
                    {cup.isCreator && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/20 text-nuffle-bronze">
                        Créateur
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Créée par <span className="font-medium">{cup.creator.coachName}</span>
                    {" • "}
                    {cup.participantCount} équipe{cup.participantCount > 1 ? "s" : ""}
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
              <div className="mt-4 pt-4 border-t border-gray-200">
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

