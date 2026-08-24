/**
 * Client HTTP du logo d'équipe.
 *
 * Le binaire part tel quel dans le corps de la requête
 * (`POST /team/:id/logo`) : c'est le contrat serveur, qui détecte le type
 * réel par magic bytes et régénère le nom de fichier.
 *
 * Mutualisé entre la fiche d'équipe (`TeamLogoUploader`, upload immédiat)
 * et le builder (`TeamLogoPicker` + upload post-création, l'équipe n'ayant
 * pas encore d'id au moment du choix).
 */
import { API_BASE } from "../../../auth-client";

/** Types acceptés côté serveur (magic bytes). */
export const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/gif,image/webp";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TOO_LARGE_MESSAGE = "Logo trop volumineux (max 2 Mo)";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrapLogo(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { logoUrl?: string | null };
    logoUrl?: string | null;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body.data?.logoUrl ?? body.logoUrl ?? null;
}

/** Envoie l'image et renvoie l'URL publique du logo. */
export async function uploadTeamLogo(
  teamId: string,
  file: File,
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/team/${teamId}/logo`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  return unwrapLogo(res);
}

/** Retire le logo uploadé (retour au logo programmatique de la race). */
export async function deleteTeamLogo(teamId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/team/${teamId}/logo`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrapLogo(res);
}
