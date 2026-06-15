"use client";

/**
 * Boucle de rafraichissement silencieux (S24.3).
 *
 * Monte un interval qui rafraichit l'access token (~13 min) tant qu'un refresh
 * token est present en localStorage. Sans cette boucle, l'access token de 15
 * minutes expirerait et chaque appel API existant ferait 401.
 *
 * IMPORTANT — refresh au montage : l'interval seul ne suffit pas. Si l'access
 * token est DÉJÀ expiré au chargement (retour sur le site après >15 min, ou
 * après un build/redeploy), rien ne le rafraichit avant le premier tick (13
 * min) → toutes les requêtes 401 "Token invalide" entre-temps, et l'UI affiche
 * un état "connecté fantôme". On déclenche donc un refresh immédiat quand le
 * token est périmé, en plus de l'interval.
 *
 * Le composant ne rend rien : il sert uniquement a piloter l'effet de bord.
 */

import { useEffect } from "react";
import { refreshAccessToken } from "../lib/auth-refresh";
import { getRefreshToken, isAccessTokenExpired } from "../lib/auth-storage";

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 min, marge de 2 min sur l'expiry 15 min

export default function AuthRefreshLoop(): null {
  useEffect(() => {
    if (!getRefreshToken()) return;

    // Refresh proactif au montage si l'access token est absent/expiré. Le
    // single-flight de refreshAccessToken évite toute double rotation si
    // AuthBar / apiRequest déclenchent un refresh au même instant.
    if (isAccessTokenExpired()) {
      void refreshAccessToken();
    }

    const id = window.setInterval(() => {
      void refreshAccessToken();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
