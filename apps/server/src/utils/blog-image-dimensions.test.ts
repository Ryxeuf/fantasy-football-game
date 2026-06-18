/**
 * Tests du parseur de dimensions d'images (PNG/GIF/JPEG/WEBP). Les fixtures
 * sont construites octet par octet : on ne dépend d'aucun fichier binaire.
 */

import { describe, it, expect } from "vitest";
import { parseImageDimensions } from "./blog-image-dimensions";

function makePng(w: number, h: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

function makeGif(w: number, h: number): Buffer {
  // En-tête (6 o.) + Logical Screen Descriptor (7 o.) = 13 o. minimum réel.
  const buf = Buffer.alloc(13);
  buf.write("GIF89a", 0, "ascii");
  buf.writeUInt16LE(w, 6);
  buf.writeUInt16LE(h, 8);
  return buf;
}

function makeJpeg(w: number, h: number): Buffer {
  const buf = Buffer.alloc(20);
  let o = 0;
  buf[o++] = 0xff;
  buf[o++] = 0xd8; // SOI
  buf[o++] = 0xff;
  buf[o++] = 0xe0; // APP0
  buf.writeUInt16BE(4, o);
  o += 2; // longueur du segment APP0
  buf[o++] = 0xaa;
  buf[o++] = 0xbb; // données APP0 (bidon)
  buf[o++] = 0xff;
  buf[o++] = 0xc0; // SOF0
  buf.writeUInt16BE(17, o);
  o += 2; // longueur
  buf[o++] = 0x08; // précision
  buf.writeUInt16BE(h, o);
  o += 2;
  buf.writeUInt16BE(w, o);
  return buf;
}

function makeWebpHeader(fourCc: string): Buffer {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  buf.write(fourCc, 12, "ascii");
  return buf;
}

function makeWebpVp8(w: number, h: number): Buffer {
  const buf = makeWebpHeader("VP8 ");
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  buf.writeUInt16LE(w & 0x3fff, 26);
  buf.writeUInt16LE(h & 0x3fff, 28);
  return buf;
}

function makeWebpVp8l(w: number, h: number): Buffer {
  const buf = Buffer.alloc(25);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8L", 12, "ascii");
  buf[20] = 0x2f;
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  buf.writeUInt32LE(bits >>> 0, 21);
  return buf;
}

function makeWebpVp8x(w: number, h: number): Buffer {
  const buf = makeWebpHeader("VP8X");
  const w1 = w - 1;
  const h1 = h - 1;
  buf[24] = w1 & 0xff;
  buf[25] = (w1 >> 8) & 0xff;
  buf[26] = (w1 >> 16) & 0xff;
  buf[27] = h1 & 0xff;
  buf[28] = (h1 >> 8) & 0xff;
  buf[29] = (h1 >> 16) & 0xff;
  return buf;
}

describe("parseImageDimensions", () => {
  it("lit les dimensions PNG", () => {
    expect(parseImageDimensions(makePng(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("lit les dimensions GIF", () => {
    expect(parseImageDimensions(makeGif(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("lit les dimensions JPEG (scan des segments)", () => {
    expect(parseImageDimensions(makeJpeg(400, 300))).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("lit les dimensions WEBP lossy (VP8 )", () => {
    expect(parseImageDimensions(makeWebpVp8(200, 150))).toEqual({
      width: 200,
      height: 150,
    });
  });

  it("lit les dimensions WEBP lossless (VP8L)", () => {
    expect(parseImageDimensions(makeWebpVp8l(16, 32))).toEqual({
      width: 16,
      height: 32,
    });
  });

  it("lit les dimensions WEBP extended (VP8X)", () => {
    expect(parseImageDimensions(makeWebpVp8x(1024, 768))).toEqual({
      width: 1024,
      height: 768,
    });
  });

  it("renvoie null pour un buffer trop court", () => {
    expect(
      parseImageDimensions(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    ).toBeNull();
  });

  it("renvoie null pour un PNG tronqué après la signature", () => {
    expect(parseImageDimensions(makePng(800, 600).subarray(0, 18))).toBeNull();
  });

  it("renvoie null pour un contenu non-image", () => {
    expect(
      parseImageDimensions(Buffer.from("ceci n'est pas une image")),
    ).toBeNull();
  });

  it("renvoie null pour un JPEG sans marqueur SOF", () => {
    // SOI puis SOS immédiat : aucune dimension disponible.
    expect(
      parseImageDimensions(
        Buffer.from([
          0xff, 0xd8, 0xff, 0xda, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00,
        ]),
      ),
    ).toBeNull();
  });

  it("ne lève jamais et renvoie null pour un argument non-buffer", () => {
    expect(parseImageDimensions(undefined as unknown as Buffer)).toBeNull();
  });
});
