"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  coachName: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  role: string;
  patreon?: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    teams: number;
    matches: number;
    createdMatches: number;
    teamSelections: number;
  };
};

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = "/login";
    throw new Error("Non authentifié");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login";
    }
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJSON("/auth/me");
        setProfile(data.user);
        setFormData(data.user);
      } catch (e: any) {
        setError(e.message || "Erreur lors du chargement du profil");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/login";
        throw new Error("Non authentifié");
      }
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setProfile(data.user);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData(profile);
    }
    setEditing(false);
    setError(null);
  };

  const getInitials = (coachName?: string, name?: string | null, email?: string) => {
    const nameToUse = coachName || name;
    if (nameToUse) {
      return nameToUse
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Chargement du profil...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || "Profil non trouvé"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <h1 className="text-3xl font-bold">Mon Profil</h1>

      {/* Informations principales */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-6 flex-1">
            <div className="w-20 h-20 rounded-full bg-nuffle-bronze text-white flex items-center justify-center font-bold text-2xl">
              {getInitials(profile.coachName, profile.name, profile.email)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{profile.coachName || profile.name || "Utilisateur"}</h2>
                {profile.patreon && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                    Patreon
                  </span>
                )}
              </div>
              <p className="text-gray-600 font-mono">{profile.email}</p>
              {(profile.firstName || profile.lastName) && (
                <p className="text-gray-600 mt-1">
                  {profile.firstName} {profile.lastName}
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-nuffle-bronze text-white rounded hover:bg-nuffle-gold transition-colors"
            >
              ✏️ Modifier
            </button>
          )}
        </div>
      </div>

      {/* Formulaire d'édition */}
      {editing && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Modifier mon profil</h3>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nuffle-bronze"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de coach <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.coachName || ""}
                onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nuffle-bronze"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom
              </label>
              <input
                type="text"
                value={formData.firstName || ""}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nuffle-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <input
                type="text"
                value={formData.lastName || ""}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nuffle-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                value={formData.dateOfBirth ? formData.dateOfBirth.split("T")[0] : ""}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nuffle-bronze"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || !formData.email || !formData.coachName}
                className="px-4 py-2 bg-nuffle-bronze text-white rounded hover:bg-nuffle-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques - masquées pour le moment */}
      {/* <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Statistiques</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-blue-700">{profile._count.teams}</div>
            <div className="text-sm text-gray-600 mt-1">Équipes</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-green-700">{profile._count.matches}</div>
            <div className="text-sm text-gray-600 mt-1">Parties jouées</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-yellow-700">{profile._count.createdMatches}</div>
            <div className="text-sm text-gray-600 mt-1">Parties créées</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-purple-700">{profile._count.teamSelections}</div>
            <div className="text-sm text-gray-600 mt-1">Sélections</div>
          </div>
        </div>
      </div> */}

      {/* Informations de compte */}
      {!editing && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Informations du compte</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-600">Date d'inscription</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Dernière mise à jour</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(profile.updatedAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            {profile.dateOfBirth && (
              <div>
                <dt className="text-sm font-medium text-gray-600">Date de naissance</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(profile.dateOfBirth).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Actions rapides */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Actions rapides</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="/me/teams"
            className="px-4 py-2 bg-nuffle-bronze text-white rounded hover:bg-nuffle-gold transition-colors"
          >
            ⚽ Gérer mes équipes
          </a>
          {profile.role === "admin" && (
            <a
              href="/admin"
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              🔧 Administration
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

