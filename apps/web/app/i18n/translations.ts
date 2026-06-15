// Dictionnaire i18n — une locale par fichier JSON (groundwork Sprint R.A.2).
//
// Les valeurs vivent desormais dans `./locales/<code>.json` (extrait du
// gros objet TS historique, contenu byte-identique). Ce module se
// contente d'agreger les locales et d'exposer les types ; l'API publique
// (`translations`, `Language`, `TranslationKey`) est inchangee.
//
// Pour ajouter une locale : deposer `./locales/<code>.json` (memes cles
// que fr.json) et l'ajouter a l'objet `translations` ci-dessous.
//
// Resolution JSON activee via `resolveJsonModule` (packages/config/
// tsconfig.base.json). Les types sont infered depuis le JSON, donc
// l'autocompletion sur `t.nav.teams` etc. reste disponible.
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const translations = { fr, en };

export type TranslationKey = keyof typeof translations.fr;
export type Language = keyof typeof translations;
