"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";
import { syncAuthCookie, clearAuthCookie } from "../../lib/auth-cookie";

/**
 * Page de synchronisation du token depuis localStorage vers les cookies pour les
 * routes protégées non-admin (ex : /me/...). Le middleware redirige ici lorsque
 * le cookie d'authentification est absent. Si aucun token valide n'est trouvé,
 * l'utilisateur est renvoyé vers la page de connexion en conservant la cible.
 */
export default function AuthSyncPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p>Chargement...</p>
        </div>
      }
    >
      <AuthSyncContent />
    </Suspense>
  );
}

function AuthSyncContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirect") || "/me";

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      // Aucun token côté client : connexion ou création de compte nécessaire.
      router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
      return;
    }

    // Vérifie que le token est toujours valide côté serveur.
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          // Token invalide/expiré : on le supprime et on redirige vers login.
          localStorage.removeItem("auth_token");
          await clearAuthCookie();
          router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
          return null;
        }
        return r.json();
      })
      .then(async (data) => {
        if (!data) return;

        // Token valide : on synchronise le cookie httpOnly via la route
        // serveur dediee (S24.1).
        await syncAuthCookie(token);

        // Recharge complet pour que le middleware prenne le cookie en compte.
        window.location.href = redirectTo;
      })
      .catch(() => {
        router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
      });
  }, [redirectTo, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
        <p className="text-gray-600">Vérification de votre session...</p>
      </div>
    </div>
  );
}
