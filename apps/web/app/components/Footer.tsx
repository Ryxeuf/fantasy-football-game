"use client";

import VersionInfo from "./VersionInfo";
import Logo from "./Logo";
import { useLanguage } from "../contexts/LanguageContext";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "../lib/featureFlagKeys";
import { buildCommunityLinks } from "@bb/game-engine";

const COMMUNITY_LINKS = buildCommunityLinks({
  DISCORD_INVITE_URL: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL,
});

export default function Footer() {
  const { t } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);
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
              {onlinePlayEnabled && (
                <li>
                  <a href="/play" className="hover:text-nuffle-gold hover:underline transition-colors">
                    {t.play?.playOnline || "Jouer en ligne"}
                  </a>
                </li>
              )}
              <li>
                <a href="/tutoriel" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.tutorial}
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
                <a href="/a-propos" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.about ?? "A propos"}
                </a>
              </li>
              <li>
                <a href="/changelog" className="hover:text-nuffle-gold hover:underline transition-colors">
                  {t.footer.changelog ?? "Changelog"}
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
            <h3 className="font-heading font-semibold text-nuffle-anthracite mb-3 mt-6">{t.footer.community}</h3>
            <ul className="text-sm text-nuffle-anthracite/80 space-y-1 font-body">
              <li>
                <a
                  href={COMMUNITY_LINKS.discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-nuffle-gold hover:underline transition-colors inline-flex items-center gap-1.5"
                  aria-label={t.footer.joinDiscord}
                >
                  <svg className="w-4 h-4 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.317 4.369A19.791 19.791 0 0 0 16.558 3.2a.075.075 0 0 0-.079.037 13.77 13.77 0 0 0-.608 1.25 18.28 18.28 0 0 0-5.487 0 12.66 12.66 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-3.76 1.169.07.07 0 0 0-.032.027C2.533 8.045 1.68 11.61 2.099 15.132a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.075.075 0 0 0-.041-.104 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.075.075 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.076.076 0 0 0-.04.105c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-4.073-.838-7.608-3.548-10.736a.06.06 0 0 0-.031-.028zM8.02 12.99c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  {t.footer.joinDiscord}
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

