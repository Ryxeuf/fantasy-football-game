"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type RouteInfo = {
  method: string;
  path: string;
  description?: string;
};

type RouteCategory = {
  category: string;
  routes: RouteInfo[];
};

export default function AdminRoutesPage() {
  const [nextjsRoutes, setNextjsRoutes] = useState<RouteInfo[]>([]);
  const [apiRoutes, setApiRoutes] = useState<RouteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Charger les routes API depuis le backend
      const response = await fetch(`${API_BASE}/admin/routes`);
      if (response.ok) {
        const data = await response.json();
        setApiRoutes(data.routes || []);
      } else {
        // Si l'endpoint n'existe pas, construire manuellement la liste
        setApiRoutes(buildApiRoutesList());
      }

      // Construire la liste des routes Next.js
      setNextjsRoutes(buildNextjsRoutesList());
    } catch (e: any) {
      console.error("Erreur lors du chargement des routes:", e);
      setError(e.message || "Erreur");
      // Utiliser les listes manuelles en cas d'erreur
      setApiRoutes(buildApiRoutesList());
      setNextjsRoutes(buildNextjsRoutesList());
    } finally {
      setLoading(false);
    }
  };

  const buildApiRoutesList = (): RouteCategory[] => {
    return [
      {
        category: "Authentification",
        routes: [
          { method: "POST", path: "/auth/register", description: "Créer un compte" },
          { method: "POST", path: "/auth/login", description: "Se connecter" },
          { method: "GET", path: "/auth/me", description: "Obtenir les infos utilisateur" },
          { method: "POST", path: "/auth/logout", description: "Se déconnecter" },
        ],
      },
      {
        category: "Administration",
        routes: [
          { method: "GET", path: "/admin/users", description: "Liste des utilisateurs" },
          { method: "GET", path: "/admin/matches", description: "Liste des parties" },
          { method: "GET", path: "/admin/stats", description: "Statistiques" },
        ],
      },
      {
        category: "Données Admin - Compétences",
        routes: [
          { method: "GET", path: "/admin/data/skills", description: "Liste des compétences" },
          { method: "POST", path: "/admin/data/skills", description: "Créer une compétence" },
          { method: "GET", path: "/admin/data/skills/:id", description: "Détails d'une compétence" },
          { method: "PUT", path: "/admin/data/skills/:id", description: "Modifier une compétence" },
          { method: "DELETE", path: "/admin/data/skills/:id", description: "Supprimer une compétence" },
        ],
      },
      {
        category: "Données Admin - Rosters",
        routes: [
          { method: "GET", path: "/admin/data/rosters", description: "Liste des rosters" },
          { method: "POST", path: "/admin/data/rosters", description: "Créer un roster" },
          { method: "GET", path: "/admin/data/rosters/:id", description: "Détails d'un roster" },
          { method: "PUT", path: "/admin/data/rosters/:id", description: "Modifier un roster" },
          { method: "DELETE", path: "/admin/data/rosters/:id", description: "Supprimer un roster" },
        ],
      },
      {
        category: "Données Admin - Positions",
        routes: [
          { method: "GET", path: "/admin/data/positions", description: "Liste des positions" },
          { method: "POST", path: "/admin/data/positions", description: "Créer une position" },
          { method: "GET", path: "/admin/data/positions/:id", description: "Détails d'une position" },
          { method: "PUT", path: "/admin/data/positions/:id", description: "Modifier une position" },
          { method: "DELETE", path: "/admin/data/positions/:id", description: "Supprimer une position" },
        ],
      },
      {
        category: "Données Admin - Star Players",
        routes: [
          { method: "GET", path: "/admin/data/star-players", description: "Liste des Star Players" },
          { method: "POST", path: "/admin/data/star-players", description: "Créer un Star Player" },
          { method: "GET", path: "/admin/data/star-players/:id", description: "Détails d'un Star Player" },
          { method: "PUT", path: "/admin/data/star-players/:id", description: "Modifier un Star Player" },
          { method: "DELETE", path: "/admin/data/star-players/:id", description: "Supprimer un Star Player" },
        ],
      },
      {
        category: "API Publique",
        routes: [
          { method: "GET", path: "/api/rosters", description: "Liste des rosters (public)" },
          { method: "GET", path: "/api/rosters/:slug", description: "Détails d'un roster (public)" },
          { method: "GET", path: "/api/positions", description: "Liste des positions (public)" },
          { method: "GET", path: "/api/skills", description: "Liste des compétences (public)" },
        ],
      },
      {
        category: "Star Players (Public)",
        routes: [
          { method: "GET", path: "/star-players", description: "Liste des Star Players" },
          { method: "GET", path: "/star-players/:slug", description: "Détails d'un Star Player" },
        ],
      },
      {
        category: "Équipes",
        routes: [
          { method: "GET", path: "/team", description: "Liste des équipes de l'utilisateur" },
          { method: "POST", path: "/team", description: "Créer une équipe" },
          { method: "GET", path: "/team/:id", description: "Détails d'une équipe" },
          { method: "PUT", path: "/team/:id", description: "Modifier une équipe" },
          { method: "DELETE", path: "/team/:id", description: "Supprimer une équipe" },
        ],
      },
      {
        category: "Parties",
        routes: [
          { method: "GET", path: "/match", description: "Liste des parties" },
          { method: "POST", path: "/match", description: "Créer une partie" },
          { method: "GET", path: "/match/:id", description: "Détails d'une partie" },
        ],
      },
    ];
  };

  const buildNextjsRoutesList = (): RouteInfo[] => {
    return [
      { method: "GET", path: "/", description: "Page d'accueil" },
      { method: "GET", path: "/login", description: "Page de connexion" },
      { method: "GET", path: "/register", description: "Page d'inscription" },
      { method: "GET", path: "/teams", description: "Liste des équipes" },
      { method: "GET", path: "/teams/[slug]", description: "Détails d'une équipe" },
      { method: "GET", path: "/star-players", description: "Liste des Star Players" },
      { method: "GET", path: "/star-players/[slug]", description: "Détails d'un Star Player" },
      { method: "GET", path: "/skills", description: "Liste des compétences" },
      { method: "GET", path: "/me/teams", description: "Mes équipes" },
      { method: "GET", path: "/me/teams/new", description: "Créer une équipe" },
      { method: "GET", path: "/me/teams/[id]", description: "Détails de mon équipe" },
      { method: "GET", path: "/me/teams/[id]/edit", description: "Modifier mon équipe" },
      { method: "GET", path: "/admin", description: "Page admin principale" },
      { method: "GET", path: "/admin/users", description: "Gestion des utilisateurs" },
      { method: "GET", path: "/admin/matches", description: "Gestion des parties" },
      { method: "GET", path: "/admin/data/skills", description: "Gestion des compétences" },
      { method: "GET", path: "/admin/data/rosters", description: "Gestion des rosters" },
      { method: "GET", path: "/admin/data/positions", description: "Gestion des positions" },
      { method: "GET", path: "/admin/data/star-players", description: "Gestion des Star Players" },
      { method: "GET", path: "/admin/sync", description: "Synchronisation auth" },
      { method: "GET", path: "/legal/mentions-legales", description: "Mentions légales" },
      { method: "GET", path: "/legal/conditions-utilisation", description: "Conditions d'utilisation" },
      { method: "GET", path: "/sitemap.xml", description: "Sitemap XML" },
      { method: "GET", path: "/robots.txt", description: "Robots.txt" },
    ];
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-blue-100 text-blue-800",
      POST: "bg-green-100 text-green-800",
      PUT: "bg-yellow-100 text-yellow-800",
      DELETE: "bg-red-100 text-red-800",
      PATCH: "bg-purple-100 text-purple-800",
    };
    return colors[method] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement des routes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          📋 Routes disponibles
        </h1>
        <p className="text-sm text-gray-600">
          Liste complète des routes API backend et pages Next.js
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error} (affichage des routes manuelles)</span>
        </div>
      )}

      {/* Routes API Backend */}
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold text-nuffle-anthracite">
          🔌 Routes API Backend
        </h2>
        {apiRoutes.map((category) => (
          <div key={category.category} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5 px-6 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-nuffle-anthracite">
                {category.category}
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {category.routes.map((route, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold ${getMethodColor(
                        route.method
                      )}`}
                    >
                      {route.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-gray-900 break-all">
                        {route.path}
                      </code>
                      {route.description && (
                        <p className="text-xs text-gray-500 mt-1">{route.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Routes Next.js */}
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold text-nuffle-anthracite">
          🌐 Pages Next.js
        </h2>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="space-y-2">
              {nextjsRoutes.map((route, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`px-3 py-1 rounded text-xs font-bold ${getMethodColor(
                      route.method
                    )}`}
                  >
                    {route.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-gray-900 break-all">
                      {route.path}
                    </code>
                    {route.description && (
                      <p className="text-xs text-gray-500 mt-1">{route.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Note :</strong> Les routes API backend nécessitent une authentification (token Bearer) 
          pour la plupart des endpoints. Les routes admin nécessitent un rôle administrateur.
        </p>
      </div>
    </div>
  );
}

