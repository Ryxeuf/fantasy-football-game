import Link from "next/link";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import StructuredData from "../../components/StructuredData";
import TeamLogo from "../../components/TeamLogo";
import {
  getRosterMeta,
  DIFFICULTY_LABELS,
  DIFFICULTY_RANK,
  PLAYSTYLE_LABELS,
  BEGINNER_FRIENDLY_SLUGS,
} from "../roster-meta";
import { buildTierListSchema } from "../tier-list-structured-data";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

// Rendu dynamique à la demande (SSR) : on n'inscrit PAS cette route statique
// dans le prerender du build pour ne pas dépendre du backend au build (cf.
// teams/[slug] et la liste /teams qui esquivent via searchParams). Le résultat
// du fetch reste mis en cache 3600 s (data cache) pour limiter la charge.
export const dynamic = "force-dynamic";

interface TierRoster {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  positionCount: number;
}

async function fetchRosters(): Promise<TierRoster[]> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ rosters?: any[] }>(
    `${base}/api/rosters?lang=fr&ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  return (data?.rosters ?? []).map((r: any) => ({
    slug: r.slug,
    name: r.name,
    budget: r.budget,
    tier: r.tier,
    naf: r.naf,
    positionCount: r._count?.positions ?? 0,
  }));
}

const TIERS = ["I", "II", "III", "IV"] as const;

const TIER_INFO: Record<
  string,
  { title: string; blurb: string; accent: string }
> = {
  I: {
    title: "Tier I — Élite",
    blurb:
      "Les équipes les plus compétitives, fortes dès la création et redoutées en tournoi.",
    accent: "from-emerald-500/15 border-emerald-400/40 text-emerald-800",
  },
  II: {
    title: "Tier II — Solides",
    blurb:
      "Des équipes polyvalentes et fiables, un excellent équilibre entre puissance et souplesse.",
    accent: "from-sky-500/15 border-sky-400/40 text-sky-800",
  },
  III: {
    title: "Tier III — Exigeantes",
    blurb:
      "Des équipes plus situationnelles qui récompensent l'expérience et un jeu précis.",
    accent: "from-amber-500/15 border-amber-400/40 text-amber-800",
  },
  IV: {
    title: "Tier IV — Stunty & défi",
    blurb:
      "Les équipes les plus difficiles (souvent Stunty) : fragiles et farfelues, pensées pour le fun et le challenge.",
    accent: "from-orange-500/15 border-orange-400/40 text-orange-800",
  },
};

function DifficultyScale({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= rank ? "bg-nuffle-gold" : "bg-nuffle-bronze/20"
          }`}
        />
      ))}
    </span>
  );
}

