import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";

vi.mock("./api", () => ({
  uploadBlogImage: vi.fn(),
}));

// Modale picker simplifiée : un bouton qui renvoie une image fixe via onSelect.
vi.mock("./MediaLibraryModal", () => ({
  default: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (img: {
      url: string;
      alt: string | null;
      filename: string;
    }) => void;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="fake-pick"
        onClick={() =>
          onSelect({
            url: "/images/blog/picked.png",
            alt: "Picked",
            filename: "picked.png",
          })
        }
      >
        pick
      </button>
    ) : null,
}));

import CoverImageField from "./CoverImageField";
import { uploadBlogImage } from "./api";

const mockedUpload = vi.mocked(uploadBlogImage);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("CoverImageField", () => {
  it("affiche un aperçu quand une URL est fournie", () => {
    render(<CoverImageField value="/images/blog/x.png" onChange={() => {}} />);
    const preview = screen.getByTestId("cover-preview") as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("/images/blog/x.png");
  });

  it("n'affiche pas d'aperçu sans valeur", () => {
    render(<CoverImageField value="" onChange={() => {}} />);
    expect(screen.queryByTestId("cover-preview")).toBeNull();
  });

  it("uploade un fichier et propage l'URL", async () => {
    mockedUpload.mockResolvedValue({
      url: "/images/blog/up-aaaaaaaaaaaa.png",
      filename: "up-aaaaaaaaaaaa.png",
      mime: "image/png",
      bytes: 10,
    });
    const onChange = vi.fn();
    render(<CoverImageField value="" onChange={onChange} />);
    const input = screen.getByTestId("cover-upload-input");
    const file = new File([new Uint8Array([0x89, 0x50])], "cover.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("/images/blog/up-aaaaaaaaaaaa.png"),
    );
  });

  it("retire la couverture", () => {
    const onChange = vi.fn();
    render(<CoverImageField value="/images/blog/x.png" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("cover-remove"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sélectionne une image depuis la médiathèque", () => {
    const onChange = vi.fn();
    render(<CoverImageField value="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("cover-pick")); // ouvre la modale
    fireEvent.click(screen.getByTestId("fake-pick")); // sélectionne
    expect(onChange).toHaveBeenCalledWith("/images/blog/picked.png");
  });

  it("permet de coller une URL manuellement", () => {
    const onChange = vi.fn();
    render(<CoverImageField value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("cover-url-input"), {
      target: { value: "https://cdn.example.com/img.png" },
    });
    expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/img.png");
  });
});
