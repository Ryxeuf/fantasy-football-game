"use client";
import { useEffect, useState } from "react";
import { apiPost } from "../auth-client";
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

export default function RegisterPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [coachName, setCoachName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string>("/me");
  const [loginHref, setLoginHref] = useState<string>("/login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = sanitizeRedirect(params.get("redirect"));
    setRedirectTo(redirectParam);
    setLoginHref(
      redirectParam === "/me"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(redirectParam)}`,
    );
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email,
        password,
        coachName,
      };
      if (firstName) payload.firstName = firstName;
      if (lastName) payload.lastName = lastName;
      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

      const response = await apiPost("/auth/register", payload);

      if (response?.token) {
        setAuthTokens({
          token: response.token,
          refreshToken: response.refreshToken,
        });
        // Cookie httpOnly synchronise via la route serveur (S24.1).
        await syncAuthCookie(response.token);
        window.location.href = redirectTo;
        return;
      }

      // Pas de token = compte créé mais en attente de validation admin
      setPending(response?.message || t.register.pendingValidationMessage);
    } catch (err: any) {
      setError(err?.message || t.register.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return (
      <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center">
          <h1
            data-testid="register-pending-title"
            className="text-xl sm:text-2xl font-bold mb-4"
          >
            {t.register.pendingValidationTitle}
          </h1>
          <p
            data-testid="register-pending-message"
            className="text-gray-600 text-sm sm:text-base mb-6"
          >
            {pending}
          </p>
          <a
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
            href="/"
          >
            {t.register.backToHome}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
      <div className="max-w-sm w-full">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">
          {t.register.title}
        </h1>
        <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <input
              data-testid="register-email"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t.register.email}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <input
              data-testid="register-coachname"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t.register.coachNamePlaceholder}
              type="text"
              required
              maxLength={50}
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              autoComplete="nickname"
            />
          </div>
          <div>
            <input
              data-testid="register-firstname"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t.register.firstNamePlaceholder}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <input
              data-testid="register-lastname"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t.register.lastNamePlaceholder}
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {t.register.dateOfBirth}
            </label>
            <input
              data-testid="register-dob"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              autoComplete="bday"
            />
          </div>
          <div>
            <input
              data-testid="register-password"
              className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t.register.passwordPlaceholder}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p
              data-testid="register-error"
              className="text-red-600 text-xs sm:text-sm"
            >
              {error}
            </p>
          )}
          <button
            data-testid="register-submit"
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base disabled:opacity-60"
          >
            {t.register.submit}
          </button>
        </form>
        <p className="text-xs sm:text-sm mt-4 text-center text-gray-500">
          {t.register.hasAccount}{" "}
          <a className="text-blue-600 hover:underline" href={loginHref}>
            {t.register.login}
          </a>
        </p>
      </div>
    </div>
  );
}
