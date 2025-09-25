import { makeRNG, setupPreMatchWithTeams, TeamPlayerData } from "@bb/game-engine";

type PrismaLike = {
  match: { findUnique: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  teamSelection: { findMany: (args: any) => Promise<any[]>; findFirst: (args: any) => Promise<any | null> };
  turn: { findMany: (args: any) => Promise<any[]>; count: (args: any) => Promise<number>; create: (args: any) => Promise<any> };
  team: { findUnique: (args: any) => Promise<any> };
  teamPlayer: { findMany: (args: any) => Promise<any[]> };
};

export async function acceptAndMaybeStartMatch(prisma: PrismaLike, params: { matchId: string; userId: string }) {
  const { matchId, userId } = params;
  const mySelection = await prisma.teamSelection.findFirst({ where: { matchId, userId } });
  if (!mySelection) return { ok: false, error: "Vous devez d'abord sélectionner une équipe", status: 400 } as const;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "Partie introuvable", status: 404 } as const;
  if (match.status !== "pending") return { ok: false, error: `Statut invalide: ${match.status}`, status: 400 } as const;

  const turnsBefore = await prisma.turn.findMany({ where: { matchId } });
  const alreadyAccepted = turnsBefore.some(t => (t as any).payload?.type === 'accept' && (t as any).payload?.userId === userId);
  if (!alreadyAccepted) {
    const nextNumber = (await prisma.turn.count({ where: { matchId } })) + 1;
    await prisma.turn.create({ data: { matchId, number: nextNumber, payload: { type: 'accept', userId, at: new Date().toISOString() } as any } });
  }

  const selections = await prisma.teamSelection.findMany({ where: { matchId }, orderBy: { createdAt: 'asc' } });
  if (selections.length < 2) return { ok: true, status: 'waiting_other_player' } as const;

  const [s1, s2] = selections;
  if (s1.userId === s2.userId) return { ok: false, error: "Deux coachs distincts sont requis", status: 400 } as const;
  const differentTeams = (s1.teamId && s2.teamId && s1.teamId !== s2.teamId) || (s1.team && s2.team && s1.team !== s2.team) || (!!s1.teamId !== !!s2.teamId) || (!!s1.team !== !!s2.team);
  if (!differentTeams) return { ok: false, error: "Deux équipes différentes sont requises", status: 400 } as const;

  const acceptances = (await prisma.turn.findMany({ where: { matchId } })).filter(t => (t as any).payload?.type === 'accept');
  const acceptedUserIds = Array.from(new Set(acceptances.map(t => (t as any).payload?.userId).filter(Boolean)));
  if (acceptedUserIds.length < 2) return { ok: true, status: 'waiting_other_accept' } as const;

  const rng = makeRNG(match.seed);
  const toss = rng() < 0.5 ? s1.userId : s2.userId;
  const kickingUserId = toss;
  const receivingUserId = kickingUserId === s1.userId ? s2.userId : s1.userId;

  // Récupérer les données des équipes sélectionnées
  const teamAId = s1.teamId || (s1.team as string);
  const teamBId = s2.teamId || (s2.team as string);
  
  const [teamA, teamB] = await Promise.all([
    prisma.team.findUnique({ 
      where: { id: teamAId }, 
      include: { players: true } 
    }),
    prisma.team.findUnique({ 
      where: { id: teamBId }, 
      include: { players: true } 
    })
  ]);

  if (!teamA || !teamB) {
    return { ok: false, error: "Équipes introuvables", status: 404 } as const;
  }

  // Convertir les données des joueurs
  const teamAData: TeamPlayerData[] = teamA.players.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    number: p.number,
    ma: p.ma,
    st: p.st,
    ag: p.ag,
    pa: p.pa,
    av: p.av,
    skills: p.skills || '',
  }));

  const teamBData: TeamPlayerData[] = teamB.players.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    number: p.number,
    ma: p.ma,
    st: p.st,
    ag: p.ag,
    pa: p.pa,
    av: p.av,
    skills: p.skills || '',
  }));

  // Initialiser l'état du jeu en phase pré-match avec les vraies équipes
  const gameState = setupPreMatchWithTeams(teamAData, teamBData, teamA.name, teamB.name);
  
  const nextNumber = (await prisma.turn.count({ where: { matchId } })) + 1;
  await prisma.turn.create({ 
    data: { 
      matchId, 
      number: nextNumber, 
      payload: { 
        type: 'prematch', 
        coinTossWinnerUserId: toss, 
        kickingUserId, 
        receivingUserId, 
        gameState,
        at: new Date().toISOString() 
      } as any 
    } 
  });

  await prisma.match.update({ where: { id: matchId }, data: { status: 'prematch' } });
  return { ok: true, status: 'prematch', kickingUserId, receivingUserId } as const;
}


