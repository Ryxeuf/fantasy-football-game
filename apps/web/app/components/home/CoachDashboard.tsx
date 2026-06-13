"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "../../lib/featureFlagKeys";
import { apiRequest } from "../../lib/api-client";
import {
  EmblemRosters,
  EmblemStar,
  EmblemTabletop,
  EmblemTutorial,
} from "./NuffleArt";

/* Meme materiau « jeton sombre grave » que la home marketing — accent
   unique reutilise (avatar, badges d'icones) pour rester coherent. */
const COIN_BADGE =
  "relative flex items-center justify-center rounded-full bg-[#1B1610] text-nuffle-gold ring-1 ring-nuffle-gold/40 shadow-[inset_0_1px_0_rgba(232,201,106,0.25),0_6px_16px_rgba(27,22,16,0.35)]";

/** Sous-ensemble du user expose par `/auth/me` dont le dashboard a besoin. */
export interface CoachUser {
  readonly id: string;
  readonly email?: string;
  readonly name?: string | null;
  readonly coachName?: string | null;
  readonly firstName?: string | null;
  readonly _count?: {
    readonly teams?: number;
    readonly matches?: number;
    readonly createdLocalMatches?: number;
  } | null;
}

interface CoachTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset?: string;
  readonly format?: string;
  readonly currentValue?: number;
}

interface CoachDashboardProps {
  readonly user: CoachUser;
}

/** Nom d'affichage du coach : coachName > name > firstName > email (local part). */
function coachDisplayName(user: CoachUser): string | null {
  const candidate =
    user.coachName?.trim() ||
    user.name?.trim() ||
    user.firstName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "";
  return candidate.length > 0 ? candidate : null;
}

/** Initiales pour l'avatar « jeton » (1 a 2 lettres, majuscules). */
function coachInitials(name: string | null): string {
  if (!name) return "C";
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0] ?? "");
  return (letters.join("") || name[0] || "C").toUpperCase();
}

function formatTv(value: number | undefined, kpoSuffix: string): string {
  return `${Math.round((value ?? 0) / 1000)}${kpoSuffix}`;
}

interface QuickAction {
  readonly href: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
}

function QuickActionCard({ href, icon, title, description }: QuickAction) {
  return (
    <a
      href={href}
      className="group h-full rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-5 shadow-[0_2px_10px_rgba(107,78,46,0.06)] hover:border-nuffle-gold/60 hover:shadow-[0_10px_30px_rgba(107,78,46,0.14)] hover:-translate-y-1 transition-all flex items-start gap-4"
    >
      <span className={`${COIN_BADGE} h-12 w-12 flex-shrink-0`}>
        <span className="h-6 w-6 flex items-center justify-center [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      </span>
      <div className="min-w-0">
        <h3 className="font-heading font-bold text-base leading-tight text-nuffle-anthracite">{title}</h3>
        <p className="mt-1 text-sm text-nuffle-anthracite/70 font-body leading-snug">{description}</p>
      </div>
    </a>
  );
}

function TeamsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-5 animate-pulse"
        >
          <div className="h-5 w-2/3 bg-nuffle-bronze/15 rounded" />
          <div className="h-3 w-1/3 bg-nuffle-bronze/15 rounded mt-3" />
          <div className="h-6 w-20 bg-nuffle-bronze/15 rounded-full mt-4" />
        </div>
      ))}
    </div>
  );
}

