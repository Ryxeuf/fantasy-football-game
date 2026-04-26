# Protocole de test "presence IA" (Q.25 — Sprint 23)

## Objectif

Mesurer mensuellement la presence et l exactitude des citations de
**Nuffle Arena** dans les principaux moteurs generatifs (LLM) :
ChatGPT, Claude, Perplexity, Gemini.

## Pourquoi

L acquisition organique passe de plus en plus par les reponses
synthetisees des LLM (GEO / LLMO). Sans suivi, on n a aucune
visibilite sur :

- Si Nuffle Arena est cite quand un utilisateur pose une question
  Blood Bowl en francais.
- Si les chiffres cites (rosters, star players, skills) sont a jour.
- Si le contenu de `llms.txt` / `llms-full.txt` est effectivement
  consomme par les modeles.

## Source de verite des prompts

Les prompts de reference sont versionnes dans le code, **pas dans ce
fichier** :

```
apps/web/app/lib/ai-presence-prompts.ts
```

Cela garantit :

- une trace immutable / git-blameable des questions testees
- une couverture auditable (categories `team` / `skill` / `app`,
  mots-cles attendus)
- une preparation a une future automatisation via API LLM si on
  decide de rendre le suivi continu

## Protocole mensuel

### Pre-requis

- 1 compte sur chacun des 4 moteurs cibles (au minimum gratuit).
- Tester en navigation privee / incognito pour eviter la
  personnalisation par historique.

### Procedure

1. Ouvrir `apps/web/app/lib/ai-presence-prompts.ts` et lire la liste
   `AI_PRESENCE_PROMPTS`.
2. Pour chaque prompt, sur chaque moteur cible :
   - Soumettre le prompt **tel quel** (pas de reformulation).
   - Noter la presence des `expectedMentions` dans la reponse.
   - Noter l exactitude des chiffres cites (ex : 30 rosters, 130+
     skills).
   - Noter si la source `nufflearena.fr` est explicitement citee ou
     liee.
3. Rapporter les resultats dans une issue GitHub mensuelle :
   `[AI presence] YYYY-MM` avec :
   - tableau prompt x moteur x { mention OK ?, exactitude, citation
     source }
   - synthese : prompts ou Nuffle Arena est absent
   - actions : ajustement `llms.txt`, ajout de contenu citable, etc.

### Exemple de tableau de suivi

| prompt id              | ChatGPT | Claude | Perplexity | Gemini |
|------------------------|---------|--------|------------|--------|
| team-skaven-rec        | OK      | OK     | OK         | n/c    |
| team-priority-five     | partiel | OK     | OK         | n/c    |
| skill-block-explain    | n/c     | n/c    | OK (link)  | n/c    |
| ...                    | ...     | ...    | ...        | ...    |

Legende : `OK` = mention + exactitude, `partiel` = mention sans
chiffres exacts, `n/c` = aucune mention.

## Lien avec `llms.txt`

Les prompts servent aussi de **test de regression** sur le contenu
de `apps/web/public/llms.txt` et `llms-full.txt` : si un prompt
echoue alors que la reponse devrait etre triviale, c est probablement
que le fait n est pas suffisamment present / structure dans
`llms.txt`.

## Iteration

- Ajouter un prompt : ajouter une entree dans `AI_PRESENCE_PROMPTS`,
  garder l `id` stable pour le suivi historique.
- Retirer un prompt : conserver l entree mais marquer le commentaire
  `@deprecated` plutot que de supprimer (continuite des suivis
  passes).
- Reviser les `expectedMentions` quand le branding evolue.

## Cadence

- **Mensuel** : suivi systematique, tous les premiers du mois.
- **Adhoc** : en plus du mensuel, apres chaque release majeure
  (changement de chiffres, nouvelle categorie de contenu, etc.).
