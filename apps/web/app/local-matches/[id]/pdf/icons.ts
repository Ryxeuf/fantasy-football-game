/**
 * Primitives de dessin vectoriel pour le PDF de recap.
 *
 * Tout est dessine en jsPDF natif (rect/line/circle/ellipse/lines), pas de
 * dependance externe ni de polices custom. Les ornements respectent la palette
 * Blood Bowl (parchemin/sang/or) et acceptent une couleur en argument quand
 * pertinent (ex: emblemes d'equipe colorises selon le roster).
 */

import type jsPDF from "jspdf";
import { PALETTE, setDrawHex, setFillHex, setTextHex } from "./colors";
import type { ActionType } from "./types";

export type IconKind =
  | ActionType
  | "casualty"
  | "fumble"
  | "armorBroken";

/**
 * Trace un polygone ferme via doc.lines(). Pratique pour des formes type
 * shield/diamond/hexagon ou ruban. Style: 'F' fill, 'D' stroke, 'FD' both.
 */
export function drawClosedPath(
  doc: jsPDF,
  points: Array<[number, number]>,
  style: "F" | "D" | "FD" = "FD",
): void {
  if (points.length < 2) return;
  const deltas: Array<[number, number]> = [];
  for (let i = 1; i < points.length; i++) {
    deltas.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]]);
  }
  const last = points[points.length - 1];
  const first = points[0];
  deltas.push([first[0] - last[0], first[1] - last[1]]);
  doc.lines(deltas, first[0], first[1], [1, 1], style, true);
}

export type EmblemShape = "shield" | "circle" | "diamond" | "hexagon";

/**
 * Dessine l'embleme d'une equipe (shield/circle/diamond/hexagon) +
 * le glyph monogramme au centre. Coordonnees = centre.
 */
export function drawEmblem(
  doc: jsPDF,
  shape: EmblemShape,
  primary: string,
  secondary: string,
  glyph: string,
  cx: number,
  cy: number,
  size = 36,
): void {
  const half = size / 2;
  setFillHex(doc, primary);
  setDrawHex(doc, secondary);
  doc.setLineWidth(1.2);

  switch (shape) {
    case "shield": {
      const pts: Array<[number, number]> = [
        [cx, cy - half],
        [cx + half * 0.85, cy - half * 0.75],
        [cx + half * 0.85, cy],
        [cx + half * 0.5, cy + half * 0.85],
        [cx, cy + half],
        [cx - half * 0.5, cy + half * 0.85],
        [cx - half * 0.85, cy],
        [cx - half * 0.85, cy - half * 0.75],
      ];
      drawClosedPath(doc, pts, "FD");
      break;
    }
    case "circle":
      doc.circle(cx, cy, half, "FD");
      break;
    case "diamond":
      drawClosedPath(
        doc,
        [
          [cx, cy - half],
          [cx + half, cy],
          [cx, cy + half],
          [cx - half, cy],
        ],
        "FD",
      );
      break;
    case "hexagon":
      drawClosedPath(
        doc,
        [
          [cx, cy - half],
          [cx + half * 0.87, cy - half * 0.5],
          [cx + half * 0.87, cy + half * 0.5],
          [cx, cy + half],
          [cx - half * 0.87, cy + half * 0.5],
          [cx - half * 0.87, cy - half * 0.5],
        ],
        "FD",
      );
      break;
  }

  // Anneau interne dore — ne s'applique qu'au cercle, ou les autres formes
  // (shield/diamond/hexagon) ont deja une silhouette caracteristique.
  if (shape === "circle") {
    setDrawHex(doc, PALETTE.GOLD);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, half * 0.78, "D");
  }

  // Glyph monogramme
  doc.setFont("helvetica", "bold");
  const fontSize = glyph.length >= 3 ? 12 : glyph.length === 2 ? 16 : 22;
  doc.setFontSize(fontSize);
  setTextHex(doc, secondary);
  doc.text(glyph, cx, cy + fontSize * 0.32, { align: "center" });
}

/**
 * Sceau circulaire decoratif type "tampon officiel" pour l'en-tete.
 */
