"use client";
import Logo from "./Logo";
import AuthBar from "../AuthBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../contexts/LanguageContext";

export default function Header() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-8">
        <Logo variant="compact" showText={true} />
        <nav className="flex items-center gap-6">
          <a 
            href="/teams" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors"
          >
            ⚽ {t.nav.teams}
          </a>
          <a 
            href="/skills" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors"
          >
            📚 {t.nav.skills}
          </a>
          <a 
            href="/star-players" 
            className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors"
          >
            ⭐ {t.nav.starPlayers}
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <AuthBar />
      </div>
    </div>
  );
}

