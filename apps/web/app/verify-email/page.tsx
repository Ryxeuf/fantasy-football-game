"use client";

/**
 * Sprint O — Lot O.B.2 : page verify-email user-facing.
 *
 * Lit le `token` query string envoye dans l'email, appelle
 * `GET /auth/verify-email?token=...` et affiche un message de succes
 * ou d'erreur typee (token invalide / expire / deja utilise).
 *
 * Pas bloquant pour la connexion : l'utilisateur peut continuer a
 * naviguer meme si la verification echoue.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { API_BASE } from "../auth-client";

interface VerifyResponse {
  readonly success: true;
  readonly email: string;
  readonly verifiedAt: string;
}

interface VerifyErrorBody {
  readonly error?: string;
  readonly code?:
    | "INVALID_TOKEN"
    | "TOKEN_EXPIRED"
    | "TOKEN_USED"
    | "USER_DELETED";
}

type Status =
  | { kind: "loading" }
  | { kind: "missing-token" }
  | { kind: "success"; email: string; verifiedAt: string }
  | { kind: "error"; code: VerifyErrorBody["code"]; message: string };

export default function VerifyEmailPage(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  // Anti double-call (StrictMode dev) — le token est single-use cote
  // serveur, le 2eme call sur le meme token renverrait TOKEN_USED.
  const calledRef = useRef<boolean>(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus({ kind: "missing-token" });
      return;
    }

    const url = `${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`;
    fetch(url, { method: "GET" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as
          | VerifyResponse
          | VerifyErrorBody;
        if (res.ok && "success" in body && body.success) {
          setStatus({
            kind: "success",
            email: body.email,
            verifiedAt: body.verifiedAt,
          });
          return;
        }
        const err = body as VerifyErrorBody;
        setStatus({
          kind: "error",
          code: err.code,
          message: err.error ?? "Erreur de verification.",
        });
      })
      .catch((e: unknown) => {
        setStatus({
          kind: "error",
          code: undefined,
          message: e instanceof Error ? e.message : "Erreur reseau.",
        });
      });
  }, []);

  return (
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12"
      data-testid="verify-email-page"
    >
      <h1 className="text-2xl font-bold">Verification de l&apos;email</h1>

      {status.kind === "loading" && (
        <p data-testid="verify-loading" className="text-slate-500">
          Verification en cours...
        </p>
      )}

      {status.kind === "missing-token" && (
        <p
          data-testid="verify-missing-token"
          role="alert"
          className="rounded border border-amber-700 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Lien de verification incomplet. Verifie que tu as bien copie le
          lien complet depuis ton email.
        </p>
      )}

      {status.kind === "success" && (
        <div
          data-testid="verify-success"
          className="rounded border border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <p className="font-semibold">Email verifie ✓</p>
          <p className="mt-1">
            L&apos;adresse{" "}
            <span className="font-mono">{status.email}</span> est
            confirmee. Tu peux maintenant{" "}
            <Link href="/me/teams" className="underline">
              retourner sur ton espace
            </Link>
            .
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div
          data-testid="verify-error"
          role="alert"
          className="rounded border border-rose-700 bg-rose-50 px-3 py-2 text-sm text-rose-900"
        >
          <p className="font-semibold">Verification impossible</p>
          <p className="mt-1">{status.message}</p>
          {status.code === "TOKEN_EXPIRED" || status.code === "TOKEN_USED" ? (
            <p className="mt-2 text-xs">
              Connecte-toi puis demande un nouveau lien depuis ton profil.
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
