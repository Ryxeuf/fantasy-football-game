import { io, type Socket } from "socket.io-client";
import { SOCKET_URL, DEFAULT_EVENT_TIMEOUT_MS } from "./env";

/**
 * Wrapper typé autour d'un client Socket.IO connecté au namespace `/game`.
 *
 * Fournit:
 *  - connexion authentifiée (JWT bearer)
 *  - helpers `emitAck()` pour les events `game:*` qui répondent via ack
 *  - `waitFor()` pour attendre un event broadcast (join, state-updated, chat…)
 *  - `disconnect()` propre
 *
 * Chaque spec crée une instance par coach connecté, la connecte, et la
 * déconnecte en teardown.
 */
export interface GameSocketOptions {
  token: string;
  /** Désactive les logs console (utile en CI pour garder les logs propres). */
  silent?: boolean;
}

export type StateUpdatedPayload = {
  matchId?: string;
  gameState: Record<string, unknown>;
  move?: Record<string, unknown>;
  userId?: string;
  timestamp?: string;
};

export type ChatMessagePayload = {
  matchId: string;
  userId: string;
  message: string;
  timestamp: string;
};

export type PlayerConnectedPayload = {
  matchId: string;
  userId: string;
  connectedSockets: number;
};

export type PlayerDisconnectedPayload = PlayerConnectedPayload;

export type MatchForfeitedPayload = {
  matchId: string;
  forfeitingUserId: string;
  gameState: Record<string, unknown>;
};

export type AckResponse<TData = unknown> =
  | ({ success: true; ok?: true } & TData)
  | { success: false; ok?: false; error: string; code?: string };

export class GameSocket {
  public readonly socket: Socket;
  private readonly silent: boolean;

  constructor(opts: GameSocketOptions) {
    this.silent = !!opts.silent;
    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: `Bearer ${opts.token}` },
      reconnection: false,
      forceNew: true,
    });

    if (!this.silent) {
      this.socket.on("connect_error", (err) => {
        console.error("[GameSocket] connect_error:", err.message);
      });
    }
  }

  async connect(): Promise<void> {
    if (this.socket.connected) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Socket connect timeout")),
        DEFAULT_EVENT_TIMEOUT_MS,
      );
      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Emit un event qui retourne une ack, avec timeout.
   * Le serveur renvoie soit `{ ok: true, ... }`, soit `{ success: true, ... }`,
   * soit `{ ok: false, error }` / `{ success: false, error }`.
   */
  async emitAck<TResponse extends AckResponse = AckResponse>(
    event: string,
    payload: unknown,
    timeoutMs = DEFAULT_EVENT_TIMEOUT_MS,
  ): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`emitAck ${event} timeout`)),
        timeoutMs,
      );
      this.socket.emit(event, payload, (response: TResponse) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  /** Attend le prochain event broadcast nommé `event`. */
  async waitFor<TPayload = unknown>(
    event: string,
    timeoutMs = DEFAULT_EVENT_TIMEOUT_MS,
  ): Promise<TPayload> {
    return new Promise<TPayload>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`waitFor ${event} timeout`)),
        timeoutMs,
      );
      this.socket.once(event, (payload: TPayload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  /**
   * Attend le prochain event satisfaisant un prédicat. Utile quand
   * plusieurs events `game:state-updated` arrivent et qu'on veut celui
   * qui correspond à un state précis (ex: gamePhase === "playing").
   */
  async waitForMatching<TPayload = unknown>(
    event: string,
    predicate: (payload: TPayload) => boolean,
    timeoutMs = DEFAULT_EVENT_TIMEOUT_MS,
  ): Promise<TPayload> {
    return new Promise<TPayload>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off(event, handler);
        reject(new Error(`waitForMatching ${event} timeout`));
      }, timeoutMs);

      const handler = (payload: TPayload) => {
        if (predicate(payload)) {
          clearTimeout(timer);
          this.socket.off(event, handler);
          resolve(payload);
        }
      };
      this.socket.on(event, handler);
    });
  }

  disconnect(): void {
    if (this.socket.connected || this.socket.active) {
      this.socket.disconnect();
    }
    this.socket.removeAllListeners();
  }
}

/** Crée + connecte + join un match sur un socket en un seul appel. */
export async function connectToMatch(
  token: string,
  matchId: string,
): Promise<GameSocket> {
  const gs = new GameSocket({ token, silent: true });
  await gs.connect();
  const ack = await gs.emitAck<AckResponse>("game:join-match", { matchId });
  if (ack.ok === false || (ack as { success?: boolean }).success === false) {
    gs.disconnect();
    throw new Error(
      `game:join-match refused: ${(ack as { error?: string }).error ?? "unknown"}`,
    );
  }
  return gs;
}
