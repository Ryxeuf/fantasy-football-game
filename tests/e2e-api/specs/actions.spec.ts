import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, rawPost } from "../helpers/api";
import { bootMatch } from "../helpers/factories";
import { connectToMatch } from "../helpers/socket";
import type { AckResponse } from "../helpers/socket";

/**
 * Spec des actions de gameplay (MOVE / BLOCK / END_TURN…) soumises via
 * Socket.IO `game:submit-move`.
 *
 * Comme pour le setup, le chemin "vrai" (setup → kickoff → playing → actions)
 * dépend de tables Prisma absentes du schéma SQLite de test (ex: roster).
 * Ces specs valident à la place les **contrats du pipeline** :
 *  - Authentification et appartenance au match
 *  - Validation des payloads
 *  - Rejet en phase non-active
 *  - Format des acks
 *
 * Les tests gameplay pur (touchdowns, turnovers…) sont couverts par les
 * tests unitaires du game-engine (packages/game-engine) et par la suite
 * Playwright côté UI qui opère contre une base Postgres complète.
 */
describe("E2E API — actions gameplay (contrats)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("REST /match/:id/move refuse un move sans auth (401)", async () => {
    const { match } = await bootMatch();
    const res = await rawPost(`/match/${match.id}/move`, null, {
      move: { type: "END_TURN" },
    });
    expect(res.status).toBe(401);
  });

  it("REST /match/:id/move refuse un move sans champ 'move' valide (400)", async () => {
    const { coachA, match } = await bootMatch();
    const res = await rawPost(`/match/${match.id}/move`, coachA.token, {});
    expect(res.status).toBe(400);
  });

  it("Socket.IO game:submit-move renvoie une ack d'erreur si matchId manquant", async () => {
    const { coachA, match } = await bootMatch();
    const sock = await connectToMatch(coachA.token, match.id);
    try {
      const ack = await sock.emitAck<AckResponse<{}>>("game:submit-move", {
        move: { type: "END_TURN" },
      });
      expect(ack.success).toBe(false);
      if (ack.success === false) {
        expect(ack.code).toBe("INVALID_PAYLOAD");
      }
    } finally {
      sock.disconnect();
    }
  });

  it(
    "Socket.IO game:submit-move rejette un move si la partie n'est pas encore 'active'",
    async () => {
      const { coachA, match } = await bootMatch();
      const sock = await connectToMatch(coachA.token, match.id);
      try {
        const ack = await sock.emitAck<AckResponse<{}>>("game:submit-move", {
          matchId: match.id,
          move: { type: "END_TURN" },
        });
        // Le match est en prematch-setup → move-processor renvoie INVALID_STATUS
        // (ou NOT_YOUR_TURN selon la progression async).
        expect(ack.success).toBe(false);
        if (ack.success === false) {
          expect(["INVALID_STATUS", "NOT_PLAYER", "NOT_YOUR_TURN"]).toContain(
            ack.code,
          );
        }
      } finally {
        sock.disconnect();
      }
    },
    15_000,
  );

  it(
    "Socket.IO game:submit-inducements a un contrat d'ack similaire",
    async () => {
      const { coachA, match } = await bootMatch();
      const sock = await connectToMatch(coachA.token, match.id);
      try {
        const ack = await sock.emitAck<AckResponse<{}>>(
          "game:submit-inducements",
          { matchId: match.id, selection: {} },
        );
        // La sélection est acceptée ou rejetée, mais la forme doit
        // toujours être `{ success: bool, ... }`.
        expect(typeof ack.success).toBe("boolean");
      } finally {
        sock.disconnect();
      }
    },
    15_000,
  );
});
