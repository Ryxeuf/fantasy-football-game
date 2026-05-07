"use client";

import MatchReplayPlayer from "./MatchReplayPlayer";

interface ReplayPageProps {
  readonly params: { id: string };
}

/**
 * Sprint 1.G.2 — Page replay d'un match Pro League completed.
 *
 * Consomme `/pro-league/matches/:id/replay` et permet la lecture
 * controlee via play/pause/scrub/speed. Pour les matchs en cours,
 * le hub redirige vers `/live` (logique 1.G.3).
 */
export default function MatchReplayPage({
  params,
}: ReplayPageProps): JSX.Element {
  return <MatchReplayPlayer matchId={params.id} />;
}
