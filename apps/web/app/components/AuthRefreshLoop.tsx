"use client";

/**
 * Boucle de rafraichissement silencieux (S24.3).
 *
 * Monte un interval qui rafraichit l'access token (~13 min) tant qu'un refresh
 * token est present en localStorage. Sans cette boucle, l'access token de 15
 * minutes expirerait et chaque appel API existant ferait 401.
 *
 * Le composant ne rend rien : il sert uniquement a piloter l'effet de bord.
 */

import { useEffect } from "react";
import { refreshAccessToken } from "../lib/auth-refresh";
import { getRefreshToken } from "../lib/auth-storage";

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 min, marge de 2 min sur l'expiry 15 min

export default function AuthRefreshLoop(): null {
  useEffect(() => {
    if (!getRefreshToken()) return;

    const id = window.setInterval(() => {
      void refreshAccessToken();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
