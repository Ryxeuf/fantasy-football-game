"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";
import { useLanguage } from "../contexts/LanguageContext";

interface MatchSummary {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  isMyTurn: boolean;
  score: { teamA: number; teamB: number };
  half: number;
  turn: number;
  myTeam: { coachName: string; teamName: string; rosterName?: string } | null;
  opponent: { coachName: string; teamName: string; rosterName?: string } | null;
}

async function apiPost(path: string, body?: unknown) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

async function apiGet(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`);
  return res.json();
}

function getStatusLabel(status: string, lang: string): string {
  if (lang === "en") {
    switch (status) {
      case "active": return "In progress";
      case "pending": return "Pending";
      case "prematch": case "prematch-setup": return "Setup";
      case "ended": return "Finished";
      default: return status;
    }
  }
  switch (status) {
    case "active": return "En cours";
    case "pending": return "En attente";
    case "prematch": case "prematch-setup": return "Configuration";
    case "ended": return "Termine";
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "pending": return "bg-yellow-500";
    case "prematch": case "prematch-setup": return "bg-blue-500";
    case "ended": return "bg-gray-500";
    default: return "bg-gray-400";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PlayPage() {
  const { t, language: lang } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [matchIdInput, setMatchIdInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);
        loadMatches();
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  async function loadMatches() {
    try {
      setLoadingMatches(true);
      const data = await apiGet("/match/my-matches");
      setMatches(data.matches || []);
    } catch {
      // silently fail
    } finally {
      setLoadingMatches(false);
    }
  }

  async function createMatch() {
    setError(null);
    setCreating(true);
    try {
      const { match, matchToken } = await apiPost("/match/create");
      localStorage.setItem("match_token", matchToken);
      window.location.href = `/team/select?matchId=${match.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function joinMatch() {
    if (!matchIdInput.trim()) return;
    setError(null);
    setJoining(true);
    try {
      const { match, matchToken } = await apiPost("/match/join", { matchId: matchIdInput.trim() });
      localStorage.setItem("match_token", matchToken);
      window.location.href = `/team/select?matchId=${match.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setJoining(false);
    }
  }

  async function copyMatchId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
    }
  }

  const activeMatches = matches.filter((m) => m.status !== "ended");
  const myTurnCount = matches.filter((m) => m.isMyTurn && m.status === "active").length;

  // Not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-nuffle-bronze/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-nuffle-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite">
            {t.play?.loginRequired || "Connexion requise"}
          </h1>
          <p className="text-nuffle-anthracite/70 font-body">
            {t.play?.loginRequiredDesc || "Vous devez etre connecte pour creer ou rejoindre une partie en ligne."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className="px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-center"
            >
              {t.auth.login}
            </a>
            <a
              href="/register"
              className="px-6 py-3 rounded-lg border-2 border-nuffle-bronze/50 text-nuffle-anthracite hover:bg-nuffle-bronze/10 font-subtitle font-semibold transition-all text-center"
            >
              {t.auth.register}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isAuthenticated === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-nuffle-anthracite/60 font-body">{t.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold text-nuffle-anthracite">
          {t.play?.title || "Jouer en ligne"}
        </h1>
        <p className="text-nuffle-anthracite/70 font-body max-w-2xl mx-auto">
          {t.play?.subtitle || "Creez une partie et partagez l'ID avec votre adversaire, ou rejoignez une partie existante."}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto rounded-lg border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 font-body">{error}</p>
        </div>
      )}

      {/* Create / Join Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Create */}
        <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
          <div className="h-3 bg-gradient-to-r from-nuffle-gold via-nuffle-bronze to-nuffle-gold" />
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-nuffle-gold/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-nuffle-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-heading font-bold text-nuffle-anthracite">
              {t.play?.createTitle || "Creer une partie"}
            </h2>
            <p className="text-sm text-nuffle-anthracite/70 font-body">
              {t.play?.createDesc || "Lancez un nouveau match et partagez l'identifiant avec votre adversaire pour qu'il vous rejoigne."}
            </p>
            <button
              onClick={createMatch}
              disabled={creating}
              className="w-full px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {creating
                ? (t.play?.creating || "Creation en cours...")
                : (t.play?.createButton || "Creer une partie")}
            </button>
          </div>
        </div>

        {/* Join */}
        <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
          <div className="h-3 bg-gradient-to-r from-nuffle-bronze via-nuffle-anthracite to-nuffle-bronze" />
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-nuffle-bronze/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-nuffle-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-heading font-bold text-nuffle-anthracite">
              {t.play?.joinTitle || "Rejoindre une partie"}
            </h2>
            <p className="text-sm text-nuffle-anthracite/70 font-body">
              {t.play?.joinDesc || "Entrez l'identifiant du match communique par votre adversaire pour le rejoindre."}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-3 rounded-lg border-2 border-nuffle-bronze/30 focus:border-nuffle-gold focus:outline-none font-body text-sm placeholder:text-nuffle-anthracite/40"
                placeholder={t.play?.matchIdPlaceholder || "ID de la partie"}
                value={matchIdInput}
                onChange={(e) => setMatchIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinMatch()}
              />
              <button
                onClick={joinMatch}
                disabled={joining || !matchIdInput.trim()}
                className="px-5 py-3 rounded-lg bg-nuffle-anthracite hover:bg-nuffle-anthracite/90 text-nuffle-ivory font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
              >
                {joining
                  ? (t.play?.joiningButton || "...")
                  : (t.play?.joinButton || "Rejoindre")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* My active matches */}
      {activeMatches.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-bold text-nuffle-anthracite">
              {t.play?.myMatches || "Mes matchs en cours"}
            </h2>
            {myTurnCount > 0 && (
              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                {myTurnCount} {t.play?.yourTurn || "a votre tour"}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {activeMatches.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border-2 bg-white shadow-sm transition-all hover:shadow-md ${
                  m.isMyTurn && m.status === "active"
                    ? "border-green-400"
                    : "border-nuffle-bronze/20"
                }`}
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${getStatusColor(m.status)}`} />
                      <span className="text-xs font-medium text-nuffle-anthracite/60 font-body">
                        {getStatusLabel(m.status, lang)}
                      </span>
                      {m.isMyTurn && m.status === "active" && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">
                          {t.play?.yourTurnBadge || "Votre tour"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-nuffle-anthracite font-subtitle font-semibold">
                      <span className="truncate">{m.myTeam?.teamName || (t.play?.myTeam || "Mon equipe")}</span>
                      {m.status !== "pending" && (
                        <span className="text-nuffle-gold font-bold">{m.score.teamA} - {m.score.teamB}</span>
                      )}
                      <span className="text-nuffle-anthracite/50">vs</span>
                      <span className="truncate">{m.opponent?.teamName || (t.play?.waitingOpponent || "En attente...")}</span>
                    </div>
                    <div className="text-xs text-nuffle-anthracite/50 mt-1 font-body flex items-center gap-2">
                      <span>{formatDate(m.createdAt)}</span>
                      {m.status === "pending" && (
                        <button
                          onClick={(e) => { e.preventDefault(); copyMatchId(m.id); }}
                          className="inline-flex items-center gap-1 text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                          title={t.play?.copyId || "Copier l'ID"}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {copied === m.id ? (t.play?.copied || "Copie !") : (t.play?.copyIdLabel || "Copier ID")}
                        </button>
                      )}
                    </div>
                  </div>
                  <a
                    href={
                      m.status === "active" || m.status === "prematch" || m.status === "prematch-setup"
                        ? `/play-hidden/${m.id}`
                        : m.status === "pending"
                          ? `/waiting-hidden/${m.id}`
                          : "#"
                    }
                    className="px-4 py-2 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold text-sm shadow hover:shadow-md transition-all whitespace-nowrap"
                  >
                    {m.status === "pending"
                      ? (t.play?.seeWaiting || "Salle d'attente")
                      : (t.play?.continueMatch || "Continuer")}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <a
              href="/me/matches"
              className="text-sm text-nuffle-bronze hover:text-nuffle-gold font-subtitle font-semibold hover:underline transition-colors"
            >
              {t.play?.seeAllMatches || "Voir tous mes matchs"} &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingMatches && activeMatches.length === 0 && (
        <div className="max-w-md mx-auto text-center py-6">
          <p className="text-sm text-nuffle-anthracite/50 font-body">
            {t.play?.noActiveMatches || "Aucun match en cours. Creez ou rejoignez une partie pour commencer !"}
          </p>
          <a
            href="/me/matches"
            className="inline-block mt-3 text-sm text-nuffle-bronze hover:text-nuffle-gold font-subtitle font-semibold hover:underline transition-colors"
          >
            {t.play?.seeMatchHistory || "Voir l'historique des matchs"} &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
