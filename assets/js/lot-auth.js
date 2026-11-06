// Shared sign-in for every editing page (admin, shows quick-add, contractors).
//
// With CONFIG filled in, editors sign in with Google; a Cloudflare Worker
// (worker/worker.js) checks the email against its allow-list and makes the
// GitHub changes with a key that never reaches the browser.
// With CONFIG empty, it falls back to the old pasted GitHub token.
(function () {
  const CONFIG = {
    worker: '',          // e.g. https://lot-auth.yourname.workers.dev  (no trailing slash)
    googleClientId: '',  // e.g. 1234-abc.apps.googleusercontent.com
    repo: 'bmlanders/adventures',
  };

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const google = !!(CONFIG.worker && CONFIG.googleClientId);

  function user() {
    if (!google) {
      const t = ls.get('lot_token');
      return t ? { name: ls.get('lot_who') || 'Brendan', email: '', token: true } : null;
    }
    try {
      const u = JSON.parse(ls.get('lot_user') || 'null');
      if (u && u.session && u.exp > Date.now()) return u;
    } catch (e) {}
    ls.del('lot_user');
    return null;
  }

  // fetch against the repo's API, e.g. gh('contents/_trips') or gh('contents/x.json', {method:'PUT', body})
  async function gh(path, opts = {}) {
    const u = user();
    if (!u) throw new Error(google ? 'Sign in with Google first.' : 'Connect first.');
    const headers = { Accept: 'application/vnd.github+json', ...(opts.headers || {}) };
    if (opts.body) headers['Content-Type'] = 'application/json';
    let res;
    if (google) {
      headers.Authorization = 'Bearer ' + u.session;
      res = await fetch(`${CONFIG.worker}/gh/${path}`, { ...opts, headers, cache: 'no-store' });
      if (res.status === 401) { ls.del('lot_user'); notify(); throw new Error('Your sign-in expired. Sign in again.'); }
    } else {
      headers.Authorization = 'token ' + ls.get('lot_token');
      res = await fetch(`https://api.github.com/repos/${ls.get('lot_repo') || CONFIG.repo}/${path}`, { ...opts, headers, cache: 'no-store' });
    }
    return res;
  }

  let gisLoading;
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    return gisLoading = gisLoading || new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error("Couldn't load Google sign-in."));
      document.head.appendChild(s);
    });
  }

  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function notify() { const u = user(); listeners.forEach(fn => { try { fn(u); } catch (e) {} }); }

  // Puts a "Sign in with Google" button in `el`. Calls back with an error message on failure.
  async function renderButton(el, onError) {
    if (!google) return false;
    await loadGis();
    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      auto_select: true,
      callback: async (resp) => {
        try {
          const r = await fetch(CONFIG.worker + '/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: resp.credential }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.message || `Sign-in failed (${r.status}).`);
          ls.set('lot_user', JSON.stringify(data));
          notify();
        } catch (e) { if (onError) onError(e.message); }
      },
    });
    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' });
    return true;
  }

  function signOut() {
    ls.del('lot_user'); ls.del('lot_token');
    try { window.google && window.google.accounts.id.disableAutoSelect(); } catch (e) {}
    notify();
  }

  window.LOT = { google, config: CONFIG, user, gh, renderButton, signOut, onChange };
})();
