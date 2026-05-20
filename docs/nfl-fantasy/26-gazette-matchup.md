# 26 — Gazette par matchup (Phase 3.H)

> Genere un article narratif "Nuffle Gazette" post-settle pour
> chaque matchup, via Claude Haiku. Donne du flavor au replay et
> permet de tester l'integration LLM sans assumer un cron production.

## Motivation

Apres Phase 3.G (replay), on a des matchups settle avec scores,
captains et starters. Ce sont des donnees factuelles seches. Une
narrative legere ("Home Team a etourdi Away Squad ce dimanche... Star
QB a colle 60 points sous le multiplier captain ×1.5...") rend les
pages admin et bientot user-facing nettement plus engageantes.

Pattern : on reutilise l'infrastructure existante `pro-gazette-llm`
(`callClaude` + parse JSON strict), mais on simplifie : 1 article par
matchup, pas de personas multiples, pas de cron — l'admin trigge
manuellement.

## Schema

Ajout de 3 colonnes a `NflFantasyMatchup` :

```prisma
gazetteTitle       String?
gazetteBody        String?
gazetteGeneratedAt DateTime?
```

Migration via `prisma db push` depuis le container `nufflearena_server`
(memo pattern). Pas de migration explicite : prod sera resyncee plus
tard.

## Backend

### Service `nfl-fantasy-gazette.ts`

```ts
generateMatchupGazette(matchupId, { force?, model?, maxTokens?, fetchImpl? })
  -> { matchupId, title, body, generatedAt, skipped, skipReason?, usage? }
```

Flow :

1. Charge le matchup via `getMatchupDetailForAdmin` (reuse Phase 3.J).
2. Throw `MATCHUP_NOT_FOUND` ou `MATCHUP_NOT_SETTLED` si pas pret.
3. Idempotent : skip si `gazetteGeneratedAt != null` sauf `force=true`.
4. Build prompt avec `buildMatchupUserPrompt` (pur, testable) qui
   passe en payload JSON : score, race, top 3 starters de chaque
   side avec captain/vice flags + finalSpp.
5. `callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 800, ... })`.
6. `parseGazetteLLMResponse` valide `{ title, body }` (tolere les
   fences markdown, tronque title a 200 chars).
7. Persiste `gazetteTitle / gazetteBody / gazetteGeneratedAt`.

### Erreur typee

```ts
class NflFantasyGazetteError extends Error {
  code: "MATCHUP_NOT_FOUND" | "MATCHUP_NOT_SETTLED"
      | "LLM_INVALID_JSON" | "LLM_INVALID_SHAPE"
}
```

Mappee dans `nfl-error-mapper` :
- `MATCHUP_NOT_FOUND` → 404
- `MATCHUP_NOT_SETTLED`, `LLM_INVALID_JSON`, `LLM_INVALID_SHAPE` → 422

### Route

```
POST /admin/nfl-fantasy/explore/matchups/:id/generate-gazette
Body Zod: { force?: boolean }
```

### Extension `getMatchupDetailForAdmin`

Le service Phase 3.J expose maintenant un champ `gazette: null | {
title, body, generatedAt }` dans `AdminMatchupDetail`. Le frontend
peut donc afficher la gazette deja generee au load de la page sans
appel supplementaire.

## Prompt design

System prompt (court) : ton enthousiaste + pulp + JSON strict
`{ title, body }`.

User prompt : payload structure `{ seasonId, weekId, homeTeam,
awayTeam, homeScore, awayScore, winnerSide, homeRace, awayRace,
homeTop[3], awayTop[3] }`. Chaque starter inclut `pseudonym /
finalSpp / isCaptain / isViceCaptain / bbPosition`.

Le winner explicite est affirme dans le prompt ("Le winner est :
Home Team (home).") pour eviter que le LLM se trompe sur le score
arithmetique.

## Frontend

Section "📜 Nuffle Gazette" en bas de `/admin/nfl-fantasy/matchups/
[id]` (uniquement si `settledAt != null`). 2 boutons :

- **Générer** (ou "Re-load" si deja present) : POST avec
  `force: false`. Idempotent — si gazette deja generee, le serveur
  renvoie celle existante.
- **Régénérer (force)** : visible uniquement si gazette deja la.
  POST avec `force: true` — recall LLM + ecrase l'existante.

L'article s'affiche dans une card amber avec `whitespace-pre-wrap`
pour preserver les paragraphes du LLM. Errors LLM s'affichent dans un
banner rouge inline (network, invalid JSON, etc).

## Tests

`nfl-fantasy-gazette.test.ts` (14 tests) couvre :

- `parseGazetteLLMResponse` : JSON valide, fences, JSON invalide,
  title/body manquants, troncature title 200.
- `buildMatchupUserPrompt` : winner home, tie.
- `generateMatchupGazette` :
  - MATCHUP_NOT_FOUND
  - MATCHUP_NOT_SETTLED
  - happy path (LLM call + parse + persist + return usage)
  - idempotent (skip + skipReason='already_generated', pas de
    callClaude)
  - force=true regenere (LLM appele meme si existante)
  - propagation LLM_INVALID_JSON (pas de persist)

`nfl-error-mapper.test.ts` est inchange — les codes sont mappés via
les `case` ajoutes.

`nfl-fantasy-admin-explorer.test.ts` : update des 3 fixtures matchup
detail pour inclure `gazetteTitle/Body/GeneratedAt: null` — pas de
nouveau test ajoute.

## Cout / quota LLM

Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), maxTokens 800. Cout
estime : ~500 input + ~200 output tokens = ~0.0008 USD par appel
(Haiku tarification 2025). Une saison replay 18 weeks × 4 matchups =
72 calls = ~0.06 USD. Negligeable a l'echelle admin.

## Hors scope (futurs)

- **Generation automatique post-settle** : actuellement manuel.
  V2 : hook dans `settleNflFantasyWeek` pour lancer la gazette en
  arriere-plan apres settle (besoin worker queue).
- **Affichage user-facing** : la gazette est admin-only pour
  l'instant. V2 : route GET publique + bouton sur la page matchup
  des utilisateurs reels (non-replay).
- **Multi-persona** : reutiliser le pattern `pro-gazette-llm` avec
  3 personas (cynic / orc_enthusiast / statistician) pour varier le
  ton. Demande prompt plus elabore + colonne `gazettePersona` en
  plus.
- **Cache de prompts** : un meme matchup ne change pas, on pourrait
  hash(matchupId+stats) et reutiliser le resultat si appel multi-fois
  (deja le cas via `gazetteGeneratedAt`).
