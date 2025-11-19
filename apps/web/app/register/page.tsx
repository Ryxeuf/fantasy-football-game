"use client";
import { useState } from "react";
import { apiPost } from "../auth-client";
import { useLanguage } from "../contexts/LanguageContext";

export default function RegisterPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coachName, setCoachName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const response = await apiPost("/auth/register", {
        email,
        password,
        coachName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });
      // Le compte est créé mais non validé, rediriger vers la page de login avec un message
      const message = response.message || "Votre compte a été créé avec succès. Un administrateur doit valider votre compte avant que vous puissiez vous connecter.";
      window.location.href = `/login?message=${encodeURIComponent(message)}`;
    } catch (err: any) {
      setError(err.message || t.register.error);
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
      <div className="max-w-md w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">{t.register.title}</h1>
      <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.email} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.coachName} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="text"
            placeholder={t.register.coachNamePlaceholder}
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.firstName}
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="text"
            placeholder={t.register.firstNamePlaceholder}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.lastName}
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="text"
            placeholder={t.register.lastNamePlaceholder}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.dateOfBirth}
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            {t.register.password} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-gray-300 p-2.5 sm:p-3 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
            type="password"
            placeholder={t.register.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-red-600 text-xs sm:text-sm">{error}</p>}
        <button 
          className="w-full bg-green-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm sm:text-base disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!email || !password || !coachName}
        >
          {t.register.submit}
        </button>
      </form>
      <p className="text-xs sm:text-sm mt-4 text-center">
        {t.register.hasAccount}{" "}
        <a className="underline text-blue-600 hover:text-blue-700" href="/login">
          {t.register.login}
        </a>
      </p>
      </div>
    </div>
  );
}
