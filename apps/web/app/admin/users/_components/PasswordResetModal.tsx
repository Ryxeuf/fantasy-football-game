"use client";

import { useEffect, useState } from "react";

/**
 * Lot P.C.2 — Modal admin pour reset le password d'un utilisateur.
 *
 * 2 etats :
 *   1) `confirm`  : warning + bouton "Generer un nouveau mot de passe".
 *   2) `revealed` : affiche le password temporaire avec un bouton "Copier".
 *                   Le password n'est jamais persiste cote UI ; il est
 *                   destine a etre transmis a l'utilisateur en out-of-band.
 *
 * Reinit a chaque ouverture pour eviter qu'un password traine en memoire.
 */

interface PasswordResetModalProps {
  open: boolean;
  userId: string | null;
  userLabel: string;
  /** Password retourne par le serveur, null tant qu'aucun reset effectue. */
  tempPassword: string | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function PasswordResetModal({
  open,
  userId,
  userLabel,
  tempPassword,
  loading,
  onClose,
  onConfirm,
}: PasswordResetModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open, userId, tempPassword]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback : selection manuelle. Pas de catastrophe.
      const textarea = document.createElement("textarea");
      textarea.value = tempPassword;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  return (
    <div
      data-testid="password-reset-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <div>
            <h2
              id="password-reset-modal-title"
              className="text-lg font-heading font-bold text-nuffle-anthracite"
            >
              Reset administrateur du mot de passe
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {userLabel}{" "}
              <span className="font-mono">({userId?.slice(0, 8)}…)</span>
            </p>
          </div>

          {tempPassword === null ? (
            <>
              <div className="text-sm text-gray-700 space-y-2">
                <p>
                  Cette action genere un mot de passe temporaire pour
                  l'utilisateur :
                </p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  <li>Les sessions actives seront revoquees.</li>
                  <li>L'utilisateur devra changer son mot de passe a la prochaine connexion.</li>
                  <li>
                    Communiquez le mot de passe par un canal sur (chat support,
                    e-mail). Il ne sera <strong>plus accessible</strong> apres
                    fermeture de cette fenetre.
                  </li>
                </ul>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  data-testid="password-reset-confirm"
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50"
                >
                  {loading ? "Generation…" : "Generer un nouveau mot de passe"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                Notez ce mot de passe maintenant. Il ne sera plus affiche apres
                fermeture.
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Mot de passe temporaire
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <code
                    data-testid="temp-password-display"
                    className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg font-mono text-sm break-all"
                  >
                    {tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    data-testid="copy-password"
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    {copied ? "Copie ✓" : "Copier"}
                  </button>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="password-reset-close"
                  className="px-4 py-2 text-sm font-medium text-white bg-nuffle-anthracite hover:opacity-90 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
