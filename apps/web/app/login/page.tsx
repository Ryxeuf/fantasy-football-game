"use client";
import { useState, useEffect } from "react";
import { apiPost, API_BASE } from "../auth-client";
import { useLanguage } from "../contexts/LanguageContext";

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer le message depuis l'URL si présent
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    if (message) {
      setInfoMessage(decodeURIComponent(message));
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await apiPost("/auth/login", { email, password });
      localStorage.setItem("auth_token", token);
      // Stocke aussi dans les cookies pour le middleware Next.js
      document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      window.location.href = "/me";
    } catch (err: any) {
      setError(err.message || t.login.error);
    }
  }

  return (
    <div className="w-full p-6 flex justify-center">
      <div className="max-w-sm w-full">
      <h1 className="text-2xl font-bold mb-4">{t.login.title}</h1>
      {infoMessage && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          {infoMessage}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border p-2 rounded"
          placeholder={t.login.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder={t.login.password}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
          {t.login.submit}
        </button>
      </form>
      <p className="text-sm mt-3">
        {t.login.noAccount}{" "}
        <a className="underline" href="/register">
          {t.login.register}
        </a>
      </p>
      </div>
    </div>
  );
}
