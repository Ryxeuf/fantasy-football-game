# Édition réversible d'un résultat offline — 2026-06-01 (W-B)

Le créateur d'une ligue peut **corriger une erreur de saisie** sur un match
offline déjà enregistré. L'édition = **annuler la saisie puis re-saisir** (la
saisie applique des incréments « à l'aveugle » impossibles à patcher en place).

## Architecture

### B1 — Stockage de la saisie brute
Nouveau champ `Match.offlineResultInput Json?` (schéma PG + mirror sqlite +
client sqlite régénéré ; appliqué en prod via `prisma db push` — ce repo ne
versionne pas les migrations, cf. `.gitignore`). `recordOfflineLeagueResult`
persiste un snapshot : saisie normalisée + pré-valeurs non-incrémentales
(`dedicatedFans` avant clamp). Helpers `buildOfflineSnapshot` /
`parseOfflineSnapshot` (parse tolérant PG objet / sqlite string).

### B2 — Réversion (`league-offline-edit.ts`)
`reverseOfflineLeagueResult(matchId)` relit le snapshot et inverse exactement :
standings décrémentés (ELO non touché — skip à la saisie), SPP/totaux/
matchesPlayed décrémentés (même modifier qu'à la saisie), treasury décrément +
`dedicatedFans` restauré à la pré-valeur, blessures décrémentées +
`missNextMatch=false`. Puis supprime les `TeamSelection` (pas de cascade) et le
`Match` (cascade la post-match-sequence), ré-ouvre le pairing (`scheduled`) et
le round si la saisie l'avait clôturé.

**Garde-fous (refus)** : match introuvable / non-offline / non comptabilisé /
snapshot absent ; **saison clôturée** ; **playoffs générés** ; blessure **`dead`**
appliquée ; **level-up déjà consommé** (advancements du joueur > `advancementsTaken`
capturé dans la post-match-sequence).

### B3 — Orchestration + route
`editOfflineLeagueResult(input)` = trouve le match offline du pairing →
`reverseOfflineLeagueResult` → `recordOfflineLeagueResult(nouvelle saisie)`
(réutilise 100 % de la logique de saisie). Propage les refus de réversion.
Route `PUT /leagues/pairings/:pairingId/result` (créateur only, 409 si refus).

> Note : reverse + record sont 2 transactions distinctes. Si la re-saisie
> échoue après une réversion réussie, le pairing est simplement ré-ouvert sans
> résultat — état récupérable (ressaisie).

### B4 — UI
Bouton « Modifier » sur les pairings offline `played` (créateur) →
`EnterResultModal` en mode édition. **Pré-remplissage complet** depuis
`GET /leagues/pairings/:id/result` (score/CAS/éco/stats joueur/blessures) — clé
pour ne pas perdre les stats/blessures non affichées lors du reverse+reapply.
Submit en `PUT`.

## Tests
- `league-offline-edit.test.ts` 13/13 (garde-fous + réversion exacte +
  orchestration no-existing / refus propagé / annule+re-saisit).
- `league-offline-result.test.ts` 8/8 (snapshot persisté).
- `EnterResultModal.test.tsx` 6/6 (+pré-remplissage/PUT). Web leagues 59/59.
- `tsc` server + web : clean.
