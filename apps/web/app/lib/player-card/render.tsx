/**
 * Rendu PNG serveur de la carte joueur (change `export-player-cards`).
 *
 * Wrapper I/O autour du template pur `PlayerCardArt` : chargement (mis en
 * cache process) des polices TTF embarquées dans `apps/web/assets/fonts/`,
 * construction de l'`ImageResponse` satori et en-têtes HTTP (cache +
 * téléchargement). À n'importer que depuis des route handlers Node
 * (`export const runtime = "nodejs"`).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import {
  PlayerCardArt,
  PLAYER_CARD_HEIGHT,
  PLAYER_CARD_WIDTH,
} from "./card-art";
import { slugifyForFileName, type PlayerCardData } from "./card-model";

interface CardFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 800;
  style: "normal";
}

let fontsPromise: Promise<CardFont[]> | null = null;

async function loadFont(
  file: string,
  name: string,
  weight: CardFont["weight"],
): Promise<CardFont> {
  const buffer = await readFile(
    path.join(process.cwd(), "assets", "fonts", file),
  );
  // Recopie dans un ArrayBuffer propre (satori n'accepte pas un Buffer nu,
  // et le pool partagé de Buffer déborderait du fichier).
  const data = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(data).set(buffer);
  return { name, data, weight, style: "normal" };
}

function loadCardFonts(): Promise<CardFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      loadFont("bebas-neue-400.ttf", "Bebas Neue", 400),
      loadFont("montserrat-600.ttf", "Montserrat", 600),
      loadFont("montserrat-800.ttf", "Montserrat", 800),
    ]).catch((error) => {
      // Ne fige pas un échec transitoire (fs) dans le cache process.
      fontsPromise = null;
      throw error;
    });
  }
  return fontsPromise;
}

export interface RenderPlayerCardOptions {
  /** Force `Content-Disposition: attachment` (téléchargement direct). */
  readonly download?: boolean;
  /**
   * `Cache-Control` de la réponse. Défaut 1 h ; le renderer générique passe
   * `immutable` (l'URL est adressée par le contenu du payload — toute
   * évolution du joueur change l'URL), la route star un max-age court.
   */
  readonly cacheControl?: string;
}

/** Nom de fichier proposé au téléchargement ("carte-grip-soberwall.png"). */
export function playerCardFileName(data: PlayerCardData): string {
  const prefix = data.lang === "en" ? "card" : "carte";
  return `${prefix}-${slugifyForFileName(data.name)}.png`;
}

/** Rend la carte en PNG 750×1050 (carte poker à 300 dpi). */
export async function renderPlayerCardResponse(
  data: PlayerCardData,
  options: RenderPlayerCardOptions = {},
): Promise<Response> {
  const fonts = await loadCardFonts();
  const headers: Record<string, string> = {
    "Cache-Control": options.cacheControl ?? "public, max-age=3600",
  };
  if (options.download) {
    headers["Content-Disposition"] =
      `attachment; filename="${playerCardFileName(data)}"`;
  }
  return new ImageResponse(<PlayerCardArt data={data} />, {
    width: PLAYER_CARD_WIDTH,
    height: PLAYER_CARD_HEIGHT,
    fonts,
    headers,
  });
}
