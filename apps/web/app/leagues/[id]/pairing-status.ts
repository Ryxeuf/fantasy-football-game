/**
 * Helpers PURS autour du statut d'une rencontre de ligue, partagés par le
 * calendrier, l'export de journée et l'éditeur de date.
 */
import type { LeaguePairingDetail } from "./types";

/** Statuts pour lesquels une date reste à prévoir (miroir serveur). */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["scheduled", "in_progress"]);

/**
 * Date prévisionnelle lisible (« 12 sept. 2026, 20:30 ») dans la locale
 * courante, ou `null` si absente / illisible.
 */
export function formatPlannedDate(
  iso: string | null | undefined,
  language: string,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Vrai quand la rencontre est « prévue le … » : pas encore jouée, et une
 * date prévisionnelle a été posée par les coachs ou le commissaire.
 */
export function isPairingPlanned(
  pairing: Pick<LeaguePairingDetail, "status" | "scheduledAt">,
): boolean {
  return pairing.status === "scheduled" && !!pairing.scheduledAt;
}

/**
 * Qui peut poser la date : les deux coachs de la rencontre et le
 * commissaire, tant que la rencontre n'est ni jouée ni annulée. Même règle
 * que le service serveur (`league-pairing-schedule`).
 */
export function canSchedulePairing(input: {
  pairing: Pick<
    LeaguePairingDetail,
    "status" | "homeParticipant" | "awayParticipant"
  >;
  currentUserId: string | null;
  isCommissioner: boolean;
}): boolean {
  const { pairing, currentUserId, isCommissioner } = input;
  if (!OPEN_STATUSES.has(pairing.status)) return false;
  if (isCommissioner) return true;
  if (!currentUserId) return false;
  return (
    pairing.homeParticipant.team.ownerId === currentUserId ||
    pairing.awayParticipant.team.ownerId === currentUserId
  );
}

/**
 * Valeur d'un `<input type="datetime-local">` (heure locale, sans zone)
 * pour une date ISO, ou "" si absente.
 */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Inverse de `toDateTimeLocalValue` : ISO UTC pour l'API, ou `null`. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
