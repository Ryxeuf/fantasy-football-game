import { notFound } from "next/navigation";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import CoachAchievementsShowcase from "./CoachAchievementsShowcase";
import CoachProfileHeader from "./CoachProfileHeader";
import type { CoachPublicProfile } from "./types";

// SEO bonus (S26.3 DoD) : la page doit etre indexable. ISR 60 minutes :
// les profils publics changent peu (ELO, statut supporter), 1h reste
// raisonnable et reduit la charge backend.
export const revalidate = 3600;

interface CoachPageProps {
  params: { slug: string };
}

interface CoachApiEnvelope {
  success?: boolean;
  data?: CoachPublicProfile;
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

export default async function CoachProfilePage({
  params,
}: CoachPageProps): Promise<JSX.Element> {
  const profile = await fetchCoachProfile(params.slug);
  if (!profile) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <CoachProfileHeader profile={profile} />
      <CoachAchievementsShowcase achievements={profile.achievements} />
      <p className="text-sm text-gray-500 italic">
        Profil public. Plus de detail (graph ELO 90j, equipes recentes,
        export PDF) viendra dans les prochaines slices de S26.3.
      </p>
    </main>
  );
}
