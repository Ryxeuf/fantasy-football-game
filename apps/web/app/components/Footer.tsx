"use client";

import VersionInfo from "./VersionInfo";
import Logo from "./Logo";
import { useLanguage } from "../contexts/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t-2 border-nuffle-bronze/30 bg-white mt-auto w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div className="w-full px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t-2 border-nuffle-bronze/30">
          <p className="text-xs text-nuffle-anthracite/70 text-center font-body">
            Nuffle Arena - Blood Bowl Fantasy Football Game. 
            {t.footer.basedOn}
          </p>
          <p className="text-xs text-nuffle-anthracite/70 text-center mt-2 font-body">
            © {new Date().getFullYear()} NuffleArena • <VersionInfo />
          </p>
        </div>
      </div>
    </footer>
  );
}