export default async function TierListPage() {
  const rosters = await fetchRosters();

  const byTier = new Map<string, TierRoster[]>();
  for (const tier of TIERS) byTier.set(tier, []);
  for (const r of rosters) {
    const bucket = byTier.get(r.tier);
    if (bucket) bucket.push(r);
    else byTier.set(r.tier, [r]);
  }
  for (const list of byTier.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const beginnerPicks = rosters
    .filter((r) => BEGINNER_FRIENDLY_SLUGS.includes(r.slug))
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[getRosterMeta(a.slug).difficulty] -
          DIFFICULTY_RANK[getRosterMeta(b.slug).difficulty] ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 4);

  return (
    <>
      <StructuredData
        data={buildTierListSchema({
          items: rosters.map((r) => ({
            slug: r.slug,
            name: r.name,
            tier: r.tier,
          })),
          baseUrl: BASE_URL,
          lang: "fr",
        })}
      />

      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-8 font-body">
        {/* Fil d'Ariane */}
        <nav
          aria-label="Fil d'Ariane"
          className="text-sm font-subtitle text-nuffle-bronze/80"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-nuffle-gold transition-colors">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/teams" className="hover:text-nuffle-gold transition-colors">
                Équipes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-nuffle-anthracite font-semibold" aria-current="page">
              Tier list
            </li>
          </ol>
        </nav>

        <header>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-nuffle-anthracite leading-tight">
            Tier list des équipes Blood Bowl
          </h1>
          <p className="mt-2 text-nuffle-bronze/90 max-w-3xl">
            Les 31 rosters officiels de la Saison 3, classés du Tier I (le plus
            compétitif) au Tier IV. Chaque équipe est accompagnée de sa
            difficulté de prise en main et de son style de jeu. Hésitant entre
            deux équipes ?{" "}
            <Link
              href="/teams/comparer"
              className="text-nuffle-gold font-semibold hover:underline"
            >
              Utilisez le comparateur
            </Link>
            .
          </p>
        </header>

        {/* Encart meilleur roster débutant */}
        {beginnerPicks.length > 0 && (
          <section
            className="rounded-2xl bg-[#1B1610] ring-1 ring-nuffle-gold/40 p-5 sm:p-6 text-nuffle-ivory shadow-[0_6px_16px_rgba(27,22,16,0.25)]"
            data-testid="beginner-picks"
          >
            <h2 className="font-heading font-bold text-xl text-nuffle-gold">
              ⭐ Meilleurs rosters pour débuter
            </h2>
            <p className="mt-1 text-sm text-nuffle-ivory/80">
              Résistantes, pardonnantes et sans piège : les équipes idéales pour
              vos premiers matchs.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {beginnerPicks.map((r) => (
                <Link
                  key={r.slug}
                  href={`/teams/${r.slug}`}
                  className="flex items-center gap-2.5 rounded-xl bg-white/5 ring-1 ring-nuffle-gold/20 px-3 py-2.5 hover:ring-nuffle-gold/60 hover:bg-white/10 transition-all"
                >
                  <TeamLogo slug={r.slug} size={36} title={r.name} />
                  <span className="min-w-0">
                    <span className="block truncate font-subtitle font-semibold text-sm text-nuffle-ivory">
                      {r.name}
                    </span>
                    <span className="block text-xs text-nuffle-gold/80">
                      Tier {r.tier}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Groupes par tier */}
        {TIERS.map((tier) => {
          const list = byTier.get(tier) ?? [];
          if (list.length === 0) return null;
          const info = TIER_INFO[tier];
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`}>
              <div
                className={`rounded-xl border bg-gradient-to-r to-transparent px-4 py-3 ${info.accent}`}
              >
                <h2
                  id={`tier-${tier}`}
                  className="font-heading font-bold text-xl text-nuffle-anthracite"
                >
                  {info.title}
                  <span className="ml-2 text-sm font-subtitle font-normal text-nuffle-bronze/70">
                    ({list.length})
                  </span>
                </h2>
                <p className="text-sm text-nuffle-anthracite/75 mt-0.5">
                  {info.blurb}
                </p>
              </div>

              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map((r) => {
                  const meta = getRosterMeta(r.slug);
                  return (
                    <li key={r.slug}>
                      <Link
                        href={`/teams/${r.slug}`}
                        className="group flex h-full gap-3 rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-4 hover:border-nuffle-gold/60 hover:-translate-y-0.5 transition-all"
                      >
                        <TeamLogo slug={r.slug} size={48} title={r.name} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-heading font-bold text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                              {r.name}
                            </span>
                            {r.naf && (
                              <span className="text-[10px] font-bold text-nuffle-gold">
                                NAF
                              </span>
                            )}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center rounded-full border border-nuffle-bronze/30 bg-white/60 px-2 py-0.5 font-subtitle font-semibold text-nuffle-bronze">
                              {PLAYSTYLE_LABELS.fr[meta.playStyle]}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-nuffle-bronze/80">
                              <DifficultyScale rank={DIFFICULTY_RANK[meta.difficulty]} />
                              {DIFFICULTY_LABELS.fr[meta.difficulty]}
                            </span>
                          </span>
                          <span className="mt-1.5 block text-xs text-nuffle-anthracite/75 leading-relaxed">
                            {meta.shortFr}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {/* CTA bas de page */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/teams/comparer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B1610] px-5 py-2.5 text-sm font-subtitle font-bold uppercase tracking-wide text-nuffle-gold ring-1 ring-nuffle-gold/50 hover:bg-[#241c12] transition-colors"
          >
            ⚔️ Comparer deux équipes
          </Link>
          <Link
            href="/teams"
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-nuffle-bronze/40 px-5 py-2.5 text-sm font-subtitle font-bold uppercase tracking-wide text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite transition-colors"
          >
            Toutes les équipes
          </Link>
        </div>
      </div>
    </>
  );
}
