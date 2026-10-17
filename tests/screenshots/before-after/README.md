# Captures avant / après sur l'application réelle

Le harnais du dossier parent rend des composants isolés. Une correction qui
AJOUTE une page, une route ou une donnée serveur ne se prouve pas ainsi : il
faut l'application entière, dans les deux versions, sur le même jeu de
données. C'est ce que fait cet outillage (parité ligue ↔ coupe, change
OpenSpec `cup-league-parity`).

| Fichier | Rôle |
|---|---|
| `seed.ts` | Remplit un serveur de test (coupes, rencontres, pronostics, coupe terminée, coupe NAF à coups de pouce, ligue) et écrit `ids.json` + les feuilles `*-sheet.json`. N'emploie que des routes communes aux deux versions. |
| `capture.mjs` | Captures Playwright (pages entières et découpes calées sur les titres) pour une version. |
| `render-sheet-pdf.template.txt` | Gabarit qui rend la feuille de rencontre PDF d'une réponse `GET …/sheet`, avec le code PDF de la version visée. |
| `compose.py` | Assemble AVANT au-dessus d'APRÈS, avec bandeaux, en palette 256 couleurs. |

## Régénérer

```bash
# 1. La version d'avant dans un worktree (dépendances installées).
git worktree add /tmp/avant <commit-de-base> && (cd /tmp/avant && pnpm install)

# 2. Un serveur de test + le web par version (ports distincts ; CORS_ORIGINS
#    doit nommer l'origine du web, le défaut n'accepte que :3100).
(cd apps/server && API_PORT=18002 TEST_SQLITE=1 \
  TEST_DATABASE_URL='file:memdb-apres?mode=memory&cache=shared' \
  JWT_SECRET=s MATCH_SECRET=m FEATURE_FLAGS_FORCE_ENABLED=true pnpm run dev:nowatch &)
(cd apps/web && NEXT_PUBLIC_API_BASE=http://localhost:18002 npx next dev -p 3100 &)
# idem dans /tmp/avant : API_PORT=18003, CORS_ORIGINS=http://localhost:3101, web sur 3101

# 3. Données, captures, PDF — pour chaque version.
cd tests/screenshots
API_PORT=18002 SHOTS_OUT=/tmp/apres npx tsx before-after/seed.ts
node before-after/capture.mjs 3100 /tmp/apres/ids.json /tmp/apres
cp before-after/render-sheet-pdf.template.txt ../../apps/web/app/lib/competition-pdf/zz-render.test.ts
(cd ../../apps/web && SHEET_DIR=/tmp/apres npx vitest run app/lib/competition-pdf/zz-render.test.ts)
rm ../../apps/web/app/lib/competition-pdf/zz-render.test.ts
pdftoppm -r 110 -f 2 -l 2 -png /tmp/apres/naf-sheet.pdf /tmp/apres/naf-sheet-p

# 4. Assemblage (exemple).
python3 before-after/compose.py /tmp/avant-shots/rondes.png /tmp/apres/rondes.png \
  ../../docs/screenshots/cup-parity-rondes.png "AVANT — …" "APRÈS — …"
```

Pièges rencontrés :

- la fixture `/__test/seed-team` pose une VE arbitraire (1 000 po, VEA 0) :
  `seed.ts` fait recalculer chaque équipe (`POST /team/:id/recalculate`) ;
- tuer un serveur par `pkill -f "API_PORT=…"` tue aussi le shell qui lance la
  commande : viser le PID (`/proc/<pid>/environ`) ;
- la police des bandeaux n'a pas d'emoji.
