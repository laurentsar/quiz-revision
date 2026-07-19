'use strict';
// Intégration Firebase — API REST pure (fetch + EventSource), sans SDK, sans auth.
// Les règles Firebase doivent autoriser les lectures/écritures publiques sur les chemins ciblés.
(function () {
  let _activeSource = null;
  let _lastOpError = null;

  function cfg() { return window.FIREBASE_CONFIG || null; }
  function dbRoot() { return cfg()?.databaseURL || null; }

  function isReady() { return !!dbRoot(); }
  function getInitError() {
    if (!cfg()) return 'FIREBASE_CONFIG absent';
    if (!cfg().databaseURL) return 'databaseURL manquant';
    return null;
  }
  function getOpError() { return _lastOpError; }

  // ── Helpers REST ─────────────────────────────────────────────────────────
  function restUrl(path) {
    return `${dbRoot()}${path}.json`;
  }

  async function dbPut(path, value, signal) {
    const res = await fetch(restUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  async function dbGet(path) {
    const res = await fetch(restUrl(path));
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  function dbListen(path, onData) {
    removeListener();
    const url = restUrl(path);
    _activeSource = new EventSource(url);
    _activeSource.addEventListener('put', e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.path === '/') { onData(msg.data); return; }
        dbGet(path).then(onData).catch(() => {});
      } catch (_) {}
    });
    _activeSource.addEventListener('patch', () => {
      dbGet(path).then(onData).catch(() => {});
    });
    _activeSource.onerror = e => console.warn('[Firebase] SSE error:', e);
  }

  function removeListener() {
    if (_activeSource) { _activeSource.close(); _activeSource = null; }
  }

  // ── API publique ──────────────────────────────────────────────────────────
  async function pushScore(code, pseudo, score, total) {
    if (!isReady()) return;
    _lastOpError = null;
    try {
      await dbPut(
        `/defis/${code.replace(/-/g, '').toUpperCase()}/joueurs/${pseudo}`,
        { score, total, pct: Math.round(100 * score / total), ts: Date.now() }
      );
    } catch (e) { _lastOpError = e.message || String(e); console.warn('[Firebase] pushScore:', e); }
  }

  function listenLeaderboard(code, callback) {
    if (!isReady()) return;
    dbListen(`/defis/${code.replace(/-/g, '').toUpperCase()}/joueurs`, data => {
      const rows = Object.entries(data || {})
        .map(([pseudo, d]) => ({ pseudo, score: d.score, total: d.total, pct: d.pct, ts: d.ts }))
        .sort((a, b) => b.pct - a.pct || b.score - a.score || a.ts - b.ts);
      callback(rows);
    });
  }

  async function createCampaign(code, config) {
    if (!isReady()) return false;
    _lastOpError = null;
    const ctrl = new AbortController();
    const tid = setTimeout(() => { ctrl.abort(); _lastOpError = 'timeout 8s'; }, 8000);
    try {
      await dbPut(`/campaigns/${code.replace(/-/g, '').toUpperCase()}/config`, config, ctrl.signal);
      clearTimeout(tid);
      return true;
    } catch (e) {
      clearTimeout(tid);
      if (!_lastOpError) _lastOpError = e.name === 'AbortError' ? 'timeout 8s' : (e.message || String(e));
      console.warn('[Firebase] createCampaign:', e);
      return false;
    }
  }

  async function fetchCampaign(code) {
    if (!isReady()) return null;
    try {
      return await dbGet(`/campaigns/${code.replace(/-/g, '').toUpperCase()}/config`);
    } catch (e) { _lastOpError = e.message || String(e); return null; }
  }

  async function pushCampaignScore(code, roundN, pseudo, score, total) {
    if (!isReady()) return;
    _lastOpError = null;
    try {
      await dbPut(
        `/campaigns/${code.replace(/-/g, '').toUpperCase()}/rounds/${roundN}/joueurs/${pseudo}`,
        { score, total, pct: Math.round(100 * score / total), ts: Date.now() }
      );
    } catch (e) { _lastOpError = e.message || String(e); console.warn('[Firebase] pushCampaignScore:', e); }
  }

  function listenCampaignLeaderboard(code, callback) {
    if (!isReady()) return;
    dbListen(`/campaigns/${code.replace(/-/g, '').toUpperCase()}/rounds`, rounds => {
      const totals = {};
      Object.values(rounds || {}).forEach(round => {
        Object.entries((round && round.joueurs) || {}).forEach(([pseudo, d]) => {
          if (!totals[pseudo]) totals[pseudo] = { pseudo, score: 0, total: 0, sessions: 0, ts: 0 };
          totals[pseudo].score += d.score || 0;
          totals[pseudo].total += d.total || 0;
          totals[pseudo].sessions++;
          totals[pseudo].ts = Math.max(totals[pseudo].ts, d.ts || 0);
        });
      });
      const rows = Object.values(totals)
        .map(r => ({ ...r, pct: r.total ? Math.round(100 * r.score / r.total) : 0 }))
        .sort((a, b) => b.pct - a.pct || b.sessions - a.sessions || a.ts - b.ts);
      callback(rows);
    });
  }

  window.FirebaseChallenge = {
    isReady, getInitError, getOpError,
    pushScore, listenLeaderboard, removeListener,
    createCampaign, fetchCampaign, pushCampaignScore, listenCampaignLeaderboard,
  };
})();
