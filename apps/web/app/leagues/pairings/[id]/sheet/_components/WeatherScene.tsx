"use client";

import type { CSSProperties } from "react";
import type { WeatherVisual, WeatherVisualKind } from "../weather";

/**
 * Ambiance graphique de la météo : un calque décoratif (aria-hidden, sans
 * pointeur) posé DERRIÈRE le contenu. Pur CSS — pas de canvas ni de
 * dépendance — et figé si l'utilisateur a demandé moins d'animations.
 *
 * `banner` : scène dense du bandeau météo.
 * `ambient` : voile léger derrière toute la saisie « En cours ».
 */
export type WeatherSceneVariant = "banner" | "ambient";

type ParticleKind = "drop" | "flake" | "streak" | "grain" | "bug" | "rock" | "bubble";

const PARTICLES: Partial<Record<WeatherVisualKind, ParticleKind>> = {
  rain: "drop",
  storm: "drop",
  snow: "flake",
  wind: "streak",
  sand: "grain",
  swarm: "bug",
  debris: "rock",
  toxic: "bubble",
};

/** Nombre de particules selon la variante et l'intensité. */
function particleCount(
  kind: ParticleKind | undefined,
  variant: WeatherSceneVariant,
  intensity: WeatherVisual["intensity"],
): number {
  if (!kind) return 0;
  const base = kind === "rock" || kind === "bubble" ? 10 : kind === "drop" ? 40 : 28;
  const scaled = intensity === "heavy" ? base : Math.round(base * 0.55);
  return variant === "ambient" ? Math.round(scaled * 0.6) : scaled;
}

/**
 * Position et rythme déterministes (pas de Math.random : même rendu
 * serveur/client, pas de saut à l'hydratation).
 */
function particleStyle(i: number, kind: ParticleKind): CSSProperties {
  const left = (i * 37 + 11) % 100;
  const top = (i * 53 + 7) % 100;
  // Les chutes (pluie, neige, débris) animent `top` sur TOUTE la hauteur du
  // conteneur : même densité sur le bandeau et sur la section entière.
  const falls = kind === "drop" || kind === "flake" || kind === "rock";
  const slow = kind === "flake" || kind === "bubble" || kind === "bug";
  const duration = (slow ? 4 : kind === "streak" || kind === "grain" ? 1.6 : 0.8) +
    ((i * 17) % 10) / (slow ? 4 : 12);
  const delay = -(((i * 29) % 100) / 100) * duration;
  return {
    left: `${left}%`,
    ...(falls ? {} : { top: `${top}%` }),
    animationDuration: `${duration.toFixed(2)}s`,
    animationDelay: `${delay.toFixed(2)}s`,
  };
}

