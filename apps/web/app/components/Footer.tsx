"use client";

import VersionInfo from "./VersionInfo";
import Logo from "./Logo";
import { useLanguage } from "../contexts/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t-2 border-nuffle-bronze/30 bg-white mt-auto w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div className="w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <Logo variant="compact" showText={false} className="mb-3" />
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">Nuffle Arena</h3>
            <p className="text-sm text-nuffle-anthracite/80 font-body">
              {t.footer.description}
            </p>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">{t.footer.features}</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/me/teams" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.teamManagement}
                </a>
              </li>
              <li>
                <a href="/star-players" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.starPlayers}
                </a>
              </li>
              <li>
                <a href="/play" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.play?.playOnline || "Jouer en ligne"}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3">{t.footer.resources}</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.home}
                </a>
              </li>
              <li>
                <a href="/support" className="hover:text-nuffle-gold hover:underline transition-colors inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {t.support?.navLabel || "Soutenir"}
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.auth.login}
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.auth.register}
                </a>
              </li>
            </ul>
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3 mt-6">{t.footer.legal}</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a href="/legal/mentions-legales" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.legalNotice}
                </a>
              </li>
              <li>
                <a href="/legal/conditions-utilisation" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.termsOfService}
                </a>
              </li>
              <li>
                <a href="/legal/politique-de-confidentialite" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.privacyPolicy}
                </a>
              </li>
              <li>
                <a href="/legal/politique-de-cookies" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.cookiePolicy}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t-2 border-nuffle-bronze/30">
          <p className="text-xs text-nuffle-anthracite/70 text-center font-body px-2">
            Nuffle Arena - Blood Bowl Fantasy Football Game. 
            {t.footer.basedOn}
          </p>
          <p className="text-xs text-nuffle-anthracite/70 text-center mt-2 font-body px-2">
            © {new Date().getFullYear()} NuffleArena • <VersionInfo />
          </p>
        </div>
      </div>
    </footer>
  );
}

