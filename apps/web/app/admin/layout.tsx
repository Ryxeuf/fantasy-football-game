"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { syncAuthCookie } from "../lib/auth-cookie";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { LEAGUES_V2_UI_FLAG } from "../lib/featureFlagKeys";
import EngineVersionsBadge from "./_components/EngineVersionsBadge";

interface NavEntry {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly exact?: boolean;
}

interface NavSection {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly items: ReadonlyArray<NavEntry>;
}

const STORAGE_KEY = "admin_nav_open_sections_v1";

function buildSections(leaguesEnabled: boolean): ReadonlyArray<NavSection> {
  const competitionItems: NavEntry[] = [
    { href: "/admin/teams", label: "Équipes", icon: "⚽" },
    { href: "/admin/matches", label: "Parties", icon: "🎮" },
    { href: "/admin/local-matches", label: "Matchs locaux", icon: "🎯" },
  ];
  if (leaguesEnabled) {
    competitionItems.push({ href: "/admin/leagues", label: "Ligues", icon: "🏅" });
  }
  competitionItems.push(
    { href: "/admin/cups", label: "Coupes", icon: "🏆" },
    { href: "/admin/nfl-fantasy", label: "NFL Fantasy", icon: "🐀" },
  );

  return [
    {
      id: "overview",
      title: "Vue d'ensemble",
      icon: "📊",
      items: [
        { href: "/admin", label: "Aperçu", icon: "📊", exact: true },
        { href: "/admin/progress", label: "Avancement", icon: "🗺️" },
      ],
    },
    {
      id: "community",
      title: "Communauté",
      icon: "👥",
      items: [
        { href: "/admin/users", label: "Utilisateurs", icon: "👥" },
        { href: "/admin/feedback", label: "Feedback", icon: "💬" },
        { href: "/admin/blog", label: "Blog", icon: "📝" },
      ],
    },
    {
      id: "competitions",
      title: "Compétitions",
      icon: "⚽",
      items: competitionItems,
    },
    {
      id: "pro-league",
      title: "Pro League",
      icon: "🏈",
      items: [
        { href: "/admin/pro-league", label: "Hub", icon: "🏈", exact: true },
        { href: "/admin/pro-league/seasons", label: "Saisons", icon: "🏆" },
        { href: "/admin/sim", label: "Simulation", icon: "🎲", exact: true },
        { href: "/admin/sim/replays", label: "Replays", icon: "📜" },
        { href: "/admin/sim/health", label: "Health", icon: "❤️" },
        { href: "/admin/sim/broadcaster", label: "Broadcaster", icon: "📡" },
        { href: "/admin/sim/test-match", label: "Test match", icon: "🧪" },
      ],
    },
    {
      id: "game-data",
      title: "Données du jeu",
      icon: "📚",
      items: [
        { href: "/admin/data/skills", label: "Compétences", icon: "📚" },
        { href: "/admin/data/rosters", label: "Rosters", icon: "⚽" },
        { href: "/admin/data/positions", label: "Positions", icon: "🎯" },
        { href: "/admin/data/star-players", label: "Star players", icon: "⭐" },
      ],
    },
    {
      id: "system",
      title: "Système",
      icon: "⚙️",
      items: [
        { href: "/admin/feature-flags", label: "Feature flags", icon: "🚩" },
        { href: "/admin/audit-log", label: "Journal d'audit", icon: "📜" },
        { href: "/admin/routes", label: "Routes", icon: "📋" },
        { href: "/admin/utilities", label: "Utilitaires", icon: "🛠️" },
      ],
    },
  ];
}

function matchesPath(entry: NavEntry, pathname: string | null): boolean {
  if (!pathname) return false;
  if (entry.exact || entry.href === "/admin") {
    return pathname === entry.href;
  }
  return pathname.startsWith(entry.href);
}

function findActiveSectionId(
  sections: ReadonlyArray<NavSection>,
  pathname: string | null,
): string | null {
  for (const section of sections) {
    if (section.items.some((entry) => matchesPath(entry, pathname))) {
      return section.id;
    }
  }
  return null;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const leaguesEnabled = useFeatureFlag(LEAGUES_V2_UI_FLAG);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = useMemo(() => buildSections(leaguesEnabled), [leaguesEnabled]);
  const activeSectionId = useMemo(
    () => findActiveSectionId(sections, pathname),
    [sections, pathname],
  );

  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => {
    const initial = new Set<string>();
    if (activeSectionId) initial.add(activeSectionId);
    else initial.add("overview");
    return initial;
  });

  // Hydrate open state from localStorage and ensure active section is open.
  useEffect(() => {
    let stored: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          stored = parsed.filter((v): v is string => typeof v === "string");
        }
      }
    } catch {
      stored = [];
    }
    const next = new Set(stored);
    if (activeSectionId) next.add(activeSectionId);
    if (next.size === 0) next.add("overview");
    setOpenSections(next);
  }, [activeSectionId]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // localStorage may be unavailable (private browsing) — silently skip.
      }
      return next;
    });
  }, []);

  // Synchronise le cookie httpOnly auth_token (S24.1).
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

  const renderNavItem = (entry: NavEntry) => {
    const active = matchesPath(entry, pathname);
    return (
      <Link
        key={entry.href}
        href={entry.href as any}
        className={`flex items-center gap-3 pl-9 pr-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
          active
            ? "bg-nuffle-gold text-white shadow-sm"
            : "text-gray-700 hover:bg-gray-100 hover:text-nuffle-bronze"
        }`}
        data-testid={`admin-nav-item-${entry.href.replace(/\//g, "-")}`}
      >
        <span className="text-base leading-none">{entry.icon}</span>
        <span>{entry.label}</span>
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const isOpen = openSections.has(section.id);
    const hasActive = section.items.some((entry) => matchesPath(entry, pathname));
    return (
      <div key={section.id} className="mb-1">
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
            hasActive
              ? "text-nuffle-anthracite bg-nuffle-gold/5"
              : "text-gray-500 hover:text-nuffle-anthracite hover:bg-gray-50"
          }`}
          aria-expanded={isOpen}
          data-testid={`admin-nav-section-${section.id}`}
        >
          <span
            className={`text-[10px] text-gray-400 transition-transform duration-150 ${
              isOpen ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="text-base leading-none" aria-hidden="true">
            {section.icon}
          </span>
          <span className="flex-1 text-left">{section.title}</span>
          {!isOpen && (
            <span className="text-[10px] font-normal text-gray-400 normal-case tracking-normal">
              {section.items.length}
            </span>
          )}
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5">
            {section.items.map(renderNavItem)}
          </div>
        )}
      </div>
    );
  };

  const navContent = (
    <nav className="p-3">
      <div className="space-y-0.5">{sections.map(renderSection)}</div>
      <div className="pt-4 mt-4 border-t border-gray-200">
        <EngineVersionsBadge variant="sidebar" />
      </div>
    </nav>
  );

  const sidebarHeader = (
    <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-nuffle-gold/10 to-transparent flex items-center justify-between">
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
