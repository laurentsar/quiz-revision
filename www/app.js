'use strict';

// Quizz Révision — questions GÉNÉRÉES à la volée depuis une base de concepts,
// avec répétition espacée (Leitner), mode Apprendre (flashcards),
// distracteurs ciblés (confusions / même catégorie) et feedback enrichi.

const OPTION_COUNT = 4;
const BOX_DAYS = [0, 1, 3, 7, 16, 30];   // Leitner : box -> jours avant réapparition
const MAX_BOX = BOX_DAYS.length - 1;     // box >= 4 = maîtrisé
const DAY = 86400000;

// Défi multijoueur : valeurs encodables dans un code partageable
const CHALLENGE_SCOPES = ['all', 'grp:homolog', 'grp:reglem', 'grp:cissp', 'grp:sscp', 'grp:ccsp', 'grp:cc', 'grp:ceh'];
const CHALLENGE_COUNTS = [5, 10, 20, 0];     // 0 = tout
const CHALLENGE_QTYPES = ['mix', 'def', 'term', 'situation', 'cat'];

// Durées de session pour les simulations d'examen (par groupe de branche)
const EXAM_CONFIG = {
  cissp:   { label: 'CISSP',          minutes: 180 },
  sscp:    { label: 'SSCP',           minutes: 180 },
  ccsp:    { label: 'CCSP',           minutes: 180 },
  cc:      { label: 'CC (ISC2)',       minutes: 120 },
  ceh:     { label: 'CEH',            minutes: 240 },
  reglem:  { label: 'Réglementation', minutes: 90  },
  homolog: { label: 'Homologation',   minutes: 90  },
};

const state = {
  branches: new Set(),   // vide = tous les thèmes ; sinon clés de branche concrètes
  qtype: 'mix',       // 'mix' | 'def' | 'term' | 'situation' | 'cat'
  count: 10,          // 0 = tout
  mode: 'srs',        // 'srs' | 'review'
  examMode: false,    // chrono session + priorité mises en situation
  examInterval: null,
  examEndTime: 0,
  challenge: null,    // { seed, code } — non-null quand un défi est en cours
  questions: [], answers: [], index: 0,
  learn: [], lidx: 0,
};

let DB = null, ALL = [], CATS = [], BYTERM = {};

// Groupes de thèmes : une chip parent repliée + le détail des membres à la demande.
// id = identifiant de la chip parent ; test() reconnaît les clés de branche membres.
// Homologation (FR) reste un groupe ; les certifications forment leurs groupes
// (préfixe « Certification »). Les thèmes de référence (ex-« Réf. cyber ») sont
// des thèmes séparés à part entière (chips individuelles).
// dot = pastille de couleur préfixant chaque sous-thème dans le menu (visible même
// sur les pickers natifs mobiles, qui ignorent la couleur CSS des options).
const REGLEM = ['igi1300', 'ii901', 'igi2102'];   // instructions FR (protection du secret)
const GROUPS = [
  { id: 'homolog', label: 'Homologation', icon: '🏛️', dot: '🔵', color: '#27B3FF', test: (k) => k === 'archi' },
  { id: 'reglem', label: 'Réglementation (IGI/II)', icon: '⚖️', dot: '🟠', color: '#FF9F6B', test: (k) => REGLEM.includes(k) },
  { id: 'cissp', label: 'Certification CISSP', icon: '🔐', dot: '🟢', color: '#4CE0D2', test: (k) => /^cissp\d+$/.test(k) },
  { id: 'sscp', label: 'Certification SSCP', icon: '🖥️', dot: '🟢', color: '#35D07F', test: (k) => /^sscp\d+$/.test(k) },
  { id: 'ccsp', label: 'Certification CCSP', icon: '☁️', dot: '🟢', color: '#27B3FF', test: (k) => /^ccsp\d+$/.test(k) },
  { id: 'cc', label: 'Certification CC (ISC2)', icon: '🌱', dot: '🟢', color: '#FF9F43', test: (k) => /^cc\d+$/.test(k) },
  { id: 'ceh', label: 'Certification CEH', icon: '🕵️', dot: '🟢', color: '#FF6B81', test: (k) => /^ceh\d+$/.test(k) },
];
function groupOf(k) { return GROUPS.find(g => g.test(k)); }
function groupById(id) { return GROUPS.find(g => g.id === id); }
function groupKeys(g) { return Object.keys(DB.branches).filter(g.test); }
function groupActive(g) { return [...state.branches].some(g.test); }
function branchLabel(k) { return (DB.branches && DB.branches[k]) || k; }

// Libellé de la sélection courante : rien de sélectionné = tout.
function scopeLabel() {
  const n = state.branches.size;
  if (!n || n === Object.keys(DB.branches).length) return 'Tout';
  if (n === 1) return branchLabel([...state.branches][0]);
  for (const g of GROUPS) {
    const inG = [...state.branches].filter(g.test).length;
    if (inG === n) return inG === groupKeys(g).length ? g.label : `${g.label} · ${n}`;
  }
  return `${n} thèmes`;
}

const settings = Object.assign({ autoNext: true, sound: true, showCounts: false, closeDistractors: false, timer: false, pomodoro: false }, lsGet('quizrev:settings:v1', {}));
const TIMER_SECS = 30;          // minuteur par question
const POMODORO_WORK = 25 * 60;  // 25 min de révision active
const POMODORO_BREAK = 5 * 60;  // 5 min de pause

// ---------- persistance ----------
function lsGet(k, d) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function saveSettings() { lsSet('quizrev:settings:v1', settings); }

function loadStats() { return Object.assign({ done: 0, bestPct: 0, lastPct: -1, totalQ: 0, totalC: 0, points: 0, streak: 0, bestStreak: 0, perfect: 0 }, lsGet('quizrev:stats:v1', {})); }
function saveStats(s) { lsSet('quizrev:stats:v1', s); }

function getWrong() { return lsGet('quizrev:wrong:v1', []); }
function saveWrong(w) { lsSet('quizrev:wrong:v1', w); }
function addWrong(t) { const w = getWrong(); if (!w.includes(t)) { w.push(t); saveWrong(w); } }
function removeWrong(t) { saveWrong(getWrong().filter(x => x !== t)); }

function getDisabled() { return new Set(lsGet('quizrev:disabled:v1', [])); }
function saveDisabled(s) { lsSet('quizrev:disabled:v1', [...s]); }

// Signalements de questions mal formulées
// { [term]: { type, note, promptLabel, ts, status:'open'|'resolved' } }
function getFlags() { return lsGet('quizrev:flags:v1', {}); }
function saveFlags(f) { lsSet('quizrev:flags:v1', f); }
function countOpenFlags() { return Object.values(getFlags()).filter(v => v.status === 'open').length; }

// Reformulations locales : { [term]: { def?, ex?, tip? } }
function getOverrides() { return lsGet('quizrev:overrides:v1', {}); }
function saveOverrides(o) { lsSet('quizrev:overrides:v1', o); }
function applyOverrides() {
  const ov = getOverrides();
  if (!Object.keys(ov).length) return;
  ALL.forEach(c => { if (ov[c.term]) Object.assign(c, ov[c.term]); });
}

// Pseudo joueur (défis multijoueur) : auto-généré à la première utilisation
const PSEUDO_ADJ = ['Agile','Brave','Cyber','Dark','Elite','Flash','Ghost','Hyper','Iron','Ninja','Omega','Proto','Quick','Recon','Swift'];
const PSEUDO_NOM = ['Aigle','Bison','Cobra','Dingo','Faucon','Gecko','Ibis','Lapin','Loup','Lynx','Orque','Panda','Renard','Tigre','Varan'];
function genPseudo() { return PSEUDO_ADJ[Math.floor(Math.random()*PSEUDO_ADJ.length)] + PSEUDO_NOM[Math.floor(Math.random()*PSEUDO_NOM.length)] + Math.floor(10+Math.random()*90); }
function getPseudo() { let p = lsGet('quizrev:pseudo:v1',''); if (!p) { p = genPseudo(); lsSet('quizrev:pseudo:v1', p); } return p; }

// Journal d'activité quotidien (alimente le graphe « 14 derniers jours »).
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function logDaily(correct) {
  const m = lsGet('quizrev:daily:v1', {});
  const t = todayStr();
  const e = m[t] || { q: 0, c: 0 };
  e.q++; if (correct) e.c++;
  m[t] = e;
  const keys = Object.keys(m).sort();
  while (keys.length > 90) delete m[keys.shift()];   // on ne garde que 90 jours
  lsSet('quizrev:daily:v1', m);
}
function lastNDays(n) {
  const m = lsGet('quizrev:daily:v1', {});
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out.push({ day: d.getDate(), q: (m[k] || {}).q || 0 });
  }
  return out;
}

