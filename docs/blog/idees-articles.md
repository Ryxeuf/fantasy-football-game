# Idées d'articles de blog — Nuffle Arena

> Backlog éditorial prêt à injecter dans le workflow IA de génération
> d'articles (n8n → `POST /api/admin/blog/posts`). Chaque idée est un
> **brief autonome** : titre, slug, angle, mots-clés, plan, liens internes,
> CTA. Le workflow n'a qu'à interpoler le brief dans le prompt-cadre de la
> section « Prompt-cadre » en fin de document.
>
> Statut : backlog vivant. Cocher / déplacer en bas de fichier une fois
> l'article publié.

## Règles éditoriales (à respecter par le workflow)

1. **Aucune reprise littérale des règles officielles.** Les textes de
   `docs/regles-bb-2025/*.md` sont une transcription du livre (PI Games
   Workshop) : source d'exactitude interne uniquement. Toute mention de
   règle doit être **reformulée** avec nos mots (mêmes chiffres, phrases
   différentes), comme dans `apps/web/app/compendium/data/rules-bb-2025.json`.
2. **Pas de fluff GW, pas de noms de personnages officiels** dans les
   exemples : inventer des noms d'équipes / coachs génériques.
3. **Disclaimer de non-affiliation** : ne pas laisser entendre un
   partenariat avec Games Workshop.
4. **Longueur cible** : 900–1 600 mots. `excerpt` ≤ 280 caractères,
   accrocheur, contenant le mot-clé principal.
5. **HTML sanitizé** : `h2`/`h3`, `p`, `ul`/`ol`, `table`, `blockquote`,
   `a`, `img`, `strong`/`em`. Pas de `h1` (le titre est rendu par la page).
6. **Au moins 2 liens internes** par article (voir « Liens internes
   disponibles ») et 1 CTA final vers une page produit.
7. **Actualité** : pour les briefs marqués 🗞️, le workflow doit
   **vérifier la source du jour** (site GW / Reddit r/bloodbowl /
   NFL.com) avant de rédiger — ne jamais inventer une date de sortie,
   un score ou un résultat de tournoi.

## Liens internes disponibles

| Page | URL |
|------|-----|
| Compendium des règles | `/compendium` (chapitres : `/compendium/coup-d-envoi`, `/blessures-eliminations`, `/agressions`, `/jeu-en-ligue`, `/amelioration-joueurs`, `/tableau-competences`, `/coups-de-pouce`, `/personnel-equipe`, `/stars-sorcier`, `/equipes-ligues-regles-speciales`) |
| Compétences | `/skills` |
| Star players | `/star-players` |
| Équipes / rosters | `/teams` |
| Tutoriel | `/tutoriel` |
| Jouer en ligne | `/play`, `/lobby` |
| Pro League (sim) | `/pro-league` |
| Ligues (gestion) | `/ligues` |
| NFL Fantasy | `/nfl-fantasy` |
| Classements | `/leaderboard` |
| Changelog | `/changelog` |

---

## 1. Piliers SEO — « débutant qui cherche à comprendre »

Fort volume de recherche, contenu evergreen, gros potentiel de liens
internes vers le compendium.

### 1.1 Blood Bowl pour les nuls : comprendre une partie en 10 minutes
- **slug** : `blood-bowl-comprendre-une-partie-en-10-minutes`
- **angle** : le lecteur n'a jamais joué ; on décrit un tour complet
  (coup d'envoi → action → turnover → fin de mi-temps) avec un
  vocabulaire expliqué au fil de l'eau.
- **mots-clés** : blood bowl règles débutant, comment jouer à blood bowl
- **plan** : 1) Le terrain et les 11 joueurs — 2) La notion de tour et le
  turnover (le concept qui déroute tout le monde) — 3) Les 4 jets de dés
  qu'on fait 90 % du temps — 4) Ce qui fait gagner un match — 5) Où
  jouer une première partie.
- **liens** : `/compendium/coup-d-envoi`, `/tutoriel`, CTA `/play`.

### 1.2 Turnover : les 7 façons de perdre son tour (et comment les éviter)
- **slug** : `turnover-blood-bowl-7-facons-de-perdre-son-tour`
- **angle** : liste pratique + « ordre des actions » comme antidote.
- **plan** : chaque cause de turnover → probabilité associée → la règle
  d'ordonnancement qui l'évite (actions sûres d'abord, relance gardée
  pour le blitz, etc.).
