"use client";

/**
 * Sprint P — Lot P.C.1 : page reset-password user-facing.
 *
 * Lit le `token` query string + propose un form newPassword/confirm.
 * Submit appelle POST /auth/reset-password. En cas de succes redirige
 * vers /login avec un message info.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiPost } from "../auth-client";

interface ResetResponse {
  readonly success: true;
  readonly email: string;
}

export default function ResetPasswordPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && t.length >= 32 && t.length <= 64) {
      setToken(t);
    } else {
      setError("Lien de reinitialisation invalide ou incomplet.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Token manquant — verifie le lien recu.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      (await apiPost("/auth/reset-password", {
        token,
        newPassword: password,
      })) as ResetResponse;
      router.push(
        "/login?message=" + encodeURIComponent("Mot de passe reinitialise — connecte-toi avec ton nouveau mot de passe."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Nouveau mot de passe</h1>
      <p className="mb-4 text-sm text-slate-300">
        Choisis un nouveau mot de passe pour ton compte.
      </p>

      <form onSubmit={handleSubmit} data-testid="reset-form" className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-200">Nouveau mot de passe</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || !token}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            data-testid="reset-password-input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-200">Confirme le mot de passe</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting || !token}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            data-testid="reset-confirm-input"
          />
        </label>
        {error ? (
          <p
            role="alert"
            data-testid="reset-error"
            className="text-sm text-red-400"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !token}
          data-testid="reset-submit"
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-emerald-50 hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting ? "Reinitialisation…" : "Reinitialiser le mot de passe"}
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        <Link href="/login" className="underline">
          Retour a la connexion
        </Link>
      </p>
    </main>
  );
}