export function drawSeal(doc: jsPDF, cx: number, cy: number, radius = 11): void {
  setFillHex(doc, PALETTE.BLOOD_DARK);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(1);
  doc.circle(cx, cy, radius, "FD");
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius * 0.78, "D");

  // Couronne de petits triangles (rayons)
  setFillHex(doc, PALETTE.GOLD);
  const spikes = 12;
  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2;
    const r1 = radius * 0.92;
    const r2 = radius * 1.08;
    const x1 = cx + Math.cos(angle - 0.08) * r1;
    const y1 = cy + Math.sin(angle - 0.08) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy + Math.sin(angle) * r2;
    const x3 = cx + Math.cos(angle + 0.08) * r1;
    const y3 = cy + Math.sin(angle + 0.08) * r1;
    drawClosedPath(
      doc,
      [
        [x1, y1],
        [x2, y2],
        [x3, y3],
      ],
      "F",
    );
  }

  // Glyph BB centre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(radius * 0.95);
  setTextHex(doc, PALETTE.GOLD);
  doc.text("BB", cx, cy + radius * 0.32, { align: "center" });
}

/**
 * Ruban diagonal "STAR OF THE MATCH" (forme bannerole).
 */
export function drawRibbon(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): void {
  const cut = 6;
  setFillHex(doc, PALETTE.BLOOD);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.8);
  drawClosedPath(
    doc,
    [
      [x + cut, y],
      [x + w - cut, y],
      [x + w, y + h / 2],
      [x + w - cut, y + h],
      [x + cut, y + h],
      [x, y + h / 2],
    ],
    "FD",
  );

  // Pointes repliees (effet pli)
  setFillHex(doc, PALETTE.BLOOD_DARK);
  drawClosedPath(
    doc,
    [
      [x, y + h / 2],
      [x + cut, y + h + 2],
      [x + cut, y + h],
    ],
    "F",
  );
  drawClosedPath(
    doc,
    [
      [x + w, y + h / 2],
      [x + w - cut, y + h + 2],
      [x + w - cut, y + h],
    ],
    "F",
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setTextHex(doc, PALETTE.BONE);
  doc.setCharSpace(0.8);
  doc.text(label, x + w / 2, y + h / 2 + 1.5, { align: "center", baseline: "middle" });
  doc.setCharSpace(0);
}

/** Separateur ornemental: filets + losange dore au centre. */
export function drawOrnament(doc: jsPDF, x1: number, x2: number, y: number): void {
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.4);
  const cx = (x1 + x2) / 2;
  doc.line(x1, y, cx - 4, y);
  doc.line(cx + 4, y, x2, y);
  setFillHex(doc, PALETTE.GOLD);
  drawClosedPath(
    doc,
    [
      [cx, y - 2],
      [cx + 3, y],
      [cx, y + 2],
      [cx - 3, y],
    ],
    "F",
  );
}

/** Badge rectangulaire (type chip) avec texte centre. */
export function drawBadge(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  fillHex: string,
  textHex: string,
  fontSize = 9,
): void {
  setFillHex(doc, fillHex);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  setTextHex(doc, textHex);
  doc.setCharSpace(0.4);
  doc.text(label, x + w / 2, y + h / 2 + fontSize * 0.18, { align: "center" });
  doc.setCharSpace(0);
}

/**
 * Icone meteo simple (soleil / pluie / neige / generique).
 * Cle = condition (texte libre du jeu), match insensible a la casse.
 */
