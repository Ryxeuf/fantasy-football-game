"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../lib/api-client";
import { getAuthToken } from "../lib/auth-storage";

/**
 * Notifications internes — état GLOBAL du compteur de non lus.
 *
 * Monté une fois dans `ClientLayout` : la cloche de l'en-tête, l'entrée du
 * menu utilisateur et la page `/me/notifications` lisent le même compteur,
 * et la page le remet à zéro quand elle marque tout lu. Sans provider, le
 * hook `useNotifications()` retombe sur un no-op (pattern « Provider global
 * avec hook no-op fallback », cf. CLAUDE.md) : les composants restent
 * testables et rendables isolément.
 *
 * Rafraîchissement : au montage, toutes les `pollIntervalMs` (60 s) tant que
 * l'onglet est visible, et au retour de focus. Rien n'est interrogé sans
 * token (visiteur déconnecté) : le compteur vaut 0.
 */

export interface NotificationsContextValue {
  /** Nombre de notifications non lues (0 hors connexion). */
  readonly unreadCount: number;
  /** Vrai dès qu'un premier chargement (ou l'absence de token) a été résolu. */
  readonly loaded: boolean;
  /** Réinterroge `GET /notifications/unread-count`. Silencieux en cas d'échec. */
  readonly refresh: () => Promise<void>;
  /** `POST /notifications/read-all` puis compteur à zéro. Renvoie le nombre passé lu. */
  readonly markAllRead: () => Promise<number>;
  /** Force une valeur locale (ex. après une lecture unitaire). */
  readonly setUnreadCount: (count: number) => void;
}

const NOOP_VALUE: NotificationsContextValue = {
  unreadCount: 0,
  loaded: false,
  refresh: async () => {},
  markAllRead: async () => 0,
  setUnreadCount: () => {},
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(
  undefined,
);

export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

interface NotificationsProviderProps {
  children: ReactNode;
  /** Surchargeable en test. */
  pollIntervalMs?: number;
}

export function NotificationsProvider({
  children,
  pollIntervalMs = NOTIFICATIONS_POLL_INTERVAL_MS,
}: NotificationsProviderProps) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Évite qu'une réponse tardive n'écrase un état plus récent (ex. read-all
  // parti pendant un refresh en vol).
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUnreadCountState(0);
      setLoaded(true);
      return;
    }
    const seq = ++requestSeq.current;
    try {
      const { count } = await apiRequest<{ count: number }>(
        "/notifications/unread-count",
      );
      if (seq === requestSeq.current) {
        setUnreadCountState(Number.isFinite(count) ? Math.max(0, count) : 0);
      }
    } catch {
      // Réseau / session : la pastille garde sa dernière valeur connue.
    } finally {
      setLoaded(true);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const { updated } = await apiRequest<{ updated: number }>(
      "/notifications/read-all",
      { method: "POST" },
    );
    // Invalide les refresh en vol : leur compteur serait périmé.
    requestSeq.current++;
    setUnreadCountState(0);
    return updated;
  }, []);

  const setUnreadCount = useCallback((count: number) => {
    requestSeq.current++;
    setUnreadCountState(Math.max(0, count));
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, pollIntervalMs);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, pollIntervalMs]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unreadCount, loaded, refresh, markAllRead, setUnreadCount }),
    [unreadCount, loaded, refresh, markAllRead, setUnreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

/** Compteur de non lus + actions. No-op gracieux hors provider. */
export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  return ctx ?? NOOP_VALUE;
}
