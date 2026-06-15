---
name: "Ideas"
description: "Generate a prioritized backlog of improvement ideas grounded in the repo, ready to hand off to /opsx:explore"
category: Workflow
tags: [ideas, brainstorm, backlog, openspec, discovery]
---

Generate a prioritized list of improvement ideas for this project. This is the
"brainstorming" step that comes **before** OpenSpec: I surface candidate ideas,
you pick one, then we deepen it with `/opsx:explore` and formalize it with
`/opsx:propose`.

**IMPORTANT: This command proposes ideas, it does not implement anything.** Read
files and investigate freely, but never write application code here. The output
is a list of ideas, nothing more.

## Input

The argument after `/ideas` (optional) scopes the brainstorming. Examples:

- Nothing → ideas across the whole project
- A domain: `/ideas moteur de match` / `/ideas onboarding` / `/ideas perf`
- A goal: `/ideas réduire la dette technique`
- A constraint: `/ideas quick wins < 1 jour`

If no scope is given, cover the project broadly but bias toward high-impact areas.

## How to gather context (do this first)

Ground every idea in the actual repo — never invent generic advice. Cheaply scan:

1. **Roadmap & backlog signals**
   - `TODO.md`, `ROADMAP_DONE.md`, `docs/roadmap/**`
   - `CLAUDE.md` "Historique sessions" and "Pieges connus" sections
2. **Existing OpenSpec state** — avoid proposing duplicates:
   ```bash
   openspec list --json
   ```
3. **Codebase reality** (use Grep/Glob/Explore agent, stay lightweight)
   - Monorepo layout: `apps/{server,web,mobile}`, `packages/{sim-engine,game-engine,shared-types}`
   - `TODO`/`FIXME`/`HACK` comments, skipped tests (`it.skip`, `describe.skip`)
   - Recent churn: `git log --oneline -20`
4. **Docs that hint at unfinished work** — the many `*.md` reports at the repo root.

Prefer one parallel sweep (e.g. an Explore agent) over many sequential reads.

## Output format

Produce a ranked table, highest value first. Keep each idea one line in the table
plus a short "why now" note. Use this exact shape:

```
## Idées — <scope ou "projet global">

| # | Idée | Impact | Effort | Pourquoi maintenant |
|---|------|--------|--------|---------------------|
| 1 | … | 🔴 Élevé | 🟢 Faible | … |
| 2 | … | 🟡 Moyen | 🟡 Moyen | … |
```

Then, below the table, for the **top 2-3** ideas only, add 2-4 lines each:
- **Problème** : ce qui cloche aujourd'hui (avec un `fichier:ligne` quand pertinent)
- **Piste** : la direction envisagée
- **Risques / inconnues** : ce qu'il faudra creuser

## Ranking rules

- **Impact**: user value, unblocking, risk reduction, or reducing recurring pain.
- **Effort**: rough size (🟢 < 1j, 🟡 quelques jours, 🔴 > 1 semaine / risqué).
- Surface a mix: at least one quick win, one larger bet, one tech-debt/quality item.
- Deduplicate against active OpenSpec changes and items already in `ROADMAP_DONE.md`.
- 5 to 8 ideas — enough to choose from, not a wall of text.

## Handoff to OpenSpec

End with a single, clear next-step line, e.g.:

> Dis-moi le numéro qui t'intéresse — j'enchaîne avec `/opsx:explore "<idée>"`
> pour creuser, puis `/opsx:propose` quand c'est mûr.

## Guardrails

- **Don't implement** — ideas only, no code.
- **Don't invent** — every idea must trace to something real in the repo.
- **Don't auto-create OpenSpec changes** — wait for the user to pick.
- **Stay concise** — the table is the deliverable; prose stays minimal.
- Match the repo's language: reply in French (this project's convention).
