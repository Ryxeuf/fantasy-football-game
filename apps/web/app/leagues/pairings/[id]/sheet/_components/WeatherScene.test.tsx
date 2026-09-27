import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeatherScene } from "./WeatherScene";

describe("WeatherScene", () => {
  it("est décorative : masquée aux lecteurs d'écran, sans pointeur", () => {
    render(<WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />);
    const scene = screen.getByTestId("weather-scene-banner");
    expect(scene.getAttribute("aria-hidden")).toBe("true");
    expect(scene.className).toContain("wx-scene");
    expect(scene.className).toContain("wx-sky-rain");
  });

  it("fait tomber des gouttes, moins nombreuses sous pluie fine", () => {
    const { container, rerender } = render(
      <WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />,
    );
    const heavy = container.querySelectorAll(".wx-drop").length;
    rerender(<WeatherScene visual={{ kind: "rain", intensity: "light" }} />);
    const light = container.querySelectorAll(".wx-drop").length;
    expect(heavy).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(0);
  });

  it("le voile ambiant est plus discret que le bandeau", () => {
    const { container } = render(
      <WeatherScene
        visual={{ kind: "snow", intensity: "heavy" }}
        variant="ambient"
      />,
    );
    const scene = screen.getByTestId("weather-scene-ambient");
    expect(Number(scene.style.opacity)).toBeLessThan(1);
    expect(container.querySelectorAll(".wx-flake").length).toBeGreaterThan(0);
  });

  it.each([
    ["fog", ".wx-veil"],
    ["gloom", ".wx-veil-dark"],
    ["toxic", ".wx-veil-toxic"],
    ["sun", ".wx-glare"],
    ["heat", ".wx-haze"],
    ["storm", ".wx-flash"],
    ["clear", ".wx-cloud"],
    ["wind", ".wx-streak"],
    ["sand", ".wx-grain"],
    ["swarm", ".wx-bug"],
    ["debris", ".wx-rock"],
  ] as const)("%s dessine %s", (kind, selector) => {
    const { container } = render(
      <WeatherScene visual={{ kind, intensity: "heavy" }} />,
    );
    expect(container.querySelector(selector)).not.toBeNull();
  });

  it("rendu déterministe (pas d'aléa à l'hydratation)", () => {
    const a = render(<WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />);
    const htmlA = a.container.innerHTML;
    a.unmount();
    const b = render(<WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />);
    expect(b.container.innerHTML).toBe(htmlA);
  });

  it("fige les animations si l'utilisateur réduit les mouvements", () => {
    const { container } = render(
      <WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />,
    );
    expect(container.querySelector("style")?.textContent).toContain(
      "prefers-reduced-motion",
    );
  });

  it("le CSS survit au rendu serveur sans être échappé", () => {
    const html = renderToStaticMarkup(
      <WeatherScene visual={{ kind: "rain", intensity: "heavy" }} />,
    );
    expect(html).toContain(".wx-scene > span");
    expect(html).not.toContain("&gt;");
  });
});
