#!/usr/bin/env tsx
/**
 * `pnpm tsx scripts/debug-match.ts --teamA=sf-gold-rush --teamB=chi-iron-bears`
 *
 * Dump les events d'un match unique pour debug. Affiche le breakdown
 * des events par type + scores + raisons des non-TDs.
 */

import { parseArgs } from "node:util";

import { PRO_LEAGUE_TEAM_BY_ID } from "../src/tactics/race-profiles";
import { simulateMatch } from "../src/simulate-match";

const { values: opts } = parseArgs({
  args: process.argv.slice(2),
  options: {
    teamA: { type: "string" },
    teamB: { type: "string" },
    seed: { type: "string", default: "42" },
    full: { type: "boolean", default: false },
    events: { type: "boolean", default: false },
  },
});

const teamA = PRO_LEAGUE_TEAM_BY_ID[opts.teamA ?? ""];
const teamB = PRO_LEAGUE_TEAM_BY_ID[opts.teamB ?? ""];
if (!teamA || !teamB) {
  console.error("Missing or invalid --teamA / --teamB");
  process.exit(1);
}

const seed = Number.parseInt(opts.seed ?? "42", 10);
const driverKind = opts.full ? "full" : "hybrid";

const result = simulateMatch(
  {
    seed,
    home: { id: teamA.id, name: teamA.name, side: "home", tactics: teamA.tactics, tv: teamA.tv },
    away: { id: teamB.id, name: teamB.name, side: "away", tactics: teamB.tactics, tv: teamB.tv },
  },
  { driverKind },
);

console.log(`Match : ${teamA.name} (home) vs ${teamB.name} (away)`);
console.log(`Seed: ${seed} · Driver: ${driverKind} · EngineVer: ${result.engineVer}`);
console.log(
  `Score: ${result.summary.score.home}-${result.summary.score.away} · Outcome: ${result.summary.outcome}`,
);
console.log(`TDs: ${result.summary.touchdownCount} · Cas: ${result.casualties.length} · Turnovers: ${result.summary.turnoverCount}`);

// Event histogram by type
const byType = new Map<string, number>();
for (const ev of result.events) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (ev as any).type as string;
  byType.set(t, (byType.get(t) ?? 0) + 1);
}
console.log("\nEvent histogram:");
const sorted = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);
for (const [type, count] of sorted) {
  console.log(`  ${type.padEnd(20)} ${count}`);
}

// MOVE breakdown by kind
const moveKinds = new Map<string, { count: number; sumYards: number }>();
let totalMoveYards = { home: 0, away: 0 };
for (const ev of result.events) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = ev as any;
  if (e.type !== "MOVE") continue;
  const k = String(e.meta?.kind ?? "?");
  const yards = Number(e.meta?.yards ?? 0);
  const team = String(e.meta?.team ?? "?");
  const existing = moveKinds.get(k) ?? { count: 0, sumYards: 0 };
  existing.count += 1;
  existing.sumYards += yards;
  moveKinds.set(k, existing);
  if (team === "home") totalMoveYards.home += yards;
  else if (team === "away") totalMoveYards.away += yards;
}
if (moveKinds.size > 0) {
  console.log("\nMOVE breakdown (kind / count / total yards):");
  for (const [k, v] of moveKinds) {
    console.log(`  ${k.padEnd(15)} ${String(v.count).padStart(3)}  ${v.sumYards} yds`);
  }
  console.log(
    `  total home yards : ${totalMoveYards.home} · total away yards : ${totalMoveYards.away}`,
  );
}

// Drive endings / turnover sources
const turnoverReasons = new Map<string, number>();
for (const ev of result.events) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = ev as any;
  if (e.type !== "TURNOVER") continue;
  const reason = String(e.meta?.reason ?? "?");
  turnoverReasons.set(reason, (turnoverReasons.get(reason) ?? 0) + 1);
}
if (turnoverReasons.size > 0) {
  console.log("\nTurnover reasons:");
  for (const [r, n] of turnoverReasons) {
    console.log(`  ${r.padEnd(20)} ${n}`);
  }
}

// Key moments (BLOCK / PASS / DODGE / GFI / etc)
const moments = new Map<string, { attempts: number; success: number }>();
for (const ev of result.events) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = ev as any;
  if (!["BLOCK", "PASS", "DODGE", "GFI", "PICKUP", "FOUL"].includes(e.type)) continue;
  const success = e.meta?.success === true;
  const existing = moments.get(e.type) ?? { attempts: 0, success: 0 };
  existing.attempts += 1;
  if (success) existing.success += 1;
  moments.set(e.type, existing);
}
if (moments.size > 0) {
  console.log("\nKey moments (success / attempts):");
  for (const [type, v] of moments) {
    const pct = v.attempts > 0 ? ((100 * v.success) / v.attempts).toFixed(0) : "0";
    console.log(`  ${type.padEnd(10)} ${v.success}/${v.attempts} (${pct}%)`);
  }
}

if (opts.events) {
  console.log("\nFull event stream:");
  for (const ev of result.events) {
    console.log("  " + JSON.stringify(ev));
  }
}
