"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import {
  NOTIFICATIONS_PAGE_SIZE,
  formatRelativeTime,
  notificationIcon,
  safeInternalUrl,
} from "./format";
import { dynamicRoute } from "../../lib/typed-route";

/**
 * Page « Mes notifications ».
 *
 * Liste paginée (50 par page, plus récentes d'abord) de `GET /notifications`.
 * Les notifications non lues au chargement sont mises en avant, puis
 * MARQUÉES LUES dès l'affichage (`markAllRead` du contexte, qui remet aussi
 * la pastille du menu à zéro) : consulter, c'est lire. Le marquage ne
 * concerne que l'utilisateur courant (filtre serveur).
 *
 * L'accès connecté est garanti par le middleware `/me/*`.
 */

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export default function NotificationsPage() {
  const { t, language } = useLanguage();
  const { markAllRead } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ids non lus au moment du chargement : restent « Nouveau » à l'écran
  // même une fois marqués lus côté serveur.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [markedRead, setMarkedRead] = useState(false);
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<ListResponse>(
          `/notifications?limit=${NOTIFICATIONS_PAGE_SIZE}`,
        );
        if (cancelled) return;
        const list = data.notifications ?? [];
        setItems(list);
        setHasMore(list.length >= NOTIFICATIONS_PAGE_SIZE);
        const fresh = new Set(list.filter((n) => !n.readAt).map((n) => n.id));
        setFreshIds(fresh);
        if ((data.unreadCount ?? 0) > 0 || fresh.size > 0) {
          // Consulter = lire. Échec toléré : la pastille se recalera au
          // prochain refresh du contexte.
          try {
            await markAllReadRef.current();
            if (!cancelled) setMarkedRead(true);
          } catch {
            /* silencieux */
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.notifications.error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // `t` est stable pour une langue donnée ; on ne recharge pas au switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    try {
      setLoadingMore(true);
      const data = await apiRequest<ListResponse>(
        `/notifications?limit=${NOTIFICATIONS_PAGE_SIZE}&offset=${items.length}`,
      );
      const more = data.notifications ?? [];
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...more.filter((n) => !seen.has(n.id))];
      });
      setHasMore(more.length >= NOTIFICATIONS_PAGE_SIZE);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.notifications.error);
    } finally {
      setLoadingMore(false);
    }
  }

  const relativeLabels = useMemo(
    () => ({
      justNow: t.notifications.justNow,
      minutesAgo: t.notifications.minutesAgo,
      hoursAgo: t.notifications.hoursAgo,
      daysAgo: t.notifications.daysAgo,
    }),
    [t],
  );
  const locale = language === "en" ? "en-GB" : "fr-FR";

  return (
    <main
      data-testid="notifications-page"
      className="mx-auto w-full max-w-3xl p-4 sm:p-6 space-y-4"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite">
          🔔 {t.notifications.title}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{t.notifications.description}</p>
      </div>

      {loading ? (
        <p data-testid="notifications-loading" className="text-sm text-gray-600">
          {t.notifications.loading}
        </p>
      ) : null}

      {error ? (
        <div
          data-testid="notifications-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div
          data-testid="notifications-empty"
          className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center"
        >
          <p className="text-gray-700 font-medium">{t.notifications.empty}</p>
          <p className="text-sm text-gray-500 mt-1">{t.notifications.emptyHint}</p>
        </div>
      ) : null}

      {markedRead && freshIds.size > 0 ? (
        <p
          data-testid="notifications-marked-read"
          className="text-xs text-gray-500"
        >
          {t.notifications.markedRead}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul data-testid="notifications-list" className="space-y-2">
          {items.map((n) => {
            const fresh = freshIds.has(n.id);
            const href = safeInternalUrl(n.url);
            return (
              <li
                key={n.id}
                data-testid={`notification-item-${n.id}`}
                data-fresh={fresh ? "true" : "false"}
                className={`rounded-lg border p-3 sm:p-4 flex gap-3 ${
                  fresh
                    ? "border-nuffle-gold bg-nuffle-gold/10"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-none pt-0.5">
                  {notificationIcon(n.kind)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-nuffle-anthracite">
                      {n.title}
                    </span>
                    {fresh ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-nuffle-red text-white">
                        {t.notifications.newBadge}
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">
                      {formatRelativeTime(n.createdAt, relativeLabels, new Date(), locale)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 break-words">{n.body}</p>
                  {href ? (
                    <Link
                      href={dynamicRoute(href)}
                      data-testid={`notification-link-${n.id}`}
                      className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-nuffle-bronze hover:text-nuffle-gold hover:underline"
                    >
                      {t.notifications.open} →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasMore ? (
        <div className="text-center">
          <button
            type="button"
            data-testid="notifications-load-more"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="px-4 py-2 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10 disabled:opacity-60"
          >
            {loadingMore ? t.notifications.loadingMore : t.notifications.loadMore}
          </button>
        </div>
      ) : null}
    </main>
  );
}
