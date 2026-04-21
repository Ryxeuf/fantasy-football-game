import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  summariseReport,
  summariseSource,
} from "./progress-parser";

describe("progress-parser", () => {
  it("parses a simple GFM table with status column", () => {
    const md = `# Phases

## Phase A

| #   | Task          | Gain | Diff   | Statut | Detail |
|-----|---------------|------|--------|--------|--------|
| A.1 | Implement WS  | Fort | Facile | [x]    | done   |
| A.2 | Broadcast     | Fort | Moyen  | [ ]    | todo   |
| A.3 | Partial       | Fort | Moyen  | [~]    | wip    |
`;

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Phase A");
    expect(sections[0].tasks).toHaveLength(3);

    const [t1, t2, t3] = sections[0].tasks;
    expect(t1).toMatchObject({ id: "A.1", text: "Implement WS", status: "done" });
    expect(t2).toMatchObject({ id: "A.2", status: "pending" });
    expect(t3).toMatchObject({ id: "A.3", status: "in_progress" });

    expect(sections[0].totals).toEqual({
      total: 3,
      done: 1,
      inProgress: 1,
      pending: 1,
      percent: 33,
    });
  });

  it("parses checkbox lists outside tables", () => {
    const md = `## Sprint 2

Checklist:

- [ ] 2.1 — Task alpha
- [x] 2.2 — Task beta
- [~] 2.3 — Task gamma
`;

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Sprint 2");
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["2.1", "2.2", "2.3"]);
    expect(sections[0].totals.done).toBe(1);
    expect(sections[0].totals.pending).toBe(1);
    expect(sections[0].totals.inProgress).toBe(1);
    expect(sections[0].totals.percent).toBe(33);
  });

  it("groups tasks by ## or ### headings and ignores other content", () => {
    const md = `# Top

## Section One

Intro paragraph (should be ignored).

| # | Task | Statut |
|---|------|--------|
| 1 | one  | [x]    |

## Section Two

- [ ] 2.1 — two
- [x] 2.2 — three

### Subsection

- [x] 2.3 — four
`;

    const sections = parseMarkdown(md);
    expect(sections.map((s) => s.title)).toEqual([
      "Section One",
      "Section Two",
      "Subsection",
    ]);
    expect(sections[0].totals.total).toBe(1);
    expect(sections[1].totals.total).toBe(2);
    expect(sections[2].totals.total).toBe(1);
  });

  it("summarises a source and a report", () => {
    const md = `## A

- [x] one
- [ ] two

## B

- [x] three
`;
    const sections = parseMarkdown(md);
    const source = summariseSource("t", "Test", "test.md", sections);
    expect(source.totals).toEqual({
      total: 3,
      done: 2,
      inProgress: 0,
      pending: 1,
      percent: 67,
    });

    const report = summariseReport([source]);
    expect(report.sources).toHaveLength(1);
    expect(report.totals.total).toBe(3);
    expect(report.totals.done).toBe(2);
    expect(typeof report.generatedAt).toBe("string");
  });

  it("ignores table rows without a status cell", () => {
    const md = `## Overview

| Sprint | Focus | Status |
|--------|-------|--------|
| 1      | A     | Done   |
| 2      | B     | Pending|
`;
    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(0);
  });

  it("treats the first non-empty cell after the id as task text", () => {
    const md = `## Sprint

| B0.1 | Brancher le registry | Fort | Moyen | [ ] | Debloque 38 skills |
`;
    const sections = parseMarkdown(md);
    expect(sections[0].tasks[0]).toMatchObject({
      id: "B0.1",
      text: "Brancher le registry",
      status: "pending",
      detail: "Debloque 38 skills",
    });
  });
});
