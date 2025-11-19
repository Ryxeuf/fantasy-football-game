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
    <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
      <div className="max-w-sm w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">{t.login.title}</h1>
      {infoMessage && (
        <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs sm:text-sm">
          {infoMessage}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
        <div>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t.login.email}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t.login.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-red-600 text-xs sm:text-sm">{error}</p>}
        <button className="w-full bg-blue-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base">
          {t.login.submit}
        </button>
      </form>
      <p className="text-xs sm:text-sm mt-4 text-center">
        {t.login.noAccount}{" "}
        <a className="underline text-blue-600 hover:text-blue-700" href="/register">
          {t.login.register}
        </a>
      </p>
      </div>
    </div>
  );
}
