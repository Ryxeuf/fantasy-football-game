"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../auth-client";
import {
  adminCreateApiKey,
  adminListApiKeys,
  adminRevokeApiKey,
  apiKeyEnvSnippet,
  apiKeyExpiryLabel,
  apiKeyLastUsedLabel,
  apiKeyScopeLabel,
  apiKeyStatusLabel,
  API_KEY_EXPIRY_OPTIONS,
  DEFAULT_API_KEY_EXPIRY_DAYS,
  expiryOptionValue,
  parseExpiryOption,
  type AdminApiKey,
  type ApiKeyScope,
  type ApiKeyStatus,
  type CreatedApiKey,
} from "../../lib/admin-api-keys";

const STATUS_CLASSES: Record<ApiKeyStatus, string> = {
  active: "bg-green-100 text-green-700",
  revoked: "bg-gray-100 text-gray-600",
  expired: "bg-amber-100 text-amber-800",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clés API d'administration (change OpenSpec `admin-api-keys`) : un client
 * automatisé — un agent Claude Code, un script de recette, une CI —
 * s'authentifie avec une clé stockée dans SES variables d'environnement.
 */
export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [scope, setScope] = useState<ApiKeyScope>("read");
  const [expiry, setExpiry] = useState<string>(
    expiryOptionValue(DEFAULT_API_KEY_EXPIRY_DAYS),
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState<"secret" | "env" | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await adminListApiKeys();
      if (id === requestId.current) setKeys(data);
    } catch (err: unknown) {
      if (id === requestId.current) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await adminCreateApiKey({
        name: name.trim(),
        scope,
        expiresInDays: parseExpiryOption(expiry),
      });
      setCreated(result);
      setCopied(null);
      setName("");
      setScope("read");
      setExpiry(expiryOptionValue(DEFAULT_API_KEY_EXPIRY_DAYS));
      setCreateOpen(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (key: AdminApiKey) => {
    if (
      !window.confirm(
        `Révoquer la clé « ${key.name} » (${key.keyPrefix}…) ? Tout client qui l'utilise sera refusé dès sa prochaine requête.`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await adminRevokeApiKey(key.id);
      setNotice(`Clé « ${key.name} » révoquée.`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de révocation");
    }
  };

  const copy = async (what: "secret" | "env", text: string) => {
    if (await copyText(text)) setCopied(what);
    else setError("Copie impossible : sélectionnez le texte et copiez-le à la main.");
  };

  const envSnippet = created ? apiKeyEnvSnippet(API_BASE, created.secret) : "";

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite flex items-center gap-2">
            <span>🔑</span> Clés API
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pour qu&apos;un client automatisé (agent Claude Code, script de
            recette, CI) appelle l&apos;API en votre nom, sans mot de passe.
          </p>
        </div>
        <button
          type="button"
          data-testid="api-keys-toggle-create"
          onClick={() => setCreateOpen((prev) => !prev)}
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-nuffle-gold text-white hover:bg-nuffle-bronze transition"
        >
          {createOpen ? "Annuler" : "+ Nouvelle clé"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200">
          {notice}
        </div>
      )}

      {created && (
        <section
          data-testid="api-key-created"
          className="mb-6 p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-3"
        >
          <h2 className="font-semibold text-amber-900">
            Clé « {created.key.name} » créée
          </h2>
          <p className="text-sm text-amber-900">
            Copiez-la maintenant : elle ne sera <strong>plus jamais
            affichée</strong>. Si vous la perdez, créez-en une autre et
            révoquez celle-ci.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code
              data-testid="api-key-secret"
              className="flex-1 min-w-0 break-all px-3 py-2 rounded bg-white border border-amber-200 font-mono text-xs"
            >
              {created.secret}
            </code>
            <button
              type="button"
              data-testid="api-key-copy-secret"
              onClick={() => copy("secret", created.secret)}
              className="px-3 py-2 rounded border border-amber-400 text-amber-900 hover:bg-amber-100 text-sm whitespace-nowrap"
            >
              {copied === "secret" ? "✓ Copiée" : "Copier la clé"}
            </button>
          </div>
          <div>
            <p className="text-sm text-amber-900 mb-1">
              Variables à déclarer dans l&apos;environnement du client :
            </p>
            <pre
              data-testid="api-key-env"
              className="px-3 py-2 rounded bg-white border border-amber-200 font-mono text-xs whitespace-pre-wrap break-all"
            >
              {envSnippet}
            </pre>
            <button
              type="button"
              data-testid="api-key-copy-env"
              onClick={() => copy("env", envSnippet)}
              className="mt-2 px-3 py-1.5 rounded border border-amber-400 text-amber-900 hover:bg-amber-100 text-xs"
            >
              {copied === "env" ? "✓ Copiées" : "Copier les variables"}
            </button>
          </div>
          <button
            type="button"
            data-testid="api-key-dismiss"
            onClick={() => setCreated(null)}
            className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 text-sm"
          >
            J&apos;ai copié la clé
          </button>
        </section>
      )}

      {createOpen && (
        <form
          data-testid="api-key-form"
          onSubmit={submitCreate}
          className="mb-6 p-4 rounded-lg bg-white border border-gray-200 space-y-4"
        >
          <div>
            <label htmlFor="api-key-name" className="block text-sm font-medium mb-1">
              Nom *
            </label>
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Claude Code — recette prod"
              required
              maxLength={80}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium mb-1">Portée</legend>
            <label className="flex items-start gap-2 text-sm mb-1">
              <input
                type="radio"
                name="api-key-scope"
                value="read"
                checked={scope === "read"}
                onChange={() => setScope("read")}
              />
              <span>
                <strong>Lecture seule</strong> (recommandé) — GET uniquement :
                smoke tests, diagnostics, lectures admin.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="api-key-scope"
                value="write"
                checked={scope === "write"}
                onChange={() => setScope("write")}
              />
              <span>
                <strong>Lecture et écriture</strong> — tout ce que votre
                compte admin peut faire, sauf gérer les clés, impersonner ou
                modifier votre compte.
              </span>
            </label>
            {scope === "write" && (
              <p
                data-testid="api-key-write-warning"
                className="mt-2 p-2 rounded bg-red-50 text-red-700 border border-red-200 text-xs"
              >
                Une clé en écriture qui fuite donne les pouvoirs d&apos;un admin
                jusqu&apos;à sa révocation. Préférez une expiration courte.
              </p>
            )}
          </fieldset>
          <div>
            <label htmlFor="api-key-expiry" className="block text-sm font-medium mb-1">
              Expiration
            </label>
            <select
              id="api-key-expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded bg-white"
            >
              {API_KEY_EXPIRY_OPTIONS.map((option) => (
                <option key={option.label} value={expiryOptionValue(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-nuffle-gold text-white hover:bg-nuffle-bronze disabled:opacity-50"
          >
            {submitting ? "Création..." : "Créer la clé"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : keys.length === 0 ? (
        <div
          data-testid="api-keys-empty"
          className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200"
        >
          Aucune clé API. Créez-en une pour commencer.
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
          {keys.map((key) => (
            <li
              key={key.id}
              data-testid={`api-key-row-${key.id}`}
              className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 break-words">{key.name}</span>
                  <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">
                    {key.keyPrefix}…
                  </code>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[key.status]}`}
                  >
                    {apiKeyStatusLabel(key.status)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      key.scope === "write"
                        ? "bg-red-50 text-red-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {apiKeyScopeLabel(key.scope)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Propriétaire : {key.owner?.coachName ?? "—"}</span>
                  <span
                    className={
                      key.expiresAt === null && key.status === "active"
                        ? "text-amber-700 font-semibold"
                        : undefined
                    }
                  >
                    {apiKeyExpiryLabel(key)}
                  </span>
                  <span>Dernier usage : {apiKeyLastUsedLabel(key)}</span>
                </div>
              </div>
              {key.status === "active" && (
                <button
                  type="button"
                  data-testid={`api-key-revoke-${key.id}`}
                  onClick={() => revoke(key)}
                  className="self-start sm:self-auto px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-800 text-xs whitespace-nowrap"
                >
                  Révoquer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <section
        data-testid="api-keys-help"
        className="mt-8 p-4 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 space-y-2"
      >
        <h2 className="font-semibold text-gray-900">
          Utiliser une clé avec Claude Code
        </h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Créez une clé en lecture seule et copiez les variables affichées.</li>
          <li>
            Dans les réglages de l&apos;environnement cloud Claude Code (menu
            de l&apos;environnement, puis « Modifier »), ajoutez
            <code className="mx-1 font-mono text-xs">NUFFLE_API_URL</code>et
            <code className="mx-1 font-mono text-xs">NUFFLE_API_KEY</code>.
            Ne collez jamais la clé dans une conversation.
          </li>
          <li>
            Ouvrez une nouvelle session et demandez de lancer
            <code className="mx-1 font-mono text-xs">pnpm smoke:remote</code>.
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          À la main : <code className="font-mono">curl -H &quot;Authorization: Bearer $NUFFLE_API_KEY&quot; $NUFFLE_API_URL/auth/me</code>
        </p>
      </section>
    </div>
  );
}