// Leitner SRS (clé = terme)
function getSrs() { return lsGet('quizrev:srs:v1', {}); }
function saveSrs(s) { lsSet('quizrev:srs:v1', s); }
function srsUpdate(term, ok) {
  const s = getSrs();
  const e = s[term] || { box: 0, due: 0, seen: 0, correct: 0, wrong: 0 };
  e.seen++;
  if (ok) { e.correct++; e.box = Math.min(e.box + 1, MAX_BOX); }
  else { e.wrong++; e.box = 0; }
  e.due = Date.now() + BOX_DAYS[e.box] * DAY;
  s[term] = e; saveSrs(s);
}

// ---------- helpers ----------
function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Générateur pseudo-aléatoire LCG déterministe (seed → séquence reproductible)
function seededRng(seed) {
  let s = (seed ^ 0xDEADBEEF) >>> 0;
  return function() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function seededShuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Encode la config du défi en un code 11 chars (XXXXX-XXXXX) partageable.
// Format : 8 hex (seed uint32) + 2 hex (config = si*20 + ci*5 + qi).
function encodeChallenge(scope, count, qtype, seed) {
  const si = CHALLENGE_SCOPES.indexOf(scope), ci = CHALLENGE_COUNTS.indexOf(count), qi = CHALLENGE_QTYPES.indexOf(qtype);
  if (si < 0 || ci < 0 || qi < 0) return null;
  const raw = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0') +
              (si * 20 + ci * 5 + qi).toString(16).toUpperCase().padStart(2, '0');
  return raw.slice(0, 5) + '-' + raw.slice(5);
}
function decodeChallenge(input) {
  const raw = input.replace(/-/g, '').trim().toUpperCase();
  if (!/^[0-9A-F]{10}$/.test(raw)) return null;
  const seed = parseInt(raw.slice(0, 8), 16);
  const config = parseInt(raw.slice(8), 16);
  const qi = config % 5, ci = Math.floor(config / 5) % 4, si = Math.floor(config / 20);
  if (si >= CHALLENGE_SCOPES.length) return null;
  return { scope: CHALLENGE_SCOPES[si], count: CHALLENGE_COUNTS[ci], qtype: CHALLENGE_QTYPES[qi], seed };
}
// Scope encodable le plus proche de la sélection courante (groupes uniquement)
function challengeScope() {
  const v = scopeToSelectValue();
  if (CHALLENGE_SCOPES.includes(v)) return v;
  const k = [...state.branches];
  if (k.length === 1) { const g = groupOf(k[0]); return g ? 'grp:' + g.id : 'all'; }
  return 'all';
}
function challengeScopeLabel(scope) {
  if (scope === 'all') return 'Tous les thèmes';
  if (scope.startsWith('grp:')) { const g = groupById(scope.slice(4)); return g ? g.label : scope; }
  return branchLabel(scope);
}
function uniq(a) { return [...new Set(a)]; }
function uniqKeepFirst(a) { const s = new Set(), o = []; a.forEach(v => { if (v != null && !s.has(v)) { s.add(v); o.push(v); } }); return o; }
const $ = (id) => document.getElementById(id);
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Sélection vide = pas de filtre (tout le corpus). Concepts désactivés exclus.
function pool() {
  const disabled = getDisabled();
  const base = state.branches.size ? ALL.filter(c => state.branches.has(c.branch)) : ALL;
  return disabled.size ? base.filter(c => !disabled.has(c.term)) : base;
}
function fieldVal(term, field) { const c = BYTERM[term]; return c ? c[field] : null; }

// ---------- sélection des concepts (répétition espacée) ----------
function pickConcepts(mode) {
  const p = pool();
  if (mode === 'review') { const w = new Set(getWrong()); return shuffle(ALL.filter(c => w.has(c.term))); }
  const srs = getSrs(), now = Date.now();
  const due = p.filter(c => srs[c.term] && srs[c.term].due <= now).sort((a, b) => srs[a.term].due - srs[b.term].due);
  const fresh = shuffle(p.filter(c => !srs[c.term]));
  let picks = due.concat(fresh);
  const target = state.count > 0 ? state.count : p.length;
  if (picks.length < target) picks = picks.concat(shuffle(p));
  const seen = new Set();
  return picks.filter(c => !seen.has(c.term) && seen.add(c.term));
}

// ---------- génération de questions à la volée ----------
// Proximité textuelle grossière (initiale, longueur, lettres communes) : sert à
// classer les distracteurs quand l'option « distracteurs proches » est active.
function similarity(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  if (a === b) return -1;
  let s = 0;
  if (a[0] === b[0]) s += 3;
  s += Math.max(0, 3 - Math.abs(a.length - b.length));
  const setB = new Set(b); let shared = 0;
  new Set(a).forEach(ch => { if (setB.has(ch)) shared++; });
  return s + shared * 0.5;
}

// Distracteurs ciblés : confusions explicites -> même catégorie -> même branche -> global.
function distractors(field, correct, concept, n) {
  const tier = (pred) => shuffle(uniq(ALL.filter(pred).map(c => c[field]))).filter(v => v && v !== correct);
  const t1 = shuffle((concept.confuse || []).map(t => fieldVal(t, field)).filter(v => v && v !== correct));
  const t2 = tier(c => c.cat === concept.cat && c.term !== concept.term);
  const t3 = tier(c => c.branch === concept.branch);
  const t4 = tier(() => true);
  const cand = uniqKeepFirst([...t1, ...t2, ...t3, ...t4]);
  if (!settings.closeDistractors) return cand.slice(0, n);
  // mode difficile : on pioche parmi les plus ressemblants, pas les premiers venus
  const ranked = cand.map(v => [v, similarity(correct, v)]).sort((x, y) => y[1] - x[1]);
  return shuffle(ranked.slice(0, Math.max(8, n * 4)).map(x => x[0])).slice(0, n);
}

// Un concept « structure » (issu de la mind map CISSP) n'a pas de définition :
// seule sa place dans l'arbre est révisable -> question de catégorie.
function hasDef(concept) { return !!concept.def; }

function makeQuestion(concept) {
  let type = state.qtype;
  if (type === 'mix') {
    // En mode examen : priorité aux mises en situation (50 %) pour coller aux vrais examens.
    // Sinon : question de fond pour les concepts définis, catégorie pour les structures CISSP.
    const types = state.examMode && hasDef(concept) && concept.ex
      ? ['situation', 'situation', 'def', 'term']
      : hasDef(concept) ? ['def', 'term', 'situation']
      : (CATS.length >= OPTION_COUNT ? ['cat'] : ['def']);
    type = types[Math.floor(Math.random() * types.length)];
  }
  if (type === 'situation' && !concept.ex) type = 'def';
  if ((type === 'def' || type === 'term') && !hasDef(concept)) type = 'cat';

  let promptLabel, promptText, correct, field;
  if (type === 'term') {
    field = 'term'; promptLabel = 'Quel terme correspond à cette définition ?';
    promptText = '« ' + concept.def + ' »'; correct = concept.term;
  } else if (type === 'situation') {
    field = 'term'; promptLabel = 'Quelle notion décrit cette situation ?';
    promptText = concept.ex; correct = concept.term;
  } else if (type === 'cat') {
    field = 'cat'; promptLabel = 'À quelle catégorie appartient…';
    promptText = '« ' + concept.term + ' »'; correct = concept.cat;
  } else {
    field = 'def'; promptLabel = 'Que recouvre ce terme ?';
    promptText = '« ' + concept.term + ' »'; correct = concept.def;
  }

  const opts = shuffle([correct, ...distractors(field, correct, concept, OPTION_COUNT - 1)]);
  return {
    key: concept.term, promptLabel, promptText,
    options: opts, correctIndex: opts.indexOf(correct), correctText: correct,
    reminder: concept.term + ' — ' + (concept.def || 'relève de : ' + concept.cat),
    tip: concept.tip, ex: concept.ex, cat: concept.cat,
  };
}

function buildSession() {
  if (state.challenge) {
    const rng = seededRng(state.challenge.seed);
    const p = pool();
    const shuffled = seededShuffle(p, rng);
    const cnt = state.count > 0 ? state.count : shuffled.length;
    return shuffled.slice(0, cnt).map(makeQuestion);
  }
  let concepts = pickConcepts(state.mode);
  if (state.count > 0) concepts = concepts.slice(0, state.count);
  return shuffle(concepts).map(makeQuestion);
}

// ---------- son ----------
let audioCtx = null;
function beep(ok) {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = ok ? 'sine' : 'square'; o.frequency.value = ok ? 880 : 180;
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (ok ? 0.18 : 0.28));
    o.start(); o.stop(audioCtx.currentTime + (ok ? 0.2 : 0.3));
  } catch (e) {}
}
function vibrate(ok) { try { navigator.vibrate && navigator.vibrate(ok ? 25 : [40, 50, 40]); } catch (e) {} }

