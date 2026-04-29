"use client";
import { useState } from "react";
import { API_BASE } from "../../auth-client";

interface PrivateProfileToggleProps {
  initialValue: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function PrivateProfileToggle({
  initialValue,
}: PrivateProfileToggleProps): JSX.Element {
  const [enabled, setEnabled] = useState<boolean>(initialValue);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function persist(next: boolean): Promise<void> {
    setStatus({ kind: "saving" });
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/auth/me/privacy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ privateProfile: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body?.error || `Erreur ${res.status}`);
      }
      setStatus({ kind: "saved" });
    } catch (e) {
      setEnabled(!next);
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const next = e.target.checked;
    setEnabled(next);
    void persist(next);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">Profil prive</h3>
      <p className="text-sm text-gray-600 mb-4">
        Cocher cette case retire votre profil public{" "}
        <code className="bg-gray-100 px-1 rounded">/coach/{"{slug}"}</code>{" "}
        des resultats indexables (sitemap + lookup direct). Aucun autre
        comportement n&apos;est affecte.
      </p>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          data-testid="private-profile-toggle"
          type="checkbox"
          checked={enabled}
          onChange={onChange}
          disabled={status.kind === "saving"}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium">
          Cacher mon profil public
        </span>
      </label>
      {status.kind !== "idle" && (
        <p
          data-testid="private-profile-status"
          className={`mt-3 text-sm ${
            status.kind === "error"
              ? "text-red-600"
              : status.kind === "saved"
                ? "text-green-600"
                : "text-gray-500"
          }`}
        >
          {status.kind === "saving" && "Enregistrement..."}
          {status.kind === "saved" && "Enregistre."}
          {status.kind === "error" && `Erreur : ${status.message}`}
        </p>
      )}
    </div>
  );
}
