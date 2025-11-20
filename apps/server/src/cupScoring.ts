export type CupScoringConfig = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  touchdownPoints: number;
  blockCasualtyPoints: number;
  foulCasualtyPoints: number;
  passPoints: number;
};

export type CupParticipantTeam = {
  id: string;
  name: string;
  roster: string;
};

export type CupParticipantWithTeam = {
  team: CupParticipantTeam;
};

export type LocalMatchTeam = {
  id: string;
  name: string;
  roster: string;
};

export type LocalMatchActionLike = {
  actionType: string;
  playerTeam: "A" | "B";
  armorBroken: boolean;
  opponentState: string | null;
};

export type LocalMatchWithRelations = {
  id: string;
  status: string;
  teamA: LocalMatchTeam;
  teamB: LocalMatchTeam | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  actions: LocalMatchActionLike[];
};

export type CupWithParticipantsAndScoring = {
  id: string;
  name: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  touchdownPoints: number;
  blockCasualtyPoints: number;
  foulCasualtyPoints: number;
  passPoints: number;
  participants: CupParticipantWithTeam[];
};

export type CupTeamStats = {
  teamId: string;
  teamName: string;
  roster: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  forfeits: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDiff: number;
  passes: number;
  blockCasualties: number;
  foulCasualties: number;
  // Statistiques de sorties subies (utiles pour les récompenses type "Martyrs")
  blockCasualtiesAgainst: number;
  foulCasualtiesAgainst: number;
  totalCasualtiesFor: number;
  totalCasualtiesAgainst: number;
  resultPoints: number;
  actionPoints: number;
  totalPoints: number;
};

export type CupAwardEntry = {
  teamId: string;
  teamName: string;
  roster: string;
  value: number;
};

export type CupAwards = {
  topScorers: CupAwardEntry[]; // Le Pichichi du TD (TD marqués)
  bestDefense: CupAwardEntry[]; // The Wall (TD encaissés minimum)
  bashers: CupAwardEntry[]; // La BASH ! (sorties infligées)
  shamePassers: CupAwardEntry[]; // La Honte (passes)
  foulExperts: CupAwardEntry[]; // Crampons affûtés (sorties sur agression)
  indestructible: CupAwardEntry[]; // Les Indestructibles (sorties subies minimum)
  martyrs: CupAwardEntry[]; // Les Martyrs (sorties subies maximum)
  permeable: CupAwardEntry[]; // Les Perméables (TD encaissés maximum)
};

export type CupStandingsResult = {
  scoringConfig: CupScoringConfig;
  teamStats: CupTeamStats[];
  awards: CupAwards;
};

function makeEmptyStats(team: CupParticipantTeam): CupTeamStats {
  return {
    teamId: team.id,
    teamName: team.name,
    roster: team.roster,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    forfeits: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDiff: 0,
    passes: 0,
    blockCasualties: 0,
    foulCasualties: 0,
    blockCasualtiesAgainst: 0,
    foulCasualtiesAgainst: 0,
    totalCasualtiesFor: 0,
    totalCasualtiesAgainst: 0,
    resultPoints: 0,
    actionPoints: 0,
    totalPoints: 0,
  };
}

/**
 * Calcule le classement d'une coupe à partir de la configuration de points
 * et des matchs locaux complétés associés à cette coupe.
 *
 * Important : cette fonction ne persiste rien en base, elle ne fait que
 * dériver des statistiques à partir des données fournies.
 */