// ---------- vues ----------
const views = { home: $('view-home'), quiz: $('view-quiz'), result: $('view-result'), fiches: $('view-fiches'), learn: $('view-learn'), resources: $('view-resources'), stats: $('view-stats') };
let autoNextTimer = null;
function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  $('btn-fab-home').classList.toggle('hidden', name === 'home');   // bouton flottant Accueil
  window.scrollTo(0, 0);
}
function renderChips(sel, current, attr) { document.querySelectorAll(sel).forEach(c => c.classList.toggle('active', c.dataset[attr] === String(current))); }

const BRANCH_COLORS = { archi: '#27B3FF', igi1300: '#8B9BFF', ii901: '#35D07F', igi2102: '#FF9F6B' };
function themeColor() {
  const sel = [...state.branches];
  for (const g of GROUPS) if (sel.length && sel.every(g.test)) return g.color;
  if (sel.length === 1) return BRANCH_COLORS[sel[0]] || '#27B3FF';
  return '#27B3FF';
}

// Sélection du thème via un unique menu déroulant (Tout, thème simple, ou groupe).
function renderBranchSelect() {
  const home = $('home-select');
  const v = scopeToSelectValue();
  home.innerHTML = (v === '' ? '<option value="" disabled>— sélection multiple —</option>' : '') + themeOptionsHtml();
  home.value = v;
}

// Options du menu déroulant, séparées en grandes parties par des optgroups (en-têtes
// natifs, visibles sur mobile) : Tout · 🇫🇷 Homologation · 🎓 Certifications · 🧭 Référence.
function themeOptionsHtml() {
  const opt = (val, l) => `<option value="${val}">${esc(l)}</option>`;
  let h = opt('all', '⭐ Tout');
  GROUPS.forEach(g => {
    const m = Object.entries(DB.branches).filter(([k]) => g.test(k));
    if (!m.length) return;
    h += `<optgroup label="${esc('── ' + (g.icon ? g.icon + ' ' : '') + g.label + ' ──')}">` +
      opt('grp:' + g.id, (g.dot || '▸') + ' Tout — ' + g.label) +
      m.map(([k, l]) => opt(k, (g.dot || '·') + ' ' + l)).join('') + `</optgroup>`;
  });
  // thèmes de référence : chacun une partie distincte (option de 1er niveau + icône)
  const ref = Object.entries(DB.branches).filter(([k]) => k.startsWith('ig_'));
  if (ref.length) h += `<optgroup label="── Références ──">` +
    ref.map(([k, l]) => opt(k, (REF_ICONS[k] || '🧭') + ' ' + l)).join('') + `</optgroup>`;
  return h;
}

// Icône propre à chaque thème de référence (partie distincte dans le menu).
const REF_ICONS = {
  ig_nist: '📋', ig_gdpr: '🔏', ig_hipaa: '🏥', ig_http: '🌐', ig_socialeng: '🎭',
  ig_mitre: '⚔️', ig_blueteam: '🛡️', ig_cybertech: '🧰', ig_sec360: '🎯',
  ig_secauto: '☠️', ig_devops: '⚙️',
};

// Valeur du menu correspondant à la sélection courante ('' = multiple/personnalisé).
function scopeToSelectValue() {
  const n = state.branches.size;
  if (!n || n === Object.keys(DB.branches).length) return 'all';
  if (n === 1) return [...state.branches][0];
  for (const g of GROUPS) { const ks = groupKeys(g); if (ks.length === n && ks.every(k => state.branches.has(k))) return 'grp:' + g.id; }
  return '';
}

// Application d'un choix du menu déroulant : remplace la sélection courante.
function selectHomeTheme(v) {
  state.branches.clear();
  if (v.startsWith('grp:')) groupKeys(groupById(v.slice(4))).forEach(k => state.branches.add(k));
  else if (v && v !== 'all') state.branches.add(v);
  renderBranchSelect(); renderHome();
}


function updateFlagBadge() {
  const n = countOpenFlags();
  const badge = $('flag-badge');
  if (badge) { badge.textContent = n || ''; badge.classList.toggle('hidden', !n); }
}

function renderHome() {
  const p = pool(), srs = getSrs(), now = Date.now();
  $('stat-pool').textContent = p.length + ' concepts';
  const mastered = p.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
  const due = p.filter(c => srs[c.term] && srs[c.term].due <= now).length;
  $('stat-mastered').textContent = mastered + ' / ' + p.length;
  $('stat-due').textContent = due;
  const s = loadStats();
  $('stat-last').textContent = s.lastPct < 0 ? '—' : s.lastPct + ' %';
  $('stat-best').textContent = s.bestPct ? s.bestPct + ' %' : '—';
  const acc = s.totalQ ? Math.round(100 * s.totalC / s.totalQ) : null;
  $('stat-total').textContent = s.done + ' · ' + (acc == null ? '—' : acc + ' %');
  const w = getWrong().length;
  $('review-count').textContent = w;
  $('btn-review').disabled = w === 0;
  updateFlagBadge();
}

// ---------- déroulé du quiz ----------
function startSession(mode) {
  state.mode = mode;
  state.questions = buildSession();
  if (!state.questions.length) { alert('Aucun concept disponible avec ces filtres.'); return; }
  state.answers = []; state.index = 0;
  studying = true; pomoStart();
  showView('quiz');
  if (state.examMode) {
    const gid = examCurrentGroup();
    if (gid) startExamTimer(EXAM_CONFIG[gid].minutes); else stopExamTimer();
  } else { stopExamTimer(); }
  renderQuestion();
}

function renderQuestion() {
  clearTimeout(autoNextTimer);
  const q = state.questions[state.index], a = state.answers[state.index];
  $('quiz-progress').textContent = `Question ${state.index + 1}/${state.questions.length}`;
  $('quiz-level').textContent = state.mode === 'review' ? '⟳ Révision erreurs' : scopeLabel();
  $('quiz-level').style.color = themeColor();
  const bar = $('quiz-bar');
  bar.style.background = themeColor();
  bar.style.width = ((state.index + (a ? 1 : 0)) / state.questions.length * 100) + '%';
  $('quiz-prompt-label').textContent = q.promptLabel;
  $('quiz-word').textContent = q.promptText;

  const box = $('quiz-options'); box.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = `<span class="idx">${String.fromCharCode(65 + idx)}</span><span>${esc(opt)}</span>`;
    if (a) {
      btn.disabled = true;
      if (idx === q.correctIndex) btn.classList.add('correct');
      else if (idx === a.selectedIndex) btn.classList.add('wrong');
    } else { btn.addEventListener('click', () => selectOption(idx)); }
    box.appendChild(btn);
  });

  const fb = $('quiz-feedback');
  if (a) {
    clearQTimer();
    const head = a.correct ? '✅ Correct' : (a.timeout ? '⏱️ Temps écoulé' : '❌ Faux');
    let html = `<div class="fb-head">${head}</div>`;
    html += `<div class="fb-line">📌 ${esc(q.reminder)}</div>`;
    if (q.tip) html += `<div class="fb-line tip">💡 ${esc(q.tip)}</div>`;
    if (q.ex) html += `<div class="fb-line ex">🔎 ${esc(q.ex)}</div>`;
    html += `<a class="fb-video" data-term="${esc(q.key)}">🎥 Voir une vidéo sur ce concept</a>`;
    html += `<button class="ghost-sm flag-btn">🚩 Signaler cette question</button>`;
    fb.innerHTML = html;
    fb.className = 'feedback show ' + (a.correct ? 'good' : 'bad');
    const v = fb.querySelector('.fb-video');
    if (v) v.addEventListener('click', () => openExternal(videoSearchUrl(v.dataset.term)));
    const flagBtn = fb.querySelector('.flag-btn');
    if (flagBtn) flagBtn.addEventListener('click', () => openFlagModal(q.key, q.promptLabel));
  } else { fb.innerHTML = ''; fb.className = 'feedback'; startQTimer(); }

  const next = $('btn-next');
  next.disabled = !a;
  next.textContent = state.index < state.questions.length - 1 ? 'Suivant' : 'Voir le score';
}

