import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

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
    const { payload } = await jwtVerify(token, JWT_SECRET);
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

