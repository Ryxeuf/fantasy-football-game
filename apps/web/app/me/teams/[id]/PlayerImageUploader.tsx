"use client";

import { useRef, useState } from "react";
import { API_BASE } from "../../../auth-client";
import PlayerAvatar from "../../../components/PlayerAvatar";

/**
 * Avatar cliquable d'un joueur sur la page d'équipe du COACH : un clic
 * ouvre le sélecteur de fichier et remplace la photo (miroir compact de
 * `TeamLogoUploader` — binaire brut dans le corps, PNG/JPEG 2 Mo max,
 * contrat `POST /team/:id/players/:playerId/image`). Un petit « ✕ »
 * retire la photo (retour aux initiales).
 */

interface PlayerImageUploaderProps {
  teamId: string;
  player: { id: string; name: string; imageUrl?: string | null };
  size?: number;
  /** Notifie le parent (rafraîchit les autres affichages de l'avatar). */
  onChange?: (playerId: string, imageUrl: string | null) => void;
}

/** PNG/JPEG uniquement : l'export de carte (satori) ne lit pas le WEBP. */
const ACCEPTED = "image/png,image/jpeg";
const MAX_BYTES = 2 * 1024 * 1024;

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrapImage(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { imageUrl?: string | null };
    imageUrl?: string | null;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body.data?.imageUrl ?? body.imageUrl ?? null;
}

export default function PlayerImageUploader({
  teamId,
  player,
  size = 32,
  onChange,
}: PlayerImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(
    player.imageUrl ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (next: string | null) => {
    setImageUrl(next);
    onChange?.(player.id, next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Image trop volumineuse (max 2 Mo)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/team/${teamId}/players/${player.id}/image`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        },
      );
      apply(await unwrapImage(res));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/team/${teamId}/players/${player.id}/image`,
        { method: "DELETE", headers: authHeaders() },
      );
      await unwrapImage(res);
      apply(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec du retrait");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span
      className="relative inline-flex shrink-0 items-center"
      data-testid={`player-image-uploader-${player.id}`}
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        data-testid={`player-image-input-${player.id}`}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        title={
          imageUrl
            ? "Remplacer la photo du joueur (PNG/JPEG, 2 Mo max)"
            : "Ajouter une photo du joueur (PNG/JPEG, 2 Mo max)"
        }
        data-testid={`player-image-upload-${player.id}`}
        className="rounded-full disabled:opacity-50"
      >
        <PlayerAvatar name={player.name} imageUrl={imageUrl} size={size} />
      </button>
      {imageUrl ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleRemove()}
          aria-label={`Retirer la photo de ${player.name}`}
          data-testid={`player-image-remove-${player.id}`}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] leading-none text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          ✕
        </button>
      ) : null}
      {error ? (
        <span
          data-testid={`player-image-error-${player.id}`}
          className="ml-1 max-w-[10rem] truncate text-[10px] text-red-600"
          title={error}
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