- **liens** : `/compendium/coup-d-envoi`, `/skills`.

### 1.3 Choisir sa première équipe : 6 rosters faciles à prendre en main
- **slug** : `choisir-sa-premiere-equipe-blood-bowl`
- **angle** : tableau comparatif « courbe d'apprentissage / coût
  d'entretien / plan de jeu ». Assumer un classement, pas un catalogue.
- **liens** : `/teams`, comparateur de rosters, CTA `/play`.

### 1.4 Les probabilités que tout coach devrait connaître par cœur
- **slug** : `probabilites-blood-bowl-a-connaitre-par-coeur`
- **angle** : tableau des réussites (1 dé, 2 dés, enchaînements) + la
  vraie leçon : une séquence à 3 jets « faciles » est souvent pire qu'un
  seul jet « moyen ».
- **format** : tableau HTML + 3 exemples de séquences chiffrées.
- **liens** : `/compendium/agressions`, `/skills`.

### 1.5 Blitz, blocage, esquive : ce que fait vraiment chaque action
- **slug** : `blitz-blocage-esquive-differences`
- **angle** : trois termes que les débutants confondent, un exemple de
  terrain pour chacun.
- **liens** : `/compendium`, `/skills`.

### 1.6 Comment lire une cage — et comment la casser
- **slug** : `lire-et-casser-une-cage-blood-bowl`
- **angle** : tactique intermédiaire, schémas ASCII ou images générées.
- **liens** : `/compendium/agressions`, `/pro-league`.

---

## 2. Compétences & progression (trafic longue traîne)

Chaque article cible une famille de compétences → maillage massif vers
`/skills` et `/compendium/tableau-competences`.

### 2.1 Les 10 compétences les plus sous-estimées
- **slug** : `competences-blood-bowl-sous-estimees`
- **angle** : contre-pied des guides « prends Blocage ». Pour chaque
  compétence : à qui la donner, dans quel type de ligue, quand ne pas la
  prendre.

### 2.2 Premier level-up : quelle compétence donner à quel poste ?
- **slug** : `premier-level-up-quelle-competence`
- **angle** : arbre de décision par archétype (porteur, blitzer,
  bloqueur, joueur de couloir), avec la logique de coût en TV.
- **liens** : `/compendium/amelioration-joueurs`, `/skills`.

### 2.3 SPP : comment les farmer sans saborder son équipe
- **slug** : `spp-blood-bowl-comment-les-farmer`
- **angle** : arbitrage entre « faire progresser un joueur » et « gagner
  le match ». Utiliser les stats de la Pro League comme illustration.
- **liens** : `/pro-league`, `/compendium/amelioration-joueurs`.

### 2.4 L'inflation de TV : le piège des équipes qui gagnent trop
- **slug** : `inflation-tv-blood-bowl`
- **angle** : pourquoi une équipe à haute TV perd des matchs qu'elle
  devrait gagner (coups de pouce adverses), et comment gérer son roster.
- **liens** : `/compendium/coups-de-pouce`, `/ligues`.

### 2.5 Star players : quand ils valent leur prix (et quand c'est du gâchis)
- **slug** : `star-players-quand-les-recruter`
- **angle** : analyse coût/impact, effet sur la TV, cas des matchs à
  handicap.
- **liens** : `/star-players`, `/compendium/stars-sorcier`.

---

## 3. Analyses de données maison (contenu que personne d'autre ne peut écrire)

