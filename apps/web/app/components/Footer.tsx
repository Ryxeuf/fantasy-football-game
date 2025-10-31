"use client";

import VersionInfo from "./VersionInfo";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">BlooBowl</h3>
            <p className="text-sm text-gray-600">
              Plateforme digitale complète pour jouer à Blood Bowl selon les règles officielles 2020.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Fonctionnalités</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <a href="/me/teams" className="hover:text-gray-900 hover:underline">
                  Gestion d'équipes
                </a>
              </li>
              <li>
                <a href="/star-players" className="hover:text-gray-900 hover:underline">
                  Star Players
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Ressources</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <a href="/" className="hover:text-gray-900 hover:underline">
                  Accueil
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-gray-900 hover:underline">
                  Connexion
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-gray-900 hover:underline">
                  Inscription
                </a>
              </li>
            </ul>
            <h3 className="font-semibold text-gray-900 mb-3 mt-6">Légal</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <a href="/legal/mentions-legales" className="hover:text-gray-900 hover:underline">
                  Mentions légales
                </a>
              </li>
              <li>
                <a href="/legal/conditions-utilisation" className="hover:text-gray-900 hover:underline">
                  Conditions d'utilisation
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            BlooBowl - Blood Bowl Fantasy Football Game. 
            Basé sur les règles officielles de Blood Bowl 2020.
          </p>
          <p className="text-xs text-gray-500 text-center mt-2">
            © {new Date().getFullYear()} Ryxeuf • <VersionInfo />
          </p>
        </div>
      </div>
    </footer>
  );
}

