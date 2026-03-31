import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { normalizeRoles } from "../utils/roles";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface SocketUser {
  id: string;
  roles: string[];
}

/**
 * Socket.io middleware that authenticates connections via JWT.
 *
 * The client must pass the token in the `auth` handshake payload:
 *   io("/game", { auth: { token: "Bearer <jwt>" } })
 *
 * On success, `socket.data.user` is populated with { id, roles }.
 * On failure, the connection is refused with an appropriate error.
 */
export function authSocket(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const raw: unknown = socket.handshake.auth?.token;

  if (!raw || typeof raw !== "string") {
    return next(new Error("Authentication required"));
  }

  // Support both "Bearer <token>" and bare "<token>" formats
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;

    const userId = payload.sub as string | undefined;
    if (!userId) {
      return next(new Error("Invalid token: missing subject"));
    }

    const roles = normalizeRoles(
      (payload.roles as string[] | string | undefined) ??
        (payload.role as string | undefined),
    );

    socket.data.user = { id: userId, roles } satisfies SocketUser;

    next();
  } catch {
    return next(new Error("Invalid or expired token"));
  }
}