// ---------- chrono de session examen ----------
function examCurrentGroup() {
  for (const g of GROUPS) if (groupActive(g) && EXAM_CONFIG[g.id]) return g.id;
  return null;
}
function startExamTimer(minutes) {
  clearInterval(state.examInterval);
  state.examEndTime = Date.now() + minutes * 60000;
  const el = $('quiz-timer');
  el.classList.remove('urgent');
  function tick() {
    const left = Math.max(0, state.examEndTime - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    el.textContent = '⏳ ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    el.classList.toggle('urgent', left > 0 && left < 300000);
    if (left === 0) { clearInterval(state.examInterval); state.examInterval = null; finishQuiz(); }
  }
  tick();
  state.examInterval = setInterval(tick, 1000);
}
function stopExamTimer() {
  clearInterval(state.examInterval); state.examInterval = null;
  const el = $('quiz-timer'); if (el && !settings.timer) el.textContent = '';
}

// ---------- minuteur par question (pausable) ----------
let qTimer = null, qRemain = 0;
function qPaint() { $('quiz-timer').textContent = qRemain > 0 ? '⏱️ ' + qRemain + 's' : ''; $('quiz-timer').classList.toggle('urgent', qRemain <= 5); }
function stopQTick() { clearInterval(qTimer); qTimer = null; }           // gèle (garde qRemain)
function clearQTimer() { stopQTick(); qRemain = 0; if (!state.examMode) $('quiz-timer').textContent = ''; }
function qTick() {                                                        // (re)lance depuis qRemain
  stopQTick();
  if (!settings.timer || state.examMode || qRemain <= 0) return;
  qPaint();
  qTimer = setInterval(() => { qRemain--; if (qRemain <= 0) { stopQTick(); qPaint(); timeUp(); } else qPaint(); }, 1000);
}
function startQTimer() { clearQTimer(); if (!settings.timer || state.examMode) return; qRemain = TIMER_SECS; qTick(); }
function timeUp() {
  if (state.answers[state.index]) return;
  const q = state.questions[state.index];
  state.answers[state.index] = { selectedIndex: -1, correct: false, timeout: true };
  srsUpdate(q.key, false); logDaily(false); addWrong(q.key);
  beep(false); vibrate(false);
  renderQuestion();
  if (settings.autoNext) autoNextTimer = setTimeout(goNext, 2200);
}

// ---------- Pomodoro (écoute active : 25 min révision -> 5 min pause) ----------
let pomoInterval = null, pomoSeconds = 0, studying = false;
function pomoStart() {
  if (!settings.pomodoro || pomoInterval || !studying) return;
  pomoInterval = setInterval(() => {
    pomoSeconds++;
    if (pomoSeconds >= POMODORO_WORK) { pomoStop(); pomoSeconds = 0; showPomodoroBreak(); }
  }, 1000);
}
function pomoStop() { clearInterval(pomoInterval); pomoInterval = null; }

// Pause du temps de révision quand l'utilisateur s'éloigne : l'app en arrière-plan
// ou l'écran éteint (Page Visibility) sert de proxy fiable au capteur de proximité.
// On gèle minuteur + Pomodoro, on reprend au retour, sans perdre le temps restant.
function pauseStudyTimers() { stopQTick(); pomoStop(); }
function resumeStudyTimers() {
  if (!views.quiz.classList.contains('hidden') && !state.answers[state.index]) qTick();
  pomoStart();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseStudyTimers(); else resumeStudyTimers(); });
// Bonus : capteur de proximité s'il est exposé (rare hors natif) — main proche = éloigné.
if ('ondeviceproximity' in window || 'onuserproximity' in window) {
  window.addEventListener('userproximity', (e) => { if (e.near) pauseStudyTimers(); else resumeStudyTimers(); });
}
function showPomodoroBreak() {
  clearTimeout(autoNextTimer); clearQTimer();
  const modal = $('pomodoro-modal'), cd = $('pomo-countdown');
  let left = POMODORO_BREAK;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  cd.textContent = fmt(left);
  modal.classList.remove('hidden');
  vibrate(false);
  const tick = setInterval(() => { left--; cd.textContent = fmt(left); if (left <= 0) end(); }, 1000);
  function end() { clearInterval(tick); modal.classList.add('hidden'); pomoStart(); }
  $('btn-pomo-resume').onclick = end;
}

function selectOption(idx) {
  if (state.answers[state.index]) return;
  clearQTimer();
  const q = state.questions[state.index];
  const correct = idx === q.correctIndex;
  state.answers[state.index] = { selectedIndex: idx, correct };
  srsUpdate(q.key, correct);
  logDaily(correct);
  if (correct) { if (state.mode === 'review') removeWrong(q.key); } else addWrong(q.key);
  beep(correct); vibrate(correct);
  renderQuestion();
  if (settings.autoNext) autoNextTimer = setTimeout(goNext, correct ? 1100 : 2200);
}

function goNext() {
  clearTimeout(autoNextTimer);
  if (!state.answers[state.index]) return;
  if (state.index < state.questions.length - 1) { state.index++; renderQuestion(); }
  else finishQuiz();
}

function finishQuiz() {
  const total = state.questions.length;
  const score = state.answers.filter(a => a && a.correct).length;
  const pct = Math.round(100 * score / total);
  const prev = loadStats();
  const perfect = score === total;
  const streak = perfect ? prev.streak + 1 : 0;
  saveStats({
    done: prev.done + 1, bestPct: Math.max(prev.bestPct, pct), lastPct: pct,
    totalQ: prev.totalQ + total, totalC: prev.totalC + score,
    points: prev.points + score, streak, bestStreak: Math.max(prev.bestStreak, streak),
    perfect: prev.perfect + (perfect ? 1 : 0),
  });

  const wrong = state.questions.map((q, i) => ({ prompt: q.promptText, correct: q.correctText, ok: state.answers[i] && state.answers[i].correct })).filter(x => !x.ok);
  $('result-sub').textContent = state.mode === 'review' ? 'Révision des erreurs terminée' : 'Quiz terminé';
  $('result-score').textContent = `${score}/${total}`;
  const wbox = $('result-wrong');
  wbox.innerHTML = wrong.length
    ? '<span class="wrong-title">À retravailler</span>' + wrong.map(w => `<div class="wrong-row"><span class="wrong-word">${esc(w.prompt)}</span><span class="wrong-answer">${esc(w.correct)}</span></div>`).join('')
    : '<span class="wrong-title">Parfait 🎉</span><span class="wrong-answer">Aucune erreur</span>';
  clearQTimer(); stopExamTimer(); studying = false; pomoStop();

  const cr = $('challenge-result');
  const lb = $('challenge-leaderboard');
  if (state.challenge) {
    const code = state.challenge.code;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '✅' : '💪';
    const shareText = `⚔️ Défi Quizz Révision [${code}]\n${score}/${total} — ${pct}% ${emoji}\nTu fais mieux ?`;
    $('challenge-result-code').textContent = code;
    $('btn-share-result').dataset.shareText = shareText;
    cr.classList.remove('hidden');
    if (window.FirebaseChallenge && FirebaseChallenge.isReady()) {
      const pseudo = getPseudo();
      FirebaseChallenge.pushScore(code, pseudo, score, total);
      lb.classList.remove('hidden');
      $('leaderboard-status').textContent = `Vous jouez en tant que : ${pseudo}`;
      renderLeaderboard([], pseudo);
      FirebaseChallenge.listenLeaderboard(code, rows => renderLeaderboard(rows, pseudo));
    } else {
      lb.classList.add('hidden');
    }
    state.challenge = null;
  } else {
    cr.classList.add('hidden');
    lb.classList.add('hidden');
  }

  showView('result');
  if (perfect && total >= 3) launchFireworks();
}

// ---------- mode Apprendre (flashcards) ----------
function startLearn() {
  state.learn = pickConcepts('srs');
  if (state.count > 0) state.learn = state.learn.slice(0, state.count);
  if (!state.learn.length) return;
  studying = true; pomoStart();
  state.lidx = 0;
  showView('learn'); renderFlash();
}
function renderFlash() {
  const c = state.learn[state.lidx];
  $('learn-progress').textContent = `Carte ${state.lidx + 1}/${state.learn.length}`;
  $('learn-level').textContent = scopeLabel();
  $('flash-cat').textContent = c.cat;
  $('flash-term').textContent = c.term;
  $('flash-def').textContent = c.def || 'Relève de : ' + c.cat;
  $('flash-tip').textContent = c.tip ? '💡 ' + c.tip : '';
  $('flash-ex').textContent = c.ex ? '🔎 ' + c.ex : '';
  $('flash-back').classList.add('hidden');
  $('btn-flash-reveal').classList.remove('hidden');
  $('flash-grade').classList.add('hidden');
}
function revealFlash() {
  $('flash-back').classList.remove('hidden');
  $('btn-flash-reveal').classList.add('hidden');
  $('flash-grade').classList.remove('hidden');
}
function gradeFlash(ok) {
  srsUpdate(state.learn[state.lidx].term, ok);
  logDaily(ok);
  if (state.lidx < state.learn.length - 1) { state.lidx++; renderFlash(); }
  else { showView('home'); renderHome(); }
}

