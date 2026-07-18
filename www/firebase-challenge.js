'use strict';
// Intégration Firebase Realtime Database pour les classements de défis.
// Exposé via window.FirebaseChallenge une fois initialisé.
// Si la config est absente ou incomplète, le module ne s'installe pas et
// toutes les fonctionnalités Firebase sont silencieusement ignorées.
(function () {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.databaseURL || cfg.databaseURL === '') return;

  let db = null;
  let activeRef = null;
  let activeHandler = null;

  function init() {
    try {
      if (!window.firebase) return;
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      db = firebase.database();
      window.FirebaseChallenge = { isReady, pushScore, listenLeaderboard, removeListener };
    } catch (e) {
      console.warn('[Firebase] init error:', e);
    }
  }

  function isReady() { return !!db; }

  // Clé de collection : code sans tiret, en majuscules
  function defiRef(code) {
    return db.ref('defis/' + code.replace(/-/g, '').toUpperCase() + '/joueurs');
  }

  async function pushScore(code, pseudo, score, total) {
    if (!db) return;
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
    if (!db) return;
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

  // S'installe dès que le DOM est prêt (scripts defer exécutés après parsing)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
