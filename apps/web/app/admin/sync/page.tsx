"use client";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

/**
 * Page de synchronisation du token depuis localStorage vers les cookies
 * Cette page est appelée par le middleware si le cookie n'existe pas
 * Elle synchronise le cookie puis redirige vers la page admin demandée
 */
export default function AdminSyncPage() {
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
      .then((data) => {
        if (!data) return;
        
        if (data?.user?.role !== "admin") {
          // Pas admin, redirige vers la page d'accueil
          router.push("/");
          return;
        }

        // Crée le cookie avec tous les attributs nécessaires
        document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax; Secure=${window.location.protocol === 'https:'}`;
        
        // Attendre un peu pour que le cookie soit bien enregistré avant de rediriger
        // Utilise window.location.href pour forcer un rechargement complet et que le cookie soit pris en compte
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 100);
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