export default function CoachDashboard({ user }: CoachDashboardProps) {
  const { t, language } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);
  const d = t.home.dashboard;

  const displayName = coachDisplayName(user);
  const greeting = displayName
    ? d.greeting.replace("{name}", displayName)
    : d.greetingFallback;

  const [teams, setTeams] = useState<CoachTeam[]>([]);
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const lang = language === "en" ? "en" : "fr";
    setLoadingTeams(true);
    // Detail principal (mes equipes) + endpoint optionnel (noms de roster).
    // Le second est public et tolere l'echec : on retombe sur le slug brut.
    Promise.all([
      apiRequest<{ teams: CoachTeam[] }>("/team/mine"),
      apiRequest<{ rosters: ReadonlyArray<{ slug: string; name: string }> }>(
        `/api/rosters?lang=${lang}`,
      ).catch(() => ({ rosters: [] as ReadonlyArray<{ slug: string; name: string }> })),
    ])
      .then(([mine, rostersResp]) => {
        if (cancelled) return;
        setTeams(mine.teams ?? []);
        const map: Record<string, string> = {};
        for (const r of rostersResp.rosters) map[r.slug] = r.name;
        setRosterNames(map);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTeams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const teamCount = teams.length || user._count?.teams || 0;
  const matchesTracked =
    (user._count?.matches ?? 0) + (user._count?.createdLocalMatches ?? 0);

  const quickActions: ReadonlyArray<QuickAction> = [
    {
      href: "/me/teams/new",
      icon: <EmblemRosters />,
      title: d.actionCreateTeam,
      description: d.actionCreateTeamDesc,
    },
    {
      href: "/local-matches",
      icon: <EmblemTabletop />,
      title: d.actionLocalMatches,
      description: d.actionLocalMatchesDesc,
    },
    {
      href: "/teams",
      icon: <EmblemStar />,
      title: d.actionExplore,
      description: d.actionExploreDesc,
    },
    {
      href: "/tutoriel",
      icon: <EmblemTutorial />,
      title: d.actionTutorial,
      description: d.actionTutorialDesc,
    },
  ];

  return (
    <div
      data-testid="coach-dashboard"
      className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 bg-gradient-to-b from-[#F3EAD6] via-[#EFE4CD] to-[#E7DABF] text-nuffle-anthracite min-h-[70vh]"
    >
      <div className="relative overflow-hidden">
        {/* texture terrain discrete, commune a la home */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(115deg,transparent,transparent_46px,#6B4E2E_46px,#6B4E2E_47px)]"
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {/* En-tete : salutation + avatar jeton */}
          <header className="flex items-center gap-4 sm:gap-5">
            <span
              className={`${COIN_BADGE} h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 font-heading font-bold text-xl sm:text-2xl`}
              aria-hidden="true"
            >
              {coachInitials(displayName)}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 px-3 py-1 text-[11px] sm:text-xs font-subtitle font-semibold uppercase tracking-[0.2em] text-nuffle-bronze">
                <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold" aria-hidden="true" />
                {d.kicker}
              </span>
              <h1
                data-testid="dashboard-greeting"
                className="mt-2 font-heading font-bold text-2xl sm:text-3xl md:text-4xl leading-tight text-nuffle-anthracite truncate"
              >
                {greeting}
              </h1>
              <p className="mt-1 text-sm sm:text-base text-nuffle-bronze/90 font-body">
                {d.subtitle}
              </p>
            </div>
          </header>

          {/* Bandeau de stats rapides */}
          <dl className="mt-7 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 px-4 py-3 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
              <dd className="font-score text-3xl sm:text-4xl text-nuffle-bronze leading-none tracking-wide">
                {teamCount}
              </dd>
              <dt className="mt-1 text-[10px] sm:text-xs text-nuffle-anthracite/55 font-subtitle uppercase tracking-wider">
                {d.statTeams}
              </dt>
            </div>
            <div className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 px-4 py-3 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
              <dd className="font-score text-3xl sm:text-4xl text-nuffle-bronze leading-none tracking-wide">
                {matchesTracked}
              </dd>
              <dt className="mt-1 text-[10px] sm:text-xs text-nuffle-anthracite/55 font-subtitle uppercase tracking-wider">
                {d.statMatches}
              </dt>
            </div>
            {onlinePlayEnabled && (
              <a
                href="/me/matches"
                className="group rounded-2xl bg-[#1B1610] text-nuffle-ivory border border-nuffle-gold/40 px-4 py-3 shadow-[0_6px_16px_rgba(27,22,16,0.35)] hover:-translate-y-0.5 transition-all flex flex-col justify-center"
              >
                <span className="font-subtitle font-bold uppercase tracking-wide text-sm text-nuffle-gold">
                  {d.statOnline}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-nuffle-ivory/70 font-body">
                  {d.statOnlineCta}
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </span>
              </a>
            )}
          </dl>

          {/* Mes equipes */}
          <section className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading font-bold text-xl sm:text-2xl text-nuffle-anthracite">
                {d.myTeams}
              </h2>
              {teams.length > 0 && (
                <a
                  href="/me/teams"
                  className="inline-flex items-center gap-1.5 text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  {d.viewAllTeams}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </div>

            <div className="mt-5">
              {loadingTeams ? (
                <TeamsSkeleton />
              ) : teams.length === 0 ? (
                <div className="rounded-2xl bg-[#FBF7EC] border border-dashed border-nuffle-bronze/40 p-8 text-center shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
                  <p className="font-body text-nuffle-anthracite/75">{d.noTeams}</p>
                  <a
                    href="/me/teams/new"
                    className="mt-5 inline-flex px-7 py-3 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_6px_20px_rgba(203,161,53,0.35)] hover:-translate-y-0.5 transition-all"
                  >
                    {d.createFirstTeam}
                  </a>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <a
                        href={`/me/teams/${team.id}`}
                        data-testid="dashboard-team-card"
                        className="group block h-full rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-5 shadow-[0_2px_10px_rgba(107,78,46,0.06)] hover:border-nuffle-gold/60 hover:shadow-[0_10px_30px_rgba(107,78,46,0.14)] hover:-translate-y-1 transition-all"
                      >
                        <h3 className="font-heading font-bold text-lg leading-tight text-nuffle-anthracite truncate group-hover:text-nuffle-bronze transition-colors">
                          {team.name}
                        </h3>
                        <p className="mt-1 text-sm text-nuffle-anthracite/65 font-body">
                          {rosterNames[team.roster] || team.roster}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/15 px-3 py-1 text-xs font-subtitle font-bold uppercase tracking-wide text-nuffle-bronze">
                            <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold" aria-hidden="true" />
                            {formatTv(team.currentValue, t.teams.kpo)}
                          </span>
                          <span className="text-sm font-subtitle font-semibold text-nuffle-bronze group-hover:text-nuffle-gold transition-colors inline-flex items-center gap-1">
                            {d.openTeam}
                            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Actions rapides */}
          <section className="mt-10">
            <h2 className="font-heading font-bold text-xl sm:text-2xl text-nuffle-anthracite">
              {d.quickActions}
            </h2>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <QuickActionCard key={action.href} {...action} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
