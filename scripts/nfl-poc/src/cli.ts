const [, , cmd] = process.argv;

async function main(): Promise<void> {
  switch (cmd) {
    case "nflverse":
      console.log("[nfl-poc] nflverse pull — not implemented yet (commit 3)");
      break;
    case "espn":
      console.log("[nfl-poc] espn poll — not implemented yet (commit 4)");
      break;
    case "all":
      console.log("[nfl-poc] all — not implemented yet (commits 3 + 4 + 5)");
      break;
    default:
      console.log(
        "Usage: npm run poc:nflverse | poc:espn | poc:all\n" +
          "Bootstrap OK — commits feat suivants vont implementer les sous-commandes."
      );
  }
}

main().catch((err) => {
  console.error("[nfl-poc] fatal:", err);
  process.exit(1);
});
