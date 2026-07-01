"use client";
/**
 * Page dediee "Trecerie / Achats entre matchs".
 *
 * Extraite de la page d'edition d'equipe : l'edition est verrouillee pour
 * une equipe engagee, mais depenser l'or gagne entre les matchs (recruter,
 * ameliorer le staff) reste une progression legitime. Cette page est donc
 * accessible quel que soit l'etat de l'equipe (engagee ou non) — pas de
 * redirection "engagee".
 *
 * Reprend fidelement le wiring de la page edit : chargement parallele de
 * `/team/{id}` + `/team/{id}/available-positions`, refetch apres achat.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../../../auth-client";
import { apiRequest } from "../../../../lib/api-client";
import TreasuryPurchasePanel from "../../components/TreasuryPurchasePanel";
import { useLanguage } from "../../../../contexts/LanguageContext";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

interface AvailablePosition {
  key: string;
  name: string;
  cost: number;
  currentCount: number;
  maxCount: number;
  canAdd: boolean;
  stats: {
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
    skills: string;
  };
}

export default function TeamTreasuryPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [availablePositions, setAvailablePositions] = useState<AvailablePosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/")[3]
      : "";

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const [me, d, positionsData] = await Promise.all([
          fetchJSON("/auth/me"),
          apiRequest<any>(`/team/${id}`),
          apiRequest<{ availablePositions: AvailablePosition[]; frozen?: boolean }>(
            `/team/${id}/available-positions`,
          ),
        ]);

        if (!me?.user) {
          window.location.href = "/login";
          return;
        }

        setData(d);
        setAvailablePositions(positionsData.availablePositions || []);
      } catch (e: any) {
        setError(e?.message || (t.teams.error ?? "Erreur"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const refetch = async () => {
    const d = await apiRequest<any>(`/team/${id}`);
    setData(d);
    const positionsData = await apiRequest<{
      availablePositions: AvailablePosition[];
      frozen?: boolean;
    }>(`/team/${id}/available-positions`);
    setAvailablePositions(positionsData.availablePositions || []);
  };

  const team = data?.team;

  return (
    <div
      data-testid="team-treasury-page"
      className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6"
    >
      <div>
        <Link
          href={`/me/teams/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← {t.teams.backToTeam ?? "Retour a l'equipe"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          {t.teams.treasuryTitle ?? "Tresorerie"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t.teams.treasuryDescription ??
            "Depensez l'or gagne entre les matchs pour recruter des joueurs et ameliorer votre equipe."}
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-lg bg-gray-200"></div>
          <div className="h-64 rounded-lg bg-gray-200"></div>
        </div>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      ) : !team ? (
        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600">
          {t.teams.error ?? "Equipe introuvable"}
        </div>
      ) : team.treasury > 0 ? (
        <TreasuryPurchasePanel
          team={{
            id: team.id,
            roster: team.roster,
            treasury: team.treasury,
            rerolls: team.rerolls || 0,
            cheerleaders: team.cheerleaders || 0,
            assistants: team.assistants || 0,
            apothecary: team.apothecary || false,
            dedicatedFans: team.dedicatedFans || 1,
            staffConfig: team.staffConfig,
            players: (team.players || []).map((p: any) => ({
              id: p.id,
              number: p.number,
              dead: p.dead || false,
              name: p.name,
            })),
          }}
          availablePositions={availablePositions}
          onPurchaseComplete={refetch}
        />
      ) : (
        <div
          data-testid="team-treasury-empty"
          className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-800"
        >
          {t.teams.treasuryEmpty ??
            "Aucune tresorerie disponible pour le moment. Gagnez de l'or en jouant des matchs."}
        </div>
      )}
    </div>
  );
}
