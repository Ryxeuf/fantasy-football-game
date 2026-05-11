/**
 * Lot P.C.2 — Generation d'un mot de passe temporaire cryptographiquement
 * sur pour un admin password reset.
 *
 * Caracteristiques :
 *  - 16 caracteres par defaut (entropie > 80 bits avec l'alphabet retenu).
 *  - Alphabet sans caracteres ambigus (`O`, `0`, `l`, `1`, `I`).
 *  - Garanti d'inclure au moins une majuscule, une minuscule, un chiffre
 *    et un symbole — pour passer les validateurs de complexite.
 *  - Pas de dependance externe : utilise `crypto.randomBytes` natif.
 *
 * Le mot de passe est destine a etre transmis a l'utilisateur via un
 * canal out-of-band (chat support, e-mail manuel). Il ne doit jamais
 * etre logge.
 */

import { randomBytes } from "crypto";

const LOWERCASE = "abcdefghijkmnopqrstuvwxyz"; // pas de 'l'
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // pas de 'I', 'O'
const DIGITS = "23456789"; // pas de '0', '1'
const SYMBOLS = "!@#$%&*+=?";

const ALPHABET = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;

/** Pick un caractere unique depuis `chars` avec une distribution uniforme.
 *  Utilise un byte aleatoire + rejection sampling pour eviter le biais
 *  du modulo. */
function pickChar(chars: string): string {
  const len = chars.length;
  // Plus grande borne inferieure a 256 divisible par len, pour rejection.
  const limit = Math.floor(256 / len) * len;
  while (true) {
    const b = randomBytes(1)[0]!;
    if (b < limit) return chars[b % len]!;
  }
}

/**
 * Genere un mot de passe temporaire respectant la politique de complexite.
 * @param length Longueur totale, doit etre >= 4 pour garantir au moins un
 *   caractere de chaque categorie. Defaut : 16.
 */
export function generateTempPassword(length = 16): string {
  if (length < 4) {
    throw new Error("temp password length must be >= 4");
  }
  // Garantit un de chaque categorie, puis remplit jusqu'a length.
  const chars: string[] = [
    pickChar(LOWERCASE),
    pickChar(UPPERCASE),
    pickChar(DIGITS),
    pickChar(SYMBOLS),
  ];
  for (let i = 4; i < length; i++) {
    chars.push(pickChar(ALPHABET));
  }
  // Shuffle pour ne pas avoir les 4 garanties toujours en debut.
  // Algorithme Fisher-Yates avec randomBytes uniform.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomFromZeroTo(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Retourne un entier uniformement reparti dans [0, max) via rejection. */
function randomFromZeroTo(max: number): number {
  const limit = Math.floor(256 / max) * max;
  while (true) {
    const b = randomBytes(1)[0]!;
    if (b < limit) return b % max;
  }
}
