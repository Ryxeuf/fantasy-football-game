import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Lazy initialization: Next.js sets NODE_ENV=production during `next build`,
// so we cannot validate env vars at module load time — the build would crash
// when collecting page data. Instead, we resolve the secret on first request.
let _cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_cachedSecret) return _cachedSecret;

  const raw = process.env.JWT_SECRET;
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error(
      'FATAL: Missing required environment variable "JWT_SECRET". ' +
        "The server cannot start in production without it.",
    );
  }
  _cachedSecret = new TextEncoder().encode(raw || "dev-secret-change-me");
  return _cachedSecret;
}

/**
 * Route API pour vérifier si un token correspond à un admin
 * Utilisée par le middleware pour éviter les problèmes de résolution de module
 */
export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const roles = Array.isArray(payload.roles)
      ? (payload.roles as string[])
      : payload.role
        ? [payload.role as string]
        : [];
    const isAdmin = roles.includes("admin");
    return NextResponse.json({ isAdmin, roles, role: payload.role });
  } catch (error) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
}

