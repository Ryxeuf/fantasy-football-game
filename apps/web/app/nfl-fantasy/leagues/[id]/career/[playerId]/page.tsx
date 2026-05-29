"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../../lib/api-client";

interface MeResponse {
  user: { id: string } | null;
}

interface LeagueEntry {
  id: string;
  userId: string;
}

interface LeagueDetail {
  entries: LeagueEntry[];
}

interface PlayerDetail {
  id: string;
  pseudonym: string;
  bbPosition: string;
  teamCode: string | null;
  bbSkills?: string[];
}

interface SkillAccessView {
  positionSlug: string;
  race: string;
  bbPosition: string;
  primarySkills: string | null;
  secondarySkills: string | null;
  costs: { primary: number; secondary: number };
  cap: number;
  startingSkills: string[];
}

interface CareerRow {
  id: string;
  entryId: string;
  playerId: string;
  sppCareer: number;
  sppSpent: number;
  sppAvailable: number;
  skillsUnlocked: string[];
}

interface CareerResponse {
  career: CareerRow;
  access: SkillAccessView | null;
}

interface AvailableSkill {
  slug: string;
  nameFr: string;
  nameEn: string;
  category: string;
  /** Description en FR de l'effet SPP, ou null si pas d'effet. */
  effectFr: string | null;
  effectCap: number | null;
}

interface SkillEffectCatalogEntry {
  slug: string;
  effectFr: string;
  cap: number;
  family: string;
}

interface AvailableSkillsResponse {
  primary: AvailableSkill[];
  secondary: AvailableSkill[];
  cap: number;
  remaining: number;
  costs: { primary: number; secondary: number };
  sppAvailable: number;
}

type AccessType = "primary" | "secondary";