export function computeCupStandings(
  cup: CupWithParticipantsAndScoring,
  matches: LocalMatchWithRelations[],
): CupStandingsResult {
  const scoringConfig: CupScoringConfig = {
    winPoints: cup.winPoints,
    drawPoints: cup.drawPoints,
    lossPoints: cup.lossPoints,
    forfeitPoints: cup.forfeitPoints,
    touchdownPoints: cup.touchdownPoints,
    blockCasualtyPoints: cup.blockCasualtyPoints,
    foulCasualtyPoints: cup.foulCasualtyPoints,
    passPoints: cup.passPoints,
  };

  const statsByTeam = new Map<string, CupTeamStats>();

  // Initialiser les stats pour toutes les équipes participantes,
  // même si elles n'ont pas encore joué de match.
  for (const participant of cup.participants) {
    const team = participant.team;
    if (!team) continue;
    if (!statsByTeam.has(team.id)) {
      statsByTeam.set(team.id, makeEmptyStats(team));
    }
  }

  for (const match of matches) {
    if (!match.teamA || !match.teamB) continue;

    const teamA =
      statsByTeam.get(match.teamA.id) ??
      (() => {
        const created = makeEmptyStats(match.teamA);
        statsByTeam.set(match.teamA.id, created);
        return created;
      })();

    const teamB =
      statsByTeam.get(match.teamB.id) ??
      (() => {
        const created = makeEmptyStats(match.teamB as LocalMatchTeam);
        statsByTeam.set(match.teamB!.id, created);
        return created;
      })();

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;

    const scoreA = match.scoreTeamA ?? 0;
    const scoreB = match.scoreTeamB ?? 0;

    teamA.touchdownsFor += scoreA;
    teamA.touchdownsAgainst += scoreB;
    teamB.touchdownsFor += scoreB;
    teamB.touchdownsAgainst += scoreA;

    if (scoreA > scoreB) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (scoreB > scoreA) {
      teamB.wins += 1;
      teamA.losses += 1;
    } else {
      teamA.draws += 1;
      teamB.draws += 1;
    }

    for (const action of match.actions || []) {
      const targetTeam =
        action.playerTeam === "A"
          ? teamA
          : action.playerTeam === "B"
            ? teamB
            : null;

      if (!targetTeam) continue;

      switch (action.actionType) {
        case "passe":
          targetTeam.passes += 1;
          break;
        case "blocage":
        case "blitz":
          if (action.armorBroken && action.opponentState === "elimine") {
            targetTeam.blockCasualties += 1;
            // Une sortie sur bloc/blitz infligée est une sortie subie pour l'équipe adverse
            const opponentTeam =
              targetTeam.teamId === teamA.teamId ? teamB : teamA;
            opponentTeam.blockCasualtiesAgainst += 1;
          }
          break;
        case "aggression":
          if (action.opponentState === "elimine") {
            targetTeam.foulCasualties += 1;
            const opponentTeam =
              targetTeam.teamId === teamA.teamId ? teamB : teamA;
            opponentTeam.foulCasualtiesAgainst += 1;
          }
          break;
        default:
          break;
      }
    }
  }

  const teamStats: CupTeamStats[] = [];

  for (const stats of statsByTeam.values()) {
    stats.touchdownDiff = stats.touchdownsFor - stats.touchdownsAgainst;

    stats.totalCasualtiesFor = stats.blockCasualties + stats.foulCasualties;
    stats.totalCasualtiesAgainst =
      stats.blockCasualtiesAgainst + stats.foulCasualtiesAgainst;

    stats.resultPoints =
      stats.wins * scoringConfig.winPoints +
      stats.draws * scoringConfig.drawPoints +
      stats.losses * scoringConfig.lossPoints +
      stats.forfeits * scoringConfig.forfeitPoints;

    stats.actionPoints =
      stats.touchdownsFor * scoringConfig.touchdownPoints +
      stats.blockCasualties * scoringConfig.blockCasualtyPoints +
      stats.foulCasualties * scoringConfig.foulCasualtyPoints +
      stats.passes * scoringConfig.passPoints;

    stats.totalPoints = stats.resultPoints + stats.actionPoints;

    teamStats.push({ ...stats });
  }

  teamStats.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.touchdownDiff !== a.touchdownDiff) {
      return b.touchdownDiff - a.touchdownDiff;
    }
    if (b.touchdownsFor !== a.touchdownsFor) {
      return b.touchdownsFor - a.touchdownsFor;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.teamName.localeCompare(b.teamName);
  });

  // Construire les "podiums" par pôle d'actions
  const asAwardEntries = (
    source: CupTeamStats[],
    pick: (s: CupTeamStats) => number,
    opts?: { reverse?: boolean },
  ): CupAwardEntry[] => {
    const arr = [...source].filter(
      (s) => pick(s) !== undefined && pick(s) !== null,
    );
    if (arr.length === 0) return [];
    arr.sort((a, b) =>
      (opts?.reverse ? pick(a) - pick(b) : pick(b) - pick(a)) ||
      a.teamName.localeCompare(b.teamName),
    );
    const topValue = pick(arr[0]);
    if (topValue === 0) {
      // Si tout le monde est à 0, on ne renvoie rien pour ce podium
      return [];
    }
    const result: CupAwardEntry[] = [];
    for (const s of arr) {
      const value = pick(s);
      if (opts?.reverse) {
        if (value !== topValue) break;
      } else if (value < topValue) {
        break;
      }
      result.push({
        teamId: s.teamId,
        teamName: s.teamName,
        roster: s.roster,
        value,
      });
    }
    return result;
  };

  const awards: CupAwards = {
    // Le Pichichi du TD : meilleures attaques (TD marqués)
    topScorers: asAwardEntries(teamStats, (s) => s.touchdownsFor),
    // The Wall : meilleure défense (TD encaissés minimum)
    bestDefense: asAwardEntries(teamStats, (s) => s.touchdownsAgainst, {
      reverse: true,
    }),
    // La BASH ! : plus de sorties infligées (toutes causes)
    bashers: asAwardEntries(teamStats, (s) => s.totalCasualtiesFor),
    // La Honte : plus gros lanceurs de ballons (passes)
    shamePassers: asAwardEntries(teamStats, (s) => s.passes),
    // Crampons affûtés : sorties sur agression
    foulExperts: asAwardEntries(teamStats, (s) => s.foulCasualties),
    // Les Indestructibles : équipes qui ont subi le moins de sorties
    indestructible: asAwardEntries(
      teamStats,
      (s) => s.totalCasualtiesAgainst,
      { reverse: true },
    ),
    // Les Martyrs : équipes qui ont subi le plus de sorties
    martyrs: asAwardEntries(teamStats, (s) => s.totalCasualtiesAgainst),
    // Les Perméables : équipes qui encaissent le plus de TD
    permeable: asAwardEntries(teamStats, (s) => s.touchdownsAgainst),
  };

  return {
    scoringConfig,
    teamStats,
    awards,
  };
}