// ---------- fiches (référence, consultables par thème via menu déroulant) ----------
// Sélection propre aux Fiches, indépendante du quiz : 'all', une clé de branche,
// ou 'grp:<id>' pour tout un groupe (CISSP, Réf. cyber…).
let fichesSel = 'all';

// Peuple le menu déroulant des fiches (mêmes options que l'accueil).
function renderFichesSelect() {
  const sel = $('fiches-select');
  sel.innerHTML = themeOptionsHtml();
  sel.value = fichesSel;
}

function fichesList() {
  if (fichesSel === 'all') return ALL;
  if (fichesSel.startsWith('grp:')) { const g = groupById(fichesSel.slice(4)); return ALL.filter(c => g.test(c.branch)); }
  return ALL.filter(c => c.branch === fichesSel);
}

function renderFiches() {
  renderFichesSelect();
  const list = fichesList();
  const byCat = {};
  list.forEach(c => { (byCat[c.cat] = byCat[c.cat] || []).push(c); });
  $('fiches-content').innerHTML = Object.entries(byCat).map(([cat, items]) =>
    `<div class="card gram-section"><h3 class="gram-h3">${esc(cat)}</h3>` +
    items.map(c => `<div class="fiche"><div class="fiche-term">${esc(c.term)}</div><div class="fiche-def">${esc(c.def || 'Relève de : ' + c.cat)}</div>` +
      (c.tip ? `<div class="fiche-tip">💡 ${esc(c.tip)}</div>` : '') +
      (c.ex ? `<div class="fiche-ex">🔎 ${esc(c.ex)}</div>` : '') +
      `<a class="fiche-video" data-term="${esc(c.term)}">🎥 Vidéo</a></div>`).join('') +
    `</div>`).join('') || '<div class="card"><div class="mm-source">Aucune fiche.</div></div>';
  $('fiches-content').querySelectorAll('.fiche-video').forEach(a =>
    a.addEventListener('click', () => openExternal(videoSearchUrl(a.dataset.term))));
}

// ---------- ressources (podcasts / vidéos) ----------
// Sélection FR d'abord ; pour les certifs ISC2/EC-Council (peu de contenu FR de
// qualité) on ajoute les meilleures références anglaises. Liens = pages stables.
const RESOURCES = [
  { cat: '🎧 Podcasts cybersécurité (FR)', items: [
    { icon: '🎧', title: 'NoLimitSecu', sub: 'podcast cyber francophone hebdo', url: 'https://www.nolimitsecu.fr/' },
    { icon: '🎧', title: 'Le Comptoir Sécu', sub: 'vulgarisation sécurité (FR)', url: 'https://www.comptoirsecu.fr/podcast/' },
    { icon: '🎧', title: 'Hack’n Speak', sub: 'offensif / pentest (FR)', url: 'https://open.spotify.com/show/2Ns0rF5R7hedYN4dpvGaThD' },
    { icon: '🎧', title: 'Cyber & Vous', sub: 'sensibilisation (FR)', url: 'https://podcasts.apple.com/fr/podcast/cyber-vous/id1519062627' },
  ] },
  { cat: '📺 Chaînes YouTube cyber (FR)', items: [
    { icon: '📺', title: 'Cookie connecté', sub: 'vulgarisation sécurité (FR)', url: 'https://www.youtube.com/@CookieConnecte' },
    { icon: '📺', title: 'Micode', sub: 'hacking / cyber (FR)', url: 'https://www.youtube.com/@Micode' },
    { icon: '📺', title: 'IT-Connect', sub: 'tutos sysadmin & sécurité (FR)', url: 'https://www.youtube.com/@itconnect-fr' },
    { icon: '📺', title: 'Waked XY', sub: 'hacking éthique (FR)', url: 'https://www.youtube.com/@WakedXY' },
  ] },
  { cat: '🇫🇷 Homologation / secret défense', items: [
    { icon: '🏛️', title: 'ANSSI — cyber.gouv.fr', sub: 'IGI 1300, II 901, IGI 2102, guides', url: 'https://cyber.gouv.fr/' },
    { icon: '⚖️', title: 'CNIL — RGPD', sub: 'fiches et vidéos officielles (FR)', url: 'https://www.cnil.fr/fr/comprendre-le-rgpd' },
    { icon: '📺', title: 'CNIL (YouTube)', sub: 'RGPD & protection des données', url: 'https://www.youtube.com/@CNIL' },
  ] },
  { cat: '🎓 Certifications ISC2 (CISSP/SSCP/CCSP/CC)', items: [
    { icon: '📺', title: 'Prabh Nair (EN)', sub: 'CISSP / CC — très pédagogique', url: 'https://www.youtube.com/@Prabhnair1' },
    { icon: '📺', title: 'Inside Cloud and Security (EN)', sub: 'CISSP / CCSP', url: 'https://www.youtube.com/@InsideCloudAndSecurity' },
    { icon: '🎓', title: 'ISC2 — parcours officiels', sub: 'CC gratuit, outlines', url: 'https://www.isc2.org/certifications' },
  ] },
  { cat: '🎯 CEH / offensif', items: [
    { icon: '📺', title: 'Processus Thief (FR)', sub: 'pentest / offensif', url: 'https://www.youtube.com/@ProcessusThief' },
    { icon: '🎓', title: 'EC-Council — CEH', sub: 'programme officiel v13', url: 'https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/' },
    { icon: '📺', title: 'TryHackMe (EN)', sub: 'labs pratiques', url: 'https://www.youtube.com/@TryHackMe' },
  ] },
];

// Ouvre un lien externe (navigateur système en APK, nouvel onglet en PWA).
function openExternal(url) {
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Browser) { cap.Plugins.Browser.open({ url }); return; }
  } catch (e) {}
  window.open(url, '_blank', 'noopener');
}
// Recherche vidéo YouTube (résultats français) pour un concept.
function videoSearchUrl(term) {
  const q = term.replace(/\([^)]*\)/g, '').trim();
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' cybersécurité');
}

function renderResources() {
  const box = $('resources-content');
  const link = (r) => `<a class="res-link" data-url="${esc(r.url)}">${esc(r.icon || '▸')} ${esc(r.title)}<span class="res-sub">${esc(r.sub || '')}</span></a>`;
  box.innerHTML = RESOURCES.map(sec =>
    `<div class="card"><h3 class="gram-h3">${esc(sec.cat)}</h3>${sec.items.map(link).join('')}</div>`
  ).join('');
  box.querySelectorAll('.res-link').forEach(a => a.addEventListener('click', () => openExternal(a.dataset.url)));
}

// ---------- graphiques (canvas, sans dépendance) ----------
function canvasCtx(c, h) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 320;
  c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, w, h);
  return [x, w, h];
}
function roundRect(x, bx, by, bw, bh, r) {
  r = Math.min(r, bw / 2, bh / 2); if (bh <= 0) return;
  x.beginPath();
  x.moveTo(bx + r, by);
  x.arcTo(bx + bw, by, bx + bw, by + bh, r);
  x.arcTo(bx + bw, by + bh, bx, by + bh, r);
  x.arcTo(bx, by + bh, bx, by, r);
  x.arcTo(bx, by, bx + bw, by, r);
  x.closePath();
}
function drawBars(c, labels, values, colors) {
  const [x, w, h] = canvasCtx(c, 170);
  const pad = { l: 6, r: 6, t: 20, b: 22 };
  const max = Math.max(1, ...values);
  const n = values.length || 1;
  const bw = (w - pad.l - pad.r) / n;
  x.font = '11px sans-serif'; x.textAlign = 'center';
  values.forEach((v, i) => {
    const bh = (h - pad.t - pad.b) * (v / max);
    const bx = pad.l + i * bw, by = h - pad.b - bh;
    x.fillStyle = (typeof colors === 'function' ? colors(i, v) : (colors[i] || '#27B3FF'));
    roundRect(x, bx + bw * 0.18, by, bw * 0.64, bh, 4); x.fill();
    if (v) { x.fillStyle = '#EAF2FF'; x.fillText(v, bx + bw / 2, by - 5); }
    x.fillStyle = '#B8C7E3'; x.fillText(labels[i], bx + bw / 2, h - 7);
  });
}
function drawGrouped(c, labels, a, b, colA, colB) {
  const [x, w, h] = canvasCtx(c, 170);
  const pad = { l: 6, r: 6, t: 20, b: 22 };
  const max = Math.max(1, ...a, ...b);
  const n = labels.length || 1;
  const gw = (w - pad.l - pad.r) / n;
  x.font = '10px sans-serif'; x.textAlign = 'center';
  labels.forEach((lab, i) => {
    const gx = pad.l + i * gw;
    [[a[i], colA, 0.20], [b[i], colB, 0.52]].forEach(([v, col, off]) => {
      const bh = (h - pad.t - pad.b) * (v / max);
      const bx = gx + gw * off, by = h - pad.b - bh, bwid = gw * 0.28;
      x.fillStyle = col; roundRect(x, bx, by, bwid, bh, 3); x.fill();
      if (v) { x.fillStyle = '#EAF2FF'; x.fillText(v, bx + bwid / 2, by - 4); }
    });
    x.fillStyle = '#B8C7E3'; x.fillText(lab, gx + gw / 2, h - 7);
  });
}

