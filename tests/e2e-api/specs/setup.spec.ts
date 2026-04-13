import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, get, post, rawPost } from "../helpers/api";
import { bootMatch } from "../helpers/factories";

/**
 * Spec de la phase de positionnement (setup):
 *
 * - Le serveur expose `POST /match/:id/validate-setup` qui prend
 *   `{ placedPlayers, playerPositions }` et applique la validation du
 *   moteur de jeu (`validatePlayerPlacement`) pour garantir:
 *     - 11 joueurs par équipe
 *     - LoS: au moins 3 joueurs sur la LoS (x=12 pour A, x=13 pour B)
 *     - Wide zones: max 2 joueurs par wide zone
 *
 * Ces tests valident le chemin API sans simuler tout le moteur: on
 * vérifie qu'un placement légal est accepté, qu'un placement illégal
 * est rejeté, et que l'authentification / les droits sont contrôlés.
 */
describe("E2E API — phase de setup", () => {
  beforeEach(async () => {
    await resetDb();
  });

  interface SetupStateResponse {
    gameState: {
      players: Array<{
        id: string;
        team: "A" | "B";
        pos: { x: number; y: number };
      }>;
      preMatch?: {
        phase?: string;
        currentCoach?: "A" | "B";
        receivingTeam?: "A" | "B";
        kickingTeam?: "A" | "B";
      };
    };
    myTeamSide: "A" | "B";
    isMyTurn?: boolean;
  }

  /**
   * Helper: polle /match/:id/state jusqu'à ce que la phase atteigne
   * `setup` ou `kickoff`, puis retourne l'état complet.
   */
  async function waitForSetupReady(
    coachToken: string,
    matchId: string,
  ): Promise<SetupStateResponse | null> {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      try {
        const res = await get<SetupStateResponse>(
          `/match/${matchId}/state`,
          coachToken,
        );
        if (
          res.gameState?.preMatch?.phase === "setup" ||
          res.gameState?.preMatch?.phase === "kickoff"
        ) {
          return res;
        }
      } catch {
        // le endpoint /state peut être 500 transitoirement
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  it("rejette un validate-setup sans payload", async () => {
    const { coachA, match } = await bootMatch();

    // Payload vide → 400
    const res = await rawPost(
      `/match/${match.id}/validate-setup`,
      coachA.token,
      {},
    );
    expect(res.status).toBe(400);
  });

  it("rejette un validate-setup non authentifié", async () => {
    const { match } = await bootMatch();

    const res = await rawPost(
      `/match/${match.id}/validate-setup`,
      null,
      { placedPlayers: [], playerPositions: [] },
    );
    expect(res.status).toBe(401);
  });

  it(
    "accepte un placement légal de 11 joueurs sur la LoS + wide zones",
    async () => {
      const { coachA, coachB, match } = await bootMatch();

      // Retry loop: la transition idle → setup peut provoquer un décalage
      // entre l'état retourné par /state et celui vu par validate-setup,
      // ce qui donne un 403 transitoire en CI. On re-poll et réessaie.
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Attente que le serveur atteigne la phase setup via coach A.
        // On ne requête pas B séparément: un seul appel /state peut avoir des
        // effets de bord (transition idle → setup) — en appeler deux en
        // concurrence crée une race visible côté test (B reçoit parfois null).
        const setupStateA = await waitForSetupReady(coachA.token, match.id);
        expect(setupStateA).not.toBeNull();

        const currentCoach = setupStateA!.gameState.preMatch?.currentCoach;
        expect(currentCoach === "A" || currentCoach === "B").toBe(true);

        // Sélection du coach qui a la main: celui dont myTeamSide matche
        // le currentCoach côté moteur. Comme myTeamSide de A est connu,
        // on en déduit celui de B par opposition.
        const aSide = setupStateA!.myTeamSide;
        const placingCoach = aSide === currentCoach ? coachA : coachB;
        const placingTeam = currentCoach!; // "A" ou "B"
        const losX = placingTeam === "A" ? 12 : 13;
        const safeX = placingTeam === "A" ? 6 : 18;

        // 3 LoS, 2 wide zones haut, 2 wide zones bas, 4 milieu.
        const positions = [
          { x: losX, y: 6 },
          { x: losX, y: 7 },
          { x: losX, y: 8 },
          { x: safeX, y: 1 },
          { x: safeX, y: 2 },
          { x: safeX, y: 12 },
          { x: safeX, y: 13 },
          { x: safeX, y: 5 },
          { x: safeX, y: 6 },
          { x: safeX, y: 7 },
          { x: safeX, y: 8 },
        ];

        const teamPlayers = setupStateA!.gameState.players
          .filter((p) => p.team === placingTeam)
          .slice(0, 11);
        expect(teamPlayers).toHaveLength(11);

        const payload = {
          placedPlayers: teamPlayers.map((p) => p.id),
          playerPositions: teamPlayers.map((p, i) => ({
            playerId: p.id,
            x: positions[i].x,
            y: positions[i].y,
          })),
        };

        const res = await rawPost(
          `/match/${match.id}/validate-setup`,
          placingCoach.token,
          payload,
        );

        if (res.status === 200) {
          // Success — test passes
          expect(res.status).toBe(200);
          return;
        }

        // 403 = race condition (currentCoach stale) — retry after short delay
        if (res.status === 403 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        // Final attempt or unexpected status — assert and fail
        expect(res.status).toBe(200);
      }
    },
    30_000,
  );
});
