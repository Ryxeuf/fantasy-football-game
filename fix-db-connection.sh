#!/bin/bash

# Script de réparation de la connexion BDD après reset

set -e

echo "🔧 Réparation de la connexion BDD..."
echo ""

# 1. Vérifier que la base de données est accessible
echo "📊 Vérification de la connexion à la base de données..."
cd "$(dirname "$0")"

# Charger les variables d'environnement
if [ -f "prisma/.env" ]; then
  export $(cat prisma/.env | grep -v '^#' | xargs)
  echo "✅ Fichier .env trouvé"
else
  echo "❌ Fichier prisma/.env non trouvé"
  exit 1
fi

# 2. Générer le client Prisma
echo ""
echo "🧬 Génération du client Prisma..."
npx prisma generate --schema prisma/schema.prisma || {
  echo "❌ Erreur lors de la génération du client Prisma"
  exit 1
}

# 3. Appliquer le schéma à la base de données
echo ""
echo "📤 Application du schéma à la base de données..."
npx prisma db push --schema prisma/schema.prisma --accept-data-loss || {
  echo "❌ Erreur lors de l'application du schéma"
  echo "💡 Vérifiez que PostgreSQL est démarré et accessible"
  exit 1
}

# 4. Exécuter le seed
echo ""
echo "🌱 Exécution du seed pour créer les utilisateurs et les données..."
cd apps/server
pnpm run db:seed || {
  echo "❌ Erreur lors de l'exécution du seed"
  exit 1
}

echo ""
echo "✅ Base de données réinitialisée avec succès !"
echo ""
echo "📝 Comptes créés :"
echo "   - admin@example.com / admin123 (admin)"
echo "   - user@example.com / user123 (user)"
echo ""
echo "🚀 Vous pouvez maintenant démarrer le serveur avec :"
echo "   cd apps/server && pnpm run dev"

