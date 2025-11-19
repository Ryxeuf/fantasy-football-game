"use client";
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "./auth-client";
import { useLanguage } from "./contexts/LanguageContext";

type UserData = {
  email: string;
  name?: string | null;
  role: string;
};

interface AuthBarProps {
  isMobileMenu?: boolean;
}

export default function AuthBar({ isMobileMenu = false }: AuthBarProps) {
  const { t } = useLanguage();
  const [hasToken, setHasToken] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setHasToken(!!token);
    if (token) {
      // Synchronise le token dans les cookies pour le middleware
      const cookieExists = document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith("auth_token="));
      if (!cookieExists) {
        document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }

      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setIsAdmin(data?.user?.role === "admin");
          setUserData(data?.user);
        })
        .catch(() => {
          setIsAdmin(false);
          setUserData(null);
        });
    } else {
      setIsAdmin(false);
      setUserData(null);
    }
  }, []);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  function logout() {
    localStorage.removeItem("auth_token");
    // Supprime aussi le cookie
    document.cookie = "auth_token=; path=/; max-age=0";
    setHasToken(false);
    setUserData(null);
    setMenuOpen(false);
    window.location.href = "/login";
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
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

  // Dans le menu mobile, afficher le menu déroulant en mode étendu
  if (isMobileMenu && hasToken) {
    return (
      <div className="w-full">
        {/* En-tête utilisateur */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-nuffle-bronze text-white flex items-center justify-center font-semibold text-sm">
              {getInitials(userData?.name, userData?.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 truncate">
                {userData?.name || t.auth.user}
              </div>
              <div className="text-xs text-gray-600 font-mono truncate">
                {userData?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Menu déroulant toujours visible dans le menu mobile */}
        <div className="space-y-1">
          <a
            href="/me/profile"
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            👤 {t.auth.profile}
          </a>
          <a
            href="/me/teams"
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ⚽ {t.auth.myTeams}
          </a>
          <a
            href="/cups"
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            🏆 Coupes
          </a>
          <a
            href="/local-matches"
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            🎮 Parties Offline
          </a>
          {isAdmin && (
            <a
              href="/admin"
              className="block px-4 py-2.5 text-sm text-purple-600 font-semibold hover:bg-purple-50 rounded-lg transition-colors"
            >
              🔧 {t.auth.admin}
            </a>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            🚪 {t.auth.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-sm">
      {hasToken ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="Menu utilisateur"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-nuffle-bronze text-white flex items-center justify-center font-semibold text-xs">
              {getInitials(userData?.name, userData?.email)}
            </div>
            <span className="hidden lg:block text-sm">{userData?.name || userData?.email || t.auth.user}</span>
            <svg
              className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[60]">
              <div className="p-3 border-b border-gray-200">
                <div className="font-semibold text-sm">{userData?.name || t.auth.user}</div>
                <div className="text-xs text-gray-600 font-mono break-all">{userData?.email}</div>
              </div>
              <div className="py-1">
                <a
                  href="/me/profile"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  👤 {t.auth.profile}
                </a>
                <a
                  href="/me/teams"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  ⚽ {t.auth.myTeams}
                </a>
                <a
                  href="/cups"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  🏆 Coupes
                </a>
                <a
                  href="/local-matches"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  🎮 Parties Offline
                </a>
                {isAdmin && (
                  <a
                    href="/admin"
                    className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors text-purple-600 font-semibold"
                    onClick={() => setMenuOpen(false)}
                  >
                    🔧 {t.auth.admin}
                  </a>
                )}
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors text-red-600"
                >
                  🚪 {t.auth.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <a className="underline text-xs sm:text-sm whitespace-nowrap" href="/login">
            {t.auth.login}
          </a>
          <a className="underline text-xs sm:text-sm whitespace-nowrap" href="/register">
            {t.auth.register}
          </a>
        </div>
      )}
    </div>
  );
}
