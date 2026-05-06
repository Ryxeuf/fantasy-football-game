"use client";

import FeedbackForm from "../components/FeedbackForm";
import { useLanguage } from "../contexts/LanguageContext";

export default function FeedbackPage() {
  const { t } = useLanguage();
  const f = t.feedback;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className="w-full min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze to-nuffle-anthracite">
        <div className="w-full px-4 sm:px-6 py-10 sm:py-14 text-center">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-nuffle-ivory">
            {f.title}
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-base sm:text-lg text-nuffle-ivory/80 font-body leading-relaxed">
            {f.subtitle}
          </p>
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 py-10 md:py-14">
        <div className="max-w-2xl mx-auto">
          <FeedbackForm turnstileSiteKey={siteKey} />
        </div>
      </section>
    </div>
  );
}
