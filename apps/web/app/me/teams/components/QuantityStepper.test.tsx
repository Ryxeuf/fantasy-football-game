import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuantityStepper from "./QuantityStepper";

describe("QuantityStepper", () => {
  it("renders the current value", () => {
    render(<QuantityStepper value={3} onChange={() => {}} valueTestId="qty" />);
    expect(screen.getByTestId("qty").textContent).toBe("3");
  });

  it("calls onChange with value + step when increment pressed", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={2}
        onChange={onChange}
        incrementTestId="inc"
      />,
    );
    fireEvent.click(screen.getByTestId("inc"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with value - step when decrement pressed", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={2}
        onChange={onChange}
        decrementTestId="dec"
      />,
    );
    fireEvent.click(screen.getByTestId("dec"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("disables decrement at min", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={0}
        min={0}
        onChange={onChange}
        decrementTestId="dec"
      />,
    );
    const btn = screen.getByTestId("dec") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables increment at max", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={5}
        max={5}
        onChange={onChange}
        incrementTestId="inc"
      />,
    );
    const btn = screen.getByTestId("inc") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables increment when disabledIncrement is true", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={2}
        max={10}
        disabledIncrement
        onChange={onChange}
        incrementTestId="inc"
      />,
    );
    const btn = screen.getByTestId("inc") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("applies custom step", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={1000}
        step={50}
        min={100}
        max={2000}
        onChange={onChange}
        incrementTestId="inc"
        decrementTestId="dec"
      />,
    );
    fireEvent.click(screen.getByTestId("inc"));
    expect(onChange).toHaveBeenCalledWith(1050);
    fireEvent.click(screen.getByTestId("dec"));
    expect(onChange).toHaveBeenCalledWith(950);
  });

  it("clamps to bounds", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={5}
        step={10}
        min={0}
        max={8}
        onChange={onChange}
        incrementTestId="inc"
      />,
    );
    // value+step (15) exceeds max (8), so increment should be disabled
    const btn = screen.getByTestId("inc") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  describe("mode editable (saisie libre)", () => {
    it("accepte une valeur hors du pas de progression", () => {
      const onChange = vi.fn();
      render(
        <QuantityStepper
          value={1000}
          step={50}
          min={100}
          max={2000}
          editable
          onChange={onChange}
          valueInputTestId="qty-input"
        />,
      );
      fireEvent.change(screen.getByTestId("qty-input"), {
        target: { value: "1234" },
      });
      expect(onChange).toHaveBeenCalledWith(1234);
    });

    it("laisse saisir une valeur intermediaire sans la clamper", () => {
      const onChange = vi.fn();
      render(
        <QuantityStepper
          value={1000}
          step={50}
          min={100}
          max={2000}
          editable
          onChange={onChange}
          valueInputTestId="qty-input"
        />,
      );
      const input = screen.getByTestId("qty-input") as HTMLInputElement;
      // "1" est en dessous du min mais c'est un etat de frappe valide :
      // le champ ne doit pas sauter a 100 sous les doigts.
      fireEvent.change(input, { target: { value: "1" } });
      expect(onChange).not.toHaveBeenCalled();
      expect(input.value).toBe("1");
    });

    it("clampe au blur (valeur hors bornes ou champ vide)", () => {
      const onChange = vi.fn();
      render(
        <QuantityStepper
          value={1000}
          step={50}
          min={100}
          max={2000}
          editable
          onChange={onChange}
          valueInputTestId="qty-input"
        />,
      );
      const input = screen.getByTestId("qty-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "5000" } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenLastCalledWith(2000);
      expect(input.value).toBe("2000");
    });

    it("revient a la valeur courante si la saisie est vide", () => {
      const onChange = vi.fn();
      render(
        <QuantityStepper
          value={1000}
          step={50}
          min={100}
          max={2000}
          editable
          onChange={onChange}
          valueInputTestId="qty-input"
        />,
      );
      const input = screen.getByTestId("qty-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);
      expect(input.value).toBe("1000");
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
