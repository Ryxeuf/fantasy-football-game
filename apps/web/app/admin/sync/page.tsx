"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";
import { syncAuthCookie } from "../../lib/auth-cookie";

/**
 * Page de synchronisation du token depuis localStorage vers les cookies
 * Cette page est appelée par le middleware si le cookie n'existe pas
 * Elle synchronise le cookie puis redirige vers la page admin demandée
 */
export default function AdminSyncPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Chargement...</p></div>}>
      <AdminSyncContent />
    </Suspense>
  );
}

function AdminSyncContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirect") || "/admin";

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    
    if (!token) {
      // Pas de token, redirige vers la page de connexion
      router.push("/login");
      return;
    }

    // Vérifie si l'utilisateur est admin
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          router.push("/login");
          return null;
        }
        return r.json();
      })
      .then(async (data) => {
        if (!data) return;

        const user = data?.user;
        const roles: string[] | undefined = Array.isArray(user?.roles)
          ? user.roles
          : user?.role
            ? [user.role]
            : undefined;

        if (!roles || !roles.includes("admin")) {
          // Pas admin, redirige vers la page d'accueil
          router.push("/");
          return;
        }

        // Synchronise le cookie httpOnly via la route serveur (S24.1).
        await syncAuthCookie(token);

        // Recharge complet pour que le middleware lise le nouveau cookie.
        window.location.href = redirectTo;
      })
      .catch(() => {
        router.push("/login");
      });
  }, [redirectTo, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
        <p className="text-gray-600">Synchronisation en cours...</p>
      </div>
    </div>
  );
}

