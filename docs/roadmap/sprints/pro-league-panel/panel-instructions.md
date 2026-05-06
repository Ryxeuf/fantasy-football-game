# Brief testeur — Panel BB Experts Pro League

Merci de prêter ton expertise Blood Bowl à la validation du sim engine
Pro League de Nuffle Arena. Ce brief décrit ton rôle, le matériel
fourni, la grille de notation et la deadline.

## Pourquoi tu es là

On construit une simulation de matchs Blood Bowl IA-vs-IA pour une
ligue permanente "Old World League" de 16 équipes (Pittsburgh
Smashers Orcs, Kansas City Soaring Hawks Wood Elves, Buffalo Snow
Ogres, etc. — homages NFL × races BB). Avant d'ouvrir au public, on
veut s'assurer que les matchs simulés **ressemblent à du vrai BB** :
choix tactiques cohérents, identité raciale visible, moments
mémorables qui font envie de les raconter.

Ton avis pèse dans la décision GO/NO-GO Phase 0 → Phase 1. Si la
moyenne du panel est < 7/10, on retourne en tuning et on te
re-sollicitera plus tard.

## Profil recherché

- FUMBBL veteran (≥ 200 matchs joués) **OU** NAF coach (tournois
  NAF officiels) **OU** créateur communauté reconnu (cast Twitch,
  blog, organisation de ligue)
- Connaissance courante de BB2020 / BB3
- Disponibilité ~3-4h sur 1 semaine
- Pas de NDA — l'évaluation est publique (les notes seront publiées
  dans le `pro-league-gate.md` du repo)

## Compensation

- Crédit explicite dans le `CHANGELOG.md` du sim engine
- 5000 Crowns pré-créditées dès l'ouverture beta de la Pro League
  (lot 1.D — pas d'argent réel impliqué)
- Skin "Panel Founder" sur ton profil Nuffle Arena

## Matériel fourni

- 50 replays texte dans `replays/` (un fichier `.txt` par match)
- Header de chaque replay : home vs away avec races BB, seed et
  engine version
- Body : un line par event de la timeline (KICKOFF / TURN_START /
  BLOCK / DODGE / PASS / TD / TURNOVER / KO / CASUALTY / NUFFLE /
  HALFTIME / END) avec dice rolls + skills + outcomes
- Footer : score final + counts (TDs, casualties, turnovers, Nuffle)

Les replays sont déterministes : si tu re-run la sim avec le même
seed, tu obtiens le même fichier. Ton retour pourra donc être
exactement reproduit.

## Workflow

1. **Lis 10 replays** au hasard pour te faire une idée du flow.
2. Pour chaque axe (4 au total), **note les 50 replays globalement**
   sur 0-10 — pas besoin de noter chaque match individuellement,
   l'objectif est ta perception d'ensemble.
3. Duplique [`notation-grille.md`](./notation-grille.md) en
   `grille-<ton-pseudo>.md` à la racine du dossier panel.
4. Remplis ta grille (4 notes 0-10 + 1 paragraphe par axe + verbatim
   2-3 replays remarquables / problématiques).
5. Soumets via une PR sur la branche `claude/pro-league-panel-feedback`
   ou par mail à `panel@nuffle-arena.local`.

## Deadline

7 jours calendaires depuis l'envoi de ce brief. Au-delà, ta note ne
sera pas comptée dans la synthèse.

## Les 4 axes de notation

### 1. Lisibilité tactique (0-10)

Est-ce que les choix de l'IA pendant la partie sont *compréhensibles*
pour un coach BB humain ? Une cage qui se forme, un drive en pass
route deep, un foul-fest contre une star adverse — tout ça doit se
"lire" comme un coach experimenté qui regarde un replay.

Notes-guide :
- 10 : "Je comprends chaque décision et je l'aurais probablement
       prise moi-même la moitié du temps."
- 7  : "Je vois la logique, mais quelques choix me paraissent étranges."
- 4  : "Souvent perplexe. L'IA blitze sans raison ou passe sur un 1d6+."
- 0  : "Decisions aleatoires, aucun fil conducteur tactique."

### 2. Cohérence des drives (0-10)

Un drive doit raconter une histoire : possession qui avance, defenders
qui s'opposent, momentum qui bascule sur un block ou un dodge. Pas de
freeze, pas de teleport, pas de TD venu de nulle part.

Notes-guide :
- 10 : "Chaque drive a un arc — début / milieu / fin se justifient."
- 7  : "La majorité des drives tient debout, quelques-uns sentent le random."
- 4  : "Souvent des drives bizarres (ball relachee de nulle part, blocks
       qui produisent rien)."
- 0  : "Pas de fil narratif, ca ressemble a une suite de dices isolés."

### 3. Identité raciale (0-10)

Pittsburgh Smashers (Orcs) doit jouer cage + bash. Kansas City Soaring
Hawks (Wood Elves) doit lancer des passes deep. Buffalo Snow Ogres
doit casser des cous. Green Bay Cheese Halflings doit tenter
l'impossible. Si tu lis 10 replays sans regarder le header, tu dois
pouvoir deviner les races.

Notes-guide :
- 10 : "Identités tres lisibles, je devine la race en 3 turns."
- 7  : "La majorité des races est reconnaissable, certaines se confondent."
- 4  : "Les races jouent toutes pareil ou presque."
- 0  : "Aucune signature raciale, on ne pourrait pas les distinguer."

### 4. Moments mémorables (0-10)

Combien de fois sur 50 replays as-tu envie de raconter le match à
quelqu'un ? Un upset, un TD à la dernière seconde, une chaîne de
GFI ratés, un Nuffle event drôle, une casualty qui change tout. La
Gazette LLM (lot 1.E.1) a besoin de matériel narratif.

Notes-guide :
- 10 : "10+ matchs sont des histoires que je raconterais."
- 7  : "5-9 matchs avec un moment marquant."
- 4  : "1-4 matchs avec un moment marquant."
- 0  : "Tous les matchs sont interchangeables."

## Questions

- Discord : `#pro-league-panel` (lien dans le mail d'invitation)
- Mail : `panel@nuffle-arena.local`
- Issue tracker : `github.com/Ryxeuf/fantasy-football-game/issues` avec label `panel-feedback`
