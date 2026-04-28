import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { serverLog } from "./utils/server-log";

async function main() {
  serverLog.log("🔧 Correction du compte admin...\n");

  const adminEmail = "admin@example.com";
  const adminPassword = "admin123";

  // Vérifier si le compte existe
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    serverLog.log("❌ Le compte admin n'existe pas. Création...");
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        coachName: "Admin",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        passwordHash,
        valid: true,
      },
    });
    serverLog.log("✅ Compte admin créé avec valid: true");
  } else {
    serverLog.log("📝 Compte admin trouvé. Mise à jour...");
    serverLog.log(`   - Email: ${existing.email}`);
    serverLog.log(`   - Rôle: ${existing.role}`);
    serverLog.log(`   - Valid actuel: ${existing.valid}`);

    // Mettre à jour le compte pour s'assurer qu'il est validé et a le bon rôle
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const updated = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        role: "admin",
        valid: true,
        passwordHash, // Réinitialiser le mot de passe au cas où
      },
    });

    serverLog.log("✅ Compte admin mis à jour:");
    serverLog.log(`   - Rôle: ${updated.role}`);
    serverLog.log(`   - Valid: ${updated.valid}`);
    serverLog.log(`   - Mot de passe: ${adminPassword}`);
  }

  // Vérifier aussi le compte user
  const userEmail = "user@example.com";
  const userPassword = "user123";
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!existingUser) {
    serverLog.log("\n❌ Le compte user n'existe pas. Création...");
    const passwordHash = await bcrypt.hash(userPassword, 10);
    await prisma.user.create({
      data: {
        email: userEmail,
        name: "User",
        coachName: "User",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        passwordHash,
        valid: true,
      },
    });
    serverLog.log("✅ Compte user créé avec valid: true");
  } else if (!existingUser.valid) {
    serverLog.log("\n📝 Compte user trouvé mais non validé. Mise à jour...");
    const passwordHash = await bcrypt.hash(userPassword, 10);
    await prisma.user.update({
      where: { email: userEmail },
      data: {
        valid: true,
        passwordHash,
      },
    });
    serverLog.log("✅ Compte user validé");
  } else {
    serverLog.log("\n✅ Compte user déjà validé");
  }

  serverLog.log("\n🎉 Correction terminée !");
  serverLog.log("\n📋 Identifiants:");
  serverLog.log(`   Admin: ${adminEmail} / ${adminPassword}`);
  serverLog.log(`   User:  ${userEmail} / ${userPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    serverLog.error("❌ Erreur:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

