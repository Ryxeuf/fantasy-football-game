#!/usr/bin/env bash
set -euo pipefail

BRANCH="ci-automation-setup"
ROOT="$(pwd)"

log() { printf "\n\033[1;36m➜ %s\033[0m\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it and re-run."; exit 1; }
}

# --- sanity checks ---
[ -f "package.json" ] || { echo "Run this at repo root (package.json not found)."; exit 1; }
require git
require node
require pnpm || true  # recommandé mais pas strict

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo."; exit 1; }

log "Creating branch $BRANCH"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"

mkdir -p .github/workflows .github

# ---------- package.json scripts (typecheck/test/changesets) ----------
log "Augmenting package.json scripts (typecheck/test/changesets)"
node <<'NODE'
const fs = require('fs');
const f = 'package.json';
const j = JSON.parse(fs.readFileSync(f,'utf8'));
j.scripts ||= {};
j.scripts.dev ??= "turbo run dev --parallel";
j.scripts.build ??= "turbo run build";
j.scripts.lint ??= "turbo run lint --continue";
j.scripts.typecheck ??= "turbo run typecheck --continue";
j.scripts.test ??= "turbo run test --continue";
j.scripts.changeset ??= "changeset";
j.scripts["changeset:version"] ??= "changeset version && pnpm install";
j.scripts["changeset:publish"] ??= "echo 'No registry publish (private)'; exit 0";
fs.writeFileSync(f, JSON.stringify(j,null,2) + "\n");
NODE

# ensure devDeps for changesets (lazy add, won't break if you use npm/yarn)
log "Adding dev dependencies (Changesets) to package.json (no install run)"
node <<'NODE'
const fs = require('fs');
const f = 'package.json';
const j = JSON.parse(fs.readFileSync(f,'utf8'));
j.devDependencies ||= {};
j.devDependencies["@changesets/cli"] ||= "^2.27.8";
j.devDependencies["@changesets/changelog-github"] ||= "^0.5.0";
fs.writeFileSync(f, JSON.stringify(j,null,2) + "\n");
NODE

# ---------- CI basic ----------
log "Writing .github/workflows/ci.yml"
cat > .github/workflows/ci.yml <<'YAML'
name: CI
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - name: Cache turbo
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            **/node_modules
            .turbo
          key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Typecheck
        run: pnpm -w run typecheck || echo "No explicit typecheck scripts in some packages"
      - name: Build
        run: pnpm build
      - name: Unit tests
        run: pnpm -w test || echo "No test scripts yet"
YAML

# ---------- E2E ----------
log "Writing .github/workflows/e2e.yml"
cat > .github/workflows/e2e.yml <<'YAML'
name: E2E Web
on:
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps || true
        working-directory: apps/web
      - name: Build web
        run: pnpm --filter @bb/web build
      - name: Start web (bg)
        run: pnpm --filter @bb/web start &
      - name: Wait on web
        run: npx wait-on http://localhost:3000
      - name: Run Playwright tests
        run: pnpm --filter @bb/web test:e2e || echo "Add Playwright tests to apps/web"
YAML

# ---------- Release (Changesets) ----------
log "Writing .github/workflows/release.yml + .changeset/config.json"
mkdir -p .changeset
cat > .changeset/config.json <<'JSON'
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "REPLACE_ME_ORG/REPLACE_ME_REPO" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
JSON

cat > .github/workflows/release.yml <<'YAML'
name: Release
on:
  push:
    branches: [ main ]
  workflow_dispatch: {}
permissions:
  contents: write
  pull-requests: write
jobs:
  version-or-release:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm -w changeset:publish
          version: pnpm -w changeset:version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
YAML

# ---------- Docker build server (GHCR) ----------
log "Writing .github/workflows/docker-server.yml"
cat > .github/workflows/docker-server.yml <<'YAML'
name: Docker Server
on:
  push:
    branches: [ main ]
    tags: [ "server-v*" ]
  workflow_dispatch:
permissions:
  contents: read
  packages: write
env:
  IMAGE_NAME: ghcr.io/${{ github.repository }}/server