export function drawWeatherIcon(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number,
  condition: string,
): void {
  const lc = condition.toLowerCase();
  setDrawHex(doc, PALETTE.INK);
  setFillHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.5);
  const half = size / 2;

  if (lc.includes("pluie") || lc.includes("rain") || lc.includes("averse") || lc.includes("orage")) {
    setDrawHex(doc, PALETTE.INK_SOFT);
    setFillHex(doc, PALETTE.PARCHMENT_DARK);
    doc.ellipse(cx, cy - 1, half * 0.9, half * 0.55, "FD");
    setDrawHex(doc, "#1E3A8A");
    doc.setLineWidth(0.7);
    for (let i = -1; i <= 1; i++) {
      doc.line(cx + i * 1.6, cy + 1.3, cx + i * 1.6 - 0.6, cy + 3);
    }
  } else if (lc.includes("neige") || lc.includes("snow") || lc.includes("blizzard") || lc.includes("glace")) {
    setDrawHex(doc, "#1E3A8A");
    doc.setLineWidth(0.6);
    doc.line(cx - half, cy, cx + half, cy);
    doc.line(cx, cy - half, cx, cy + half);
    doc.line(cx - half * 0.7, cy - half * 0.7, cx + half * 0.7, cy + half * 0.7);
    doc.line(cx - half * 0.7, cy + half * 0.7, cx + half * 0.7, cy - half * 0.7);
  } else if (lc.includes("sweltering") || lc.includes("canicule") || lc.includes("chaud")) {
    doc.circle(cx, cy, half * 0.55, "F");
    setDrawHex(doc, PALETTE.GOLD_DARK);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      doc.line(
        cx + Math.cos(a) * half * 0.7,
        cy + Math.sin(a) * half * 0.7,
        cx + Math.cos(a) * half,
        cy + Math.sin(a) * half,
      );
    }
  } else if (lc.includes("vent") || lc.includes("wind") || lc.includes("tornade")) {
    setDrawHex(doc, PALETTE.INK_SOFT);
    doc.setLineWidth(0.7);
    doc.line(cx - half, cy - half * 0.5, cx + half * 0.6, cy - half * 0.5);
    doc.line(cx - half * 0.7, cy, cx + half, cy);
    doc.line(cx - half, cy + half * 0.5, cx + half * 0.4, cy + half * 0.5);
  } else {
    // Generique: soleil voile
    doc.circle(cx, cy, half * 0.65, "F");
    setDrawHex(doc, PALETTE.GOLD_DARK);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, half * 0.65, "D");
  }
}

/**
 * Icone d'action 6mm cote, dessinee en primitives. La couleur de fond
 * (carte/cellule) est laissee a l'appelant. `failed` superpose une croix rouge.
 */
