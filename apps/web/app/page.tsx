import ImageCarousel from "./components/ImageCarousel";
import HowToPlay from "./components/HowToPlay";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col-reverse md:flex-row items-center gap-10">
          <div className="text-white max-w-xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              BlooBowl
            </h1>
            <p className="mt-4 text-xl text-gray-300 leading-relaxed">
              Plateforme digitale pour créer et gérer vos équipes Blood Bowl. Construisez vos rosters, recrutez des Star Players légendaires, et exportez vos équipes en PDF.
            </p>
            <p className="mt-3 text-gray-400 leading-relaxed">
              Conformité aux règles officielles Blood Bowl 2020 : 28 rosters disponibles, gestion complète des budgets, trésorerie, et export PDF pour vos parties.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/me/teams"
                className="px-5 py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
              >
                Gérer mes équipes
              </a>
              <a
                href="/login"
                className="px-5 py-2.5 rounded border border-white/20 text-white hover:bg-white/10"
              >
                Connexion
              </a>
              <a
                href="/register"
                className="px-5 py-2.5 rounded border border-white/20 text-white/90 hover:text-white hover:bg-white/10"
              >
                Inscription
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-2xl">
              <img
                src="/images/bb_dice_sides.png"
                alt="Dés de blocage"
                className="w-[540px] max-w-full rounded-md"
              />
            </div>
            <div className="hidden md:block absolute -bottom-6 -left-6 rotate-[-8deg] rounded-lg border border-white/10 bg-white/5 p-3 shadow-xl">
              <img
                src="/images/blocking_dice/pow.png"
                alt="POW"
                className="w-20"
              />
            </div>
            <div className="hidden md:block absolute -top-6 -right-8 rotate-[12deg] rounded-lg border border-white/10 bg-white/5 p-3 shadow-xl">
              <img
                src="/images/blocking_dice/push_back.png"
                alt="PUSH"
                className="w-20"
              />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.25),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.25),transparent_40%)]" />
      </section>

      {/* Carousel */}
      <section className="max-w-6xl mx-auto px-6 -mt-10">
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow bg-white">
          <ImageCarousel />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white shadow border border-gray-200 overflow-hidden">
            <div className="h-40 bg-gray-50 flex items-center justify-center">
              <img
                src="/images/blocking_dice/both_down.png"
                alt="Both Down"
                className="h-24"
              />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg">28 Rosters disponibles</h3>
              <p className="text-gray-600 mt-1">
                Toutes les équipes officielles : Skaven, Elfes, Orques, Nains, et bien plus. Chaque roster respecte les règles et budgets officiels.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow border border-gray-200 overflow-hidden">
            <div className="h-40 bg-gray-50 flex items-center justify-center">
              <img
                src="/images/blocking_dice/stumble.png"
                alt="Stumble"
                className="h-24"
              />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg">Star Players légendaires</h3>
              <p className="text-gray-600 mt-1">
                Recrutez parmi 25 Star Players emblématiques comme Griff Oberwald, Morg 'n' Thorg, ou Hakflem Skuttlespike selon les règles de disponibilité.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow border border-gray-200 overflow-hidden">
            <div className="h-40 bg-gray-50 flex items-center justify-center">
              <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg">Export PDF</h3>
              <p className="text-gray-600 mt-1">
                Exportez vos rosters d'équipe au format PDF avec toutes les informations : joueurs, Star Players, budgets et statistiques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Callout */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 text-white p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-extrabold">
              Créez votre première équipe
            </h3>
            <p className="text-white/90 mt-2">
              Choisissez parmi 28 rosters disponibles, recrutez vos joueurs et des Star Players, puis exportez votre équipe en PDF.
            </p>
          </div>
          <a
            href="/me/teams"
            className="px-6 py-3 bg-white text-gray-900 font-semibold rounded shadow hover:shadow-md"
          >
            Gérer mes équipes
          </a>
        </div>
      </section>

      {/* How to play */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <HowToPlay />
      </section>

      {/* Screenshots */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold mb-4">Captures d’écran</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            <img
              src="/images/bb_dice_sides.png"
              alt="Dés"
              className="w-full h-48 object-contain bg-gray-50"
            />
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            <img
              src="/images/blocking_dice/pow.png"
              alt="POW"
              className="w-full h-48 object-contain bg-gray-50"
            />
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            <img
              src="/images/stadium_illustration.svg"
              alt="Stade"
              className="w-full h-48 object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
