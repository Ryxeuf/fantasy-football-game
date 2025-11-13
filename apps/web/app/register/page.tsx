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
    <div className="w-full p-6 flex justify-center">
      <div className="max-w-md w-full">
      <h1 className="text-2xl font-bold mb-4">{t.register.title}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.email} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border p-2 rounded"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.coachName} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border p-2 rounded"
            type="text"
            placeholder={t.register.coachNamePlaceholder}
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.firstName}
          </label>
          <input
            className="w-full border p-2 rounded"
            type="text"
            placeholder={t.register.firstNamePlaceholder}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.lastName}
          </label>
          <input
            className="w-full border p-2 rounded"
            type="text"
            placeholder={t.register.lastNamePlaceholder}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.dateOfBirth}
          </label>
          <input
            className="w-full border p-2 rounded"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.register.password} <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border p-2 rounded"
            type="password"
            placeholder={t.register.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button 
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors"
          disabled={!email || !password || !coachName}
        >
          {t.register.submit}
        </button>
      </form>
      <p className="text-sm mt-3">
        {t.register.hasAccount}{" "}
        <a className="underline" href="/login">
          {t.register.login}
        </a>
      </p>
      </div>
    </div>
  );
}
