import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Le widget Turnstile est charge via `next/dynamic` et dependrait de
// `window.turnstile` injecte par un script externe. On le stub pour
// pouvoir tester la logique du formulaire sans charger le script.
vi.mock("./TurnstileWidget", () => ({
  default: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <div data-testid="turnstile-widget">
      <button
        type="button"
        data-testid="turnstile-verify"
        onClick={() => onVerify("fake-captcha-token")}
      >
        verify
      </button>
    </div>
  ),
}));

vi.mock("../lib/feedback", () => ({
  submitFeedback: vi.fn(),
}));

import FeedbackForm from "./FeedbackForm";
import { submitFeedback } from "../lib/feedback";
import { LanguageProvider } from "../contexts/LanguageContext";

const mockSubmit = submitFeedback as unknown as ReturnType<typeof vi.fn>;

function renderForm(props: Parameters<typeof FeedbackForm>[0] = {}) {
  return render(
    <LanguageProvider>
      <FeedbackForm {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FeedbackForm", () => {
  it("renders the 3 feedback type radios", () => {
    renderForm({ turnstileSiteKey: "test-key" });
    expect(screen.getByLabelText(/bug/i)).toBeTruthy();
    expect(screen.getByLabelText(/remarque|remark/i)).toBeTruthy();
    expect(screen.getByLabelText(/commentaire|comment/i)).toBeTruthy();
  });

  it("blocks submission when no captcha token is set", async () => {
    renderForm({ turnstileSiteKey: "test-key" });
    fireEvent.change(screen.getByLabelText(/sujet|subject/i), {
      target: { value: "Sujet" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Suffisamment long pour passer le min" },
    });
    fireEvent.click(screen.getByRole("button", { name: /envoyer|send/i }));
    await waitFor(() => {
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  it("submits the form with captcha token and trimmed values", async () => {
    mockSubmit.mockResolvedValueOnce({ id: "fb_1" });
    renderForm({ turnstileSiteKey: "test-key" });

    fireEvent.change(screen.getByLabelText(/sujet|subject/i), {
      target: { value: "  Crash button  " },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "  Le bouton fin de tour ne reagit plus apres 3 clics  " },
    });
    fireEvent.click(screen.getByTestId("turnstile-verify"));
    fireEvent.click(screen.getByRole("button", { name: /envoyer|send/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledOnce());
    const arg = mockSubmit.mock.calls[0][0];
    expect(arg.subject).toBe("Crash button");
    expect(arg.message).toBe("Le bouton fin de tour ne reagit plus apres 3 clics");
    expect(arg.captchaToken).toBe("fake-captcha-token");
    // Type par defaut = comment
    expect(arg.type).toBe("comment");
  });

  it("displays the success state after a successful submit", async () => {
    mockSubmit.mockResolvedValueOnce({ id: "fb_42" });
    renderForm({ turnstileSiteKey: "test-key" });
    fireEvent.change(screen.getByLabelText(/sujet|subject/i), {
      target: { value: "ok" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Au moins dix caracteres ici" },
    });
    fireEvent.click(screen.getByTestId("turnstile-verify"));
    fireEvent.click(screen.getByRole("button", { name: /envoyer|send/i }));
    await screen.findByRole("status");
    expect(screen.getByRole("status").textContent).toMatch(/merci|thank/i);
  });

  it("shows a server error when submitFeedback rejects", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("Trop d'envois"));
    renderForm({ turnstileSiteKey: "test-key" });
    fireEvent.change(screen.getByLabelText(/sujet|subject/i), {
      target: { value: "ok" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Suffisamment long pour passer le min" },
    });
    fireEvent.click(screen.getByTestId("turnstile-verify"));
    fireEvent.click(screen.getByRole("button", { name: /envoyer|send/i }));
    const alert = await screen.findByText(/Trop d'envois/i);
    expect(alert).toBeTruthy();
  });

  it("disables submission and shows config-missing alert when no site key", () => {
    renderForm({ turnstileSiteKey: undefined });
    // Le widget Turnstile n'est pas rendu sans cle.
    expect(screen.queryByTestId("turnstile-widget")).toBeNull();
    // Un message d'alerte doit prevenir l'utilisateur.
    expect(
      screen.getAllByRole("alert").some((node) =>
        /configur|Turnstile/i.test(node.textContent ?? ""),
      ),
    ).toBe(true);
  });

  it("rejects an invalid email format", async () => {
    renderForm({ turnstileSiteKey: "test-key" });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText(/sujet|subject/i), {
      target: { value: "ok" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Suffisamment long pour passer le min" },
    });
    fireEvent.click(screen.getByTestId("turnstile-verify"));
    fireEvent.click(screen.getByRole("button", { name: /envoyer|send/i }));
    await waitFor(() => {
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });
});
