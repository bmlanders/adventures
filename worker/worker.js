// Landers On Tour sign-in gatekeeper (Cloudflare Worker).
//
// The site is static, so it can't hold a GitHub key. This Worker does:
//   POST /login   {credential: <Google ID token>}  ->  {session, email, name, exp}
//                 Only emails in ALLOWED_EMAILS get a session.
//   GET|PUT /gh/contents/<path>   proxied to the GitHub contents API for REPO,
//                 using the GitHub token stored here, for signed-in users only.
//
// Settings (Cloudflare dashboard > Worker > Settings > Variables and Secrets):
//   GOOGLE_CLIENT_ID  text    the Web client ID from Google Cloud
//   ALLOWED_EMAILS    text    comma-separated, e.g. you@gmail.com,jen@gmail.com
//   REPO              text    bmlanders/adventures
//   ALLOWED_ORIGINS   text    https://bmlanders.github.io,http://localhost:4000
//   GITHUB_TOKEN      secret  fine-grained token, Contents read/write on REPO only
//   SESSION_SECRET    secret  any long random string (signs the 90-day sessions)

const SESSION_DAYS = 90;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === '/login' && request.method === 'POST') {
        const { credential } = await request.json();
        if (!credential) return json({ message: 'Missing Google credential.' }, 400);
        // Google checks the signature and expiry for us.
        const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
        if (!r.ok) return json({ message: 'Google sign-in could not be verified.' }, 401);
        const g = await r.json();
        const email = String(g.email || '').toLowerCase();
        if (g.aud !== env.GOOGLE_CLIENT_ID) return json({ message: 'Sign-in was for a different app.' }, 401);
        if (!['accounts.google.com', 'https://accounts.google.com'].includes(g.iss)) return json({ message: 'Unexpected issuer.' }, 401);
        if (String(g.email_verified) !== 'true') return json({ message: 'That Google email is not verified.' }, 401);
        const list = (env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (!list.includes(email)) return json({ message: `${email} isn't on the list for this site.` }, 403);
        const name = g.given_name || g.name || email.split('@')[0];
        const exp = Date.now() + SESSION_DAYS * 864e5;
        const session = await sign({ email, name, exp }, env.SESSION_SECRET);
        return json({ session, email, name, exp });
      }

      if (url.pathname === '/me') {
        const user = await verify(request, env);
        return user ? json(user) : json({ message: 'Not signed in.' }, 401);
      }

      if (url.pathname.startsWith('/gh/')) {
        const user = await verify(request, env);
        if (!user) return json({ message: 'Sign in again.' }, 401);
        const path = url.pathname.slice(4);
        if (!/^contents(\/[\w.\-]+)*\/?$/.test(path) || path.includes('..')) return json({ message: 'Path not allowed.' }, 400);
        if (!['GET', 'PUT'].includes(request.method)) return json({ message: 'Method not allowed.' }, 405);

        let body;
        if (request.method === 'PUT') {
          const b = await request.json();
          // Credit the commit to whoever signed in.
          b.author = { name: user.name, email: user.email };
          b.committer = { name: user.name, email: user.email };
          b.branch = b.branch || 'main';
          body = JSON.stringify(b);
        }
        const gh = await fetch(`https://api.github.com/repos/${env.REPO}/${path}${url.search}`, {
          method: request.method,
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'landers-on-tour-worker',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body,
        });
        return new Response(gh.body, {
          status: gh.status,
          headers: { ...cors, 'Content-Type': gh.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      return json({ ok: true, service: 'landers-on-tour sign-in' });
    } catch (e) {
      return json({ message: 'Worker error: ' + e.message }, 500);
    }
  },
};

// ---- tiny signed session: base64url(payload).base64url(hmac) ----
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function key(secret) {
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is missing or too short');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(payload, secret) {
  const p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(p));
  return p + '.' + b64u(sig);
}
async function verify(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+([\w-]+)\.([\w-]+)$/);
  if (!m) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(env.SESSION_SECRET), unb64u(m[2]), enc.encode(m[1]));
  if (!ok) return null;
  const user = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
  if (!user.exp || user.exp < Date.now()) return null;
  // Removing someone from ALLOWED_EMAILS locks them out right away, not in 90 days.
  const list = (env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase());
  return list.includes(user.email) ? user : null;
}
