"use client";
import { useState, useRef, useEffect } from "react";
import Logo from "./Logo";
import AuthBar from "../AuthBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../contexts/LanguageContext";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG, NUFFLE_COACH_FLAG } from "../lib/featureFlagKeys";

type DropdownId =
  | "competitions"
  | "compendium"
  | "play"
  | "nuffle-coach"
  | null;

export default function Header() {
  const { t } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);
  const nuffleCoachEnabled = useFeatureFlag(NUFFLE_COACH_FLAG);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
      const clickedInsideAnyDropdown = Object.values(dropdownRefs.current).some(
        (ref) => ref && ref.contains(event.target as Node)
      );
      if (!clickedInsideAnyDropdown) {
        setOpenDropdown(null);
      }
    }

    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleResize);

    if (mobileMenuOpen) {
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

  const toggleDropdown = (id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const navLinkClass =
    "text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors whitespace-nowrap";

  const dropdownTriggerClass = (id: DropdownId) =>
    `flex items-center gap-1 text-sm font-subtitle font-semibold whitespace-nowrap transition-colors ${
      openDropdown === id
        ? "text-nuffle-gold"
        : "text-nuffle-bronze hover:text-nuffle-gold"
    }`;

  const dropdownItem = (href: string, icon: string, label: string) => (
    <a
      href={href}
      onClick={() => setOpenDropdown(null)}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-nuffle-bronze transition-colors whitespace-nowrap"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );

  const chevron = (id: DropdownId) => (
    <svg
      className={`w-3.5 h-3.5 transition-transform ${openDropdown === id ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className="flex items-center justify-between mb-6 relative" ref={menuRef}>
      <div className="flex items-center gap-3 sm:gap-4 md:gap-8 min-w-0 flex-1">
        <Logo variant="compact" showText={true} />

        {/* Navigation desktop */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6">

          {/* Jouer — dropdown si online activé, lien direct sinon */}
          {onlinePlayEnabled ? (
            <div
              className="relative"
              ref={(el) => { dropdownRefs.current["play"] = el; }}
            >
              <button
                onClick={() => toggleDropdown("play")}
                className={dropdownTriggerClass("play")}
              >
                🎮 {t.nav.play}
                {chevron("play")}
              </button>
              {openDropdown === "play" && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <a
                    href="/play"
                    onClick={() => setOpenDropdown(null)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-nuffle-gold hover:bg-yellow-50 transition-colors"
                  >
                    <span>⚔️</span>
                    <span>{t.nav.playOnline}</span>
                  </a>
                  {dropdownItem("/local-matches", "🎮", t.nav.offlineMatches)}
                </div>
              )}
            </div>
          ) : (
            <a href="/local-matches" className={navLinkClass}>
              🎮 {t.nav.offlineMatches}
            </a>
          )}

          {/* Compétitions */}
          <div
            className="relative"
            ref={(el) => { dropdownRefs.current["competitions"] = el; }}
          >
            <button
              onClick={() => toggleDropdown("competitions")}
              className={dropdownTriggerClass("competitions")}
            >
              🏆 {t.nav.competitions}
              {chevron("competitions")}
            </button>
            {openDropdown === "competitions" && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                {/* Le hub /leagues est gate par OnlinePlayGate cote layout.
                    Sans le flag, le lien menerait a un message "indisponible"
                    decevant — on le cache pour eviter l'effet tunnel. */}
                {onlinePlayEnabled && dropdownItem("/leagues", "🏅", t.nav.leagues)}
                {dropdownItem("/cups", "🏆", t.nav.cups)}
                {onlinePlayEnabled && dropdownItem("/leaderboard", "📊", t.nav.leaderboard)}
              </div>
            )}
          </div>

          {/* Nuffle Coach (fantasy NFL) — gate par flag */}
          {nuffleCoachEnabled && (
            <div
              className="relative"
              ref={(el) => { dropdownRefs.current["nuffle-coach"] = el; }}
            >
              <button
                onClick={() => toggleDropdown("nuffle-coach")}
                className={dropdownTriggerClass("nuffle-coach")}
              >
                🏈 Nuffle Coach
                {chevron("nuffle-coach")}
              </button>
              {openDropdown === "nuffle-coach" && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {dropdownItem("/nfl-fantasy", "🏟️", "Mes coachs")}
                  {dropdownItem("/nfl-fantasy/new", "➕", "Créer un coach")}
                  {dropdownItem("/nfl-fantasy/join", "🤝", "Rejoindre")}
                  {dropdownItem("/nfl-fantasy/players", "📋", "Catalogue joueurs")}
                  {dropdownItem("/nfl-fantasy/about", "ℹ️", "À propos")}
                </div>
              )}
            </div>
          )}

          {/* Compendium */}
          <div
            className="relative"
            ref={(el) => { dropdownRefs.current["compendium"] = el; }}
          >
            <button
              onClick={() => toggleDropdown("compendium")}
              className={dropdownTriggerClass("compendium")}
            >
              📖 {t.nav.compendium}
              {chevron("compendium")}
            </button>
            {openDropdown === "compendium" && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                {dropdownItem("/teams", "⚽", t.nav.teams)}
                {dropdownItem("/skills", "📚", t.nav.skills)}
                {dropdownItem("/star-players", "⭐", t.nav.starPlayers)}
              </div>
            )}
          </div>

          {/* Blog */}
          <a href="/blog" className={navLinkClass}>
            📝 {t.nav.blog}
          </a>

          {/* Soutenir */}
          <a
            href="/support"
            className="text-sm font-subtitle font-semibold text-nuffle-red hover:text-nuffle-gold hover:underline transition-colors whitespace-nowrap inline-flex items-center gap-1"
            title={t.support?.navLabel || "Soutenir"}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {t.support?.navLabel || "Soutenir"}
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
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] sm:max-w-sm bg-white shadow-2xl z-50 lg:hidden overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <Logo variant="compact" showText={true} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Fermer le menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Jouer */}
            <nav className="p-4 sm:p-6 space-y-1 border-b border-gray-200">
              <p className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t.nav.play}
              </p>
              {onlinePlayEnabled && (
                <a
                  href="/play"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-gold hover:text-nuffle-bronze transition-colors"
                >
                  ⚔️ {t.nav.playOnline}
                </a>
              )}
              <a
                href="/local-matches"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                🎮 {t.nav.offlineMatches}
              </a>
            </nav>

            {/* Compétitions */}
            <nav className="p-4 sm:p-6 space-y-1 border-b border-gray-200">
              <p className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                🏆 {t.nav.competitions}
              </p>
              {/* Cf. desktop ci-dessus : on cache /leagues quand le flag
                  online_play est OFF pour eviter le message "indisponible". */}
              {onlinePlayEnabled && (
                <a
                  href="/leagues"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  🏅 {t.nav.leagues}
                </a>
              )}
              <a
                href="/cups"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                🏆 {t.nav.cups}
              </a>
              {onlinePlayEnabled && (
                <a
                  href="/leaderboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  📊 {t.nav.leaderboard}
                </a>
              )}
            </nav>

            {/* Nuffle Coach (mobile) — gate par flag */}
            {nuffleCoachEnabled && (
              <nav className="p-4 sm:p-6 space-y-1 border-b border-gray-200">
                <p className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  🏈 Nuffle Coach
                </p>
                <a
                  href="/nfl-fantasy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  🏟️ Mes coachs
                </a>
                <a
                  href="/nfl-fantasy/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  ➕ Créer un coach
                </a>
                <a
                  href="/nfl-fantasy/join"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  🤝 Rejoindre
                </a>
                <a
                  href="/nfl-fantasy/players"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  📋 Catalogue joueurs
                </a>
                <a
                  href="/nfl-fantasy/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
                >
                  ℹ️ À propos
                </a>
              </nav>
            )}

            {/* Compendium */}
            <nav className="p-4 sm:p-6 space-y-1 border-b border-gray-200">
              <p className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                📖 {t.nav.compendium}
              </p>
              <a
                href="/teams"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                ⚽ {t.nav.teams}
              </a>
              <a
                href="/skills"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                📚 {t.nav.skills}
              </a>
              <a
                href="/star-players"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                ⭐ {t.nav.starPlayers}
              </a>
            </nav>

            {/* Blog */}
            <nav className="p-4 sm:p-6 space-y-1 border-b border-gray-200">
              <a
                href="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-base font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                📝 {t.nav.blog}
              </a>
            </nav>

            {/* Langue + Soutenir */}
            <div className="p-4 sm:p-6 space-y-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Langue</span>
                <LanguageSwitcher />
              </div>
              <a
                href="/support"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-semibold text-nuffle-red hover:text-nuffle-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {t.support?.navLabel || "Soutenir"}
              </a>
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
