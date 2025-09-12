#!/bin/bash

# Script de formatage TypeScript pour le moteur de jeu Blood Bowl

echo "🎯 Formatage des fichiers TypeScript..."

# Formater avec Prettier
echo "📝 Application de Prettier..."
npx prettier --write "src/**/*.ts"

# Corriger avec ESLint
echo "🔧 Correction avec ESLint..."
npx eslint "src/**/*.ts" --fix

# Vérifier les types
echo "🔍 Vérification des types TypeScript..."
npx tsc --noEmit

# Lancer les tests
echo "🧪 Exécution des tests..."
npm test -- --run

echo "✅ Formatage terminé !"
