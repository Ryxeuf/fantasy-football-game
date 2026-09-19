# L'invalidation d'une feuille n'est plus bloquée par un journalier ou un mort relevé recruté

## Why

Retour testeur (Discord, 2026-09-19, match « Gones Kass'Krânes vs Nordlands
Creepers ») : le commissaire ne peut plus invalider une feuille validée —
« Reversion impossible: purchase-consumed — un joueur acheté après ce match a
déjà joué ou progressé ». Le joueur en cause est le Zombie relevé par Maîtres
de la Non-vie (« Mort relevé (Trois-quart Zombie) », n°13 Lakrakzette) que le
coach nécromant a recruté à l'étape EMBAUCHES.

La cause : un journalier ou un mort relevé recruté est créé AVEC ce qu'il a
gagné en jouant CE match — 1 match joué, ses PSP restants, l'évolution prise
à l'étape 3 (`applyOfflinePurchasesForTeam`). Le garde-fou de reversion
(`offlinePurchasesConsumed`) comparait ces compteurs à ZÉRO, la référence
d'un joueur acheté ordinaire : le recrutement passait donc toujours pour un
usage POSTÉRIEUR au match, et la feuille devenait définitive. Le testeur
l'a dit mot pour mot : « il ne faut pas bloquer l'invalidation si un joueur
relevé dans le match a joué ensuite dans ce même match. Idem pour un
journalier ».

## What Changes

- **Le garde-fou compare à l'état À LA CRÉATION, jamais à zéro.** Nouveau
  module PUR `services/league-offline-purchase-baseline` : référence d'un
  achat (un recrutement de feuille vaut `spp` / `advancements` du recrutement
  et 1 match joué, un joueur acheté part de zéro), résolution de la référence
  de chaque joueur créé, et prédicat « consommé DEPUIS » (un match de plus,
  des PSP de plus, un avancement de plus, ou mort).
- **La trace des mutations stocke la référence** (`createdPlayers` sur
  `OfflineRosterMutationSide`, à côté de `createdPlayerIds`) pour toute
  feuille validée désormais.
- **Les feuilles déjà validées sont couvertes sans backfill** : la référence
  est REDÉRIVÉE des achats du snapshot (`input.purchasesHome/Away`, déjà
  persistés), alignés dans l'ordre sur les joueurs créés et vérifiés (poste,
  nom). Quand l'alignement n'est pas certain (un achat sauté), la référence
  retombe sur zéro : le comportement historique, conservateur.
- Un recrutement qui a REJOUÉ, progressé ou est mort depuis reste refusé
  (`purchase-consumed`), et l'invalidation retire toujours le joueur recruté,
  rend l'or et ressuscite le mort adverse ; une nouvelle validation le
  recrute à nouveau.

## Impact

- Serveur : `services/league-offline-purchase-baseline.ts` (nouveau),
  `league-offline-purchases.ts` (trace + garde-fou), `league-offline-edit.ts`
  (passe les achats du snapshot au garde-fou).
- Snapshot `Match.offlineResultInput.rosterMutations.<side>.createdPlayers`
  (JSON, optionnel) : lisible sans backfill, aucune colonne Prisma.
- Tests : module pur, service d'achats, reversion, snapshot ; e2e-api
  `leagues-sheet-raise-dead-undead` (invalidation puis re-validation) et
  `leagues-sheet-journeymen-orc` (invalidation).
- Web : aucun changement (le message de refus reste celui du serveur).
