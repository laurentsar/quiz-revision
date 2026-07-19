'use strict';
// Intégration Firebase Realtime Database — initialisation paresseuse.
// window.FirebaseChallenge est installé immédiatement ; Firebase s'initialise
// à la première utilisation (plus de dépendance à l'ordre des scripts defer).
(function () {
  let db = null;
  let activeRef = null;
  let activeHandler = null;

  function getDb() {
    if (db) return db;
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL) return null;
    if (!window.firebase) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      db = firebase.database();
    } catch (e) {
      console.warn('[Firebase] init error:', e);
    }
    return db;
  }

  function isReady() { return !!getDb(); }

  function defiRef(code) {
    return getDb().ref('defis/' + code.replace(/-/g, '').toUpperCase() + '/joueurs');
  }

  function campaignRef(code) {
    return getDb().ref('campaigns/' + code.replace(/-/g, '').toUpperCase());
  }

  async function pushScore(code, pseudo, score, total) {
    if (!getDb()) return;
    try {
      await defiRef(code).child(pseudo).set({
        score, total,
        pct: Math.round(100 * score / total),
        ts: Date.now(),
      });
    } catch (e) {
      console.warn('[Firebase] write error:', e);
    }
  }

  function listenLeaderboard(code, callback) {
    if (!getDb()) return;
    removeListener();
    activeRef = defiRef(code);
    activeHandler = activeRef.on('value', (snap) => {
      const data = snap.val() || {};
      const rows = Object.entries(data)
        .map(([pseudo, d]) => ({ pseudo, score: d.score, total: d.total, pct: d.pct, ts: d.ts }))
        .sort((a, b) => b.pct - a.pct || b.score - a.score || a.ts - b.ts);
      callback(rows);
    }, (err) => console.warn('[Firebase] read error:', err));
  }

  function removeListener() {
    if (activeRef && activeHandler) {
      activeRef.off('value', activeHandler);
      activeRef = null; activeHandler = null;
    }
  }

  async function createCampaign(code, config) {
    if (!getDb()) return false;
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
      await Promise.race([campaignRef(code).child('config').set(config), timeout]);
      return true;
    } catch (e) {
      console.warn('[Firebase] createCampaign error:', e);
      return false;
    }
  }

  async function fetchCampaign(code) {
    if (!getDb()) return null;
    try {
      const snap = await campaignRef(code).child('config').once('value');
      return snap.val();
    } catch (e) {
      console.warn('[Firebase] fetchCampaign error:', e);
      return null;
    }
  }

  async function pushCampaignScore(code, roundN, pseudo, score, total) {
    if (!getDb()) return;
    try {
      await campaignRef(code).child('rounds/' + roundN + '/joueurs/' + pseudo).set({
        score, total,
        pct: Math.round(100 * score / total),
        ts: Date.now(),
      });
    } catch (e) {
      console.warn('[Firebase] pushCampaignScore error:', e);
    }
  }

  function listenCampaignLeaderboard(code, callback) {
    if (!getDb()) return;
    removeListener();
    activeRef = campaignRef(code).child('rounds');
    activeHandler = activeRef.on('value', (snap) => {
      const rounds = snap.val() || {};
      const totals = {};
      Object.values(rounds).forEach(round => {
        const joueurs = (round && round.joueurs) ? round.joueurs : {};
        Object.entries(joueurs).forEach(([pseudo, d]) => {
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
    }, err => console.warn('[Firebase] campaign lb error:', err));
  }

  // Installé immédiatement — pas d'attente du chargement du SDK
  window.FirebaseChallenge = {
    isReady, pushScore, listenLeaderboard, removeListener,
    createCampaign, fetchCampaign, pushCampaignScore, listenCampaignLeaderboard,
  };
})();