// ---------- vue Stats ----------
// Abréviation des thèmes pour tenir sous une barre de graphe.
function shortBranch(k) {
  if (/^cissp\d+$/.test(k)) return 'D' + k.replace('cissp', '');
  if (/^sscp\d+$/.test(k)) return 'S' + k.replace('sscp', '');
  if (/^ccsp\d+$/.test(k)) return 'P' + k.replace('ccsp', '');
  if (/^cc\d+$/.test(k)) return 'CC' + k.replace('cc', '');
  if (/^ceh\d+$/.test(k)) return 'CEH';
  if (k.startsWith('ig_')) return k.slice(3, 7);
  return { archi: 'Archi', igi1300: '1300', ii901: '901', igi2102: '2102' }[k] || k.slice(0, 5);
}

function renderStatsView() {
  const srs = getSrs(), p = pool();
  $('stats-scope').textContent = scopeLabel();

  let c = 0, w = 0, seen = 0, mastered = 0;
  const boxes = [0, 0, 0, 0, 0, 0];
  p.forEach(it => {
    const e = srs[it.term];
    if (e && e.seen > 0) {
      seen++; c += e.correct; w += e.wrong;
      boxes[e.box] = (boxes[e.box] || 0) + 1;
      if (e.box >= 4) mastered++;
    }
  });
  const acc = (c + w) ? Math.round(100 * c / (c + w)) : 0;
  const st = loadStats();
  $('stats-summary').innerHTML = [
    ['Quiz', st.done], ['Points', st.points], ['Précision', acc + '%'],
    ['Concepts vus', seen], ['Maîtrisés', mastered], ['Record série', st.bestStreak],
  ].map(([l, v]) => `<div class="stile"><b>${v}</b><span>${l}</span></div>`).join('');

  const act = lastNDays(14);
  drawBars($('chart-activity'), act.map(d => d.day), act.map(d => d.q), '#27B3FF');

  const boxColors = ['#FF6B81', '#27B3FF', '#27B3FF', '#4CE0D2', '#35D07F', '#35D07F'];
  drawBars($('chart-boxes'), ['0', '1', '2', '3', '4', '5'], boxes, (i) => boxColors[i]);

  const keys = Object.keys(DB.branches);
  const vus = keys.map(k => ALL.filter(it => it.branch === k && srs[it.term] && srs[it.term].seen > 0).length);
  const mas = keys.map(k => ALL.filter(it => it.branch === k && srs[it.term] && srs[it.term].box >= 4).length);
  drawGrouped($('chart-branches'), keys.map(shortBranch), vus, mas, '#27B3FF', '#35D07F');
}

// ---------- feux d'artifice (quiz parfait) ----------
function launchFireworks() {
  let c = document.getElementById('fx-canvas');
  if (!c) { c = document.createElement('canvas'); c.id = 'fx-canvas'; document.body.appendChild(c); }
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const colors = ['#FF3B5C', '#27B3FF', '#35D07F', '#FFD166', '#B15CFF', '#4CE0D2', '#FF9F43', '#FF6BD6', '#FFFFFF'];
  let parts = [];
  function burst(bx, by, big) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    const n = big ? 180 + Math.floor(Math.random() * 90) : 100 + Math.floor(Math.random() * 60);
    const power = big ? 9.5 : 6.5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.35 + Math.random()) * power;
      parts.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.018 + Math.random() * 0.022, col, r: 2 + Math.random() * 2.8 });
    }
    parts.push({ flash: true, x: bx, y: by, life: 1, decay: 0.13, col, r: big ? 110 : 70 });
  }
  const t0 = performance.now();
  let last = 0, finale = false;
  function frame(t) {
    const el = t - t0;
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgba(6,16,28,0.22)'; x.fillRect(0, 0, W, H);
    if (el < 1100 && t - last > 190) { last = t; burst(W * (0.12 + Math.random() * 0.76), H * (0.12 + Math.random() * 0.42), Math.random() < 0.4); }
    if (!finale && el > 1100) { finale = true; for (let k = 0; k < 6; k++) burst(W * (0.18 + Math.random() * 0.64), H * (0.15 + Math.random() * 0.45), true); }
    x.globalCompositeOperation = 'lighter';
    parts.forEach(p => {
      if (p.flash) {
        p.life -= p.decay;
        const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,' + Math.max(0, p.life * 0.55) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
        return;
      }
      p.vy += 0.055; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      x.globalAlpha = Math.max(0, p.life);
      x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
    });
    x.globalAlpha = 1;
    parts = parts.filter(p => p.life > 0);
    if (el < 2000) requestAnimationFrame(frame);
    else c.remove();
  }
  requestAnimationFrame(frame);
}

// ---------- gestionnaire de concepts ----------
function updateConceptBadge() {
  const d = getDisabled(), el = $('concept-badge');
  if (el) el.textContent = d.size > 0 ? d.size : '';
}

function renderConceptManager() {
  const disabled = getDisabled();
  const search = ($('concept-search').value || '').toLowerCase();
  const src = search ? ALL.filter(c =>
    c.term.toLowerCase().includes(search) ||
    (c.def || '').toLowerCase().includes(search) ||
    c.cat.toLowerCase().includes(search)) : ALL;

  const byBranch = {};
  src.forEach(c => { (byBranch[c.branch] = byBranch[c.branch] || []).push(c); });

  $('concept-list').innerHTML = Object.entries(byBranch).map(([branch, items]) =>
    `<div class="concept-branch-head">${esc(branchLabel(branch))}</div>` +
    items.map(c => {
      const off = disabled.has(c.term);
      return `<div class="concept-row"><div class="concept-info"><div class="concept-term">${esc(c.term)}</div><div class="concept-cat">${esc(c.cat)}</div></div><button class="concept-toggle ${off ? 'toggle-off' : 'toggle-on'}" data-term="${esc(c.term)}">${off ? 'Désactivé' : 'Actif'}</button></div>`;
    }).join('')
  ).join('');

  $('concept-list').querySelectorAll('.concept-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = getDisabled(), term = btn.dataset.term;
      if (d.has(term)) d.delete(term); else d.add(term);
      saveDisabled(d); updateConceptBadge(); renderConceptManager();
    });
  });

  const dis = getDisabled().size;
  $('concept-count').textContent = `${ALL.length - dis} actifs · ${dis} désactivés`;
}

// ---------- classement temps réel ----------
function renderLeaderboard(rows, myPseudo) {
  const MEDALS = ['🥇','🥈','🥉'];
  $('leaderboard-rows').innerHTML = rows.length
    ? rows.map((r, i) =>
        `<div class="lb-row${r.pseudo === myPseudo ? ' lb-me' : ''}">` +
        `<span class="lb-rank">${MEDALS[i] || '#'+(i+1)}</span>` +
        `<span class="lb-pseudo">${esc(r.pseudo)}</span>` +
        `<span class="lb-score">${r.score}/${r.total}</span>` +
        `<span class="lb-pct">${r.pct}%</span>` +
        `</div>`).join('')
    : '<p class="mm-source" style="margin:10px 0">En attente des autres joueurs…</p>';
}

// ---------- défi multijoueur ----------
let _challengeSeed = 0;

function valueToScope(v) {
  if (CHALLENGE_SCOPES.includes(v)) return v;
  const g = groupOf(v);
  return g ? 'grp:' + g.id : 'all';
}

function refreshChallengeCode() {
  const v = $('challenge-theme-select').value;
  const scope = valueToScope(v);
  const count = state.count;
  const qtype = state.qtype;
  const code = encodeChallenge(scope, count, qtype, _challengeSeed) || '—';
  $('challenge-code').textContent = code;
  const qtypeLabel = { mix: 'Mélange', def: 'Terme→déf.', term: 'Déf.→terme', situation: 'Mise en situation', cat: 'Catégorie' }[qtype] || qtype;
  const fireReady = window.FirebaseChallenge && FirebaseChallenge.isReady();
  $('challenge-scope-info').textContent = challengeScopeLabel(scope) + ' · ' + (count || 'Tout') + ' questions · ' + qtypeLabel +
    (fireReady ? ' · 🟢 classement en direct' : ' · ⚫ classement hors ligne');
  $('challenge-modal')._challenge = { scope, count, qtype, seed: _challengeSeed, code };
}

