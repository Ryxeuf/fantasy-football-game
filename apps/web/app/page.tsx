"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "./lib/api-client";
import MarketingHome from "./components/home/MarketingHome";
import { coachDisplayName, type CoachUser } from "./components/home/coach";

/**
 * Accueil (/) — home marketing publique.
 *
 * Rendue pour tout le monde (serveur + client, SEO). Quand un coach est
 * connecté, on enrichit la home d'un bandeau personnalisé vers son tableau
 * de bord, qui vit désormais sous une URL propre `/me`
 * (cf. `app/me/page.tsx`). La home reste donc toujours accessible — y compris
 * connecté — ce qui permet de « revenir à l'accueil sans être connecté »
 * depuis le dashboard.
 *
 * Contrainte hydratation : le premier rendu (serveur + premier rendu client)
 * doit être IDENTIQUE => on ne lit ni `localStorage` ni l'état connecté
 * pendant le rendu. Le bandeau n'apparaît qu'après le mount, et seulement si
 * un `auth_token` est présent : zéro flash et zéro requête inutile pour les
 * visiteurs déconnectés.
 */
export default function HomePage() {
  const [coachName, setCoachName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hasToken =
      typeof window !== "undefined" &&
      !!window.localStorage.getItem("auth_token");
    // Pas de token => visiteur déconnecté : aucun appel API, pas de bandeau.
    if (!hasToken) return;

    apiRequest<{ user: CoachUser | null }>("/auth/me")
      .then((res) => {
        if (cancelled || !res.user) return;
        setCoachName(coachDisplayName(res.user));
      })
      .catch(() => {
        // Token invalide/expiré ou API injoignable : on reste sur la home
        // publique sans bandeau.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <MarketingHome coachName={coachName} />;
}
