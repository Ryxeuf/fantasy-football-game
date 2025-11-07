"use client";
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "./auth-client";
import { useLanguage } from "./contexts/LanguageContext";

type UserData = {
  email: string;
  name?: string | null;
  role: string;
};

export default function AuthBar() {
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

  return (
    <div className="flex items-center gap-3 text-sm">
      {hasToken ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="Menu utilisateur"
          >
            <div className="w-8 h-8 rounded-full bg-nuffle-bronze text-white flex items-center justify-center font-semibold text-xs">
              {getInitials(userData?.name, userData?.email)}
            </div>
            <span className="hidden md:block text-sm">{userData?.name || userData?.email || t.auth.user}</span>
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
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-gray-200">
                <div className="font-semibold text-sm">{userData?.name || t.auth.user}</div>
                <div className="text-xs text-gray-600 font-mono">{userData?.email}</div>
              </div>
              <div className="py-1">
                <a
                  href="/me/profile"
                  className="block px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  👤 {t.auth.profile}
                </a>
                <a
                  href="/me/teams"
                  className="block px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  ⚽ {t.auth.myTeams}
                </a>
                {isAdmin && (
                  <a
                    href="/admin"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 transition-colors text-purple-600 font-semibold"
                    onClick={() => setMenuOpen(false)}
                  >
                    🔧 {t.auth.admin}
                  </a>
                )}
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors text-red-600"
                >
                  🚪 {t.auth.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <a className="underline" href="/login">
            {t.auth.login}
          </a>
          <a className="underline" href="/register">
            {t.auth.register}
          </a>
        </div>
      )}
    </div>
  );
}
