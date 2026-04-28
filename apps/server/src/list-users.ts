import { prisma } from "./prisma";
import { serverLog } from "./utils/server-log";

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, createdAt: true },
  });
  serverLog.log(JSON.stringify(users, null, 2));
}

main().then(() => prisma.$disconnect());
