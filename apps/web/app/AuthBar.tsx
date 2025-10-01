"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "./auth-client";

export default function AuthBar() {
  const [hasToken, setHasToken] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("auth_token");
    setHasToken(!!t);
    if (t) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => setIsAdmin(data?.user?.role === "admin"))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, []);

  function logout() {
    localStorage.removeItem("auth_token");
    setHasToken(false);
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {isAdmin && (
        <a className="underline" href="/admin">
          Admin
        </a>
      )}
      {hasToken ? (
        <>
          <a className="underline" href="/me">
            Mes parties
          </a>
          <a className="underline" href="/me/teams">
            Mes équipes
          </a>
          <button
            onClick={logout}
            className="px-3 py-1 bg-neutral-800 text-white rounded"
          >
            Se déconnecter
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <a className="underline" href="/login">
            Connexion
          </a>
          <a className="underline" href="/register">
            Inscription
          </a>
        </div>
      )}
    </div>
  );
}
