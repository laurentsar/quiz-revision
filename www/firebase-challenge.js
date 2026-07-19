'use strict';
// Intégration Firebase — API REST pure (fetch + EventSource), sans SDK, sans auth.
(function () {
  let _activeSource = null;
  let _reconnectTimer = null;
  let _listenPath = null;
  let _listenCallback = null;
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

  function restUrl(path) {
    return `${dbRoot()}${path}.json`;
  }

  // ── Helpers REST ─────────────────────────────────────────────────────────
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

  async function dbDelete(path, signal) {
    const res = await fetch(restUrl(path), { method: 'DELETE', signal });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  // GET avec timeout 8s + 1 retry sur erreur réseau
  async function dbGet(path) {
    const attempt = async () => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(restUrl(path), { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        return res.json().catch(() => null);
      } catch (e) {
        clearTimeout(tid);
        throw e;
      }
    };
    try {
      return await attempt();
    } catch (e) {
      if (e.name === 'AbortError') return null;
      // 1 retry après 1.5s sur erreur réseau
      await new Promise(r => setTimeout(r, 1500));
      try { return await attempt(); } catch (_) { return null; }
    }
  }

  // SSE avec reconnexion automatique
  function dbListen(path, onData) {
    _listenPath = path;
    _listenCallback = onData;
    _connect();
  }

  function _connect() {
    if (!_listenPath) return;
    if (_activeSource) { _activeSource.close(); _activeSource = null; }
    _activeSource = new EventSource(restUrl(_listenPath));
    _activeSource.addEventListener('put', e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.path === '/') { _listenCallback(msg.data); return; }
        dbGet(_listenPath).then(d => { if (d !== null) _listenCallback(d); }).catch(() => {});
      } catch (_) {}
    });
    _activeSource.addEventListener('patch', () => {
      dbGet(_listenPath).then(d => { if (d !== null) _listenCallback(d); }).catch(() => {});
    });
    _activeSource.onerror = () => {
      if (_activeSource) { _activeSource.close(); _activeSource = null; }
      // Reconnexion automatique après 5s
      _reconnectTimer = setTimeout(_connect, 5000);
    };
  }

  function removeListener() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    if (_activeSource) { _activeSource.close(); _activeSource = null; }
    _listenPath = null;
    _listenCallback = null;
  }

  // ── Opérations avec timeout ───────────────────────────────────────────────
  function withAbort(fn, ms) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => { ctrl.abort(); _lastOpError = `timeout ${ms / 1000}s`; }, ms);
    return fn(ctrl.signal).then(v => { clearTimeout(tid); return v; }, e => {
      clearTimeout(tid);
      if (!_lastOpError) _lastOpError = e.name === 'AbortError' ? `timeout ${ms / 1000}s` : (e.message || String(e));
      throw e;
    });
  }

  // ── API publique ──────────────────────────────────────────────────────────
  async function pushScore(code, pseudo, score, total) {
    if (!isReady()) return;
    _lastOpError = null;
    try {
      await withAbort(sig => dbPut(
        `/defis/${code.replace(/-/g, '').toUpperCase()}/joueurs/${pseudo}`,
        { score, total, pct: Math.round(100 * score / total), ts: Date.now() },
        sig
      ), 8000);
    } catch (e) { console.warn('[Firebase] pushScore:', e); }
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
    try {
      await withAbort(sig => dbPut(
        `/campaigns/${code.replace(/-/g, '').toUpperCase()}/config`,
        config, sig
      ), 8000);
      return true;
    } catch (e) {
      console.warn('[Firebase] createCampaign:', e);
      return false;
    }
  }

  async function deleteCampaign(code) {
    if (!isReady()) return false;
    _lastOpError = null;
    try {
      await withAbort(sig => dbDelete(
        `/campaigns/${code.replace(/-/g, '').toUpperCase()}`,
        sig
      ), 8000);
      return true;
    } catch (e) {
      console.warn('[Firebase] deleteCampaign:', e);
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
      await withAbort(sig => dbPut(
        `/campaigns/${code.replace(/-/g, '').toUpperCase()}/rounds/${roundN}/joueurs/${pseudo}`,
        { score, total, pct: Math.round(100 * score / total), ts: Date.now() },
        sig
      ), 8000);
    } catch (e) { console.warn('[Firebase] pushCampaignScore:', e); }
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
    createCampaign, deleteCampaign,
    fetchCampaign, pushCampaignScore, listenCampaignLeaderboard,
  };
})();