export function drawIcon(
  doc: jsPDF,
  type: IconKind,
  x: number,
  y: number,
  color = PALETTE.INK,
  size = 6,
  failed = false,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  setDrawHex(doc, color);
  setFillHex(doc, color);
  doc.setLineWidth(0.4);

  switch (type) {
    case "td":
      drawClosedPath(
        doc,
        [
          [cx, y],
          [x + size, cy],
          [cx, y + size],
          [x, cy],
        ],
        "F",
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.5);
      setTextHex(doc, PALETTE.PARCHMENT);
      doc.text("TD", cx, cy + 0.8, { align: "center" });
      break;
    case "blocage":
      doc.rect(x + 0.5, y + 0.5, size - 1, size - 1, "F");
      setDrawHex(doc, PALETTE.PARCHMENT);
      doc.setLineWidth(0.6);
      doc.line(x + 1.5, y + 1.5, x + size - 1.5, y + size - 1.5);
      doc.line(x + size - 1.5, y + 1.5, x + 1.5, y + size - 1.5);
      break;
    case "blitz": {
      const pts: Array<[number, number]> = [
        [cx - 0.8, y + 0.4],
        [cx + 1.2, cy - 0.6],
        [cx + 0.1, cy - 0.3],
        [cx + 1.4, y + size - 0.4],
        [cx - 1.0, cy + 0.6],
        [cx + 0.1, cy + 0.3],
      ];
      drawClosedPath(doc, pts, "F");
      break;
    }
    case "passe":
      doc.ellipse(cx, cy, size * 0.42, size * 0.28, "D");
      doc.setLineWidth(0.5);
      doc.line(x + 1.2, cy - 0.5, x + size - 1.2, cy + 0.5);
      break;
    case "reception":
      doc.setLineWidth(0.6);
      doc.line(x + 1, cy + 1.2, cx, cy - 0.6);
      doc.line(cx, cy - 0.6, x + size - 1, cy + 1.2);
      doc.circle(cx, cy + 1.6, 0.6, "F");
      break;
    case "transmission":
      doc.setLineWidth(0.5);
      doc.line(x + 1, cy - 1, x + size - 1, cy - 1);
      doc.line(x + size - 1.2, cy - 1.6, x + size - 1, cy - 1);
      doc.line(x + size - 1.2, cy - 0.4, x + size - 1, cy - 1);
      doc.line(x + size - 1, cy + 1, x + 1, cy + 1);
      doc.line(x + 1.2, cy + 0.4, x + 1, cy + 1);
      doc.line(x + 1.2, cy + 1.6, x + 1, cy + 1);
      break;
    case "aggression":
      doc.rect(cx - 1.4, cy - 1.4, 2.8, 2, "F");
      doc.rect(cx - 1.4, cy + 0.3, 0.6, 1.4, "F");
      doc.rect(cx - 0.6, cy + 0.3, 0.6, 1.4, "F");
      doc.rect(cx + 0.2, cy + 0.3, 0.6, 1.4, "F");
      doc.rect(cx + 1.0, cy + 0.3, 0.6, 1.4, "F");
      break;
    case "sprint":
      doc.setLineWidth(0.55);
      doc.line(x + 1.5, cy - 1.4, x + size - 0.8, cy - 1.4);
      doc.line(x + 1.0, cy, x + size - 0.5, cy);
      doc.line(x + 1.5, cy + 1.4, x + size - 0.8, cy + 1.4);
      break;
    case "esquive":
      doc.setLineWidth(0.5);
      // Spirale approximee par 3 ellipses
      doc.ellipse(cx, cy, 1.8, 1.2, "D");
      doc.ellipse(cx, cy, 1.2, 0.8, "D");
      doc.circle(cx, cy, 0.4, "F");
      break;
    case "apothicaire":
      doc.rect(cx - 0.7, y + 1, 1.4, size - 2, "F");
      doc.rect(x + 1, cy - 0.7, size - 2, 1.4, "F");
      break;
    case "interception":
      drawClosedPath(
        doc,
        [
          [cx, y + 0.3],
          [x + size - 0.5, y + 1.5],
          [x + size - 0.5, cy + 0.5],
          [cx, y + size - 0.3],
          [x + 0.5, cy + 0.5],
          [x + 0.5, y + 1.5],
        ],
        "F",
      );
      break;
    case "casualty":
      doc.circle(cx, cy - 0.4, 1.7, "F");
      setFillHex(doc, PALETTE.PARCHMENT);
      doc.circle(cx - 0.6, cy - 0.6, 0.4, "F");
      doc.circle(cx + 0.6, cy - 0.6, 0.4, "F");
      setDrawHex(doc, color);
      doc.setLineWidth(0.4);
      doc.line(cx - 1, cy + 1.2, cx - 1, cy + 2.1);
      doc.line(cx, cy + 1.2, cx, cy + 2.1);
      doc.line(cx + 1, cy + 1.2, cx + 1, cy + 2.1);
      break;
    case "fumble":
      setDrawHex(doc, PALETTE.LOSS_RED);
      doc.setLineWidth(0.6);
      doc.circle(cx, cy, size * 0.4, "D");
      doc.line(x + 1, y + size - 1, x + size - 1, y + 1);
      break;
    case "armorBroken":
      drawClosedPath(
        doc,
        [
          [cx, y + 0.5],
          [cx + 0.6, cy - 0.4],
          [cx + 1.6, cy - 0.6],
          [cx + 0.8, cy + 0.3],
          [cx + 1.4, cy + 1.4],
          [cx, cy + 0.6],
          [cx - 1.4, cy + 1.4],
          [cx - 0.8, cy + 0.3],
          [cx - 1.6, cy - 0.6],
          [cx - 0.6, cy - 0.4],
        ],
        "F",
      );
      break;
  }

  if (failed && type !== "fumble") {
    setDrawHex(doc, PALETTE.LOSS_RED);
    doc.setLineWidth(0.7);
    doc.line(x + 1, y + size - 1, x + size - 1, y + 1);
  }
}
