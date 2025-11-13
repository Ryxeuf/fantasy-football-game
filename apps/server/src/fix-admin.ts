import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🔧 Correction du compte admin...\n");

  const adminEmail = "admin@example.com";
  const adminPassword = "admin123";

  // Vérifier si le compte existe
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    console.log("❌ Le compte admin n'existe pas. Création...");
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
    console.log("✅ Compte admin créé avec valid: true");
  } else {
    console.log("📝 Compte admin trouvé. Mise à jour...");
    console.log(`   - Email: ${existing.email}`);
    console.log(`   - Rôle: ${existing.role}`);
    console.log(`   - Valid actuel: ${existing.valid}`);

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

    console.log("✅ Compte admin mis à jour:");
    console.log(`   - Rôle: ${updated.role}`);
    console.log(`   - Valid: ${updated.valid}`);
    console.log(`   - Mot de passe: ${adminPassword}`);
  }

  // Vérifier aussi le compte user
  const userEmail = "user@example.com";
  const userPassword = "user123";
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!existingUser) {
    console.log("\n❌ Le compte user n'existe pas. Création...");
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
    console.log("✅ Compte user créé avec valid: true");
  } else if (!existingUser.valid) {
    console.log("\n📝 Compte user trouvé mais non validé. Mise à jour...");
    const passwordHash = await bcrypt.hash(userPassword, 10);
    await prisma.user.update({
      where: { email: userEmail },
      data: {
        valid: true,
        passwordHash,
      },
    });
    console.log("✅ Compte user validé");
  } else {
    console.log("\n✅ Compte user déjà validé");
  }

  console.log("\n🎉 Correction terminée !");
  console.log("\n📋 Identifiants:");
  console.log(`   Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`   User:  ${userEmail} / ${userPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Erreur:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

