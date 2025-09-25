import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';

const API_PORT = process.env.API_PORT || '18001';
const API_BASE = process.env.API_BASE || `http://localhost:${API_PORT}`;

// serveur géré globalement dans setup.ts

async function post(path: string, token: string | null, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function get(path: string, token: string | null) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

// Helpers pour créer deux users, deux équipes, et dérouler le flux
async function loginAs(email: string, password: string) {
  const { token } = await post('/auth/login', null, { email, password });
  return token as string;
}

async function ensureUser(email: string, password: string) {
  try {
    await post('/auth/register', null, { email, password, name: email.split('@')[0] });
  } catch {}
  return loginAs(email, password);
}

describe('Démarrage de match: acceptations + pré-match', () => {
  let aToken = '';
  let bToken = '';
  let teamA: string = '';
  let teamB: string = '';

  beforeAll(async () => {
    // Vérifier si l'API répond déjà
    let apiUp = false;
    try {
      const res = await fetch(`${API_BASE}/health`).catch(() => null);
      apiUp = !!res && res.ok;
    } catch {}
    if (!apiUp) {
      serverProc = spawn('pnpm', ['run', 'dev:nowatch'], {
        cwd: '../../apps/server',
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          API_PORT,
          BGIO_PORT: process.env.BGIO_PORT || '18000',
          TEST_SQLITE: '1',
          TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'file:memdb1?mode=memory&cache=shared',
        },
      });
      spawned = true;
      await new Promise((r) => setTimeout(r, 2000));
    }
    // Reset complet DB de test pour stabilité
    await fetch(`${API_BASE}/__test/reset`, { method: 'POST' }).catch(() => null);
    aToken = await ensureUser('coach.a@example.com', 'password-a');
    bToken = await ensureUser('coach.b@example.com', 'password-b');

    // Créer une équipe par coach si nécessaire
    const createTeam = async (token: string, name: string, roster: 'skaven' | 'lizardmen') => {
      const t = await post('/team/create-from-roster', token, { name, roster });
      return t.team.id as string;
    };

    teamA = await createTeam(aToken, 'Rats A', 'skaven');
    teamB = await createTeam(bToken, 'Lizards B', 'lizardmen');
  }, 30000);

  afterAll(async () => {
    if (spawned && serverProc) serverProc.kill();
  });

  it('doit exiger deux équipes différentes et deux coachs distincts, puis lancer le pré-match', async () => {
    // A crée le match
    const { match, matchToken: aMatchToken } = await post('/match/create', aToken, {});

    // B rejoint
    const { match: match2, matchToken: bMatchToken } = await post('/match/join', bToken, { matchId: match.id });
    expect(match2.id).toBe(match.id);

    // Chaque coach choisit son équipe
    await post('/team/choose', aToken, { matchId: match.id, teamId: teamA });
    await post('/team/choose', bToken, { matchId: match.id, teamId: teamB });

    // Accept A (attend B)
    const accA = await post('/match/accept', aToken, { matchId: match.id });
    expect(accA.status).toBeDefined();
    expect(accA.status === 'waiting_other_player' || accA.status === 'waiting_other_accept').toBe(true);

    // Accept B -> devrait démarrer
    const accB = await post('/match/accept', bToken, { matchId: match.id });
    expect(accB.status).toBe('started');
    expect(accB.kickingUserId).toBeTruthy();
    expect(accB.receivingUserId).toBeTruthy();

    // Le match passe en active
    const summary = await get(`/match/${match.id}/summary`, aToken);
    expect(summary.status).toBe('active');
  });
});


