# Les coupes se gèrent comme les ligues

## Why

`/cups` et `/leagues` racontaient deux histoires différentes du même jeu.

Une **ligue** a une feuille de match : avant-match (météo, coups de pouce,
prières), journal d'évènements, soumission des deux coachs, validation du
commissaire, fenêtre d'invalidation — et toute la séquence d'après-match du
livre (p. 68). Une **coupe** avait un « match local » : une saisie d'actions
libre, sans gel, sans validation, sans invalidation, sans rien de commun avec
l'autre. Deux mécaniques pour la même chose, donc deux règles qui dérivent :
un correctif de feuille ne profitait qu'à la moitié des compétitions.

Le reste suivait le même déséquilibre :

1. **Aucun écran d'édition.** Corriger le nom d'une coupe ou son barème
   imposait de la recréer — et donc de réinscrire tout le monde.
2. **Un seul appariement.** Une coupe ne savait générer qu'une ronde SUISSE.
   Or à la ronde 1 le classement est vide : l'appariement suisse s'y réduit à
   l'ordre alphabétique. Les tournois tirent leur première ronde au sort, et
   un commissaire veut parfois poser les rencontres à la main.
3. **Un classement figé dans le code.** Le barème de points est entièrement
   paramétrable, mais les départages étaient EN DUR. Un règlement qui
   départage à la BASH ou aux TD encaissés n'était pas exprimable.
4. **Construire une équipe pour une coupe échouait en silence.** Deux chemins
   ramenaient au budget natif du roster (1 000 kpo) et à un pool de 0 PSP —
   donc aucune compétence achetable — pour une équipe que l'inscription
   refusait ensuite.

## What Changes

Une coupe garde ses différences de RÈGLE, et rien d'autre : aucun PSP, aucune
blessure ni mort conservée, aucun gain d'or ni de fans, aucune évolution ni
achat — et chaque rencontre se joue avec le roster D'INSCRIPTION, tel quel
(mode résurrection).

- **Feuille de match commune.** `LeagueMatchSheet` devient POLYMORPHE (ligue
  XOR coupe, deux FK nullables — même patron que `CompetitionDocument`) et le
  service résout la rencontre dans l'une puis l'autre table. Les ~4 000 lignes
  de la feuille ne sont pas dupliquées ; seul un JEU DE RÈGLES par compétition
  décide de ce que la validation écrit. Les routes de coupe montent les mêmes
  handlers, et le web sert la même page.
- **Le résultat d'une coupe est matérialisé** en `LocalMatch` complété, et le
  journal rejoué en `LocalMatchAction` : classement, podiums par action et
  classements individuels — tous DÉRIVÉS — continuent de fonctionner sans
  changement. Même procédé que le `Match` offline synthétique des ligues.
- **Trois appariements** : tirage au sort (défaut de la 1re ronde), ronde
  suisse, saisie manuelle. Le tirage est un appariement suisse sur un ordre
  mélangé : il hérite du « zéro rematch », de l'exempt tournant et de
  l'équilibrage des réceptions, sans second moteur. Graine = coupe + numéro de
  ronde, donc rejouable.
- **Critères de classement configurables** (`Cup.tieBreakRules`, 13 slugs) et
  **édition d'une coupe** (`PATCH /cup/:id` + `/cups/[id]/edit`).
- **Corrections de construction** : un règlement de tournoi compte comme un
  ajustement de composition (« Adapter à la coupe », plus « Inscrire tel
  quel ») ; un règlement imposé mais introuvable côté client est annoncé et
  bloque la création au lieu de retomber en silence ; le lien de secours
  « Créer une équipe » porte le contexte de la coupe.

## Impact

- **Aucun backfill.** `prisma/migrations/` est gitignoré, la prod applique
  `db push` : `Cup.tieBreakRules` est nullable et lue avec repli (ordre
  historique), `LeagueMatchSheet.pairingId` passe nullable sans toucher une
  seule feuille existante, et `CupRound.system` était déjà une colonne libre.
- Le classement historique d'une coupe est **inchangé** tant qu'aucun critère
  n'est configuré : le comparateur par défaut reproduit l'ordre en dur.
- `POST /cup/:id/rounds/swiss` reste servi ; la nouvelle route
  `POST /cup/:id/rounds` la généralise.
- Le « match local » d'une coupe reste possible : la feuille s'y ajoute sans
  retirer le chemin existant.
