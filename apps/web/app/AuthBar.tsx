"use client";
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "./auth-client";
import { useLanguage } from "./contexts/LanguageContext";
import { useFeatureFlag } from "./hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "./lib/featureFlagKeys";
import { syncAuthCookie, clearAuthCookie } from "./lib/auth-cookie";
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
} from "./lib/auth-storage";
import { refreshAccessToken } from "./lib/auth-refresh";

type UserData = {
  email: string;
  name?: string | null;
  role?: string;
  roles?: string[];
};

interface AuthBarProps {
  isMobileMenu?: boolean;
}

export default function AuthBar({ isMobileMenu = false }: AuthBarProps) {
  const { t } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);
  const [hasToken, setHasToken] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    function fetchMe(token: string): Promise<Response> {
      return fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    function applyUser(user: UserData | undefined): void {
      const roles: string[] | undefined = Array.isArray(user?.roles)
        ? user?.roles
        : user?.role
          ? [user.role]
          : undefined;
      setIsAdmin(!!roles && roles.includes("admin"));
      setUserData(user ?? null);
    }

    // Bascule l'UI en "déconnecté" et purge tout token périmé. Appelé quand la
    // session est RÉELLEMENT perdue (refresh impossible), pas sur une simple
    // erreur réseau transitoire.
    async function forceLoggedOut(): Promise<void> {
      clearAuthTokens();
      await clearAuthCookie();
      if (cancelled) return;
      setHasToken(false);
      setIsAdmin(false);
      setUserData(null);
    }

    async function loadSession(): Promise<void> {
      const token = getAuthToken();
      if (!token) {
        setHasToken(false);
        setIsAdmin(false);
        setUserData(null);
        return;
      }

      // Token présent → affichage optimiste de l'état connecté pendant la
      // validation. Synchronise le cookie httpOnly pour le middleware (S24.1) ;
      // la route est idempotente.
      setHasToken(true);
      void syncAuthCookie(token);

      let res: Response;
      try {
        res = await fetchMe(token);
      } catch {
        // Erreur réseau (serveur down pendant un deploy, hors-ligne...) :
        // transitoire. On NE détruit PAS la session, un reload réessaiera.
        if (!cancelled) {
          setIsAdmin(false);
          setUserData(null);
        }
        return;
      }

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!cancelled) applyUser(data?.user);
        return;
      }

      if (res.status === 401 || res.status === 403) {
        // Access token expiré/invalide (cas classique après un build) → on
        // tente un refresh silencieux via le refresh token (7 j), puis on
        // rejoue /auth/me. Le refresh est single-flight : pas de course avec
        // AuthRefreshLoop.
        const newToken = await refreshAccessToken();
        if (cancelled) return;
        if (newToken) {
          try {
            const retry = await fetchMe(newToken);
            if (cancelled) return;
            if (retry.ok) {
              const data = await retry.json().catch(() => null);
              applyUser(data?.user);
              return;
            }
          } catch {
            // tombe dans le force-logout ci-dessous
          }
        }
        // Refresh impossible ou retry échoué → session réellement perdue. On
        // purge l'état "connecté fantôme" (menu utilisateur sans accès) et on
        // bascule en "déconnecté".
        await forceLoggedOut();
        return;
      }

      // Autre statut (5xx, maintenance...) : transitoire, on garde la session.
      if (!cancelled) {
        setIsAdmin(false);
        setUserData(null);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
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

  async function logout() {
    // Best-effort : revoque le refresh jti cote serveur (S24.3). On ne bloque
    // pas le logout si le serveur est down ou repond une erreur.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // ignore
      }
    }
    clearAuthTokens();
    // Le cookie est httpOnly : seul le serveur peut l'effacer (S24.1).
    await clearAuthCookie();
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nuffle-bronze text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
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

        {/* Mon compte */}
        <p className="px-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Mon compte
        </p>
        <div className="space-y-1 mb-4">
          <a href="/me/profile" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            👤 {t.auth.profile}
          </a>
          <a href="/me/achievements" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            🏅 {t.auth.achievements || "Mes succès"}
          </a>
        </div>

        {/* Mes parties */}
        <p className="px-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100 pt-3">
          Mes parties
        </p>
        <div className="space-y-1 mb-4">
          <a href="/me/teams" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            ⚽ {t.auth.myTeams}
          </a>
          {onlinePlayEnabled && (
            <a href="/me/matches" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              📊 {t.play?.myOnlineMatches || "Mes matchs en ligne"}
            </a>
          )}
        </div>

        {/* Admin + Déconnexion */}
        <div className="space-y-1 border-t border-gray-200 pt-3">
          {isAdmin && (
            <a href="/admin" className="block px-4 py-2.5 text-sm text-purple-600 font-semibold hover:bg-purple-50 rounded-lg transition-colors">
              🔧 {t.auth.admin}
            </a>
          )}
          <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
            <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-[60] overflow-hidden">
              {/* Entête */}
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <div className="font-semibold text-sm text-gray-900">{userData?.name || t.auth.user}</div>
                <div className="text-xs text-gray-500 font-mono break-all">{userData?.email}</div>
              </div>

              {/* Mon compte */}
              <div className="py-1">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Mon compte
                </p>
                <a href="/me/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>
                  👤 {t.auth.profile}
                </a>
                <a href="/me/achievements" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>
                  🏅 {t.auth.achievements || "Mes succès"}
                </a>
              </div>

              {/* Mes parties */}
              <div className="border-t border-gray-100 py-1">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Mes parties
                </p>
                <a href="/me/teams" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>
                  ⚽ {t.auth.myTeams}
                </a>
                {onlinePlayEnabled && (
                  <a href="/me/matches" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>
                    📊 {t.play?.myOnlineMatches || "Mes matchs en ligne"}
                  </a>
                )}
              </div>

              {/* Admin + Déconnexion */}
              <div className="border-t border-gray-100 py-1">
                {isAdmin && (
                  <a href="/admin" className="block px-4 py-2 text-sm text-purple-600 font-semibold hover:bg-purple-50 transition-colors" onClick={() => setMenuOpen(false)}>
                    🔧 {t.auth.admin}
                  </a>
                )}
                <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
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
        </div>
      )}
    </div>
  );
}
