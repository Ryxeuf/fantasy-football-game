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
});
