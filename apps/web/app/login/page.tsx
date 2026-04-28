"use client";
import { useState, useEffect } from "react";
import { apiPost, API_BASE } from "../auth-client";
import { useLanguage } from "../contexts/LanguageContext";
import { syncAuthCookie } from "../lib/auth-cookie";
import { setAuthTokens } from "../lib/auth-storage";

// Autorise uniquement les redirections internes (chemins relatifs commençant par "/"
// et ne pouvant être interprétés comme des URLs externes).
function sanitizeRedirect(raw: string | null, fallback: string = "/me"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string>("/me");
  const [registerHref, setRegisterHref] = useState<string>("/register");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    const redirectParam = sanitizeRedirect(params.get("redirect"));

    setRedirectTo(redirectParam);
    setRegisterHref(
      redirectParam === "/me"
        ? "/register"
        : `/register?redirect=${encodeURIComponent(redirectParam)}`,
    );

    if (message) {
      setInfoMessage(decodeURIComponent(message));
      // Nettoie le paramètre "message" mais conserve "redirect" pour le submit.
      params.delete("message");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token, refreshToken } = await apiPost("/auth/login", {
        email,
        password,
      });
      setAuthTokens({ token, refreshToken });
      // Cookie httpOnly synchronise via la route serveur (S24.1).
      await syncAuthCookie(token);
      window.location.href = redirectTo;
    } catch (err: any) {
      setError(err.message || t.login.error);
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
      <div className="max-w-sm w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">{t.login.title}</h1>
      {infoMessage && (
        <div
          data-testid="login-info-message"
          className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs sm:text-sm"
        >
          {infoMessage}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
        <div>
          <input
            data-testid="login-email"
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
            data-testid="login-password"
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t.login.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p data-testid="login-error" className="text-red-600 text-xs sm:text-sm">
            {error}
          </p>
        )}
        <button
          data-testid="login-submit"
          className="w-full bg-blue-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
        >
          {t.login.submit}
        </button>
      </form>
      <p className="text-xs sm:text-sm mt-4 text-center text-gray-500">
        {t.login.noAccount}{" "}
        <a className="text-blue-600 hover:underline" href={registerHref}>
          {t.login.register}
        </a>
      </p>
      </div>
    </div>
  );
}
