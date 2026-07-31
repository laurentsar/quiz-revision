/*
 * update-check.js — vérification de mise à jour applicative (générique).
 * Interroge la dernière Release GitHub, compare au numéro embarqué et affiche
 * une bannière de téléchargement si une version plus récente est publiée.
 *
 * Config (dans index.html, avant ce script) :
 *   window.UPDATE_REPO = 'laurentsar/<repo>';   // obligatoire
 *   window.APP_VERSION = '1.2';                  // obligatoire (version installée)
 *
 * Autonome : aucune dépendance, styles injectés. Anti-spam : 1 requête / 6 h,
 * mémorise la version ignorée. Échec réseau silencieux.
 */
(function () {
  'use strict';
  var REPO = window.UPDATE_REPO;
  var CURRENT = window.APP_VERSION;
  if (!REPO || !CURRENT) return;

  var POLL_INTERVAL = 6 * 3600 * 1000; // 6 h
  var KEY_POLL = 'updPoll:' + REPO;
  var KEY_DISMISS = 'updDismiss:' + REPO;

  function ls(get, k, v) {
    try { return get ? localStorage.getItem(k) : localStorage.setItem(k, v); }
    catch (e) { return null; }
  }

  // Compare deux versions "a.b.c" → >0 si va plus récente que vb.
  function cmp(va, vb) {
    var a = String(va).replace(/^v/, '').split('.');
    var b = String(vb).replace(/^v/, '').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var d = (parseInt(a[i], 10) || 0) - (parseInt(b[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  // force = déclenché par l'utilisateur (bouton Réglages) : ignore le throttle
  // 6 h et une version déjà ignorée. Résout { status, version } ou rejette
  // (erreur réseau) — utilisé par le bouton « Vérifier les mises à jour ».
  function check(force) {
    var last = parseInt(ls(true, KEY_POLL), 10) || 0;
    if (!force && Date.now() - last < POLL_INTERVAL) {
      return Promise.resolve({ status: 'throttled', version: CURRENT });
    }
    // Cache-buster (_) : évite qu'un service worker "cache-first" serve une
    // réponse d'API périmée. GitHub ignore les paramètres inconnus.
    return fetch('https://api.github.com/repos/' + REPO + '/releases/latest?_=' + Date.now(), {
      headers: { Accept: 'application/vnd.github+json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rel) {
      if (!rel || !rel.tag_name) throw new Error('Release illisible');
      ls(false, KEY_POLL, Date.now());
      var latest = String(rel.tag_name).replace(/^v/, '');
      if (cmp(latest, CURRENT) <= 0) return { status: 'uptodate', version: latest };
      if (!force && ls(true, KEY_DISMISS) === latest) return { status: 'dismissed', version: latest };
      var apk = (rel.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
      showBanner(latest, apk ? apk.browser_download_url : rel.html_url);
      return { status: 'update', version: latest };
    });
  }

  // API publique (bouton « Vérifier les mises à jour » dans Réglages), + vérif
  // à l'ouverture et à chaque retour au premier plan (throttlée à 1 req / 6 h).
  window.UpdateCheck = { check: check, current: CURRENT };
  check(false).catch(function () { /* hors ligne : silencieux */ });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) check(false).catch(function () {});
  });

  // Télécharge + installe l'APK via le plugin natif UpdatePlugin, sans quitter
  // l'app (utilisé par le bouton « ⬇ Installer » de la bannière). `reset`
  // réactive ce bouton en cas d'échec ou d'absence du plugin natif (PWA).
  window.installApkUpdate = function (url, btn, reset) {
    var up = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UpdatePlugin;
    if (!up) { reset(); window.open(url, '_blank', 'noopener'); return; }
    up.downloadAndInstall({ url: url }).catch(function (e) {
      reset();
      var msg = (e && e.message) || String(e);
      alert(/permission/i.test(msg)
        ? "Autorise l'installation d'apps depuis cette source dans les paramètres Android, puis réessaie."
        : 'Erreur : ' + msg);
    });
  };

  function showBanner(version, url) {
    if (document.getElementById('update-banner')) return;
    var css = document.createElement('style');
    css.textContent =
      '#update-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;' +
      'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;' +
      'background:#1f2937;color:#f9fafb;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
      'font:500 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'max-width:520px;margin:0 auto}' +
      '#update-banner .ub-txt{flex:1;min-width:0}' +
      '#update-banner b{color:#fff}' +
      '#update-banner a.ub-act,#update-banner button.ub-act{flex:none;background:#22c55e;' +
      'color:#06210f;text-decoration:none;border:0;font-weight:700;font-size:14px;' +
      'padding:8px 14px;border-radius:10px;cursor:pointer}' +
      '#update-banner button.ub-x{flex:none;background:transparent;border:0;color:#9ca3af;' +
      'font-size:18px;line-height:1;cursor:pointer;padding:4px}';
    document.head.appendChild(css);

    var b = document.createElement('div');
    b.id = 'update-banner';
    var txt = document.createElement('span');
    txt.className = 'ub-txt';
    txt.innerHTML = '🔄 Nouvelle version <b>v' + version + '</b> disponible';

    // Si le plugin natif est présent (APK) : bouton qui télécharge + INSTALLE
    // directement. Sinon lien de téléchargement navigateur (PWA).
    var canInstall = typeof window.installApkUpdate === 'function' &&
      window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UpdatePlugin;
    var act;
    if (canInstall) {
      act = document.createElement('button');
      act.className = 'ub-act';
      act.textContent = '⬇ Installer';
      act.onclick = function () {
        act.disabled = true; act.textContent = '⏳ Installation…';
        window.installApkUpdate(url, act, function () {
          act.disabled = false; act.textContent = '⬇ Installer';
        });
      };
    } else {
      act = document.createElement('a');
      act.className = 'ub-act';
      act.href = url; act.target = '_blank'; act.rel = 'noopener';
      act.textContent = 'Télécharger';
    }

    var x = document.createElement('button');
    x.className = 'ub-x';
    x.setAttribute('aria-label', 'Ignorer'); x.textContent = '✕';
    x.onclick = function () { ls(false, KEY_DISMISS, version); b.remove(); };
    b.appendChild(txt); b.appendChild(act); b.appendChild(x);
    (document.body || document.documentElement).appendChild(b);
  }
})();
