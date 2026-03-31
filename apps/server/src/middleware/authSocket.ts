import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { normalizeRoles } from "../utils/roles";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    roles: string[];
  };
}

/**
 * Socket.io middleware that verifies JWT from handshake auth.
 * Clients must connect with: io("/game", { auth: { token: "Bearer xxx" } })
 * Sets socket.data.userId and socket.data.roles on success.
 */
export function authSocket(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = extractToken(socket);

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;

    const roles = normalizeRoles(
      (payload.roles as string[] | string | undefined) ??
        (payload.role as string | undefined),
    );

    socket.data.userId = payload.sub as string;
    socket.data.roles = roles;

    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}

function extractToken(socket: Socket): string | null {
  const raw = socket.handshake.auth?.token as string | undefined;
  if (!raw) return null;

  // Support both "Bearer xxx" and plain "xxx" formats
  if (raw.startsWith("Bearer ")) {
    return raw.slice(7);
  }
  return raw;
}
