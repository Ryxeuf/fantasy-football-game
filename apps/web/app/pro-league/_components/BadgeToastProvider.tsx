"use client";

/**
 * Sprint O — Lot O.C.3 : provider + toast pour badges Pro League débloqués.
 *
 * Backend : `POST /pro-league/me/badges/evaluate` retourne
 * `{ newlyEarned: string[] }` (codes badges). Le provider expose une
 * fonction `notifyAndEvaluate()` que les composants appellent apres une
 * action qui peut debloquer un badge (claim daily, place bet, follow
 * team) → call API → affiche un toast par badge debloque.
 *
 * Avant Lot O.C.3, le debloquage etait silencieux (zero feedback).
 * Audit 2026-05-10 : satisfaction nulle au unlock, drama opportunity
 * perdue (variable ratio reward).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { apiRequest } from "../../lib/api-client";

interface ToastEntry {
  id: number;
  code: string;
  emoji: string;
  name: string;
  expiresAt: number;
}

interface EvaluateResponse {
  newlyEarned: string[];
}

interface BadgeCatalogueEntry {
  code: string;
  name: string;
  emoji: string;
}

interface BadgeCatalogueResponse {
  badges: BadgeCatalogueEntry[];
}

interface BadgeToastContextValue {
  /**
   * Trigger backend `POST /me/badges/evaluate` puis affiche un toast
   * pour chaque code retourne. No-op si user non-auth (catch silencieux).
   */
  notifyAndEvaluate: () => Promise<void>;
}

const TOAST_TTL_MS = 6000;

const BadgeToastContext = createContext<BadgeToastContextValue | null>(null);

/**
 * Fallback minimal si le catalogue n'est pas joignable. Le label restera
 * le code raw, mais on garde la sequence visuelle (emoji + name).
 */
const FALLBACK_EMOJI = "🏆";

export function BadgeToastProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [catalogue, setCatalogue] = useState<
    Record<string, BadgeCatalogueEntry>
  >({});
  const [nextId, setNextId] = useState(1);

  // Charge le catalogue une fois (pas critique, fallback raw code OK).
  useEffect(() => {
    let cancelled = false;
    apiRequest<BadgeCatalogueResponse>("/pro-league/badges")
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, BadgeCatalogueEntry> = {};
        for (const b of res.badges) map[b.code] = b;
        setCatalogue(map);
      })
      .catch(() => {
        // Catalogue indispo → fallback raw codes.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-dismiss toasts apres TTL.
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setToasts((cur) => cur.filter((t) => t.expiresAt > now));
    }, 500);
    return () => clearInterval(id);
  }, [toasts.length]);

  const notifyAndEvaluate = useCallback(async (): Promise<void> => {
    try {
      const res = await apiRequest<EvaluateResponse>(
        "/pro-league/me/badges/evaluate",
        { method: "POST" },
      );
      if (res.newlyEarned.length === 0) return;
      const now = Date.now();
      const newToasts: ToastEntry[] = res.newlyEarned.map((code) => {
        const def = catalogue[code];
        return {
          id: 0,
          code,
          emoji: def?.emoji ?? FALLBACK_EMOJI,
          name: def?.name ?? code,
          expiresAt: now + TOAST_TTL_MS,
        };
      });
      setToasts((cur) => {
        let id = nextId;
        const stamped = newToasts.map((t) => ({ ...t, id: id++ }));
        setNextId(id);
        return [...cur, ...stamped];
      });
    } catch {
      // Erreur silencieuse — un user non-auth ou un 500 ne doit pas
      // casser l'action principale qui a appele notifyAndEvaluate.
    }
  }, [catalogue, nextId]);

  const dismiss = (id: number): void => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  };

  return (
    <BadgeToastContext.Provider value={{ notifyAndEvaluate }}>
      {children}
      <div
        data-testid="badge-toast-container"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={`badge-toast-${toast.code}`}
            className="pointer-events-auto flex min-w-[280px] max-w-sm items-center gap-3 rounded-lg border border-amber-500 bg-amber-950/95 px-4 py-3 shadow-xl"
          >
            <span className="text-3xl" aria-hidden="true">
              {toast.emoji}
            </span>
            <div className="flex-1">
              <div className="text-xs uppercase text-amber-400">
                Badge débloqué !
              </div>
              <div className="font-semibold text-amber-100">{toast.name}</div>
            </div>
            <button
              data-testid={`badge-toast-dismiss-${toast.code}`}
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer"
              className="rounded p-1 text-amber-400 hover:bg-amber-900 hover:text-amber-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </BadgeToastContext.Provider>
  );
}

/**
 * Hook pour declencher l'evaluation + toasts. No-op gracieux si pas
 * dans un BadgeToastProvider.
 */
export function useBadgeNotify(): BadgeToastContextValue {
  const ctx = useContext(BadgeToastContext);
  if (!ctx) {
    return {
      notifyAndEvaluate: async () => {
        // Pas de provider monte (ex: tests) → no-op silencieux.
      },
    };
  }
  return ctx;
}
