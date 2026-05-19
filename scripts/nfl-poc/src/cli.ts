import { runNflversePoc } from "./fetch-nflverse.js";
import { runEspnPoc } from "./fetch-espn.js";

const [, , cmd] = process.argv;

const TARGET_YEAR = 2025;
const TARGET_WEEK = 10;
// NFL 2025 W10 Sunday slate (Nov 9 2025).
const TARGET_ESPN_DATE = "20251109";

async function main(): Promise<void> {
  switch (cmd) {
    case "nflverse":
      await runNflversePoc(TARGET_YEAR, TARGET_WEEK);
      break;
    case "espn":
      await runEspnPoc(TARGET_ESPN_DATE);
      break;
    case "all":
      await runNflversePoc(TARGET_YEAR, TARGET_WEEK);
      console.log("");
      await runEspnPoc(TARGET_ESPN_DATE);
      console.log("\n[nfl-poc] normalize — not implemented yet (commit 5)");
      break;
    default:
      console.log(
        "Usage: npm run poc:nflverse | poc:espn | poc:all\n" +
          `Cible courante: saison ${TARGET_YEAR}, week ${TARGET_WEEK}, espn date ${TARGET_ESPN_DATE}.`
      );
  }
}

main().catch((err) => {
  console.error("[nfl-poc] fatal:", err);
  process.exit(1);
});
