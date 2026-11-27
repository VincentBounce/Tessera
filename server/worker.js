// TESSERA — server/worker.js
//
// A Cloudflare Worker: accounts by passkey alone (WebAuthn, no e-mail, no password) and each account's Gallery, kept in
// one KV namespace (GALLERIES) and merged with each browser's.
//
// A Gallery is its cards by their key (the app's thumbnailKey: one card a setup) and its tombstones: the keys deleted, each
// with its time. A card is only ever added or deleted, never changed: a merge is every card either side knows, but those a
// tombstone deleted after the card was saved; a tombstone kept so a deletion reaches the other browsers.
//
// KV: user:<id> its name and passkeys; cred:<credential id> its user; gallery:<user id> its cards and tombstones;
// session:<token> its user (30 days); flow:<id> a ceremony's challenge (5 minutes).
//
// Routes, all POST with JSON: /register/options, /register/verify, /login/options, /login/verify (a session's token),
// then with `Authorization: Bearer <token>`: /sync (the browser's Gallery in, the merged one out), /logout, /delete.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// the pages allowed, each with its passkeys' domain (a passkey made on one works there only)
const ORIGINS = {
  'https://vincentbounce.github.io': 'vincentbounce.github.io',
  'http://localhost:8321': 'localhost',
};
const SESSION_SECONDS = 30 * 24 * 3600,
  FLOW_SECONDS = 300;

const randomId = () => isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(24)));

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin'),
      rpID = ORIGINS[origin];
    const cors = rpID
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST',
          Vary: 'Origin',
        }
      : {};
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
    if (request.method === 'OPTIONS') return new Response(null, { status: rpID ? 204 : 403, headers: cors });
    if (!rpID) return reply({ error: 'Not an allowed page.' }, 403);
    if (request.method !== 'POST') return reply({ error: 'POST only.' }, 405);
    const kv = env.GALLERIES,
      route = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    // a ceremony's challenge, kept for its verify (once)
    const startFlow = async (challenge, extra = {}) => {
      const flow = randomId();
      await kv.put(`flow:${flow}`, JSON.stringify({ challenge, rpID, ...extra }), { expirationTtl: FLOW_SECONDS });
      return flow;
    };
    const takeFlow = async (flow) => {
      const f = flow && (await kv.get(`flow:${flow}`, 'json'));
      if (f) await kv.delete(`flow:${flow}`);
      return f?.rpID === rpID ? f : null;
    };
    const openSession = async (user) => {
      const token = randomId();
      await kv.put(`session:${token}`, user.id, { expirationTtl: SESSION_SECONDS });
      return reply({ token, name: user.name });
    };
    try {
      if (route === '/register/options') {
        const name =
          String(body.name ?? '')
            .trim()
            .slice(0, 64) || 'Tessera';
        const userID = crypto.getRandomValues(new Uint8Array(16));
        const options = await generateRegistrationOptions({
          rpName: 'Tessera',
          rpID,
          userName: name,
          userID,
          attestationType: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        });
        const flow = await startFlow(options.challenge, { name, userId: isoBase64URL.fromBuffer(userID) });
        return reply({ options, flow });
      }
      if (route === '/register/verify') {
        const f = await takeFlow(body.flow);
        if (!f?.userId) return reply({ error: 'This sign-up expired: try again.' }, 400);
        const { verified, registrationInfo } = await verifyRegistrationResponse({
          response: body.response,
          expectedChallenge: f.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });
        if (!verified) return reply({ error: 'The passkey was not verified.' }, 400);
        const { credential } = registrationInfo,
          user = {
            id: f.userId,
            name: f.name,
            credentials: [
              {
                id: credential.id,
                publicKey: isoBase64URL.fromBuffer(credential.publicKey),
                counter: credential.counter,
                transports: credential.transports ?? [],
              },
            ],
          };
        await kv.put(`user:${user.id}`, JSON.stringify(user));
        await kv.put(`cred:${credential.id}`, user.id);
        return openSession(user);
      }
      if (route === '/login/options') {
        const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' }); // (no list: the browser offers the passkeys it holds for this domain)
        return reply({ options, flow: await startFlow(options.challenge) });
      }
      if (route === '/login/verify') {
        const f = await takeFlow(body.flow),
          userId = body.response?.id && (await kv.get(`cred:${body.response.id}`)),
          user = userId && (await kv.get(`user:${userId}`, 'json')),
          stored = user?.credentials.find((c) => c.id === body.response.id);
        if (!f || !stored) return reply({ error: 'No account for this passkey.' }, 400);
        const { verified, authenticationInfo } = await verifyAuthenticationResponse({
          response: body.response,
          expectedChallenge: f.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: { ...stored, publicKey: isoBase64URL.toBuffer(stored.publicKey) },
        });
        if (!verified) return reply({ error: 'The passkey was not verified.' }, 400);
        stored.counter = authenticationInfo.newCounter;
        await kv.put(`user:${user.id}`, JSON.stringify(user));
        return openSession(user);
      }
      // the routes of a session
      const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, ''),
        userId = token && (await kv.get(`session:${token}`));
      if (!userId) return reply({ error: 'Signed out: sign in again.' }, 401);
      if (route === '/sync') {
        const mine = (await kv.get(`gallery:${userId}`, 'json')) ?? { cards: {}, gone: {} },
          merged = mergeGalleries(mine, { cards: body.cards ?? {}, gone: body.gone ?? {} });
        await kv.put(`gallery:${userId}`, JSON.stringify(merged));
        return reply(merged);
      }
      if (route === '/logout') {
        await kv.delete(`session:${token}`);
        return reply({});
      }
      if (route === '/delete') {
        const user = await kv.get(`user:${userId}`, 'json');
        for (const c of user?.credentials ?? []) await kv.delete(`cred:${c.id}`);
        await kv.delete(`user:${userId}`);
        await kv.delete(`gallery:${userId}`);
        await kv.delete(`session:${token}`); // (its other sessions: unread once their user is gone, then expired)
        return reply({});
      }
      return reply({ error: 'No such route.' }, 404);
    } catch (e) {
      return reply({ error: e.message }, 400);
    }
  },
};

// Two Galleries as one: every card either knows, but those a tombstone deleted after it was saved; each tombstone the
// later of the two (a card saved again after it: no tombstone left)
function mergeGalleries(a, b) {
  const gone = { ...a.gone };
  for (const [key, at] of Object.entries(b.gone)) if (!(gone[key] >= at)) gone[key] = at;
  const cards = {};
  for (const [key, card] of [...Object.entries(a.cards), ...Object.entries(b.cards)]) {
    if (gone[key] && gone[key] >= (card.saved ?? '')) continue;
    if (!cards[key] || (card.saved ?? '') > (cards[key].saved ?? '')) cards[key] = card;
  }
  for (const key of Object.keys(cards)) delete gone[key];
  return { cards, gone };
}
