"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Synchronise le token depuis localStorage vers les cookies pour les utilisateurs déjà connectés
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      // Vérifie si le cookie n'existe pas déjà
      const cookieExists = document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith("auth_token="));
      if (!cookieExists) {
        // Crée le cookie si il n'existe pas
        document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }
    }
  }, []);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(path);
  };

  const navItem = (href: string, label: string, icon: string) => (
    <Link
      href={href as any}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive(href)
          ? "bg-nuffle-gold text-white shadow-md"
          : "text-gray-700 hover:bg-gray-100 hover:text-nuffle-bronze"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div className="flex w-full">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white border-r border-gray-200 shadow-sm sticky top-0 flex-shrink-0">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-nuffle-gold/10 to-transparent">
            <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite flex items-center gap-2">
              <span className="text-3xl">🔧</span>
              Admin
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-subtitle">
              Panneau de contrôle
            </p>
          </div>
          
          <nav className="p-4 space-y-1">
            <div className="mb-4">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Administration
              </div>
              {navItem("/admin", "Aperçu", "📊")}
              {navItem("/admin/progress", "Avancement", "🗺️")}
              {navItem("/admin/users", "Utilisateurs", "👥")}
              {navItem("/admin/teams", "Équipes", "⚽")}
              {navItem("/admin/matches", "Parties", "🎮")}
              {navItem("/admin/local-matches", "Matchs Locaux", "🎯")}
              {navItem("/admin/cups", "Coupes", "🏆")}
              {navItem("/admin/feature-flags", "Feature Flags", "🚩")}
              {navItem("/admin/routes", "Routes", "📋")}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Données du jeu
              </div>
              {navItem("/admin/data/skills", "Compétences", "📚")}
              {navItem("/admin/data/rosters", "Rosters", "⚽")}
              {navItem("/admin/data/positions", "Positions", "🎯")}
              {navItem("/admin/data/star-players", "Star Players", "⭐")}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 w-full p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
