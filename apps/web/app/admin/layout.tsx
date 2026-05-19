"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { syncAuthCookie } from "../lib/auth-cookie";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { LEAGUES_V2_UI_FLAG } from "../lib/featureFlagKeys";
import EngineVersionsBadge from "./_components/EngineVersionsBadge";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const leaguesEnabled = useFeatureFlag(LEAGUES_V2_UI_FLAG);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Synchronise le cookie httpOnly auth_token (S24.1). La route est
  // idempotente et le cookie n'est plus visible cote JS, on tente
  // donc toujours la synchro.
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      void syncAuthCookie(token);
    }
  }, []);

  // Ferme le drawer mobile a chaque navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll quand le drawer mobile est ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    // /admin/sim et /admin/sim/replays partagent un préfixe : forcer la
    // comparaison exacte sur /admin/sim pour éviter le double highlight.
    if (path === "/admin/sim") {
      return pathname === "/admin/sim";
    }
    // Idem pour /admin/pro-league vs /admin/pro-league/seasons (et /teams).
    if (path === "/admin/pro-league") {
      return pathname === "/admin/pro-league";
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

  const navContent = (
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
        {leaguesEnabled && navItem("/admin/leagues", "Ligues", "🏅")}
        {navItem("/admin/cups", "Coupes", "🏆")}
        {navItem("/admin/feature-flags", "Feature Flags", "🚩")}
        {navItem("/admin/sim", "Sim Pro League", "🎲")}
        {navItem("/admin/sim/replays", "Replays Panel", "📜")}
        {navItem("/admin/sim/health", "Sim Health", "❤️")}
        {navItem("/admin/sim/broadcaster", "Broadcaster", "📡")}
        {navItem("/admin/sim/test-match", "Test Match", "🧪")}
        {navItem("/admin/pro-league", "Hub Pro League", "🏈")}
        {navItem("/admin/pro-league/seasons", "Saisons Pro League", "🏆")}
        {navItem("/admin/blog", "Blog", "📝")}
        {navItem("/admin/feedback", "Feedback", "💬")}
        {navItem("/admin/audit-log", "Journal d'audit", "📜")}
        {navItem("/admin/routes", "Routes", "📋")}
        {navItem("/admin/utilities", "Utilitaires", "🛠️")}
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

      <EngineVersionsBadge variant="sidebar" />
    </nav>
  );

  const sidebarHeader = (
    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-nuffle-gold/10 to-transparent flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite flex items-center gap-2">
          <span className="text-3xl">🔧</span>
          Admin
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-subtitle">
          Panneau de contrôle
        </p>
      </div>
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className="lg:hidden text-gray-500 hover:text-gray-700 text-2xl leading-none p-2 -mr-2"
        aria-label="Fermer le menu"
      >
        ✕
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      {/* Topbar mobile */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Ouvrir le menu admin"
          data-testid="admin-mobile-menu-button"
        >
          <span className="text-xl">☰</span>
          <span className="text-sm font-medium">Menu</span>
        </button>
        <h1 className="text-lg font-heading font-bold text-nuffle-anthracite flex items-center gap-1.5">
          <span>🔧</span>
          <span>Admin</span>
        </h1>
        <div className="w-[72px]" aria-hidden="true" />
      </div>

      <div className="flex w-full">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 min-h-screen bg-white border-r border-gray-200 shadow-sm sticky top-0 flex-shrink-0">
          {sidebarHeader}
          {navContent}
        </aside>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={`lg:hidden fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-full bg-white border-r border-gray-200 shadow-xl transform transition-transform duration-200 overflow-y-auto ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          data-testid="admin-mobile-drawer"
        >
          {sidebarHeader}
          {navContent}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 w-full px-3 py-4 sm:px-4 sm:py-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
