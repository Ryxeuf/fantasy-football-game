import { runNflversePoc } from "./fetch-nflverse.js";

const [, , cmd] = process.argv;

const TARGET_YEAR = 2025;
const TARGET_WEEK = 10;

async function main(): Promise<void> {
  switch (cmd) {
    case "nflverse":
      await runNflversePoc(TARGET_YEAR, TARGET_WEEK);
      break;
    case "espn":
      console.log("[nfl-poc] espn poll — not implemented yet (commit 4)");
      break;
    case "all":
      await runNflversePoc(TARGET_YEAR, TARGET_WEEK);
      console.log("\n[nfl-poc] espn + normalize — not implemented yet (commits 4 + 5)");
      break;
    default:
      console.log(
        "Usage: npm run poc:nflverse | poc:espn | poc:all\n" +
          `Cible courante: saison ${TARGET_YEAR}, week ${TARGET_WEEK}.`
      );
  }
}

main().catch((err) => {
  console.error("[nfl-poc] fatal:", err);
  process.exit(1);
});
