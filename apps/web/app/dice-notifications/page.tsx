'use client';

import React from 'react';
import { ToastProvider, DiceNotificationDemo } from '@bb/ui';

export default function DiceNotificationsPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Notifications de Dés - Blood Bowl
          </h1>
          
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Système de Notifications</h2>
            <p className="text-gray-600 mb-4">
              Ce système affiche des notifications toaster pour tous les jets de dés effectués dans le jeu.
              Les notifications incluent le type de dé, le résultat, et si le jet a réussi ou échoué.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Types de Dés Supportés :</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>D6 - Dé à 6 faces simple</li>
                  <li>2D6 - Deux dés à 6 faces</li>
                  <li>Esquive - Jet d'agilité</li>
                  <li>Ramassage - Jet de ramassage de balle</li>
                  <li>Armure - Jet d'armure</li>
                  <li>Blocage - Dés de blocage spéciaux</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Fonctionnalités :</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Notifications visuelles avec icônes</li>
                  <li>Différents types (succès, échec, info, avertissement)</li>
                  <li>Auto-dismiss après quelques secondes</li>
                  <li>Possibilité de fermer manuellement</li>
                  <li>Design responsive</li>
                </ul>
              </div>
            </div>
          </div>
          
          <DiceNotificationDemo />
          
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Intégration</h3>
            <p className="text-blue-800 text-sm">
              Pour intégrer les notifications dans votre jeu, utilisez le hook <code className="bg-blue-100 px-1 rounded">useDiceNotifications</code> 
              et configurez les callbacks avec <code className="bg-blue-100 px-1 rounded">setDiceNotificationCallback</code> et 
              <code className="bg-blue-100 px-1 rounded">setBlockDiceNotificationCallback</code>.
            </p>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
