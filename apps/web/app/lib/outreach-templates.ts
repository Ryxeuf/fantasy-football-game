/**
 * Templates d'annonce communautaire pour la strategie liens entrants
 * (Q.26 — Sprint 23).
 *
 * Q.26 demande une strategie de liens entrants vers Nuffle Arena
 * (r/bloodbowl, TalkFantasyFootball, blog Mordorbihan, Discord BB).
 * La phase d'outreach reste manuelle, mais les **templates de message
 * sont versionnes** pour garantir la coherence du ton, eviter les
 * derives de contenu entre canaux, et permettre une revue editoriale
 * en PR.
 *
 * Pure : pas de fetch, pas d'I/O. Les templates sont rendered en
 * substituant {siteUrl} et {discordInvite}.
 */

export const OUTREACH_CHANNELS = [
  "reddit_bloodbowl",
  "talkfantasyfootball",
  "discord_bloodbowl",
  "mordorbihan_blog",
] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export interface OutreachTemplate {
  /** Sujet / titre de la communication. */
  title: string;
  /** Corps du message (peut etre multiligne, markdown leger toler  e). */
  body: string;
  /** Phrase d'appel a l'action / lien final. */
  callToAction: string;
}

export interface OutreachInput {
  /** URL canonique du site (validee https). */
  siteUrl: string;
  /** URL d'invitation Discord (utilisee uniquement par discord_bloodbowl). */
  discordInvite?: string;
}

const TEMPLATES: Record<OutreachChannel, OutreachTemplate> = {
  reddit_bloodbowl: {
    title: "[Tool] Nuffle Arena — gestionnaire d'equipes Blood Bowl gratuit ({siteUrl})",
    body:
      "Bonjour r/bloodbowl,\n\n" +
      "Je partage Nuffle Arena, une plateforme gratuite et open-source\n" +
      "pour gerer vos equipes Blood Bowl Saison 3 :\n\n" +
      "- 30 rosters officiels Saison 2 + Saison 3\n" +
      "- 60+ Star Players avec regles speciales\n" +
      "- 130+ competences en FR/EN\n" +
      "- Export PDF pour vos matchs sur table\n" +
      "- Mode multijoueur en ligne (matchmaking + ELO)\n\n" +
      "Aucune pub, aucune revente de donnees. Code public sur GitHub.\n" +
      "Tout retour est le bienvenu.\n",
    callToAction: "Lien : {siteUrl}",
  },
  talkfantasyfootball: {
    title: "Nuffle Arena — free open-source Blood Bowl team manager ({siteUrl})",
    body:
      "Hi all,\n\n" +
      "Sharing Nuffle Arena, a free, open-source Blood Bowl team manager:\n" +
      "30 official rosters (Season 2 + 3), 60+ Star Players, 130+ skills,\n" +
      "PDF export for tabletop matches, and an online multiplayer mode.\n\n" +
      "No ads, no data resale. Built by the community for the community.\n" +
      "Feedback very welcome here or on GitHub.\n",
    callToAction: "Link: {siteUrl}",
  },
  discord_bloodbowl: {
    title: "Nuffle Arena — outil gratuit Blood Bowl ({siteUrl})",
    body:
      "Salut tout le monde,\n\n" +
      "Pour ceux qui cherchent un outil gratuit pour gerer leurs\n" +
      "equipes Blood Bowl Saison 3, jeter un coup d'oeil a Nuffle Arena :\n" +
      "rosters officiels, Star Players, competences en FR/EN, export PDF,\n" +
      "et bientot un mode multijoueur en ligne complet.\n\n" +
      "Discord du projet : {discordInvite}\n",
    callToAction: "Site : {siteUrl}",
  },
  mordorbihan_blog: {
    title: "Nuffle Arena — un nouvel outil francophone pour vos equipes Blood Bowl ({siteUrl})",
    body:
      "Bonjour Mordorbihan,\n\n" +
      "Je voulais te presenter Nuffle Arena, une plateforme francophone\n" +
      "gratuite et open-source dediee a la gestion d equipes Blood Bowl\n" +
      "(Saison 2 et Saison 3). 30 rosters officiels, 60+ Star Players,\n" +
      "130+ competences traduites, export PDF prepare pour les matchs sur\n" +
      "table. Aucune pub, code 100 % public sur GitHub.\n\n" +
      "Si ca peut interesser ton lectorat, je serais ravi qu'on echange.\n",
    callToAction: "Site : {siteUrl}",
  },
};

export const OUTREACH_TEMPLATES: Record<OutreachChannel, OutreachTemplate> = TEMPLATES;

const HTTPS_REGEX = /^https:\/\/[^\s]+$/;

export function renderOutreachTemplate(
  channel: OutreachChannel,
  input: OutreachInput,
): OutreachTemplate {
  const template = OUTREACH_TEMPLATES[channel];
  if (!template) {
    throw new Error(`Unknown outreach channel: ${channel}`);
  }
  if (!HTTPS_REGEX.test(input.siteUrl)) {
    throw new Error(`Invalid siteUrl (must be https://): ${input.siteUrl}`);
  }
  const discord = input.discordInvite ?? "https://discord.gg/XEZJTgEHKn";

  const interpolate = (text: string): string =>
    text.replace(/\{siteUrl\}/g, input.siteUrl).replace(/\{discordInvite\}/g, discord);

  return {
    title: interpolate(template.title),
    body: interpolate(template.body),
    callToAction: interpolate(template.callToAction),
  };
}
