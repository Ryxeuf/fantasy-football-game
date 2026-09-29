/** Titre de section de la home : sur-titre or, titre, filet, sous-titre. */
export default function SectionTitle({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      {kicker && (
        <p className="font-subtitle text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-nuffle-gold/90">
          {kicker}
        </p>
      )}
      <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-nuffle-anthracite">
        {title}
      </h2>
      <span className="mt-3 inline-block h-px w-20 bg-gradient-to-r from-transparent via-nuffle-gold to-transparent" aria-hidden="true" />
      {subtitle && (
        <p className="mt-3 text-base sm:text-lg text-nuffle-bronze/90 font-body">{subtitle}</p>
      )}
    </div>
  );
}
