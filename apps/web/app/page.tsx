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
              Blood Bowl Fantasy Football
            </h1>
            <p className="mt-4 text-gray-300 leading-relaxed">
              Un jeu tour-par-tour inspiré de Blood Bowl: lancez les dés,
              bloquez, poussez et marquez des touchdowns.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/lobby"
                className="px-5 py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
              >
                Jouer maintenant
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
              <a
                href="/play/demo"
                className="px-5 py-2.5 rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10"
              >
                Démo du plateau
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
              <h3 className="font-bold text-lg">Blocages et Poussées</h3>
              <p className="text-gray-600 mt-1">
                Résolutions conformes aux règles officielles: choix des dés,
                directions de poussée et follow-up.
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
              <h3 className="font-bold text-lg">Dés et Probabilités</h3>
              <p className="text-gray-600 mt-1">
                Tirages contrôlés, logs détaillés et popups de résultats pour
                une lisibilité optimale.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow border border-gray-200 overflow-hidden">
            <div className="h-40 bg-gray-50 flex items-center justify-center">
              <img
                src="/images/blocking_dice/player_down.png"
                alt="Player Down"
                className="h-24"
              />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg">Parties sécurisées</h3>
              <p className="text-gray-600 mt-1">
                Accès aux matchs via un token dédié aux participants.
                Authentification utilisateur par JWT.
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
              Prêt à lancer le coup d’envoi ?
            </h3>
            <p className="text-white/90 mt-2">
              Créez une partie et invitez un ami avec l’ID du match.
            </p>
          </div>
          <a
            href="/lobby"
            className="px-6 py-3 bg-white text-gray-900 font-semibold rounded shadow hover:shadow-md"
          >
            Aller au Lobby
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
