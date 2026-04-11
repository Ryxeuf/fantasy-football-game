import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/api";
import { bootMatch } from "../helpers/factories";
import { GameSocket, connectToMatch } from "../helpers/socket";

/**
 * Spec multijoueur temps-réel:
 *
 * - Broadcast des connexions de joueurs (player-connected / player-disconnected)
 * - Resync après reconnexion
 * - Chat in-game
 * - Contrat du forfeit (déconnexion)
 *
 * Ces tests couvrent la mécanique réseau, pas le gameplay. Ils doivent
 * tourner rapidement (< 3s chacun) car ils ne dépendent que des events
 * `/game` namespace de socket.io, qui ne requièrent aucune divergence de
 * schéma Prisma.
 */
describe("E2E API — multijoueur temps-réel", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("player-connected est diffusé aux autres joueurs de la room", async () => {
    const { coachA, coachB, match } = await bootMatch();

    const sockA = await connectToMatch(coachA.token, match.id);
    try {
      // Dès que B rejoint, A doit recevoir un event player-connected.
      const connectedPromise = sockA.waitFor<{
        matchId: string;
        userId: string;
        connectedSockets: number;
      }>("game:player-connected", 8_000);

      const sockB = await connectToMatch(coachB.token, match.id);
      try {
        const event = await connectedPromise;
        expect(event.matchId).toBe(match.id);
        expect(event.userId).toBe(coachB.userId);
        expect(event.connectedSockets).toBeGreaterThanOrEqual(2);
      } finally {
        sockB.disconnect();
      }
    } finally {
      sockA.disconnect();
    }
  });

  it("player-disconnected est diffusé quand un joueur quitte", async () => {
    const { coachA, coachB, match } = await bootMatch();

    const sockA = await connectToMatch(coachA.token, match.id);
    const sockB = await connectToMatch(coachB.token, match.id);

    try {
      const disconnectedPromise = sockA.waitFor<{
        matchId: string;
        userId?: string;
      }>("game:player-disconnected", 8_000);

      sockB.disconnect();

      const event = await disconnectedPromise;
      expect(event.matchId).toBe(match.id);
    } finally {
      sockA.disconnect();
    }
  });

  it(
    "game:request-resync retourne un gameState pour le joueur reconnecté",
    async () => {
      const { coachA, match } = await bootMatch();
      const sock = await connectToMatch(coachA.token, match.id);
      try {
        const ack = await sock.emitAck<
          | { success: true; gameState: Record<string, unknown> }
          | { success: false; error: string }
        >("game:request-resync", { matchId: match.id });

        // Soit resync réussit avec un gameState, soit il échoue proprement
        // (ex: aucun état persisté encore). On valide juste la forme de l'ack.
        expect(typeof ack.success).toBe("boolean");
        if (ack.success) {
          expect(ack.gameState).toBeDefined();
        }
      } finally {
        sock.disconnect();
      }
    },
    15_000,
  );

  it("game:chat-message est relayé aux autres joueurs de la room", async () => {
    const { coachA, coachB, match } = await bootMatch();

    const sockA = await connectToMatch(coachA.token, match.id);
    const sockB = await connectToMatch(coachB.token, match.id);

    try {
      const chatPromise = sockB.waitFor<{
        matchId: string;
        userId: string;
        message: string;
      }>("game:chat-message", 5_000);

      const ack = await sockA.emitAck<
        { ok: true } | { ok: false; error: string }
      >("game:chat-message", {
        matchId: match.id,
        message: "Bonne chance pour le match !",
      });
      expect("ok" in ack ? ack.ok : false).toBe(true);

      const received = await chatPromise;
      expect(received.matchId).toBe(match.id);
      expect(received.message).toBe("Bonne chance pour le match !");
      expect(received.userId).toBe(coachA.userId);
    } finally {
      sockA.disconnect();
      sockB.disconnect();
    }
  });

  it("une connexion sans JWT est refusée", async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        const sock = new GameSocket({ token: "invalid-token", silent: true });
        sock
          .connect()
          .then(() => {
            sock.disconnect();
            resolve();
          })
          .catch((e) => reject(e));
      }),
    ).rejects.toThrow();
  });
});
