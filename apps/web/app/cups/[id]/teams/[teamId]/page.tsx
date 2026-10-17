"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api-client";
import { dynamicRoute } from "../../../../lib/typed-route";
import TeamRosterPanel, {
  formatGold,
  type RosterPlayer,
  type RosterTeam,
} from "../../../../components/TeamRosterPanel";

// Fiche de roster d'une équipe INSCRITE à une coupe (lecture seule), servie
// par `GET /cup/:id/teams/:teamId/roster-view`. Même mise en page que la
// fiche de ligue (`TeamRosterPanel`), sur le roster d'INSCRIPTION : c'est lui
// que rejoue chaque rencontre de la coupe.

interface CupRosterResponse {
  cup: { id: string; name: string };
  /** `registration` = roster d'inscription ; `live` = repli équipe en direct. */
  source: "registration" | "live";
  registeredAt: number | null;
  team: RosterTeam;
  players: RosterPlayer[];
  /** Coups de pouce achetés à la création (coupe en `build`). */
  inducements?: Array<{ name: string; quantity: number; unitCost: number }>;
}

function RegistrationNotice({ data }: { data: CupRosterResponse }) {
  const when =
    data.registeredAt !== null
      ? new Date(data.registeredAt).toLocaleDateString("fr-FR")
      : null;
  return (
    <p
      data-testid="cup-roster-source"
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      {data.source === "registration" ? (
        <>
          <strong>Roster d&apos;inscription</strong>
          {when ? ` (figé le ${when})` : ""} : c&apos;est lui que l&apos;équipe
          rejoue à chaque rencontre de la coupe. Les statistiques sont celles
          de la coupe.
        </>
      ) : (
        <>
          <strong>Roster actuel de l&apos;équipe</strong> : inscription
          antérieure au gel du roster, l&apos;état d&apos;inscription
          n&apos;a pas été conservé. Les statistiques sont celles de la coupe.
        </>
      )}
    </p>
  );
}

export default function CupTeamRosterPage() {
  const params = useParams();
  const cupId = typeof params.id === "string" ? params.id : "";
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [data, setData] = useState<CupRosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cupId || !teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<CupRosterResponse>(`/cup/${cupId}/teams/${teamId}/roster-view`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cupId, teamId]);

  const inducements = data?.inducements ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <Link
        href={dynamicRoute(`/cups/${cupId}`)}
        className="text-sm text-nuffle-bronze hover:underline"
      >
        {data ? `← Retour à la coupe « ${data.cup.name} »` : "← Retour à la coupe"}
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement du roster…</p>
      ) : error ? (
        <p
          data-testid="cup-roster-error"
          className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : data ? (
        <TeamRosterPanel
          testId="cup-roster-page"
          competition="cup"
          team={data.team}
          players={data.players}
          notice={<RegistrationNotice data={data} />}
        >
          {inducements.length > 0 ? (
            <section
              data-testid="cup-roster-inducements"
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <h2 className="mb-2 text-sm font-semibold text-nuffle-anthracite">
                Coups de pouce achetés à la création
              </h2>
              <ul className="flex flex-wrap gap-2 text-xs">
                {inducements.map((i) => (
                  <li
                    key={i.name}
                    className="rounded-full bg-nuffle-gold/15 px-3 py-1 text-nuffle-bronze"
                  >
                    {i.name} ×{i.quantity}
                    <span className="ml-1 text-gray-500">
                      ({formatGold(i.unitCost * i.quantity)})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </TeamRosterPanel>
      ) : null}
    </main>
  );
}
