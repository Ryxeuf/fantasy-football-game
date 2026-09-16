# Design — le rattrapage se paie à la lecture, le mot-clé se stocke

## Un correctif de calcul ne corrige pas un compteur persisté

`eliminationEarnsSpp` est la définition d'une sortie, et les trois lectures
qui comptent des sorties en dérivent déjà. Mais la ligue PERSISTE ses
compteurs à la validation (c'est ce qui rend le classement lisible sans
rejouer toutes les feuilles), donc une feuille validée AVANT la règle garde
ses chiffres. `prisma/migrations/` est gitignoré (prod = `db push`) : aucun
backfill de migration n'est possible — c'est exactement le cas prévu par la
règle « toute colonne de gating ajoutée doit être lisible SANS backfill ».

Le rattrapage lui-même existe déjà, écrit pour ça : `resyncValidatedSheetCasualties`
rejoue les seuls DELTAS qui dépendent de la qualification des sorties, il est
idempotent et journalisé. Ce qui manquait, c'est son DÉCLENCHEUR. Un script
d'opérateur ne corrige que les bases sur lesquelles quelqu'un pense à le
lancer ; le bug est donc resté visible.

**Patron retenu** : celui du repo (« Snapshot lazy compute avec staleness
window ») — pas de cron, le lecteur paie le recompute. Ici la fenêtre n'est
pas temporelle mais VERSIONNÉE : la règle a changé une fois, il suffit de
savoir quelles feuilles ont été écrites avant.

```prisma
/// null = feuille validée avant la règle « une sortie rapporte des PSP »
/// (à rattraper), sinon la version sous laquelle elle a été écrite.
casualtyRuleVersion Int?
```

Le marqueur vit sur la FEUILLE, pas sur la saison : une feuille validée après
le passage n'a jamais besoin d'être revisitée, et le balayage devient une
requête qui ne ramène rien (`casualtyRuleVersion: null` + `status: validated`).
Un marqueur de saison aurait re-balayé la saison entière à chaque nouvelle
validation, ou obligé à le remettre à zéro.

Le balayage est posé dans `computeSeasonStandings`, le seul entonnoir des
classements (détail de ligue, endpoint dédié, récap) : c'est l'écran où le
« 5 » se lit. Il est BEST-EFFORT — un rattrapage en échec ne doit jamais
empêcher d'afficher un classement — et il marque aussi les feuilles que la
resynchronisation refuse par conception (saison clôturée, snapshot absent),
sinon elles seraient retentées à chaque consultation sans jamais bouger.

Alternative rejetée : dériver `casualtiesFor/Against` des feuilles à la
lecture. C'est le vrai remède, mais il change la nature du classement (les
matchs saisis hors feuille n'ont pas d'évènements) et coûte un rejeu complet à
chaque affichage.

## Haine (X) : le choix est stocké, le candidat est dérivé

Même patron que les journaliers et le mort relevé. Le CANDIDAT (victime,
auteur, mots-clés éligibles) se redérive de la feuille à chaque lecture : une
correction de saisie qui change l'auteur d'une sortie change les mots-clés
proposés, sans qu'aucun backfill soit nécessaire. Seul le CHOIX est écrit.

```prisma
/// Haine (X) — mot-clé retenu par victime : [{ victimPlayerId, keyword }].
hateChoices Json?
```

Trois conséquences voulues :

- un choix devenu ineligible (l'auteur a changé) est IGNORÉ silencieusement
  au lieu de faire échouer la validation : on retombe sur le premier mot-clé,
  exactement comme une feuille antérieure ;
- la clé est la VICTIME, pas le couple (victime, auteur) : la règle n'accorde
  qu'un trait par joueur blessé et par match, et `buildHateCandidates`
  dédoublonne déjà sur (victime, mot-clé) ;
- le D6 reste jeté à la validation, côté serveur. Choisir avant de savoir si
  le trait sera accordé n'est pas gênant — c'est une préférence, pas un pari.

`resolveHateKeyword(csv, preferred)` vit dans le moteur, à côté de
`pickHateKeyword` dont elle est la généralisation : `preferred` gagne s'il est
dans les éligibles (comparaison NORMALISÉE — « morts-vivants », « Morts
Vivants » et « MORTS_VIVANTS » se rejoignent), sinon premier éligible. Pur,
donc testable sans base ni DOM, et partagé par la dérivation des candidats et
la validation — les deux ne peuvent pas diverger.
