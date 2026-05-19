/**
 * Nuffle Arena — Service Worker for Push Notifications
 *
 * Handles:
 * - Push event: display native notification
 * - Notification click: focus/open the relevant page
 */

/* eslint-disable no-restricted-globals */

const FALLBACK_ICON = "/images/favicon-optimized.png";
const FALLBACK_BADGE = "/images/favicon-optimized.png";

/**
 * Push event — triggered by server-sent web-push.
 * Payload expected: { title, body, icon?, badge?, url?, tag? }
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Nuffle Arena", body: event.data.text() };
  }

  const { title, body, icon, badge, url, tag } = payload;

  const options = {
    body: body || "",
    icon: icon || FALLBACK_ICON,
    badge: badge || FALLBACK_BADGE,
    tag: tag || "nuffle-arena",
    data: { url: url || "/" },
    vibrate: [100, 50, 100],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title || "Nuffle Arena", options));
});

/**
 * Notification click — open or focus the target URL.
 *
 * Audit round 11 (HIGH) : avant, on passait `data?.url` brut a
 * `openWindow`. Si la cle VAPID etait volee ou si le serveur push
 * etait compromis, un attaquant pouvait envoyer
 * `{data: {url: "https://evil.com/phishing"}}` et chaque user qui
 * clique sur la notif partait sur le domaine attaquant. Maintenant
 * on restreint a des chemins internes commencant par `/`.
 */
function isSafeInternalUrl(url) {
  return typeof url === "string"
    && url.startsWith("/")
    && !url.startsWith("//")
    && !url.startsWith("/\\");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url;
  const targetUrl = isSafeInternalUrl(rawUrl) ? rawUrl : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open on the target, focus it
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

/**
 * Activate event — claim clients immediately so the SW takes effect
 * without requiring a page reload.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
