import { serverLog } from "../utils/server-log";

type PrismaLike = {
  match: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  turn: {
    count: (args: any) => Promise<number>;
    create: (args: any) => Promise<any>;
  };
};

export type CancelResult =
  | { ok: true; status: "cancelled" }
  | { ok: false; error: string; status: number };

/**
 * Annule un match en attente (status === "pending").
 *
 * Le match doit etre en attente (pas encore demarre) et l'utilisateur doit etre
 * inscrit comme joueur du match. Une fois annule, le match passe au status
 * "cancelled" et un turn d'audit est cree pour tracer qui a annule.
 */
export async function cancelMatch(
  prisma: PrismaLike,
  params: { matchId: string; userId: string },
): Promise<CancelResult> {
  const { matchId, userId } = params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: { select: { id: true } } },
  });

  if (!match) {
    return { ok: false, error: "Partie introuvable", status: 404 };
  }

  if (match.status !== "pending") {
    return {
      ok: false,
      error: "Le match a deja commence et ne peut plus etre annule",
      status: 400,
    };
  }

  const isPlayer = (match.players || []).some((p: any) => p.id === userId);
  if (!isPlayer) {
    return {
      ok: false,
      error: "Vous n'etes pas joueur de ce match",
      status: 403,
    };
  }

  try {
    const nextNumber = (await prisma.turn.count({ where: { matchId } })) + 1;
    await prisma.turn.create({
      data: {
        matchId,
        number: nextNumber,
        payload: {
          type: "cancel",
          userId,
          at: new Date().toISOString(),
        } as any,
      },
    });

    await prisma.match.update({
      where: { id: matchId },
      data: { status: "cancelled" },
    });

    return { ok: true, status: "cancelled" };
  } catch (e) {
    serverLog.error("Erreur lors de l'annulation du match:", e);
    return { ok: false, error: "Erreur serveur", status: 500 };
  }
}