function openChallengeModal() {
  _challengeSeed = (Math.random() * 0x100000000) >>> 0;
  const sel = $('challenge-theme-select');
  sel.innerHTML = themeOptionsHtml();
  sel.value = scopeToSelectValue();
  if (!sel.value) sel.value = 'all';
  refreshChallengeCode();
  $('challenge-error').classList.add('hidden');
  $('challenge-code-input').value = '';
  $('challenge-modal').classList.remove('hidden');
}

// ---------- signalements & reformulation ----------
let _flagTerm = '', _flagPromptLabel = '';

function openFlagModal(term, promptLabel) {
  _flagTerm = term; _flagPromptLabel = promptLabel || '';
  $('flag-concept-label').textContent = '« ' + term + ' »' + (promptLabel ? ' — ' + promptLabel : '');
  document.querySelectorAll('.flag-type-chip').forEach(c => c.classList.remove('active'));
  $('flag-note').value = '';
  $('flag-modal').classList.remove('hidden');
}

function renderFlagsManager() {
  const flags = getFlags();
  const ov = getOverrides();
  const open = Object.entries(flags).filter(([, v]) => v.status === 'open');
  $('flags-open-count').textContent = open.length;
  if (!open.length) {
    $('flags-list').innerHTML = '<p class="mm-source" style="padding:12px 0">Aucun signalement en cours. 🎉</p>';
    return;
  }
  const TYPE_LABELS = { floue: '📝 Formulation floue', rep: '❌ Mauvaise réponse', ex: '🔎 Exemple trompeur', autre: '💬 Autre' };
  $('flags-list').innerHTML = open.map(([term, flag]) => {
    const c = BYTERM[term] || {};
    const curDef = (ov[term] && ov[term].def !== undefined ? ov[term].def : c.def) || '';
    const curEx  = (ov[term] && ov[term].ex  !== undefined ? ov[term].ex  : c.ex)  || '';
    const curTip = (ov[term] && ov[term].tip !== undefined ? ov[term].tip : c.tip) || '';
    return `<div class="flag-item" data-term="${esc(term)}">
      <div class="flag-item-head">
        <span class="flag-item-term">${esc(term)}</span>
        <span class="flag-item-typelabel">${TYPE_LABELS[flag.type] || flag.type || ''}</span>
      </div>
      ${flag.promptLabel ? `<p class="flag-ctx">${esc(flag.promptLabel)}</p>` : ''}
      ${flag.note ? `<p class="flag-note-display">💬 ${esc(flag.note)}</p>` : ''}
      ${curDef ? `<label class="flag-field-label">Définition</label><textarea class="flag-textarea" data-field="def" rows="2">${esc(curDef)}</textarea>` : ''}
      ${curEx  ? `<label class="flag-field-label">Exemple / situation</label><textarea class="flag-textarea" data-field="ex" rows="2">${esc(curEx)}</textarea>` : ''}
      ${curTip ? `<label class="flag-field-label">Conseil</label><textarea class="flag-textarea" data-field="tip" rows="2">${esc(curTip)}</textarea>` : ''}
      <div class="flag-item-actions">
        <button class="ghost flag-save-btn">💾 Sauvegarder</button>
        <button class="chip flag-resolve-btn">✓ Résolu</button>
      </div>
    </div>`;
  }).join('<hr class="flag-sep" />');

  $('flags-list').querySelectorAll('.flag-save-btn').forEach(btn => {
    const item = btn.closest('.flag-item');
    btn.addEventListener('click', () => {
      const term = item.dataset.term;
      const o = getOverrides(); o[term] = o[term] || {};
      item.querySelectorAll('.flag-textarea').forEach(ta => { o[term][ta.dataset.field] = ta.value.trim(); });
      saveOverrides(o);
      if (BYTERM[term]) Object.assign(BYTERM[term], o[term]);
      btn.textContent = '✅ Sauvegardé';
      setTimeout(() => { btn.textContent = '💾 Sauvegarder'; }, 2000);
    });
  });

  $('flags-list').querySelectorAll('.flag-resolve-btn').forEach(btn => {
    const item = btn.closest('.flag-item');
    btn.addEventListener('click', () => {
      const f = getFlags(); const term = item.dataset.term;
      if (f[term]) { f[term].status = 'resolved'; saveFlags(f); }
      updateFlagBadge(); renderFlagsManager();
    });
  });
}

function startChallengeSession(challenge, code) {
  state.branches.clear();
  if (challenge.scope.startsWith('grp:')) {
    const g = groupById(challenge.scope.slice(4));
    if (g) groupKeys(g).forEach(k => state.branches.add(k));
  } else if (challenge.scope !== 'all') {
    state.branches.add(challenge.scope);
  }
  state.count = challenge.count;
  state.qtype = challenge.qtype;
  state.challenge = { seed: challenge.seed, code };
  state.examMode = false;
  state.mode = 'srs';
  state.questions = buildSession();
  if (!state.questions.length) { state.challenge = null; alert('Aucun concept disponible pour ce défi.'); return; }
  state.answers = []; state.index = 0;
  studying = true; pomoStart();
  $('challenge-modal').classList.add('hidden');
  showView('quiz');
  stopExamTimer();
  renderQuestion();
}

// ---------- câblage ----------
$('home-select').addEventListener('change', (e) => selectHomeTheme(e.target.value));
$('btn-fab-home').addEventListener('click', exitToHome);
$('btn-stats').addEventListener('click', () => { showView('stats'); renderStatsView(); });
$('btn-stats-home').addEventListener('click', exitToHome);
window.addEventListener('resize', () => { if (!views.stats.classList.contains('hidden')) renderStatsView(); });
document.querySelectorAll('.qtype-chip').forEach(c => c.addEventListener('click', () => { state.qtype = c.dataset.qtype; renderChips('.qtype-chip', state.qtype, 'qtype'); }));
document.querySelectorAll('.count-chip').forEach(c => c.addEventListener('click', () => { state.count = +c.dataset.count; renderChips('.count-chip', state.count, 'count'); }));

function exitToHome() {
  clearTimeout(autoNextTimer); clearQTimer(); stopExamTimer(); studying = false; pomoStop();
  state.challenge = null;
  if (window.FirebaseChallenge) FirebaseChallenge.removeListener();
  showView('home'); renderHome();
}
$('btn-start').addEventListener('click', () => startSession('srs'));
$('btn-review').addEventListener('click', () => startSession('review'));
$('btn-next').addEventListener('click', goNext);
$('btn-abort').addEventListener('click', exitToHome);
$('btn-replay').addEventListener('click', () => startSession(state.mode));
$('btn-home').addEventListener('click', exitToHome);
$('btn-learn').addEventListener('click', startLearn);
$('btn-flash-reveal').addEventListener('click', revealFlash);
$('btn-flash-ok').addEventListener('click', () => gradeFlash(true));
$('btn-flash-again').addEventListener('click', () => gradeFlash(false));
$('btn-learn-home').addEventListener('click', exitToHome);
$('btn-fiches').addEventListener('click', () => {
  // pré-sélectionne le thème du quiz : une branche unique, un groupe entier, sinon Tout
  const sel = [...state.branches];
  if (sel.length === 1) fichesSel = sel[0];
  else { const g = sel.length && GROUPS.find(gr => sel.every(gr.test) && sel.length === Object.keys(DB.branches).filter(gr.test).length); fichesSel = g ? 'grp:' + g.id : 'all'; }
  renderFiches(); showView('fiches');
});
$('fiches-select').addEventListener('change', (e) => { fichesSel = e.target.value; renderFiches(); window.scrollTo(0, 0); });
$('btn-fiches-home').addEventListener('click', exitToHome);
$('btn-resources').addEventListener('click', () => { renderResources(); showView('resources'); });
$('btn-resources-home').addEventListener('click', exitToHome);

const optExam = $('opt-exammode');
optExam.addEventListener('change', () => { state.examMode = optExam.checked; });

const conceptModal = $('concept-modal');
$('btn-concepts').addEventListener('click', () => { conceptModal.classList.remove('hidden'); renderConceptManager(); });
$('concept-modal-close').addEventListener('click', () => { conceptModal.classList.add('hidden'); renderHome(); });
conceptModal.addEventListener('click', (e) => { if (e.target === conceptModal) { conceptModal.classList.add('hidden'); renderHome(); } });
$('concept-search').addEventListener('input', renderConceptManager);
$('btn-enable-all').addEventListener('click', () => { saveDisabled(new Set()); updateConceptBadge(); renderConceptManager(); });
$('btn-disable-branch').addEventListener('click', () => {
  const d = getDisabled();
  (state.branches.size ? ALL.filter(c => state.branches.has(c.branch)) : ALL).forEach(c => d.add(c.term));
  saveDisabled(d); updateConceptBadge(); renderConceptManager();
});

