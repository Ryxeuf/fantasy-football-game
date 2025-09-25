"use client";
import { useState } from "react";
import { apiPost, API_BASE } from "../auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await apiPost("/auth/login", { email, password });
      localStorage.setItem("auth_token", token);
      window.location.href = "/me";
    } catch (err: any) {
      setError(err.message || "Erreur");
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connexion</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-2" placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-blue-600 text-white py-2">Se connecter</button>
      </form>
      <p className="text-sm mt-3">Pas de compte ? <a className="underline" href="/register">Inscrivez-vous</a></p>
    </div>
  );
}


