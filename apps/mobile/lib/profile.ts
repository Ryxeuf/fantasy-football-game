// Pure helpers for the mobile profile & settings screen (M.12).
// Network-free so they can be unit-tested in node.

export interface ProfileCounts {
  teams: number;
  matches: number;
  createdMatches: number;
  teamSelections: number;
  createdLocalMatches: number;
}

export interface UserProfile {
  id: string;
  email: string;
  coachName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  role: string;
  roles: string[];
  patreon: boolean;
  eloRating: number;
  createdAt: string;
  updatedAt: string;
  counts: ProfileCounts;
}

export interface ProfileFormData {
  email: string;
  coachName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface ProfileUpdatePayload {
  email: string;
  coachName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_ELO = 1000;

const EMPTY_COUNTS: ProfileCounts = {
  teams: 0,
  matches: 0,
  createdMatches: 0,
  teamSelections: 0,
  createdLocalMatches: 0,
};

export function getInitials(
  coachName: string | null | undefined,
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = (coachName && coachName.trim()) || (name && name.trim()) || "";
  if (source) {
    const initials = source
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    if (initials) return initials;
  }
  if (email && email.length > 0) {
    return email[0].toUpperCase();
  }
  return "?";
}

export function formatDateFr(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function validateProfileUpdate(
  form: ProfileFormData,
): string | null {
  const email = form.email.trim();
  const coachName = form.coachName.trim();
  if (email === "") return "L'email est requis";
  if (!EMAIL_REGEX.test(email)) return "Email invalide";
  if (coachName === "") return "Le nom de coach est requis";
  if (form.dateOfBirth && form.dateOfBirth !== "") {
    const parsed = new Date(form.dateOfBirth);
    if (Number.isNaN(parsed.getTime())) {
      return "Date de naissance invalide";
    }
  }
  return null;
}

export function validatePasswordChange(
  data: PasswordChange,
): string | null {
  if (
    data.currentPassword === "" ||
    data.newPassword === "" ||
    data.confirmPassword === ""
  ) {
    return "Tous les champs sont requis";
  }
  if (data.newPassword.length < MIN_PASSWORD_LENGTH) {
    return "Le nouveau mot de passe doit contenir au moins 8 caractères";
  }
  if (data.newPassword !== data.confirmPassword) {
    return "Les nouveaux mots de passe ne correspondent pas";
  }
  if (data.newPassword === data.currentPassword) {
    return "Le nouveau mot de passe doit être différent de l'ancien";
  }
  return null;
}

function normaliseRoles(
  rawRoles: unknown,
  rawRole: unknown,
): string[] {
  if (Array.isArray(rawRoles)) {
    return rawRoles.filter((r): r is string => typeof r === "string");
  }
  if (typeof rawRole === "string" && rawRole.length > 0) {
    return [rawRole];
  }
  return [];
}

function parseCounts(raw: unknown): ProfileCounts {
  if (!raw || typeof raw !== "object") return { ...EMPTY_COUNTS };
  const v = raw as Record<string, unknown>;
  return {
    teams: typeof v.teams === "number" ? v.teams : 0,
    matches: typeof v.matches === "number" ? v.matches : 0,
    createdMatches: typeof v.createdMatches === "number" ? v.createdMatches : 0,
    teamSelections:
      typeof v.teamSelections === "number" ? v.teamSelections : 0,
    createdLocalMatches:
      typeof v.createdLocalMatches === "number" ? v.createdLocalMatches : 0,
  };
}

function asNullableString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

export function parseProfileResponse(response: unknown): UserProfile | null {
  if (!response || typeof response !== "object") return null;
  const rawUser = (response as Record<string, unknown>).user;
  if (!rawUser || typeof rawUser !== "object") return null;
  const u = rawUser as Record<string, unknown>;
  if (
    typeof u.id !== "string" ||
    typeof u.email !== "string" ||
    typeof u.coachName !== "string" ||
    typeof u.role !== "string" ||
    typeof u.createdAt !== "string" ||
    typeof u.updatedAt !== "string"
  ) {
    return null;
  }
  const roles = normaliseRoles(u.roles, u.role);
  return {
    id: u.id,
    email: u.email,
    coachName: u.coachName,
    firstName: asNullableString(u.firstName),
    lastName: asNullableString(u.lastName),
    dateOfBirth: asNullableString(u.dateOfBirth),
    role: u.role,
    roles,
    patreon: u.patreon === true,
    eloRating: typeof u.eloRating === "number" ? u.eloRating : DEFAULT_ELO,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    counts: parseCounts(u._count),
  };
}

export function buildProfileUpdatePayload(
  form: ProfileFormData,
): ProfileUpdatePayload {
  const trimmedFirst = form.firstName.trim();
  const trimmedLast = form.lastName.trim();
  const trimmedDob = form.dateOfBirth.trim();
  return {
    email: form.email.trim(),
    coachName: form.coachName.trim(),
    firstName: trimmedFirst === "" ? null : trimmedFirst,
    lastName: trimmedLast === "" ? null : trimmedLast,
    dateOfBirth: trimmedDob === "" ? null : trimmedDob,
  };
}

export function profileToFormData(profile: UserProfile): ProfileFormData {
  return {
    email: profile.email,
    coachName: profile.coachName,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split("T")[0] : "",
  };
}

export function isAdmin(profile: UserProfile): boolean {
  return profile.roles.includes("admin") || profile.role === "admin";
}
