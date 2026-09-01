import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchServerJson, safeServerJson, getServerApiBase } from "../../lib/serverApi";
import { prettifySlug } from "../../lib/roster-display";
import { rosterPlayersOf } from "../../lib/roster-players";
import {
  buildRosterShareDescription,
  buildRosterShareTitle,
} from "../../lib/roster-share-text";
import { fetchSkillsCatalog } from "../../lib/skills-catalog.server";
import { SkillsCatalogProvider } from "../../me/teams/skills-catalog-context";
import type { RosterPositionLike } from "../../me/teams/[id]/roster-skill-access";
import type { PlayerValueView } from "../../me/teams/[id]/roster-player-value";
import ShareBar from "../../components/ShareBar";
import TeamLogo from "../../components/TeamLogo";
import PublicRosterTable from "./PublicRosterTable";
import { buildStaffLines } from "./staff-lines";

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
  pa: number | null;
  av: number;
  skills: unknown;
  dead?: boolean;
  /** Sorti du roster (licencié, ou tué depuis la règle de fin de match). */
  firedAt?: string | null;
  imageUrl?: string | null;
  /** Repli de valorisation si `playerValues` manque (cf. API). */
  advancements?: string | null;
}
interface PublicStarPlayer {
  id: string;
  starPlayerSlug: string;
  cost: number;
}
/**
 * Coûts unitaires du staff, servis par l'API. Optionnels : un serveur
 * pré-correctif ne les rend pas (cf. « Backwards-compat sur champs API
 * ajoutes »), les défauts de `staff-lines` prennent alors le relais.
 */
interface PublicStaffConfig {
  rerollCost?: number;
  cheerleaderCost?: number;
  assistantCost?: number;
  apothecaryCost?: number;
  dedicatedFanCost?: number;
}
/** Postes de dépense totalisés par le serveur (mêmes chiffres que la VE). */
interface PublicBudgetSummary {
  playersCost?: number;
  starPlayersCost?: number;
  staffCost?: number;
  rerollsCost?: number;
  dedicatedFansCost?: number;
  teamValue?: number;
  currentValue?: number;
  /** Valeur des joueurs indisponibles au prochain match (VE − VEA). */
  unavailablePlayersCost?: number;
  /** Embauches annulées dans la VEA par « Trois-quarts à vil prix ». */
  cheapLinemenWaived?: number;
}
interface PublicTeam {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  teamValue: number;
  currentValue?: number;
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  /** Fluff saisi par le coach. Sert de texte d'aperçu au partage. */
  description?: string | null;
  logoUrl?: string | null;
  players: PublicPlayer[];
  starPlayers: PublicStarPlayer[];
  staffConfig?: PublicStaffConfig;
  budgetSummary?: PublicBudgetSummary;
  playerValues?: Record<string, PlayerValueView>;
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

/**
 * Détail du roster de l'équipe : libellés de poste, compétences PAR DÉFAUT
 * (base vs acquise), accès primaire/secondaire et tarifs d'embauche. Même
 * source que la fiche du coach (`/api/rosters/:slug`), pour que les deux
 * pages ne divergent pas.
 *
 * Non bloquant : sans lui, l'effectif reste affiché avec les libellés du
 * catalogue compilé en repli.
 */
async function fetchRosterPositions(
  slug: string,
  ruleset: string,
): Promise<RosterPositionLike[] | null> {
  const base = getServerApiBase();
  const data = await safeServerJson<{ roster?: { positions?: RosterPositionLike[] } }>(
    `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=${encodeURIComponent(ruleset)}`,
    { next: { revalidate: 3600, tags: ["rosters", `roster:${slug}`] } },
  );
  return data?.roster?.positions ?? null;
}

function formatGold(value: number): string {
  return value.toLocaleString("fr-FR");
}

/** « 130 000 po » → « 130K po » (même convention que la fiche du coach). */
function formatKpo(valuePo: number): string {
  return `${Math.round(valuePo / 1000).toLocaleString("fr-FR")}K po`;
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const team = await fetchPublicTeam(params.token, false);
  const url = `${SITE_URL}/r/${params.token}`;
  if (!team) {
    return { title: "Équipe introuvable", robots: { index: false, follow: true } };
  }
  const race = prettifySlug(team.roster);
  // `title` passe par le `title.template` de `app/layout.tsx` (« %s | Nuffle
  // Arena ») ; `og:title` NON — ce template ne s'applique qu'a `<title>`.
  // On y ecrit donc le nom du site explicitement, car c'est `og:title` que
  // Discord, Slack et X affichent.
  const title = `${team.name} — Équipe Blood Bowl (${race})`;
  const shareTitle = buildRosterShareTitle({ teamName: team.name, raceName: race });
  const description = buildRosterShareDescription({
    teamName: team.name,
    raceName: race,
    playerCount: rosterPlayersOf(team.players).length,
    teamValue: team.teamValue,
    description: team.description,
  });
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: shareTitle,
      description,
      type: "article",
      url,
      siteName: "Nuffle Arena",
    },
    twitter: { card: "summary_large_image", title: shareTitle, description },
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
  // `!p.dead` seul laissait un LICENCIÉ dans l'effectif public : le filtre
  // canonique porte sur `firedAt` (cf. `lib/roster-players`).
  const livePlayers = rosterPlayersOf(team.players);

