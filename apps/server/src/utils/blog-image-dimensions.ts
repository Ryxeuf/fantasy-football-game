/**
 * Extraction des dimensions (largeur x hauteur) d'une image à partir de son
 * en-tête binaire, sans dépendance externe (cf. médiathèque blog —
 * `routes/admin-blog.ts`). Volontairement aligné sur l'approche "magic bytes"
 * de `detectImageType` (`blog-upload.ts`) : on lit uniquement les premiers
 * octets, on borne chaque accès, et on ne lève **jamais** d'exception — un
 * contenu illisible renvoie `null` (dimensions inconnues).
 *
 * Formats couverts (les mêmes que l'upload) : PNG, GIF, JPEG, WEBP
 * (VP8 / VP8L / VP8X).
 */

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** PNG : signature 8 o. + chunk IHDR (`IHDR` à 12..15, w@16, h@20, big-endian). */
function parsePng(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;
  // Vérifie le type de chunk IHDR pour ne pas lire n'importe quoi.
  if (
    buf[12] !== 0x49 || // I
    buf[13] !== 0x48 || // H
    buf[14] !== 0x44 || // D
    buf[15] !== 0x52 // R
  ) {
    return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** GIF : `GIF87a`/`GIF89a` puis Logical Screen Descriptor (w@6, h@8, little-endian). */
function parseGif(buf: Buffer): ImageDimensions | null {
  if (buf.length < 10) return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * JPEG : pas d'offset fixe — on scanne la chaîne de segments depuis l'octet 2
 * (après le SOI `FF D8`). On saute chaque segment via sa longueur jusqu'à
 * tomber sur un marqueur Start-Of-Frame (`0xC0`..`0xCF` sauf `C4` DHT, `C8` JPG
 * extension, `CC` DAC) qui porte les dimensions ; on s'arrête au SOS (`0xDA`).
 */
function parseJpeg(buf: Buffer): ImageDimensions | null {
  let offset = 2; // après FF D8
  const len = buf.length;
  while (offset + 1 < len) {
    if (buf[offset] !== 0xff) {
      offset++; // resynchronisation défensive
      continue;
    }
    let marker = buf[offset + 1];
    // Saute les octets de remplissage 0xFF entre marqueurs.
    while (marker === 0xff && offset + 1 < len) {
      offset++;
      marker = buf[offset + 1];
    }
    // Marqueurs sans charge utile.
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    // Start-Of-Scan : les données image commencent, plus de méta-segment.
    if (marker === 0xda) break;
    if (offset + 4 > len) break;
    const segLen = buf.readUInt16BE(offset + 2);
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      // [FF][Cn][len:2][precision:1][height:2][width:2]
      if (offset + 9 > len) break;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (segLen < 2) break; // longueur incohérente : on stoppe pour éviter une boucle
    offset += 2 + segLen;
  }
  return null;
}

/** WEBP : conteneur RIFF/WEBP, FourCC à l'octet 12 (`VP8 ` / `VP8L` / `VP8X`). */
function parseWebp(buf: Buffer): ImageDimensions | null {
  if (buf.length < 16) return null;
  const fourCc = buf.toString("ascii", 12, 16);
  if (fourCc === "VP8 ") {
    // Lossy : start code 9D 01 2A à 23..25, puis w@26, h@28 (14 bits, LE).
    if (buf.length < 30) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (fourCc === "VP8L") {
    // Lossless : signature 0x2F à 20, 4 octets compactés à partir de 21 (LE).
    if (buf.length < 25 || buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (fourCc === "VP8X") {
    // Extended : canvas (w-1)@24 et (h-1)@27, 24 bits little-endian.
    if (buf.length < 30) return null;
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}

/**
 * Détecte le format par magic bytes puis délègue au parseur dédié. Renvoie
 * `null` si le format n'est pas reconnu ou si l'en-tête est trop court /
 * incohérent. Ne lève jamais.
 */
export function parseImageDimensions(buf: Buffer): ImageDimensions | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return parsePng(buf);
  }
  // GIF : "GIF8"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return parseGif(buf);
  }
  // JPEG : FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return parseJpeg(buf);
  }
  // WEBP : "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return parseWebp(buf);
  }
  return null;
}
