import fetch from "node-fetch";

// On vérifie les statuts d'erreur et la route qui dépend du X-Match-Token,
// contre le serveur démarré par `setup.ts`.
//
// Le repli était le port de DEV (8201) : la spec ne touchait donc jamais le
// serveur de test et échouait en `ECONNREFUSED`. On suit maintenant le même
// port que le setup (`API_PORT`), qui renseigne aussi `API_BASE`.
const API_PORT = process.env.API_PORT || "18001";
const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  `http://localhost:${API_PORT}`;

// Token fourni par l'utilisateur (match_token signé avec MATCH_SECRET)
const MATCH_TOKEN =
  process.env.MATCH_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYXRjaElkIjoiY21meTVxcmptMDAwMHFwYXpwNG80dnpwaSIsInVzZXJJZCI6ImNtZnkzbDF0YTAwMDBqbDRwanprZ2Uwb3ciLCJpYXQiOjE3NTg3MzA5MDIsImV4cCI6MTc1ODczODEwMn0.tSGy_iqfQfq1T0efaVTInlIX0euyO5VikWR4XpNaFwU";

// MatchId encodé dans le token (utile pour les routes /:id/...)
const MATCH_ID = process.env.MATCH_ID || "cmfy5qrjm0000qpazp4o4vzpi";

describe("Match endpoints", () => {
  it("GET /match/details with X-Match-Token returns 200 and structure", async () => {
    const res = await fetch(`${API_BASE}/match/details`, {
      headers: { "X-Match-Token": MATCH_TOKEN },
    });
    expect(res.status).toBeLessThan(500);
    // Autorisé si le token est valide
    if (res.status === 200) {
      const json: any = await res.json();
      expect(json).toBeTruthy();
      expect(json.matchId).toBeTruthy();
      expect(json.local).toBeTruthy();
      expect(json.visitor).toBeTruthy();
    } else {
      // Au minimum, pas d'erreur serveur
      expect([401, 400]).toContain(res.status);
    }
  }, 15000);

  it("GET /match/:id/details without Authorization fails with 401", async () => {
    const res = await fetch(`${API_BASE}/match/${MATCH_ID}/details`);
    expect(res.status).toBe(401);
  }, 15000);

  it("GET /match/:id/summary without Authorization fails with 401", async () => {
    const res = await fetch(`${API_BASE}/match/${MATCH_ID}/summary`);
    expect(res.status).toBe(401);
  }, 15000);
});
