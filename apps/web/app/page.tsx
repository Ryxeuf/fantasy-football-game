"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./contexts/LanguageContext";
import { apiRequest } from "./lib/api-client";
import MarketingHome from "./components/home/MarketingHome";
import CoachDashboard, { type CoachUser } from "./components/home/CoachDashboard";

/**
 * Accueil (/) — double face.
 *
 * - Visiteur DECONNECTE / bots : home marketing (rendue cote serveur, SEO).
 * - Coach CONNECTE : tableau de bord personnalise (ses equipes, actions
 *   rapides), bascule cote client uniquement.
 *
 * Contrainte hydratation : le premier rendu (serveur + premier rendu
 * client) doit etre IDENTIQUE => on rend toujours le marketing par defaut,
 * puis on bascule apres le mount selon `/auth/me`. Aucune lecture de
 * `localStorage`/auth pendant le rendu serveur (sinon mismatch). On ne
 * declenche meme le fetch que si un `auth_token` est present, pour eviter
 * tout flash de chargement aux visiteurs deconnectes.
 */

type Phase = "marketing" | "loading" | "dashboard";

export default function HomePage() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("marketing");
  const [coach, setCoach] = useState<CoachUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hasToken =
      typeof window !== "undefined" &&
      !!window.localStorage.getItem("auth_token");
    // Pas de token => visiteur deconnecte : on reste sur le marketing sans
    // meme appeler l'API (zero flash, zero requete inutile).
    if (!hasToken) return;

    setPhase("loading");
    apiRequest<{ user: CoachUser | null }>("/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.user) {
          setCoach(res.user);
          setPhase("dashboard");
        } else {
          setPhase("marketing");
        }
      })
      .catch(() => {
        // Token invalide/expire ou API injoignable : retour marketing.
        if (!cancelled) setPhase("marketing");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "dashboard" && coach) {
    return <CoachDashboard user={coach} />;
  }

  if (phase === "loading") {
    return (
      <div
        data-testid="home-loading"
        className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 min-h-[70vh] bg-gradient-to-b from-[#F3EAD6] via-[#EFE4CD] to-[#E7DABF] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4 text-nuffle-bronze/80">
          <span
            className="h-10 w-10 rounded-full border-2 border-nuffle-gold/30 border-t-nuffle-gold animate-spin"
            aria-hidden="true"
          />
          <p className="font-subtitle text-sm uppercase tracking-[0.2em]">
            {t.home.dashboard.loading}
          </p>
        </div>
      </div>
    );
  }

  return <MarketingHome />;
}