  // Détail roster + catalogue de compétences en parallèle : ils n'alimentent
  // que l'affichage de l'effectif, et aucun des deux ne doit retarder l'autre.
  const [positions, skillsCatalog] = await Promise.all([
    fetchRosterPositions(team.roster, team.ruleset),
    fetchSkillsCatalog(team.ruleset),
  ]);

  const staffLines = buildStaffLines({
    roster: team.roster,
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    dedicatedFans: team.dedicatedFans,
    staffConfig: team.staffConfig,
    budgetSummary: team.budgetSummary,
  });

  const currentValue = team.budgetSummary?.currentValue ?? team.currentValue ?? null;
  const playersCost = team.budgetSummary?.playersCost ?? null;
  const starPlayersCost = team.budgetSummary?.starPlayersCost ?? null;
  // Écart VE → VEA, servi par le serveur et jamais re-dérivé ici. Une VEA
  // inférieure à la VE sur une équipe qui n'a joué aucun match n'a que deux
  // causes : des joueurs indisponibles, ou « Trois-quarts à vil prix » qui
  // annule leur coût d'embauche. La fiche du coach les affiche déjà
  // (`tv-ctv-gap`) ; sans elles ici, l'écart passe pour une erreur de calcul
  // sur la seule surface que des inconnus consultent.
  const unavailablePlayersCost = team.budgetSummary?.unavailablePlayersCost ?? 0;
  const cheapLinemenWaived = team.budgetSummary?.cheapLinemenWaived ?? 0;

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* En-tête */}
      <header className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
        <div className="flex items-start gap-4 sm:gap-6">
          {/* Logo du coach quand il existe, sinon l'emblème programmatique
              du roster — l'équipe est toujours identifiable d'un coup d'œil. */}
          <TeamLogo
            slug={team.roster}
            logoUrl={team.logoUrl}
            size={80}
            title={`Logo de ${team.name}`}
            className="shrink-0 rounded-xl bg-white/60 ring-1 ring-nuffle-bronze/20 p-1"
          />
          <div className="min-w-0">
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
          </div>
        </div>

        {/* Fluff du coach : c'est aussi le texte servi dans l'apercu de
            partage, il doit donc etre lisible sur la page elle-meme. */}
        {team.description ? (
          <blockquote
            data-testid="public-team-description"
            className="mt-5 border-l-4 border-nuffle-gold/60 bg-white/50 rounded-r-xl px-4 py-3 max-w-3xl whitespace-pre-line font-body text-sm sm:text-base leading-relaxed text-nuffle-anthracite/80"
          >
            {team.description}
          </blockquote>
        ) : null}

        <div className="mt-5">
          <ShareBar url={shareUrl} title={`${team.name} — mon équipe Blood Bowl sur Nuffle Arena`} />
        </div>
      </header>

      {/* Effectif */}
      <section className="mt-8">
        <h2 className="font-heading font-bold text-xl text-nuffle-anthracite mb-3">
          Effectif <span className="text-nuffle-bronze/70 text-base">({livePlayers.length})</span>
        </h2>
        {/* Catalogue résolu côté serveur : les noms de compétences sont
            corrects dès le HTML initial, sans flash slug → libellé. */}
        <SkillsCatalogProvider value={skillsCatalog}>
          <PublicRosterTable
            players={livePlayers}
            rosterSlug={team.roster}
            ruleset={team.ruleset}
            positions={positions}
            playerValues={team.playerValues}
          />
        </SkillsCatalogProvider>
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

      {/* Staff & finances */}
      <section className="mt-8" data-testid="public-team-staff">
        <h2 className="font-heading font-bold text-xl text-nuffle-anthracite mb-3">Staff de l&apos;équipe</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {staffLines.map((line) => (
            <div
              key={line.key}
              data-testid={`public-staff-${line.key}`}
              className="rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-3 text-center"
            >
              <div className="font-score text-2xl text-nuffle-bronze leading-none">{line.value}</div>
              <div className="mt-1 text-[10px] font-subtitle uppercase tracking-wider text-nuffle-anthracite/55">
                {line.label}
              </div>
              {/* Le coût n'est affiché que si le poste a été acheté : une
                  ligne « 0K po » n'apprend rien au visiteur. */}
              {line.costPo !== null ? (
                <div className="mt-1 text-[11px] font-body text-nuffle-anthracite/70">
                  {formatKpo(line.costPo)}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: "teamValue", label: "Valeur d'équipe", value: formatKpo(team.teamValue) },
            ...(currentValue !== null
              ? [{ key: "currentValue", label: "VE actuelle", value: formatKpo(currentValue) }]
              : []),
            { key: "treasury", label: "Trésorerie", value: formatKpo(team.treasury) },
            ...(playersCost !== null
              ? [{ key: "playersCost", label: "Coût de l'effectif", value: formatKpo(playersCost) }]
              : []),
            ...(starPlayersCost ? [{ key: "starPlayersCost", label: "Star Players", value: formatKpo(starPlayersCost) }] : []),
          ].map((tile) => (
            <div
              key={tile.key}
              data-testid={`public-finance-${tile.key}`}
              className="rounded-xl bg-[#1B1610]/[0.04] border border-nuffle-bronze/20 p-3 text-center"
            >
              <div className="font-score text-xl text-nuffle-anthracite leading-none">{tile.value}</div>
              <div className="mt-1 text-[10px] font-subtitle uppercase tracking-wider text-nuffle-anthracite/55">
                {tile.label}
              </div>
            </div>
          ))}
        </div>

        {unavailablePlayersCost > 0 || cheapLinemenWaived > 0 ? (
          <div
            data-testid="public-vea-gap"
            className="mt-3 rounded-xl border border-nuffle-bronze/20 bg-[#FBF7EC] p-3 font-body text-xs text-nuffle-anthracite/80"
          >
            <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-nuffle-anthracite/55">
              Pourquoi la VE actuelle diffère de la valeur d&apos;équipe
            </p>
            {cheapLinemenWaived > 0 ? (
              <div className="mt-1.5 flex justify-between gap-2">
                <span>Trois-quarts à vil prix (embauches à 0)</span>
                <span
                  data-testid="public-vea-gap-cheap-linemen"
                  className="whitespace-nowrap font-mono"
                >
                  −{formatKpo(cheapLinemenWaived)}
                </span>
              </div>
            ) : null}
            {unavailablePlayersCost > 0 ? (
              <div className="mt-1 flex justify-between gap-2">
                <span>Joueurs indisponibles au prochain match</span>
                <span
                  data-testid="public-vea-gap-unavailable"
                  className="whitespace-nowrap font-mono"
                >
                  −{formatKpo(unavailablePlayersCost)}
                </span>
              </div>
            ) : null}
            {cheapLinemenWaived > 0 ? (
              <p className="mt-1.5 text-[11px] text-nuffle-anthracite/60">
                Cette équipe traite le Coût d&apos;Embauche de ses Trois-quarts
                comme nul dans la VE actuelle ; leurs augmentations de valeur
                restent comptées.
              </p>
            ) : null}
          </div>
        ) : null}
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
