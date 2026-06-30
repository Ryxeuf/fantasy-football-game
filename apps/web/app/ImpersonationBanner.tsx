"use client";

/**
 * Bannière d'impersonation admin (« se connecter en tant que »).
 *
 * Affichée en haut de toutes les pages quand une session d'impersonation est
 * active. L'état provient uniquement du localStorage (présence des tokens
 * admin sauvegardés), donc la bannière reste fiable même si le token
 * d'impersonation a expiré — l'admin peut toujours revenir à son compte.
 *
 * « Revenir à mon compte » restaure les tokens admin puis recharge la page
 * vers la gestion des utilisateurs.
 */

import { useEffect, useState } from "react";
import {
  isImpersonating,
  getImpersonationTargetLabel,
  stopImpersonation,
} from "./lib/auth-storage";

export default function ImpersonationBanner() {
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setActive(isImpersonating());
    setLabel(getImpersonationTargetLabel());
  }, []);

  if (!active) return null;

  const handleReturn = () => {
    stopImpersonation();
    // Rechargement complet pour repartir d'un état propre (AuthBar, caches…)
    // sur la session admin restaurée.
    window.location.href = "/admin/users";
  };

  return (
    <div
      role="alert"
      data-testid="impersonation-banner"
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow"
    >
      <span>
        ⚠️ Mode admin : vous êtes connecté en tant que{" "}
        <strong>{label ?? "un utilisateur"}</strong>.
      </span>
      <button
        type="button"
        onClick={handleReturn}
        data-testid="impersonation-return"
        className="rounded bg-amber-950 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-50 transition hover:bg-amber-900"
      >
        Revenir à mon compte
      </button>
    </div>
  );
}
