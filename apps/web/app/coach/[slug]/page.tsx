import { notFound } from "next/navigation";
import { fetchServerJson, getServerApiBase, safeServerJson } from "../../lib/serverApi";
import CoachAchievementsShowcase from "./CoachAchievementsShowcase";
import CoachChampionshipsBanner from "./CoachChampionshipsBanner";
import CoachCupChampionshipsBanner from "./CoachCupChampionshipsBanner";
import CoachLeagueChampionshipsBanner from "./CoachLeagueChampionshipsBanner";
import CoachEloChart from "./CoachEloChart";
import CoachExportPdfButton from "./CoachExportPdfButton";
import CoachProfileHeader from "./CoachProfileHeader";
import CoachRecentTeams from "./CoachRecentTeams";
import type { CoachEloSnapshot, CoachPublicProfile } from "./types";

// SEO bonus (S26.3 DoD) : la page doit etre indexable. ISR 60 minutes :
// les profils publics changent peu (ELO, statut supporter), 1h reste
// raisonnable et reduit la charge backend.
export const revalidate = 3600;

const ELO_HISTORY_DAYS = 90;

interface CoachPageProps {
  params: { slug: string };
}

interface CoachApiEnvelope {
  success?: boolean;
  data?: CoachPublicProfile;
  error?: string;
}

interface CoachEloHistoryEnvelope {
  success?: boolean;
  data?: { snapshots?: CoachEloSnapshot[] };
  error?: string;
}

async function fetchCoachProfile(
  slug: string,
): Promise<CoachPublicProfile | null> {
  const base = getServerApiBase();
  const envelope = await fetchServerJson<CoachApiEnvelope>(
    `${base}/coach/${encodeURIComponent(slug)}`,
    { next: { revalidate: 3600 } },
  );
  if (!envelope || envelope.success !== true || !envelope.data) {
    return null;
  }
  return envelope.data;
}

// S26.3n — Charge la courbe ELO 90j en parallele du profil. La degradation
// douce (`safeServerJson`) protege la page : si l'historique echoue, on
// rend le profil sans la courbe plutot qu'une erreur 500.
async function fetchEloHistory(slug: string): Promise<CoachEloSnapshot[]> {
  const base = getServerApiBase();
  const envelope = await safeServerJson<CoachEloHistoryEnvelope>(
    `${base}/coach/${encodeURIComponent(slug)}/elo-history?days=${ELO_HISTORY_DAYS}`,
    { next: { revalidate: 3600 } },
  );
  if (!envelope || envelope.success !== true) return [];
  const snapshots = envelope.data?.snapshots;
  return Array.isArray(snapshots) ? snapshots : [];
}

export default async function CoachProfilePage({
  params,
}: CoachPageProps): Promise<JSX.Element> {
  // Parallelise les deux fetches : si le profil n'existe pas on rend un
  // 404 et l'historique vide est ignore. Pas de cout supplementaire.
  const [profile, eloSnapshots] = await Promise.all([
    fetchCoachProfile(params.slug),
    fetchEloHistory(params.slug),
  ]);
  if (!profile) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <CoachProfileHeader profile={profile} />
      <CoachChampionshipsBanner championships={profile.championships} />
      <CoachCupChampionshipsBanner cupChampionships={profile.cupChampionships} />
      <CoachLeagueChampionshipsBanner
        leagueChampionships={profile.leagueChampionships}
      />
      <CoachEloChart snapshots={eloSnapshots} />
      <CoachAchievementsShowcase achievements={profile.achievements} />
      <CoachRecentTeams teams={profile.recentTeams} />
      <CoachExportPdfButton profile={profile} eloSnapshots={eloSnapshots} />
      <p className="text-sm text-gray-500 italic">
        Profil public. PDF inclut header, courbe ELO 90j, succes recents et
        equipes recentes (sans la liste des joueurs).
      </p>
    </main>
  );
}