Différenciant fort : on a le moteur, les replays, la Pro League. Chaque
article part d'un chiffre extrait de nos données. **Le workflow doit
recevoir les chiffres en entrée** (ou déclencher l'export) — ne jamais
inventer une statistique.

### 3.1 Nous avons simulé N matchs : voici ce que disent les chiffres
- **slug** : `n-matchs-simules-ce-que-disent-les-chiffres`
- **angle** : taux de TD par mi-temps, longueur moyenne d'un drive,
  fréquence des turnovers par type. Un graphique par section.
- **entrées requises** : export d'agrégats Pro League.

### 3.2 Le classement des équipes par taux de victoire dans notre simulateur
- **slug** : `classement-equipes-taux-de-victoire-simulateur`
- **angle** : tier-list appuyée par des données, avec les limites
  méthodologiques assumées (IA de simulation ≠ coach humain).
- **liens** : `/pro-league`, `/leaderboard`, `/teams`.

### 3.3 À quel tour marque-t-on vraiment ? Anatomie d'un drive
- **slug** : `anatomie-d-un-drive-blood-bowl`
- **angle** : distribution du tour de marque, ce que ça implique sur la
  gestion d'horloge (2-tour drive, stalling).

### 3.4 Le coût réel d'une agression : ce que la sanction change
- **slug** : `cout-reel-d-une-agression-blood-bowl`
- **angle** : espérance de gain (joueur sorti) vs risque (expulsion +
  turnover), chiffré.
- **liens** : `/compendium/agressions`.

### 3.5 Les blessures : combien de joueurs survit-on à une saison ?
- **slug** : `blessures-blood-bowl-survie-sur-une-saison`
- **angle** : taux d'attrition par poste sur une saison simulée,
  conséquence sur la politique d'achat (banc, apothicaire).
- **liens** : `/compendium/blessures-eliminations`, `/ligues`.

---

## 4. Ligues & communauté (public « organisateur »)

Cible les commissaires de ligue — audience petite mais ultra-prescriptrice,
et directement raccord avec la feature `/ligues`.

### 4.1 Monter une ligue Blood Bowl à 8 coachs : le guide complet
- **slug** : `monter-une-ligue-blood-bowl-8-coachs`
- **angle** : calendrier, format (poules / playoffs), règles maison à
  fixer AVANT le premier match, gestion des abandons.
- **liens** : `/ligues`, `/compendium/jeu-en-ligue`. CTA : créer sa ligue.

### 4.2 Les 5 règles maison qui sauvent une ligue (et les 3 qui la tuent)
- **slug** : `regles-maison-ligue-blood-bowl`
- **angle** : retour d'expérience, ton assumé. Ex. : plafond de TV,
  fenêtre de report de match, gestion du no-show.

### 4.3 Feuille de match : pourquoi la saisie post-match change tout
- **slug** : `feuille-de-match-blood-bowl-ligue`
- **angle** : article produit + méthode. Comment tracer TD, blessures,
  SPP sans y passer 20 minutes.
- **liens** : `/ligues`.

### 4.4 Organiser un tournoi one-day : le rétroplanning
- **slug** : `organiser-tournoi-blood-bowl-one-day`
- **angle** : J-30 → J+1, avec check-list téléchargeable dans l'article.

### 4.5 Débutant vs vétéran dans la même ligue : équilibrer sans frustrer
- **slug** : `equilibrer-ligue-debutants-veterans`
- **angle** : handicaps, poules de niveau, mentorat. Sujet clivant =
  commentaires + partages.

---

## 5. Actualité 🗞️ (à re-vérifier au moment de la génération)

Ces briefs sont des **gabarits récurrents**. Le workflow doit d'abord
récupérer la source réelle du jour, puis remplir le gabarit. Interdiction
de générer si la source n'a pas été trouvée.

### 5.1 Ce qui change avec la saison en cours : notre lecture
- **slug** : `saison-en-cours-ce-qui-change` (suffixer l'année)
- **entrées requises** : liste des changements de règles / rosters
  officiellement publiés.
- **angle** : impact pratique par archétype d'équipe, pas de recopie de
  la règle — notre interprétation.

### 5.2 Récap du dernier gros tournoi : ce que les finalistes ont joué
- **slug** : `recap-tournoi-<nom>-<annee>`
- **entrées requises** : résultats + compositions publiés publiquement.
- **angle** : méta-lecture (quels rosters, quelles compétences).

### 5.3 Draft NFL / rentrée NFL vue par un coach Blood Bowl
- **slug** : `nfl-vue-par-un-coach-blood-bowl`
- **angle** : pont éditorial vers le module NFL Fantasy — traduire les
  postes NFL en archétypes BB, expliquer le mapping.
- **saisonnalité** : septembre (kickoff NFL), avril (draft).
- **liens** : `/nfl-fantasy`.

### 5.4 Notre changelog du mois, raconté
- **slug** : `changelog-du-mois-<annee>-<mois>`
- **angle** : 3 nouveautés expliquées côté joueur (pas côté dev), une
  coulisse technique, une question ouverte à la communauté.
- **entrées requises** : diff du `/changelog`.
- **récurrence** : mensuel — le meilleur candidat pour automatiser en
  premier.

---

## 6. Coulisses & tech (audience dev, backlinks Hacker News / Reddit dev)

Public différent, mais excellent pour les liens entrants et la citabilité
par les LLM.

### 6.1 Comment on a écrit un moteur de règles Blood Bowl en TypeScript
- **slug** : `moteur-de-regles-blood-bowl-en-typescript`
- **angle** : state machine, déterminisme par seed, pourquoi le moteur
  est un package pur sans I/O.
- **liens** : `/changelog`, dépôt public si ouvert.

### 6.2 Rejouer un match à l'identique : déterminisme et replays compressés
- **slug** : `determinisme-et-replays-blood-bowl`
- **angle** : seed + journal d'événements, coût de stockage, ce que ça
  permet (analyse post-match, anti-triche).

### 6.3 Simuler 10 000 matchs sans faire fondre le serveur
- **slug** : `simuler-10000-matchs-optimisation`
- **angle** : le clone d'état qui coûtait 10× trop cher, les caches
  mémoïsés, la mesure avant/après.

### 6.4 Écrire un blog dont les articles sont générés par une IA — et assumés
- **slug** : `blog-genere-par-ia-comment-on-fait`
- **angle** : méta et honnête : le pipeline, les garde-fous (vérification
  des sources, relecture humaine, pas de recopie de contenu protégé),
  ce qui marche et ce qui rate.

### 6.5 SEO pour un jeu de niche : ce qui a marché en 12 mois
- **slug** : `seo-jeu-de-niche-retour-d-experience`
- **angle** : chiffres réels de trafic, pages qui ont pris, pages mortes.
- **entrées requises** : export Search Console.

---

## Prompt-cadre pour le workflow

```
Tu écris un article pour le blog de Nuffle Arena, une plateforme
francophone de Blood Bowl (matchs en ligne, gestion de ligues,
compendium des règles, module NFL Fantasy).

BRIEF
- Titre : {{titre}}
- Slug : {{slug}}
- Angle : {{angle}}
- Plan imposé : {{plan}}
- Mots-clés : {{mots_cles}}
- Liens internes obligatoires : {{liens}}
- Données fournies (ne rien inventer au-delà) : {{donnees}}

CONTRAINTES
- Français, tutoiement du lecteur, ton de coach expérimenté : direct,
  concret, un peu d'humour, zéro emphase marketing.
- 900 à 1600 mots. Paragraphes courts. Une idée par section.
- Reformule toute règle avec tes propres mots. N'utilise jamais le
  texte officiel Games Workshop, ni les noms de personnages officiels.
  Nuffle Arena n'est pas affilié à Games Workshop.
- Chiffres : uniquement ceux fournis dans {{donnees}}. Si une donnée
  manque, écris la section sans chiffre plutôt que d'estimer.
- Sortie STRICTEMENT en JSON :
  { "slug", "title", "excerpt" (<=280 car.), "contentHtml", "status": "draft" }
- contentHtml : balises autorisées uniquement h2, h3, p, ul, ol, li,
  table, thead, tbody, tr, th, td, blockquote, a, img, strong, em, code.
  Pas de h1, pas de style inline, pas de script.
- Termine par un paragraphe CTA renvoyant vers {{cta}}.
```

Publication : le workflow crée l'article en `status: "draft"` via
`POST /api/admin/blog/posts`, l'image de couverture passe par
`POST /api/admin/blog/upload` (binaire brut, `?filename=<slug>`). La
bascule en `published` reste **manuelle** après relecture — voir
[`docs/blog-feature.md`](../blog-feature.md).

## Priorisation suggérée

| Vague | Articles | Pourquoi |
|-------|----------|----------|
| 1 (SEO socle) | 1.1, 1.2, 1.3, 2.2 | Requêtes débutant, evergreen, maillage vers le compendium |
| 2 (différenciation) | 3.1, 3.2, 2.1 | Contenu impossible à copier, base de backlinks |
| 3 (produit) | 4.1, 4.3, 5.4 | Convertit vers `/ligues` ; 5.4 automatisable en mensuel |
| 4 (notoriété dev) | 6.1, 6.2, 6.4 | Backlinks hors communauté BB |

## Publiés

_(déplacer ici les briefs consommés, avec le lien de l'article)_
