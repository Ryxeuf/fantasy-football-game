import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";

vi.mock("./api", () => {
  class BlogImageInUseError extends Error {
    referencedBy: Array<{ id: string; slug: string; title: string }>;
    constructor(
      referencedBy: Array<{ id: string; slug: string; title: string }>,
    ) {
      super("Image utilisée");
      this.name = "BlogImageInUseError";
      this.referencedBy = referencedBy;
    }
  }
  return {
    listBlogImages: vi.fn(),
    uploadBlogImage: vi.fn(),
    updateBlogImageAlt: vi.fn(),
    deleteBlogImage: vi.fn(),
    BlogImageInUseError,
  };
});

import MediaLibrary from "./MediaLibrary";
import {
  listBlogImages,
  uploadBlogImage,
  updateBlogImageAlt,
  deleteBlogImage,
  BlogImageInUseError,
  type BlogImage,
} from "./api";

const mockedList = vi.mocked(listBlogImages);
const mockedUpload = vi.mocked(uploadBlogImage);
const mockedUpdateAlt = vi.mocked(updateBlogImageAlt);
const mockedDelete = vi.mocked(deleteBlogImage);

function img(overrides: Partial<BlogImage> = {}): BlogImage {
  return {
    filename: "orc-aaaaaaaaaaaa.png",
    url: "/images/blog/orc-aaaaaaaaaaaa.png",
    bytes: 2048,
    width: 800,
    height: 600,
    alt: null,
    uploadedAt: "2026-06-18T10:00:00.000Z",
    ext: "png",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedList.mockResolvedValue({ images: [img()], total: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MediaLibrary", () => {
  it("affiche les images chargées", async () => {
    render(<MediaLibrary mode="manage" />);
    expect(await screen.findByText("orc-aaaaaaaaaaaa.png")).toBeTruthy();
    expect(mockedList).toHaveBeenCalled();
  });

  it("enregistre le texte alternatif au blur", async () => {
    mockedUpdateAlt.mockResolvedValue(img({ alt: "Un Orc" }));
    render(<MediaLibrary mode="manage" />);
    const input = await screen.findByTestId("media-alt-orc-aaaaaaaaaaaa.png");
    fireEvent.change(input, { target: { value: "Un Orc" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mockedUpdateAlt).toHaveBeenCalledWith(
        "orc-aaaaaaaaaaaa.png",
        "Un Orc",
      ),
    );
  });

  it("supprime une image après confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedDelete.mockResolvedValue(undefined);
    render(<MediaLibrary mode="manage" />);
    const btn = await screen.findByTestId("media-delete-orc-aaaaaaaaaaaa.png");
    fireEvent.click(btn);
    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith("orc-aaaaaaaaaaaa.png"),
    );
    await waitFor(() =>
      expect(screen.queryByText("orc-aaaaaaaaaaaa.png")).toBeNull(),
    );
  });

  it("propose de forcer la suppression si l'image est utilisée (409)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedDelete
      .mockRejectedValueOnce(
        new BlogImageInUseError([{ id: "p1", slug: "a", title: "Article A" }]),
      )
      .mockResolvedValueOnce(undefined);
    render(<MediaLibrary mode="manage" />);
    const btn = await screen.findByTestId("media-delete-orc-aaaaaaaaaaaa.png");
    fireEvent.click(btn);
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledTimes(2));
    expect(mockedDelete).toHaveBeenLastCalledWith("orc-aaaaaaaaaaaa.png", {
      force: true,
    });
  });

  it("n'efface pas l'image si l'utilisateur refuse de forcer", async () => {
    vi.spyOn(window, "confirm")
      .mockReturnValueOnce(true) // confirmation initiale
      .mockReturnValueOnce(false); // refuse de forcer
    mockedDelete.mockRejectedValueOnce(
      new BlogImageInUseError([{ id: "p1", slug: "a", title: "Article A" }]),
    );
    render(<MediaLibrary mode="manage" />);
    const btn = await screen.findByTestId("media-delete-orc-aaaaaaaaaaaa.png");
    fireEvent.click(btn);
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("orc-aaaaaaaaaaaa.png")).not.toBeNull();
  });

  it("appelle onSelect en mode picker", async () => {
    const onSelect = vi.fn();
    render(<MediaLibrary mode="picker" onSelect={onSelect} />);
    const sel = await screen.findByTestId("media-select-orc-aaaaaaaaaaaa.png");
    fireEvent.click(sel);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "orc-aaaaaaaaaaaa.png" }),
    );
  });

  it("uploade les fichiers sélectionnés et recharge", async () => {
    mockedUpload.mockResolvedValue({
      url: "/images/blog/photo-bbbbbbbbbbbb.png",
      filename: "photo-bbbbbbbbbbbb.png",
      mime: "image/png",
      bytes: 10,
    });
    render(<MediaLibrary mode="manage" />);
    await screen.findByText("orc-aaaaaaaaaaaa.png");
    const input = screen.getByTestId("media-upload-input");
    const file = new File([new Uint8Array([0x89, 0x50])], "photo.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    // reload ⇒ listBlogImages rappelé (1 au montage + 1 après upload).
    await waitFor(() =>
      expect(mockedList.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
  });
});
