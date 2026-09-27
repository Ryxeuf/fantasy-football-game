import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WeatherReminder } from "./WeatherReminder";
import { resolveSheetWeather } from "../weather";

const TABLES = [
  {
    id: "classique",
    name: "Classique",
    results: [
      { roll: 4, condition: "Conditions parfaites", description: "Idéal." },
      { roll: 11, condition: "Pluie battante", description: "Ballon glissant." },
    ],
  },
];

describe("WeatherReminder", () => {
  it("affiche la météo d'avant-match et ses effets", () => {
    render(
      <WeatherReminder
        weather={resolveSheetWeather(TABLES, "classique", "Pluie battante")}
        changingWeather={[]}
      />,
    );
    expect(screen.getByTestId("weather-reminder").textContent).toContain(
      "Météo : Pluie battante",
    );
    expect(screen.getByTestId("weather-reminder-effects").textContent).toContain(
      "-1 aux tests d'Agilité",
    );
    expect(screen.getByText("Ballon glissant.")).toBeTruthy();
    expect(screen.queryByTestId("weather-reminder-changed")).toBeNull();
  });

  it("annonce l'absence d'effet en conditions idéales", () => {
    render(
      <WeatherReminder
        weather={resolveSheetWeather(TABLES, "classique", "Conditions parfaites")}
        changingWeather={[]}
      />,
    );
    expect(screen.getByTestId("weather-reminder-none")).toBeTruthy();
  });

  it("signale une météo non saisie", () => {
    render(<WeatherReminder weather={null} changingWeather={[]} />);
    expect(screen.getByTestId("weather-reminder-missing")).toBeTruthy();
  });

  it("invite à mettre à jour la météo après une Météo capricieuse", () => {
    const onEdit = vi.fn();
    render(
      <WeatherReminder
        weather={resolveSheetWeather(TABLES, "classique", "Conditions parfaites")}
        changingWeather={[{ id: "k", meta: { half: 2, turn: 3 } }]}
        onEditPreMatch={onEdit}
      />,
    );
    expect(screen.getByTestId("weather-reminder-changed").textContent).toContain(
      "(MT 2, T3)",
    );
    fireEvent.click(screen.getByTestId("weather-reminder-edit"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("sans droit d'édition, pas de bouton", () => {
    render(
      <WeatherReminder
        weather={null}
        changingWeather={[{ id: "k", meta: null }]}
      />,
    );
    expect(screen.queryByTestId("weather-reminder-edit")).toBeNull();
  });

  it("dessine l'ambiance de la condition derrière le texte", () => {
    render(
      <WeatherReminder
        weather={resolveSheetWeather(TABLES, "classique", "Pluie battante")}
        changingWeather={[]}
      />,
    );
    expect(
      screen.getByTestId("weather-scene-banner").getAttribute("data-weather-kind"),
    ).toBe("rain");
  });

  it("l'interrupteur masque l'ambiance sans masquer le rappel", () => {
    const onToggle = vi.fn();
    const weather = resolveSheetWeather(TABLES, "classique", "Pluie battante");
    const { rerender } = render(
      <WeatherReminder
        weather={weather}
        changingWeather={[]}
        effectsEnabled
        onToggleEffects={onToggle}
      />,
    );
    fireEvent.click(screen.getByTestId("weather-effects-toggle"));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <WeatherReminder
        weather={weather}
        changingWeather={[]}
        effectsEnabled={false}
        onToggleEffects={onToggle}
      />,
    );
    expect(screen.queryByTestId("weather-scene-banner")).toBeNull();
    expect(screen.getByTestId("weather-reminder-effects")).toBeTruthy();
    expect(
      screen.getByTestId("weather-effects-toggle").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("pas d'ambiance sans météo saisie", () => {
    render(<WeatherReminder weather={null} changingWeather={[]} />);
    expect(screen.queryByTestId("weather-scene-banner")).toBeNull();
  });
});
