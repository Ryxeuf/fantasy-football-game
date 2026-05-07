// S27.4.2 — Composite React hook qui consolide `useGameSocket` et
// `useGameChat` derriere une seule API pour les ecrans de match.
//
// Utilise par `apps/mobile/app/play/[id].tsx`. Evite a chaque
// consommateur de devoir cabler manuellement le `socket` entre les
// deux hooks. Ne contient aucune logique propre : compose simplement
// les deux hooks existants et expose leur sortie aplatie.

import {
  useGameSocket,
  type UseGameSocketOptions,
  type UseGameSocketResult,
} from "./use-game-socket";
import {
  useGameChat,
  type UseGameChatResult,
} from "./use-game-chat";

export interface UseGameMatchOptions extends UseGameSocketOptions {
  /** Match a rejoindre. Doit etre stable entre rendus. */
  matchId: string;
}

export interface UseGameMatchResult
  extends Omit<UseGameSocketResult, "socket"> {
  /** Messages de chat recus pour ce match (chronologique). */
  chatMessages: UseGameChatResult["messages"];
  /** Envoie un message de chat sur le canal du match. */
  sendChatMessage: UseGameChatResult["sendMessage"];
}

/**
 * Hook composite : ouvre la WebSocket de match (state updates,
 * reconnexion, soumission de moves) et le canal de chat associe.
 *
 * La socket sous-jacente n'est pas exposee : tout passe par les
 * helpers retournes (`submitMove`, `sendChatMessage`).
 */
export function useGameMatch({
  matchId,
  ...socketOptions
}: UseGameMatchOptions): UseGameMatchResult {
  const socket = useGameSocket(matchId, socketOptions);
  const chat = useGameChat({ socket: socket.socket, matchId });

  return {
    connected: socket.connected,
    joined: socket.joined,
    error: socket.error,
    reconnecting: socket.reconnecting,
    reconnectAttempt: socket.reconnectAttempt,
    submitMove: socket.submitMove,
    chatMessages: chat.messages,
    sendChatMessage: chat.sendMessage,
  };
}
