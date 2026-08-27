# Haine (X) — acquisition du trait sur blessure

## La règle

Un joueur sorti d'un match avec une blessure qui le rendra **absent au
moins le match suivant** (Amoché, Blessure Sérieuse, Séquelle) jette
**1D6** à la validation de la feuille de match. Sur **4+**, il gagne le
trait **Haine (X)**, où **X** est un Mot-clé du joueur qui l'a éliminé.

X est nécessairement un mot-clé de **lignée** (Humain, Orque, Nain,
Troll, Homme Lézard…). Les mots-clés de **poste** sont exclus :

> Gros Bras, Bloqueur (*Blocker*), Blitzer, Receveur, Trois-quart,
> Coureur, Spécial, Lanceur.

Haïr « les Blitzers » n'aurait aucun sens de rivalité, et la moitié du
terrain finirait par porter le trait.

Le trait **ne se choisit jamais à l'évolution** : c'est le seul trait du
jeu qui s'obtient uniquement en étant mis sur la touche.

## Où ça vit

| Couche | Fichier | Rôle |
|---|---|---|
| Moteur (pur) | `packages/game-engine/src/skills/hate-trait.ts` | Mots-clés exclus, choix de X, slug de compétence, seuil du D6, définition de la compétence à créer |
| Résumé de feuille | `apps/server/src/services/league-match-summary.ts` | `InjuredPlayer.causedByPlayerId` — l'auteur de la sortie |
| Service | `apps/server/src/services/league-hate-trait.ts` | Candidats, résolution des Mots-clés, jet + pose, réversion |
| Feuille de match | `apps/server/src/services/league-match-sheet.ts` | Résout les Mots-clés des joueurs de la feuille et produit `hateCandidates` |
| Application | `apps/server/src/services/league-offline-result.ts` | Joue le jet **après** les blessures, mémorise `hateGranted` dans le snapshot |
| Invalidation | `apps/server/src/services/league-offline-edit.ts` | Retire les traits accordés par le match annulé |

## Détails qui comptent

**Qui peut être haï.** L'auteur de la sortie peut être un joueur du
roster, un **journalier** ou un **Star Player** engagé : tous les trois
portent des Mots-clés. Une auto-élimination (esquive ratée) et une sortie
par la foule n'ont pas d'auteur — personne à haïr.

**La mort ne déclenche rien.** Un joueur mort n'a plus de match à jouer.

**Un seul jet par couple (victime, X).** Deux sorties infligées par le
même adversaire dans le même match ne donnent qu'un jet. Un joueur qui
possède déjà Haine (X) pour ce mot-clé ne rejette pas.

**Le trait ne coûte rien en VE.** Il est posé sur la CSV
`TeamPlayer.skills`, pas dans `advancements` — le calcul de valeur
d'équipe ne lit que `advancements`. Ce n'est pas une amélioration
achetée.

**Mots-clés : base d'abord, moteur en repli.** La colonne
`Position.keywords` est éditable en admin ; `KEYWORDS_SEASON3` en est la
transcription de référence et le repli (même posture que
`effectiveRegionalRules`).

**Création à la volée.** Le catalogue ne porte que trois variantes
(`hate`, `hate-troll`, `hate-dwarf`). Les autres sont créées à la
première occurrence, toujours avec `excludedFromSelection: true`. Une
ligne antérieure restée sélectionnable est réparée au passage — le seed
la corrige aussi, sans attendre le prochain déploiement.

**Réversible.** Comme toute écriture d'après-match, les traits accordés
sont mémorisés dans `Match.offlineResultInput.hateGranted` et retirés à
l'invalidation de la feuille.
