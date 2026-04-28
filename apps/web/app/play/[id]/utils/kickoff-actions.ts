/**
 * Helpers d'appel API pour la phase de kickoff (placement du ballon,
 * deviation, resolution d'evenement).
 *
 * Chaque fonction encapsule fetch + normalisation + dispatch React
 * state. Les redirects /lobby (token absent) restent gérés ici car
 * factorises a un seul endroit.
 *
 * Extraits de `play/[id]/page.tsx` dans le cadre du refactor S26.0d.
 */

import {
  type ExtendedGameState,
  type Position,
} from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import { webLog } from "../../../lib/log";
import { normalizeState } from "./normalize-state";

type SetStateFn = (
  s:
    | ExtendedGameState
    | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
) => void;

/**
 * Recupere le bearer token depuis localStorage et redirige vers
 * `/lobby` s'il est absent. Retourne le token quand present.
 */
function requireAuthOrRedirect(): string | null {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = "/lobby";
    }
    return null;
  }
  return token;
}

async function postKickoffAction(
  matchId: string,
  endpoint: string,
  setState: SetStateFn,
  body?: unknown,
  errorLabel: string = "Erreur kickoff",
): Promise<void> {
  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/match/${matchId}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      throw new Error(errorLabel);
    }

    const responseData = await response.json();
    const normalizedState = normalizeState(responseData.gameState);
    setState(normalizedState);

    webLog.debug(`${errorLabel}:`, responseData.message);
  } catch (error) {
    console.error(`${errorLabel}:`, error);
  }
}

export function handlePlaceKickoffBall(
  matchId: string,
  setState: SetStateFn,
  position: Position,
): Promise<void> {
  return postKickoffAction(
    matchId,
    "place-kickoff-ball",
    setState,
    { position },
    "Erreur lors du placement du ballon",
  );
}

export function handleCalculateDeviation(
  matchId: string,
  setState: SetStateFn,
): Promise<void> {
  return postKickoffAction(
    matchId,
    "calculate-kick-deviation",
    setState,
    undefined,
    "Erreur lors du calcul de deviation",
  );
}

export function handleResolveKickoffEvent(
  matchId: string,
  setState: SetStateFn,
): Promise<void> {
  return postKickoffAction(
    matchId,
    "resolve-kickoff-event",
    setState,
    undefined,
    "Erreur lors de la resolution de l'evenement",
  );
}
