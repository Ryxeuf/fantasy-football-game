"use client";

import VersionInfo from "./VersionInfo";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t-2 border-nuffle-bronze/30 bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Logo variant="compact" showText={false} className="mb-3" />
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">Nuffle Arena</h3>
            <p className="text-sm text-nuffle-anthracite/80 font-body">
              Plateforme digitale complète pour jouer à Blood Bowl selon les règles officielles 2020.
            </p>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">Fonctionnalités</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/me/teams" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Gestion d'équipes
                </a>
              </li>
              <li>
                <a href="/star-players" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Star Players
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">Ressources</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Accueil
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Connexion
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Inscription
                </a>
              </li>
            </ul>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3 mt-6">Légal</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/legal/mentions-legales" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Mentions légales
                </a>
              </li>
              <li>
                <a href="/legal/conditions-utilisation" className="hover:text-nuffle-gold hover:underline transition-colors">
                  Conditions d'utilisation
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t-2 border-nuffle-bronze/30">
          <p className="text-xs text-nuffle-anthracite/70 text-center font-body">
            Nuffle Arena - Blood Bowl Fantasy Football Game. 
            Basé sur les règles officielles de Blood Bowl 2020.
          </p>
          <p className="text-xs text-nuffle-anthracite/70 text-center mt-2 font-body">
            © {new Date().getFullYear()} NuffleArena • <VersionInfo />
          </p>
        </div>
      </div>
    </footer>
  );
}

