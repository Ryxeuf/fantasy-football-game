"use client";
import { useState } from "react";
import { apiPost } from "../auth-client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await apiPost("/auth/register", {
        email,
        password,
        name,
      });
      localStorage.setItem("auth_token", token);
      window.location.href = "/me";
    } catch (err: any) {
      setError(err.message || "Erreur");
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Inscription</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border p-2"
          placeholder="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-green-600 text-white py-2">
          Créer le compte
        </button>
      </form>
      <p className="text-sm mt-3">
        Déjà un compte ?{" "}
        <a className="underline" href="/login">
          Connectez-vous
        </a>
      </p>
    </div>
  );
}