$('btn-challenge').addEventListener('click', openChallengeModal);
$('challenge-modal-close').addEventListener('click', () => $('challenge-modal').classList.add('hidden'));
$('challenge-modal').addEventListener('click', (e) => { if (e.target === $('challenge-modal')) $('challenge-modal').classList.add('hidden'); });
$('btn-copy-code').addEventListener('click', async () => {
  const code = $('challenge-code').textContent;
  try {
    await navigator.clipboard.writeText(code);
    const btn = $('btn-copy-code'); btn.textContent = '✅ Copié';
    setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000);
  } catch (e) {}
});
$('btn-whatsapp-code').addEventListener('click', () => {
  const code = $('challenge-code').textContent;
  const info = $('challenge-scope-info').textContent;
  const text = `⚔️ Défi Quizz Révision\nCode : ${code}\n(${info})\nRelève le défi !`;
  openExternal('https://wa.me/?text=' + encodeURIComponent(text));
});
$('challenge-theme-select').addEventListener('change', refreshChallengeCode);
$('btn-start-my-challenge').addEventListener('click', () => {
  const ch = $('challenge-modal')._challenge;
  if (ch) startChallengeSession(ch, ch.code);
});
$('btn-join-challenge').addEventListener('click', () => {
  const raw = $('challenge-code-input').value.trim();
  const ch = decodeChallenge(raw);
  if (!ch) { $('challenge-error').classList.remove('hidden'); return; }
  $('challenge-error').classList.add('hidden');
  startChallengeSession(ch, raw.toUpperCase().replace(/[^0-9A-F]/g, '').replace(/(.{5})(.{5})/, '$1-$2'));
});
$('btn-share-result').addEventListener('click', async () => {
  const text = ($('btn-share-result').dataset.shareText || '').trim();
  if (navigator.share) { try { await navigator.share({ title: 'Défi Quizz Révision', text }); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(text); } catch (e) {}
});

// Signalements
$('btn-flags').addEventListener('click', () => { renderFlagsManager(); $('flags-modal').classList.remove('hidden'); });
$('flags-modal-close').addEventListener('click', () => $('flags-modal').classList.add('hidden'));
$('flags-modal').addEventListener('click', (e) => { if (e.target === $('flags-modal')) $('flags-modal').classList.add('hidden'); });
$('flag-modal-close').addEventListener('click', () => $('flag-modal').classList.add('hidden'));
$('flag-modal').addEventListener('click', (e) => { if (e.target === $('flag-modal')) $('flag-modal').classList.add('hidden'); });
document.querySelectorAll('.flag-type-chip').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.flag-type-chip').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
}));
$('btn-flag-submit').addEventListener('click', () => {
  const typeChip = document.querySelector('.flag-type-chip.active');
  const type = typeChip ? typeChip.dataset.type : 'autre';
  const note = $('flag-note').value.trim();
  const f = getFlags();
  f[_flagTerm] = { type, note, promptLabel: _flagPromptLabel, ts: Date.now(), status: 'open' };
  saveFlags(f); updateFlagBadge();
  $('flag-modal').classList.add('hidden');
  const btn = $('btn-flag-submit'); btn.textContent = '✅ Signalé !';
  setTimeout(() => { btn.textContent = 'Signaler'; }, 1800);
});

function bindToggle(id, key, after) { const el = $(id); el.checked = settings[key]; el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); if (after) after(); }); }
bindToggle('opt-autonext', 'autoNext');
bindToggle('opt-sound', 'sound');
bindToggle('opt-counts', 'showCounts', renderBranchSelect);
bindToggle('opt-close', 'closeDistractors');
bindToggle('opt-timer', 'timer');
bindToggle('opt-pomodoro', 'pomodoro', () => { if (settings.pomodoro) pomoStart(); else pomoStop(); });

const pseudoInput = $('pseudo-input');
pseudoInput.value = getPseudo();
pseudoInput.addEventListener('change', () => {
  const v = pseudoInput.value.replace(/[^\w\-À-ÿ]/g, '').slice(0, 20).trim();
  const final = v || genPseudo();
  lsSet('quizrev:pseudo:v1', final);
  pseudoInput.value = final;
});

const settingsModal = $('settings-modal');
$('app-version').textContent = 'v' + (window.APP_VERSION || '?');
$('home-version').textContent = 'Version ' + (window.APP_VERSION || '?');
$('btn-check-update').addEventListener('click', async () => {
  const btn = $('btn-check-update'), out = $('update-status');
  if (!window.UpdateCheck) { out.textContent = 'Vérificateur indisponible.'; return; }
  btn.disabled = true; out.textContent = '⏳ Vérification…';
  try {
    // force : ignore le throttle de 6 h et une version précédemment ignorée
    const r = await window.UpdateCheck.check(true);
    out.textContent = r.status === 'update'
      ? '🆕 Version v' + r.version + ' disponible — voir la bannière en bas.'
      : '✅ À jour (v' + r.version + ').';
  } catch (e) {
    out.textContent = '❌ Échec : ' + ((e && e.message) || e);
  }
  btn.disabled = false;
});
$('btn-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
$('settings-close').addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });
$('btn-reset').addEventListener('click', () => {
  if (confirm('Réinitialiser progression, stats et erreurs ?')) {
    ['quizrev:stats:v1', 'quizrev:wrong:v1', 'quizrev:srs:v1', 'quizrev:daily:v1', 'quizrev:disabled:v1'].forEach(k => localStorage.removeItem(k));
    settingsModal.classList.add('hidden'); updateConceptBadge(); renderHome();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- démarrage ----------
(async function init() {
  const empty = { branches: {}, concepts: [] };
  const [base, cissp, isc2, ceh, ignite, scen] = await Promise.all([
    (await fetch('data/secu_concepts.json')).json(),
    (await fetch('data/cissp_concepts.json')).json().catch(() => empty),
    (await fetch('data/isc2_concepts.json')).json().catch(() => empty),
    (await fetch('data/ceh_concepts.json')).json().catch(() => empty),
    (await fetch('data/ignite_concepts.json')).json().catch(() => empty),
    (await fetch('data/scenarios.json')).json().catch(() => ({})),
  ]);
  // Chaque source (homologation, CISSP, SSCP/CCSP/CC, CEH, mind maps Ignite) apporte
  // ses thèmes ; tous sont traités à l'identique par le quiz, les flashcards et le Leitner.
  const srcs = [base, cissp, isc2, ceh, ignite];
  DB = {
    branches: Object.assign({}, ...srcs.map(s => s.branches)),
    concepts: [].concat(...srcs.map(s => s.concepts)),
  };
  ALL = DB.concepts;
  const normEx = (t) => t.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();

  // Remplissage des définitions manquantes : un concept sans `def` hérite de la
  // définition d'un homonyme défini ailleurs (ex. « Confidentiality » côté CISSP
  // reprend la définition écrite côté CC). Complété par data/cissp_defs.json.
  const defByNorm = {};
  ALL.forEach(c => { if (c.def && !defByNorm[normEx(c.term)]) defByNorm[normEx(c.term)] = c.def; });
  const authored = await (await fetch('data/cissp_defs.json')).json().catch(() => ({}));
  Object.entries(authored).forEach(([k, v]) => { defByNorm[k] = v; });   // rédigé > hérité
  ALL.forEach(c => { if (!c.def && defByNorm[normEx(c.term)]) c.def = defByNorm[normEx(c.term)]; });

  // Scénarios (« mises en situation ») rattachés par terme normalisé : un concept
  // doté d'un `ex` débloque la question de mise en situation. On n'applique un
  // scénario que si sa langue correspond à celle du thème — un thème français
  // (homologation, Réf. cyber) ne reçoit pas un scénario anglais, et inversement.
  const branchLang = (b) => (b === 'archi' || b === 'igi1300' || b === 'ii901' || b === 'igi2102' || b.startsWith('ig_')) ? 'fr' : 'en';
  ALL.forEach(c => {
    const s = scen[normEx(c.term)];
    if (!c.ex && s && s.lang === branchLang(c.branch)) c.ex = s.ex;
  });
  CATS = uniq(ALL.map(c => c.cat));
  ALL.forEach(c => { BYTERM[c.term] = c; });
  applyOverrides();
  renderBranchSelect();
  renderChips('.qtype-chip', state.qtype, 'qtype');
  renderChips('.count-chip', state.count, 'count');
  updateConceptBadge();
  renderHome();
})();
