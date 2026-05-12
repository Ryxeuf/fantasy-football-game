"use client";

/**
 * Sprint Q lot Q.D.1 — Page "mes ligues de pronostics".
 *
 * Affiche les ligues dont l'utilisateur est membre + 2 actions :
 *  - Creer une nouvelle ligue (modal)
 *  - Rejoindre via un code (modal)
 *
 * Chaque ligue est cliquable → page detail.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../lib/api-client";

interface LeagueSummary {
  readonly id: string;
  readonly name: string;
  readonly joinCode: string;
  readonly isPrivate: boolean;
  readonly isOwner: boolean;
  readonly memberCount: number;
  readonly joinedAt: string;
  readonly createdAt: string;
}

interface MyLeaguesResponse {
  readonly leagues: readonly LeagueSummary[];
}

export default function MyPredictionLeaguesPage() {
  const [leagues, setLeagues] = useState<readonly LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<MyLeaguesResponse>(
        "/pro-league/prediction-leagues/me",
      );
      setLeagues(data.leagues);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Erreur";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
            🎯 Mes ligues de pronostics
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Cree une ligue avec tes amis et battez-vous au tableau des pronos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModal("join")}
            className="px-3 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
            data-testid="btn-open-join"
          >
            Rejoindre via code
          </button>
          <button
            type="button"
            onClick={() => setModal("create")}
            className="px-4 py-2 rounded bg-nuffle-gold text-white text-sm font-semibold hover:bg-yellow-600"
            data-testid="btn-open-create"
          >
            + Creer une ligue
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          data-testid="page-error"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500" data-testid="leagues-loading">
          Chargement…
        </div>
      )}

      {!loading && leagues.length === 0 && !error && (
        <div
          className="p-6 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800"
          data-testid="leagues-empty"
        >
          Vous n&apos;etes encore dans aucune ligue. Creez la votre ou
          rejoignez-en une via un code.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {leagues.map((l) => (
          <Link
            key={l.id}
            href={`/pro-league/leagues/${l.id}` as any}
            data-testid={`league-card-${l.id}`}
            className="p-4 rounded-xl border bg-white border-gray-200 hover:border-nuffle-gold hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-nuffle-anthracite truncate">
                  {l.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {l.memberCount} membre{l.memberCount > 1 ? "s" : ""}
                  {l.isOwner ? " · vous etes admin" : ""}
                </div>
              </div>
              {l.isOwner && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  OWNER
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                {l.joinCode}
              </code>
              <span className="text-[10px] text-gray-500">code de jonction</span>
            </div>
          </Link>
        ))}
      </div>

      {modal === "create" && (
        <CreateLeagueModal
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === "join" && (
        <JoinLeagueModal
          onClose={() => setModal(null)}
          onJoined={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface CreateLeagueModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateLeagueModal({ onClose, onCreated }: CreateLeagueModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest<{ leagueId: string; joinCode: string }>(
        "/pro-league/prediction-leagues",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
          headers: { "Content-Type": "application/json" },
        },
      );
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Erreur";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="modal-create"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold">Creer une ligue</h2>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Nom</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={50}
            required
            placeholder="Ex: Le bureau, Les copains du dimanche…"
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            data-testid="input-name"
          />
        </label>
        {error && (
          <div
            className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800"
            data-testid="modal-error"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || name.trim().length < 3}
            className="px-4 py-1.5 rounded bg-nuffle-gold text-white text-sm font-semibold disabled:opacity-50"
            data-testid="btn-submit-create"
          >
            {saving ? "Creation…" : "Creer"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface JoinLeagueModalProps {
  onClose: () => void;
  onJoined: () => void;
}

function JoinLeagueModal({ onClose, onJoined }: JoinLeagueModalProps) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest<{ leagueId: string; leagueName: string }>(
        "/pro-league/prediction-leagues/join",
        {
          method: "POST",
          body: JSON.stringify({ joinCode: code.trim() }),
          headers: { "Content-Type": "application/json" },
        },
      );
      onJoined();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Erreur";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="modal-join"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold">Rejoindre une ligue</h2>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">
            Code de jonction
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            minLength={4}
            maxLength={20}
            required
            placeholder="ABCDEFGH"
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono uppercase"
            data-testid="input-code"
          />
        </label>
        {error && (
          <div
            className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800"
            data-testid="modal-error"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || code.trim().length < 4}
            className="px-4 py-1.5 rounded bg-nuffle-gold text-white text-sm font-semibold disabled:opacity-50"
            data-testid="btn-submit-join"
          >
            {saving ? "Jonction…" : "Rejoindre"}
          </button>
        </div>
      </form>
    </div>
  );
}
