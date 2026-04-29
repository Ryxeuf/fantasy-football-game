import type { CoachPublicProfile } from "./types";

interface CoachProfileHeaderProps {
  profile: CoachPublicProfile;
}

function formatJoinedYear(memberSinceIso: string): string {
  const d = new Date(memberSinceIso);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getUTCFullYear());
}

export default function CoachProfileHeader({
  profile,
}: CoachProfileHeaderProps): JSX.Element {
  const supporterLabel = profile.supporterTier
    ? `Supporter ${profile.supporterTier}`
    : "Supporter";
  return (
    <header className="bg-gradient-to-br from-nuffle-anthracite to-gray-800 text-white rounded-xl p-6 shadow-lg">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold font-heading truncate">
            {profile.coachName}
          </h1>
          <p
            data-testid="coach-member-since"
            className="text-sm text-gray-300 mt-1"
          >
            Membre depuis {formatJoinedYear(profile.memberSince)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-nuffle-gold/15 border border-nuffle-gold rounded-lg px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-nuffle-gold">
              ELO
            </p>
            <p
              data-testid="coach-elo"
              className="text-xl font-bold leading-none"
            >
              {profile.eloRating}
            </p>
          </div>
          {profile.isSupporter && (
            <span
              data-testid="coach-supporter-badge"
              className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 px-3 py-1 text-xs font-bold uppercase tracking-wide"
            >
              <span aria-hidden>★</span> {supporterLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
