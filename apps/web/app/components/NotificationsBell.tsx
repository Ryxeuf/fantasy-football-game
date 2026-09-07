"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { getAuthToken } from "../lib/auth-storage";

interface NotificationsBellProps {
  /** `mobile` : rendu à côté du bouton menu (masqué à partir de `lg`). */
  variant?: "desktop" | "mobile";
}

/** Pastille : au-delà de 99, on n'affiche plus le nombre exact. */
export function formatUnreadBadge(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/**
 * Cloche du menu : lien vers `/me/notifications` avec le nombre de
 * notifications non lues. Rendue uniquement pour un coach connecté (la
 * présence du token est lue APRÈS le montage pour ne pas diverger du HTML
 * serveur, qui ne connaît pas le localStorage).
 */
export default function NotificationsBell({
  variant = "desktop",
}: NotificationsBellProps) {
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!getAuthToken());
  }, []);

  if (!hasToken) return null;

  const label =
    unreadCount > 0
      ? `${t.notifications.navLabel} — ${t.notifications.unreadAria.replace(
          "{count}",
          String(unreadCount),
        )}`
      : t.notifications.navLabel;
  const testId =
    variant === "mobile" ? "notifications-bell-mobile" : "notifications-bell";

  return (
    <a
      href="/me/notifications"
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`relative inline-flex items-center justify-center rounded-lg p-2 text-nuffle-bronze hover:bg-gray-100 hover:text-nuffle-gold transition-colors ${
        variant === "mobile" ? "lg:hidden" : ""
      }`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        🔔
      </span>
      {unreadCount > 0 ? (
        <span
          data-testid="notifications-unread-badge"
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-nuffle-red text-white text-[10px] font-bold leading-[18px] text-center shadow"
        >
          {formatUnreadBadge(unreadCount)}
        </span>
      ) : null}
    </a>
  );
}