export default function PlayerCareerDetailPage() {
  const params = useParams<{ id: string; playerId: string }>();
  const leagueId = params?.id;
  const playerId = params?.playerId;

  const [entryId, setEntryId] = useState<string | null>(null);
  const [career, setCareer] = useState<CareerRow | null>(null);
  const [access, setAccess] = useState<SkillAccessView | null>(null);
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [available, setAvailable] = useState<AvailableSkillsResponse | null>(
    null,
  );
  const [effectsBySlug, setEffectsBySlug] = useState<
    Map<string, SkillEffectCatalogEntry>
  >(new Map());
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [unlockBusy, setUnlockBusy] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const fetchCareer = useCallback(
    async (resolvedEntryId: string) => {
      const detail = await apiRequest<CareerResponse>(
        `/api/nfl-fantasy/entries/${resolvedEntryId}/careers/${playerId}`,
      );
      const avail = await apiRequest<AvailableSkillsResponse>(
        `/api/nfl-fantasy/entries/${resolvedEntryId}/careers/${playerId}/available-skills`,
      ).catch(() => null);
      setCareer(detail.career);
      setAccess(detail.access);
      setAvailable(avail);
    },
    [playerId],
  );

  // Catalogue d'effets (public, fetch unique). Permet de filtrer les
  // skills sans effet SPP et d'afficher la description par compétence.
  useEffect(() => {
    apiRequest<{ effects: SkillEffectCatalogEntry[] }>(
      "/api/nfl-fantasy/public/skill-effects",
    )
      .then((res) => {
        const map = new Map<string, SkillEffectCatalogEntry>();
        for (const e of res.effects) map.set(e.slug, e);
        setEffectsBySlug(map);
      })
      .catch(() => {
        // Silent fallback : si l'API est down, on garde l'ancien comportement
        // (skills sans effet visible).
      });
  }, []);

  useEffect(() => {
    if (!leagueId || !playerId) return;
    let cancelled = false;
    async function load() {
      try {
        const [me, league, playerDetail] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<LeagueDetail>(`/api/nfl-fantasy/leagues/${leagueId}`),
          apiRequest<PlayerDetail>(`/api/nfl-fantasy/players/${playerId}`).catch(
            () => null,
          ),
        ]);
        const userId = me.user?.id ?? null;
        if (!userId) {
          if (!cancelled) setError({ message: "Non authentifie", status: 401 });
          return;
        }
        const mine = league.entries.find((e) => e.userId === userId);
        if (!mine) {
          if (!cancelled)
            setError({ message: "Tu n'es pas membre de ce championnat", status: 403 });
          return;
        }
        if (cancelled) return;
        setEntryId(mine.id);
        if (playerDetail) setPlayer(playerDetail);
        await fetchCareer(mine.id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leagueId, playerId, fetchCareer]);

  async function handleUnlock(slug: string, accessType: AccessType) {
    if (!entryId || !playerId) return;
    setUnlockBusy(slug);
    setUnlockError(null);
    try {
      await apiRequest(
        `/api/nfl-fantasy/entries/${entryId}/careers/${playerId}/unlock-skill`,
        {
          method: "POST",
          body: JSON.stringify({ skillSlug: slug, accessType }),
        },
      );
      await fetchCareer(entryId);
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : "Erreur lors de l'achat",
      );
    } finally {
      setUnlockBusy(null);
    }
  }

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 403 || error?.status === 404) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-nuffle-anthracite/70">{error.message}</p>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}/career`}
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour à mes carrières
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="career-detail">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}/career`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour à mes carrières
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {player?.pseudonym ?? playerId}
        </h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {player?.bbPosition ?? "—"}
          {access ? ` · ${access.race}` : ""}
          {access ? ` · pos: ${access.positionSlug}` : ""}
        </p>
      </div>

      {error && error.status !== 401 && error.status !== 403 && error.status !== 404 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Erreur : {error.message}
        </div>
      )}

      {career === null && !error && (
        <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>
      )}

      {career && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="SPP cumulés" value={career.sppCareer} />
          <Stat label="SPP dépensés" value={career.sppSpent} />
          <Stat
            label="SPP disponibles"
            value={career.sppAvailable}
            highlight
          />
        </div>
      )}

      {career && (
        <OwnedSkillsSection
          startingSkills={access?.startingSkills ?? []}
          unlockedSkills={career.skillsUnlocked}
          effectsBySlug={effectsBySlug}
        />
      )}

      {unlockError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {unlockError}
        </div>
      )}

      {available && (
        <UnlockSection
          title="Pool primaire (6 SPP)"
          description={`Pool primaire : ${access?.primarySkills || "—"}`}
          skills={available.primary.filter((s) => s.effectFr != null)}
          totalSkills={available.primary.length}
          cost={available.costs.primary}
          accessType="primary"
          sppAvailable={available.sppAvailable}
          remaining={available.remaining}
          busySlug={unlockBusy}
          onUnlock={handleUnlock}
        />
      )}

      {available && (
        <UnlockSection
          title="Pool secondaire (12 SPP)"
          description={`Pool secondaire : ${access?.secondarySkills || "—"}`}
          skills={available.secondary.filter((s) => s.effectFr != null)}
          totalSkills={available.secondary.length}
          cost={available.costs.secondary}
          accessType="secondary"
          sppAvailable={available.sppAvailable}
          remaining={available.remaining}
          busySlug={unlockBusy}
          onUnlock={handleUnlock}
        />
      )}

      {career && !available && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Pool d'accès non renseigné pour cette combinaison (race +
          position). Achat de skill indisponible.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-nuffle-bronze/30 bg-nuffle-cream/40"
          : "border-nuffle-bronze/15 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          highlight ? "text-nuffle-bronze" : "text-nuffle-anthracite"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "starter" | "unlocked" }) {
  const cls =
    tone === "starter"
      ? "bg-nuffle-cream text-nuffle-anthracite/80"
      : "bg-nuffle-gold/20 text-nuffle-anthracite";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>;
}

// ────────────────────────────────────────────────────────────────────
// Section des competences actuelles avec leurs effets
// ────────────────────────────────────────────────────────────────────

function OwnedSkillsSection({
  startingSkills,
  unlockedSkills,
  effectsBySlug,
}: {
  startingSkills: readonly string[];
  unlockedSkills: readonly string[];
  effectsBySlug: Map<string, SkillEffectCatalogEntry>;
}) {
  const rowsWithEffect: Array<{
    slug: string;
    tone: "starter" | "unlocked";
    effect: SkillEffectCatalogEntry | null;
  }> = [];
  for (const s of startingSkills) {
    rowsWithEffect.push({
      slug: s,
      tone: "starter",
      effect: lookupEffect(s, effectsBySlug),
    });
  }
  for (const s of unlockedSkills) {
    rowsWithEffect.push({
      slug: s,
      tone: "unlocked",
      effect: lookupEffect(s, effectsBySlug),
    });
  }
  const withEffect = rowsWithEffect.filter((r) => r.effect !== null);
  const withoutEffect = rowsWithEffect.filter((r) => r.effect === null);

  if (rowsWithEffect.length === 0) {
    return (
      <section className="rounded-lg border border-nuffle-bronze/20 bg-white p-4">
        <h2 className="text-sm font-semibold text-nuffle-anthracite/70">
          Compétences actuelles
        </h2>
        <p className="mt-2 text-xs text-nuffle-anthracite/40">
          Aucune compétence pour l&apos;instant.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-nuffle-bronze/20 bg-white p-4">
      <h2 className="text-sm font-semibold text-nuffle-anthracite/70">
        Compétences actuelles
      </h2>
      {withEffect.length > 0 && (
        <ul className="mt-3 divide-y divide-nuffle-bronze/10">
          {withEffect.map((r) => (
            <li
              key={`${r.tone}-${r.slug}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="flex items-center gap-2">
                <Badge label={r.slug} tone={r.tone} />
                <span className="text-xs text-nuffle-anthracite/50">
                  {r.tone === "starter" ? "starting" : "débloquée"}
                </span>
              </div>
              <p className="flex-1 text-right text-xs text-nuffle-anthracite/80 sm:text-sm">
                {r.effect?.effectFr}
                {r.effect && (
                  <span className="ml-1 font-mono text-[10px] text-nuffle-anthracite/50">
                    (cap {r.effect.cap})
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {withoutEffect.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-nuffle-anthracite/60 hover:text-nuffle-bronze">
            {withoutEffect.length} autre{withoutEffect.length > 1 ? "s" : ""}{" "}
            sans effet SPP
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5 opacity-70">
            {withoutEffect.map((r) => (
              <Badge
                key={`noeff-${r.slug}`}
                label={r.slug}
                tone={r.tone}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-nuffle-anthracite/50">
            Ces compétences existent en Blood Bowl mais n&apos;ont pas de bonus
            SPP dans le scoring NFL Fantasy V1.
          </p>
        </details>
      )}
    </section>
  );
}

function lookupEffect(
  slug: string,
  effects: Map<string, SkillEffectCatalogEntry>,
): SkillEffectCatalogEntry | null {
  const direct = effects.get(slug);
  if (direct) return direct;
  if (slug.startsWith("mighty-blow")) return effects.get("mighty-blow-1") ?? null;
  return null;
}

function UnlockSection({
  title,
  description,
  skills,
  totalSkills,
  cost,
  accessType,
  sppAvailable,
  remaining,
  busySlug,
  onUnlock,
}: {
  title: string;
  description: string;
  skills: AvailableSkill[];
  /** Nombre total dans le pool (avant filtrage par effetFr) — pour message info. */
  totalSkills: number;
  cost: number;
  accessType: AccessType;
  sppAvailable: number;
  remaining: number;
  busySlug: string | null;
  onUnlock: (slug: string, accessType: AccessType) => void;
}) {
  const filteredOut = totalSkills - skills.length;
  return (
    <section className="rounded-lg border border-nuffle-bronze/20 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-nuffle-anthracite/60">{description}</span>
      </div>
      {filteredOut > 0 && (
        <p className="mt-1 text-[11px] text-nuffle-anthracite/50">
          {filteredOut} compétence{filteredOut > 1 ? "s" : ""} masquée
          {filteredOut > 1 ? "s" : ""} (sans effet sur le scoring SPP).
        </p>
      )}
      <div className="mt-3">
        {skills.length === 0 ? (
          <p className="text-xs text-nuffle-anthracite/50">
            Aucune compétence avec effet SPP achetable dans ce pool.
          </p>
        ) : (
          <ul className="divide-y divide-nuffle-bronze/10">
            {skills.map((s) => {
              const canAfford = sppAvailable >= cost;
              const canSlot = remaining > 0;
              const disabled =
                busySlug !== null || !canAfford || !canSlot;
              return (
                <li
                  key={s.slug}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.nameFr}</div>
                    <div className="text-xs text-nuffle-anthracite/60">
                      {s.category} · {s.slug}
                    </div>
                    {s.effectFr && (
                      <div className="mt-1 text-xs text-nuffle-anthracite/80">
                        ✨ {s.effectFr}
                        {s.effectCap != null && (
                          <span className="ml-1 font-mono text-[10px] text-nuffle-anthracite/50">
                            (cap {s.effectCap})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onUnlock(s.slug, accessType)}
                    className="shrink-0 rounded-md bg-nuffle-bronze px-3 py-1.5 text-xs font-medium text-white hover:bg-nuffle-bronze/90 disabled:cursor-not-allowed disabled:bg-nuffle-anthracite/20"
                  >
                    {busySlug === s.slug
                      ? "…"
                      : `Débloquer (${cost} SPP)`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
