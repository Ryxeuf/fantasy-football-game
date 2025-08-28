#!/bin/bash

echo "🐳 Démarrage de BlooBowl dans Docker..."
echo "📱 Port public: 8200"
echo "🔌 Port serveur: 8000"
echo ""

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
docker-compose down

# Nettoyer les images
echo "🧹 Nettoyage des images..."
docker-compose rm -f

# Construire et démarrer
echo "🔨 Construction et démarrage des conteneurs..."
docker-compose up --build

echo ""
echo "✅ BlooBowl est maintenant accessible sur:"
echo "   🌐 Web: http://localhost:8200"
echo "   🔌 API: http://localhost:8000"
echo ""
echo "Pour arrêter: docker-compose down"