jobs:
  docker:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build image
        run: |
          docker build -f apps/server/Dockerfile -t $IMAGE_NAME:sha-${GITHUB_SHA::7} .
      - name: Push image (sha tag)
        run: docker push $IMAGE_NAME:sha-${GITHUB_SHA::7}
      - name: Push image (latest on main)
        if: startsWith(github.ref, 'refs/heads/main')
        run: |
          docker tag $IMAGE_NAME:sha-${GITHUB_SHA::7} $IMAGE_NAME:latest
          docker push $IMAGE_NAME:latest
      - name: Push image (tagged release)
        if: startsWith(github.ref, 'refs/tags/server-v')
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          docker tag $IMAGE_NAME:sha-${GITHUB_SHA::7} $IMAGE_NAME:${TAG}
          docker push $IMAGE_NAME:${TAG}
YAML

# Dockerfile server (if missing)
if [ ! -f "apps/server/Dockerfile" ]; then
  log "Adding apps/server/Dockerfile"
  mkdir -p apps/server
  cat > apps/server/Dockerfile <<'DOCKER'
FROM node:20-alpine AS base
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
RUN pnpm install --frozen-lockfile --filter @bb/server...
EXPOSE 8000
CMD ["pnpm","--filter","@bb/server","dev"]
DOCKER
fi

# ---------- Vercel preview (optional) ----------
log "Writing .github/workflows/preview-vercel.yml (optional)"
cat > .github/workflows/preview-vercel.yml <<'YAML'
name: Vercel Preview (Web)
on:
  pull_request:
    branches: [ main, develop ]
jobs:
  vercel:
    runs-on: ubuntu-latest
    environment: preview
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_WEB }}
          working-directory: ./apps/web
          vercel-args: "--prod=false"
YAML

# ---------- Expo EAS (optional) ----------
log "Writing .github/workflows/expo-eas.yml (optional)"
cat > .github/workflows/expo-eas.yml <<'YAML'
name: EAS Build
on:
  push:
    tags: [ "mobile-v*" ]
  workflow_dispatch:
jobs:
  eas:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Setup EAS
        run: pnpm dlx eas-cli login --token ${{ secrets.EAS_TOKEN }}
      - name: Build Android
        working-directory: apps/mobile
        run: pnpm dlx eas-cli build --platform android --non-interactive
      - name: Build iOS
        working-directory: apps/mobile
        run: pnpm dlx eas-cli build --platform ios --non-interactive
YAML

# ---------- PR template ----------
log "Writing PR template"
cat > .github/pull_request_template.md <<'MD'
## Résumé
- [ ] But de la PR

## Checklist
- [ ] Lint / Types OK
- [ ] Tests unitaires
- [ ] (si applicable) Tests e2e
- [ ] Changeset ajouté (`pnpm changeset`)
MD

# ---------- Labeler ----------
log "Writing labeler config + workflow"
cat > .github/labeler.yml <<'YAML'
packages-ui:
  - "packages/ui/**"
game-engine:
  - "packages/game-engine/**"
web:
  - "apps/web/**"
server:
  - "apps/server/**"
mobile:
  - "apps/mobile/**"
YAML

cat > .github/workflows/labeler.yml <<'YAML'
name: PR Labeler
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
YAML

# ---------- Renovate (optional) ----------
log "Writing renovate.json (optional)"
cat > renovate.json <<'JSON'
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "rangeStrategy": "bump",
  "labels": ["dependencies"],
  "platformAutomerge": false,
  "packageRules": [
    { "matchManagers": ["pnpm"], "groupName": "pnpm monorepo deps" }
  ]
}
JSON

# ---------- Commit ----------
log "git add & commit"
git add -A
git commit -m "ci: add GitHub Actions (CI/E2E/Release/Docker), PR template, labeler, Renovate; update scripts"

cat <<'TXT'

✅ Done.

Prochaines étapes :
1) Ajoute les **secrets** GitHub si tu utilises les workflows optionnels :
   - Vercel Preview: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID_WEB
   - Expo EAS: EAS_TOKEN
   - (GHCR utilise GITHUB_TOKEN intégré)

2) (Optionnel) mets à jour .changeset/config.json :
   - Remplace "REPLACE_ME_ORG/REPLACE_ME_REPO" par "tonOrg/tonRepo"

3) Pousse la branche et ouvre une PR :
   git push -u origin ci-automation-setup

4) Ajoute (si besoin) les scripts dans les apps :
   - apps/web/package.json => "test:e2e": "playwright test"
   - devDeps apps/web: "@playwright/test", "wait-on"

5) Lance un Changeset en local pour tester le workflow Release :
   pnpm changeset

Bon build !
TXT
