"use client";
import { useState, useRef, useEffect } from "react";
import Logo from "./Logo";
import AuthBar from "../AuthBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../contexts/LanguageContext";

export default function Header() {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu mobile si on clique en dehors ou si on change de taille d'écran
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    function handleResize() {
      // Fermer le menu si on passe en mode desktop
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", handleResize);
      // Empêcher le scroll du body quand le menu est ouvert
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex items-center justify-between mb-6 relative" ref={menuRef}>
      <div className="flex items-center gap-3 sm:gap-4 md:gap-8 min-w-0 flex-1">
        <Logo variant="compact" showText={true} />
        {/* Navigation desktop */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
          <a 
            href="/teams" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors whitespace-nowrap"
          >
            ⚽ {t.nav.teams}
          </a>
          <a 
            href="/skills" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors whitespace-nowrap"
          >
            📚 {t.nav.skills}
          </a>
          <a 
            href="/star-players" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors whitespace-nowrap"
          >
            ⭐ {t.nav.starPlayers}
          </a>
        </nav>
      </div>
      
      {/* Actions desktop */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-3 flex-shrink-0">
        <LanguageSwitcher />
        <AuthBar />
      </div>

      {/* Bouton hamburger mobile/tablet */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
        aria-label="Menu"
        aria-expanded={mobileMenuOpen}
      >
        <svg
          className="w-6 h-6 text-nuffle-anthracite"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Menu mobile/tablet */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu */}
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] sm:max-w-sm bg-white shadow-2xl z-50 lg:hidden overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <Logo variant="compact" showText={true} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Fermer le menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Navigation mobile */}
            <nav className="p-4 sm:p-6 space-y-3 sm:space-y-4 border-b border-gray-200">
              <a 
                href="/teams"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors py-2 active:text-nuffle-gold"
              >
                ⚽ {t.nav.teams}
              </a>
              <a 
                href="/skills"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors py-2 active:text-nuffle-gold"
              >
                📚 {t.nav.skills}
              </a>
              <a 
                href="/star-players"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors py-2 active:text-nuffle-gold"
              >
                ⭐ {t.nav.starPlayers}
              </a>
            </nav>

            {/* Actions mobile */}
            <div className="p-4 sm:p-6 space-y-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Langue</span>
                <LanguageSwitcher />
              </div>
            </div>

            {/* AuthBar mobile */}
            <div className="p-4 sm:p-6">
              <AuthBar isMobileMenu={true} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

