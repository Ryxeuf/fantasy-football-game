"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";
import CoachDashboard from "../components/home/CoachDashboard";
import type { CoachUser } from "../components/home/coach";

/**
 * Tableau de bord personnalisé du coach — URL propre `/me`.
 *
 * L'accès connecté est garanti par le middleware : toute route `/me/*`
 * exige un `auth_token` valide, sinon redirection vers `/auth/sync` (pas de
 * cookie) ou `/login` (cookie invalide). On recharge néanmoins `/auth/me`
 * pour récupérer le profil ; si le token vient d'expirer côté API, on
 * renvoie vers la connexion.
 */
export default function MePage() {
  const { t } = useLanguage();
  const [coach, setCoach] = useState<CoachUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ user: CoachUser | null }>("/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.user) {
          setCoach(res.user);
          setLoading(false);
        } else {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        if (!cancelled) window.location.href = "/login";
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !coach) {
    return (
      <div
        data-testid="me-loading"
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

  return <CoachDashboard user={coach} />;
}
