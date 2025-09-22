"use client";
import { useEffect, useState } from "react";

export default function AuthBar() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("auth_token"));
  }, []);

  function logout() {
    localStorage.removeItem("auth_token");
    setHasToken(false);
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {hasToken ? (
        <button onClick={logout} className="px-3 py-1 bg-neutral-800 text-white rounded">Se déconnecter</button>
      ) : (
        <div className="flex items-center gap-3">
          <a className="underline" href="/login">Connexion</a>
          <a className="underline" href="/register">Inscription</a>
        </div>
      )}
    </div>
  );
}
