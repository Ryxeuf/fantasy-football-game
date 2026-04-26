# Strategie liens entrants (Q.26 — Sprint 23)

## Objectif

Acquerir des **backlinks de qualite** vers Nuffle Arena depuis les
canaux communautaires Blood Bowl francophones et internationaux. Ces
backlinks renforcent :

- l autorite de domaine (signal SEO classique)
- la decouvrabilite via les communautes existantes
- la citabilite par les LLM (qui consultent les forums et blogs)

## Canaux cibles

| Canal | Type | Audience | Frequence |
|-------|------|----------|-----------|
| **r/bloodbowl** | Subreddit | Anglophone, ~30k membres | 1x release majeure |
| **TalkFantasyFootball.org** | Forum | Anglophone, joueurs serieux | 1x release majeure |
| **Discord BB francophones** | Discord | Francophone, joueurs actifs | Mensuel + releases |
| **Mordorbihan / blogs Blood Bowl FR** | Blog | Francophone, lecture longue | 1x trimestre (proposer un article invite) |

## Templates versionnes

Les templates de message sont versionnes dans le code, **pas dans ce
fichier** :

```
apps/web/app/lib/outreach-templates.ts
```

Cela garantit :

- coherence du ton entre canaux
- absence de derive (chaque modification passe par PR review)
- interpolation centralisee de `{siteUrl}` et `{discordInvite}`
  (eviter les hardcodes errones)

Pour rendre un template :

```ts
import { renderOutreachTemplate } from "@/lib/outreach-templates";

const message = renderOutreachTemplate("reddit_bloodbowl", {
  siteUrl: "https://nufflearena.fr",
});
console.log(message.title);
console.log(message.body);
console.log(message.callToAction);
```

## Procedure d outreach

### Pre-requis

- Compte actif sur le canal cible (verifier la regle anti-self-promo
  de chaque sub / forum avant de poster).
- Avoir contribue ou interagi prealablement sur le canal (anti-spam).
- Une release recente / nouveaute concrete a annoncer.

### Sequence

1. Lire les templates dans `outreach-templates.ts` et choisir le
   canal cible.
2. Adapter eventuellement le titre / corps a la culture du canal
   (ex: ajouter une question ouverte sur Reddit).
3. Poster ; epingler le lien `{siteUrl}` en CTA.
4. Suivre la conversation pendant 48h, repondre aux questions.
5. Logger le post dans une issue mensuelle
   `[Outreach] YYYY-MM` :
   - canal, date, lien post
   - feedback (upvotes, comments, sentiment)
   - signal de conversion (clics, inscriptions) si trackable

## Anti-patterns a eviter

- **Cross-posting strict identique** sur tous les canaux le meme jour
  (Reddit + forums anti-spam).
- **Auto-promo sans contexte** : toujours apporter une valeur
  (changelog, retour communautaire, AMA, screenshot).
- **Demander du karma / des votes** explicitement (banni partout).
- **Liens raccourcis** (bit.ly, tinyurl) -> rejet auto.
- **Commenter ses propres posts comme un autre** -> ban definitif.

## Iteration sur les templates

- Ajouter un canal : ajouter `OUTREACH_CHANNELS` + entry dans
  `OUTREACH_TEMPLATES`. Garder l id stable (slug).
- Reviser un template : modifier en place, garder les placeholders
  `{siteUrl}` / `{discordInvite}` pour que `renderOutreachTemplate`
  reste fonctionnel.

## Cadence

- **Mensuel** : 1 message Discord + 1 message blog FR si nouveaute.
- **Par release majeure** : annonce sur les 4 canaux dans la meme
  semaine, mais espacees de 24-48h.
- **Adhoc** : reponses aux questions, AMA spontane, etc.
