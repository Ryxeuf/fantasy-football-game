"use client";

/**
 * Sprint P — Lot P.C.1 : page forgot-password user-facing.
 *
 * Form a un seul champ email. Submit appelle POST /auth/forgot-password
 * et affiche un message de confirmation generique (anti-enumeration —
 * on ne signale jamais si l'email existe ou pas).
 *
 * En dev (NODE_ENV !== "production"), la response peut inclure un
 * `devLink` que l'on affiche pour faciliter le test sans SMTP. En
 * prod, ce champ est toujours null cote serveur.
 */

import Link from "next/link";
import { useState } from "react";

import { apiPost } from "../auth-client";

interface ForgotResponse {
  readonly requested: true;
  readonly devLink: string | null;
}

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = (await apiPost("/auth/forgot-password", { email })) as ForgotResponse;
      setSubmitted(true);
      setDevLink(res.devLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Mot de passe oublie ?</h1>
      <p className="mb-4 text-sm text-slate-300">
        Indique ton email. Si un compte existe, tu recevras un lien de
        reinitialisation valable 24h.
      </p>

      {submitted ? (
        <section
          data-testid="forgot-confirmation"
          className="rounded border border-emerald-700 bg-emerald-900/30 p-4 text-sm text-emerald-100"
        >
          <p>
            Si un compte existe pour cet email, un lien de reinitialisation
            a ete envoye. Verifie ta boite mail (ainsi que tes spams).
          </p>
          {devLink ? (
            <p className="mt-3 break-all">
              <span className="font-semibold">Dev link :</span>{" "}
              <Link
                href={devLink.replace(/^https?:\/\/[^/]+/, "")}
                data-testid="forgot-dev-link"
                className="underline"
              >
                {devLink}
              </Link>
            </p>
          ) : null}
          <p className="mt-3">
            <Link href="/login" className="underline">
              Retour a la connexion
            </Link>
          </p>
        </section>
      ) : (
        <form onSubmit={handleSubmit} data-testid="forgot-form" className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-200">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              data-testid="forgot-email-input"
            />
          </label>
          {error ? (
            <p
              role="alert"
              data-testid="forgot-error"
              className="text-sm text-red-400"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            data-testid="forgot-submit"
            className="rounded bg-emerald-700 px-4 py-2 text-sm text-emerald-50 hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "Envoi en cours…" : "Envoyer le lien"}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-slate-500">
        <Link href="/login" className="underline">
          Retour a la connexion
        </Link>
      </p>
    </main>
  );
}
