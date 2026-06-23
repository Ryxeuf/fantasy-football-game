import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchServerJson, safeServerJson, getServerApiBase } from "../../lib/serverApi";
import { prettifySlug, parseSkillList } from "../../lib/roster-display";
import ShareBar from "../../components/ShareBar";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr").replace(/\/$/, "");

// ISR : un roster partagé change peu. Pas de generateStaticParams (les
// tokens sont privés/opt-in) — rendu à la demande puis caché.
export const revalidate = 600;

interface PublicPlayer {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: unknown;
  dead?: boolean;
}
interface PublicStarPlayer {
  id: string;
  starPlayerSlug: string;
  cost: number;
}
interface PublicTeam {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  teamValue: number;
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  players: PublicPlayer[];
  starPlayers: PublicStarPlayer[];
}

const RULESET_LABELS: Record<string, string> = {
  season_2: "Saison 2 (2020)",
  season_3: "Saison 3 (2025)",
};

async function fetchPublicTeam(token: string, throwing: boolean): Promise<PublicTeam | null> {
  const base = getServerApiBase();
  const url = `${base}/api/public/teams/${encodeURIComponent(token)}`;
  const fetcher = throwing ? fetchServerJson : safeServerJson;
  const data = await fetcher<{ team?: PublicTeam }>(url, { next: { revalidate: 600 } });
  return data?.team ?? null;
}

function formatGold(value: number): string {
  return value.toLocaleString("fr-FR");
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const team = await fetchPublicTeam(params.token, false);
  const url = `${SITE_URL}/r/${params.token}`;
  if (!team) {
    return { title: "Équipe introuvable", robots: { index: false, follow: true } };
  }
  const race = prettifySlug(team.roster);
  const title = `${team.name} — Équipe Blood Bowl (${race})`;
  const description = `Découvrez ${team.name}, équipe ${race} Blood Bowl : ${team.players.length} joueurs, valeur d'équipe ${formatGold(team.teamValue)} po. Composée sur Nuffle Arena.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url, siteName: "Nuffle Arena" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicRosterPage({ params }: { params: { token: string } }) {
  const team = await fetchPublicTeam(params.token, true);
  if (!team) {
    notFound();
  }
  const race = prettifySlug(team.roster);
  const rulesetLabel = RULESET_LABELS[team.ruleset] ?? team.ruleset;
  const shareUrl = `${SITE_URL}/r/${params.token}`;
  const livePlayers = team.players.filter((p) => !p.dead);

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* En-tête */}
      <header className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
        <p className="font-subtitle text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-nuffle-gold/90">
          Équipe partagée
        </p>
        <h1 className="mt-2 font-heading font-bold text-3xl sm:text-4xl text-nuffle-anthracite leading-tight">
          {team.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-nuffle-bronze/30 bg-white/50 px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze">
            {race}
          </span>
          <span className="inline-flex items-center rounded-full border border-nuffle-gold/40 bg-nuffle-gold/10 px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze">
            {rulesetLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-[#1B1610] px-3 py-0.5 text-xs font-subtitle font-bold uppercase tracking-wide text-nuffle-gold ring-1 ring-nuffle-gold/40">
            VE {formatGold(team.teamValue)} po
          </span>
        </div>

        <div className="mt-5">
          <ShareBar url={shareUrl} title={`${team.name} — mon équipe Blood Bowl sur Nuffle Arena`} />
        </div>
      </header>

      {/* Effectif */}
      <section className="mt-8">
        <h2 className="font-heading font-bold text-xl text-nuffle-anthracite mb-3">
          Effectif <span className="text-nuffle-bronze/70 text-base">({livePlayers.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nuffle-bronze/20 text-left text-xs font-subtitle uppercase tracking-wide text-nuffle-bronze/70">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Joueur</th>
                <th className="px-4 py-3">Poste</th>
                <th className="px-3 py-3 text-center">MA</th>
                <th className="px-3 py-3 text-center">ST</th>
                <th className="px-3 py-3 text-center">AG</th>
                <th className="px-3 py-3 text-center">PA</th>
                <th className="px-3 py-3 text-center">AV</th>
                <th className="px-4 py-3">Compétences</th>
              </tr>
            </thead>
            <tbody>
              {livePlayers
                .slice()
                .sort((a, b) => a.number - b.number)
                .map((p) => (
                  <tr key={p.id} className="border-b border-nuffle-bronze/10 last:border-0">
                    <td className="px-4 py-2.5 font-score text-lg text-nuffle-bronze">{p.number}</td>
                    <td className="px-4 py-2.5 font-subtitle font-semibold text-nuffle-anthracite">{p.name}</td>
                    <td className="px-4 py-2.5 text-nuffle-anthracite/75">{prettifySlug(p.position)}</td>
                    <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.ma}</td>
                    <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.st}</td>
                    <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.ag}+</td>
                    <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.pa ? `${p.pa}+` : "–"}</td>
                    <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.av}+</td>
                    <td className="px-4 py-2.5 text-nuffle-anthracite/70 text-xs">
                      {parseSkillList(p.skills).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Star Players */}
      {team.starPlayers.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading font-bold text-xl text-nuffle-anthracite mb-3">Star Players</h2>
          <ul className="flex flex-wrap gap-2.5">
            {team.starPlayers.map((sp) => (
              <li
                key={sp.id}
                className="inline-flex items-center gap-2 rounded-full bg-[#1B1610] px-4 py-2 text-sm font-subtitle font-semibold text-nuffle-gold ring-1 ring-nuffle-gold/40"
              >
                <span aria-hidden="true">★</span>
                {prettifySlug(sp.starPlayerSlug)}
                <span className="text-nuffle-gold/60">· {formatGold(sp.cost)} po</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Inducements / staff */}
      <section className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Relances", value: team.rerolls },
          { label: "Pom-pom", value: team.cheerleaders },
          { label: "Assistants", value: team.assistants },
          { label: "Apothicaire", value: team.apothecary ? "Oui" : "Non" },
          { label: "Fans dévoués", value: team.dedicatedFans },
          { label: "Trésorerie", value: `${formatGold(team.treasury)} po` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-3 text-center">
            <div className="font-score text-2xl text-nuffle-bronze leading-none">{s.value}</div>
            <div className="mt-1 text-[10px] font-subtitle uppercase tracking-wider text-nuffle-anthracite/55">{s.label}</div>
          </div>
        ))}
      </section>

      {/* CTA acquisition */}
      <section className="mt-10 mb-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#1B1610] text-nuffle-ivory ring-1 ring-nuffle-gold/50 p-6 sm:p-8 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(115deg,transparent,transparent_40px,#E8C96A_40px,#E8C96A_41px)]"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="font-heading font-bold text-2xl bg-gradient-to-br from-[#F3Dd92] via-nuffle-gold to-[#a8852b] bg-clip-text text-transparent">
              À toi de jouer, coach.
            </h2>
            <p className="mt-2 text-nuffle-ivory/75 font-body text-sm sm:text-base">
              Crée ta propre équipe Blood Bowl gratuitement sur Nuffle Arena : 31 rosters, 60+ Star Players, export PDF.
            </p>
            <a
              href="/me/teams"
              className="mt-5 inline-flex px-8 py-3.5 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_8px_28px_rgba(203,161,53,0.4)] hover:-translate-y-0.5 transition-all"
            >
              Créer mon équipe
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