// Styles embarqués : les keyframes ne sont pas exprimables en classes
// Tailwind sans toucher la config, et un <style> reste inerte en test.
const SCENE_CSS = `
.wx-scene{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit}
.wx-scene > span{position:absolute;display:block}
.wx-sky-clear{background:linear-gradient(180deg,rgba(186,230,253,.55),rgba(240,249,255,.2))}
.wx-sky-sun{background:radial-gradient(circle at 88% 0%,rgba(253,224,71,.85),rgba(253,230,138,.35) 28%,rgba(255,251,235,0) 60%)}
.wx-sky-heat{background:linear-gradient(0deg,rgba(251,146,60,.45),rgba(254,215,170,.2) 45%,rgba(255,247,237,0))}
.wx-sky-rain{background:linear-gradient(180deg,rgba(100,116,139,.45),rgba(148,163,184,.15))}
.wx-sky-storm{background:linear-gradient(180deg,rgba(51,65,85,.6),rgba(100,116,139,.25))}
.wx-sky-snow{background:linear-gradient(180deg,rgba(203,213,225,.55),rgba(241,245,249,.25))}
.wx-sky-frost{background:linear-gradient(180deg,rgba(224,242,254,.5),rgba(240,249,255,.2));box-shadow:inset 0 0 28px rgba(125,211,252,.7)}
.wx-sky-fog{background:linear-gradient(180deg,rgba(203,213,225,.7),rgba(226,232,240,.55))}
.wx-sky-gloom{background:linear-gradient(180deg,rgba(76,29,149,.35),rgba(30,41,59,.3))}
.wx-sky-toxic{background:linear-gradient(0deg,rgba(132,204,22,.45),rgba(190,242,100,.15) 60%,rgba(247,254,231,0))}
.wx-sky-wind{background:linear-gradient(90deg,rgba(203,213,225,.35),rgba(241,245,249,.1))}
.wx-sky-sand{background:linear-gradient(90deg,rgba(217,169,99,.5),rgba(253,230,138,.25))}
.wx-sky-swarm{background:linear-gradient(180deg,rgba(163,230,53,.18),rgba(254,249,195,.15))}
.wx-sky-debris{background:linear-gradient(180deg,rgba(120,113,108,.4),rgba(214,211,209,.15))}
.wx-drop{width:1.5px;height:18px;background:linear-gradient(180deg,rgba(30,64,175,0),rgba(30,64,175,.8));animation:wx-fall linear infinite;transform:rotate(12deg)}
.wx-flake{width:5px;height:5px;border-radius:9999px;background:rgba(255,255,255,.95);box-shadow:0 0 2px rgba(100,116,139,.6);animation:wx-snow linear infinite}
.wx-streak{width:42px;height:1px;background:linear-gradient(90deg,rgba(71,85,105,0),rgba(71,85,105,.6));animation:wx-blow linear infinite}
.wx-grain{width:3px;height:2px;border-radius:9999px;background:rgba(146,64,14,.7);animation:wx-blow linear infinite}
.wx-bug{width:3px;height:3px;border-radius:9999px;background:rgba(28,25,23,.75);animation:wx-buzz ease-in-out infinite alternate}
.wx-rock{width:6px;height:5px;border-radius:2px;background:rgba(87,83,78,.8);animation:wx-fall-spin linear infinite}
.wx-bubble{width:8px;height:8px;border-radius:9999px;border:1px solid rgba(77,124,15,.7);background:rgba(190,242,100,.35);animation:wx-rise ease-in infinite}
.wx-veil{inset:-20% -40% !important;background:radial-gradient(ellipse at 25% 55%,rgba(255,255,255,.9),rgba(255,255,255,0) 45%),radial-gradient(ellipse at 70% 35%,rgba(255,255,255,.85),rgba(255,255,255,0) 40%),radial-gradient(ellipse at 50% 90%,rgba(248,250,252,.8),rgba(248,250,252,0) 50%);filter:blur(4px);animation:wx-drift 14s ease-in-out infinite alternate}
.wx-veil-dark{background:radial-gradient(ellipse at 30% 50%,rgba(148,163,184,.55),rgba(148,163,184,0) 60%),radial-gradient(ellipse at 70% 40%,rgba(88,28,135,.35),rgba(88,28,135,0) 55%)}
.wx-veil-toxic{background:radial-gradient(ellipse at 35% 70%,rgba(163,230,53,.55),rgba(163,230,53,0) 60%),radial-gradient(ellipse at 75% 60%,rgba(132,204,22,.45),rgba(132,204,22,0) 55%)}
.wx-glare{inset:0;background:radial-gradient(circle at 88% 0%,rgba(255,255,255,.9),rgba(255,255,255,0) 30%);animation:wx-pulse 4s ease-in-out infinite alternate}
.wx-haze{left:0;right:0;bottom:0;height:45%;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,rgba(255,255,255,0) 2px 6px);animation:wx-shimmer 1.8s ease-in-out infinite alternate}
.wx-flash{inset:0;background:rgba(255,255,255,.9);opacity:0;animation:wx-flash 7s linear infinite}
.wx-cloud{width:70px;height:18px;border-radius:9999px;background:rgba(255,255,255,.85);animation:wx-cloud 40s linear infinite}
@keyframes wx-fall{from{top:-20%}to{top:105%}}
@keyframes wx-fall-spin{from{top:-15%;transform:rotate(0)}to{top:105%;transform:rotate(360deg)}}
@keyframes wx-snow{from{top:-10%;transform:translateX(0)}50%{transform:translateX(10px)}to{top:105%;transform:translateX(-4px)}}
@keyframes wx-blow{from{transform:translateX(-160px)}to{transform:translateX(320px)}}
@keyframes wx-buzz{from{transform:translate(0,0)}33%{transform:translate(9px,-6px)}66%{transform:translate(-5px,7px)}to{transform:translate(6px,3px)}}
@keyframes wx-rise{from{transform:translateY(40px);opacity:0}30%{opacity:1}to{transform:translateY(-90px);opacity:0}}
@keyframes wx-drift{from{transform:translateX(-8%)}to{transform:translateX(8%)}}
@keyframes wx-pulse{from{opacity:.55}to{opacity:1}}
@keyframes wx-shimmer{from{transform:skewX(-3deg) scaleY(1)}to{transform:skewX(3deg) scaleY(1.08)}}
@keyframes wx-flash{0%,92%,96%,100%{opacity:0}93%,95%{opacity:.7}}
@keyframes wx-cloud{from{transform:translateX(-120px)}to{transform:translateX(900px)}}
@media (prefers-reduced-motion: reduce){.wx-scene,.wx-scene *{animation:none !important}}
`;

export function WeatherScene({
  visual,
  variant = "banner",
}: {
  visual: WeatherVisual;
  variant?: WeatherSceneVariant;
}) {
  const { kind, intensity } = visual;
  const particle = PARTICLES[kind];
  const count = particleCount(particle, variant, intensity);
  // Le voile ambiant reste discret : il ne doit jamais gêner la lecture.
  const opacity = variant === "ambient" ? 0.45 : 1;

  return (
    <div
      aria-hidden="true"
      data-testid={`weather-scene-${variant}`}
      data-weather-kind={kind}
      data-weather-intensity={intensity}
      className={`wx-scene wx-sky-${kind}`}
      style={{ opacity }}
    >
      {/* Constante statique : injectée telle quelle, car un enfant texte
          serait échappé au rendu serveur (`>` → `&gt;` casse le sélecteur). */}
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
      {kind === "clear" &&
        [0, 1].map((i) => (
          <span
            key={`cloud-${i}`}
            className="wx-cloud"
            style={{ top: `${20 + i * 35}%`, animationDelay: `${-i * 18}s` }}
          />
        ))}
      {(kind === "sun" || kind === "heat") && <span className="wx-glare" />}
      {kind === "heat" && <span className="wx-haze" />}
      {kind === "storm" && <span className="wx-flash" />}
      {(kind === "fog" || kind === "gloom" || kind === "toxic") && (
        <span
          className={`wx-veil${kind === "gloom" ? " wx-veil-dark" : ""}${
            kind === "toxic" ? " wx-veil-toxic" : ""
          }`}
          style={{ opacity: intensity === "heavy" ? 1 : 0.6 }}
        />
      )}
      {particle &&
        Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={`wx-${particle}`}
            style={particleStyle(i, particle)}
          />
        ))}
    </div>
  );
}
