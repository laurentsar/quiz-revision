'use strict';

// Quizz Révision — questions GÉNÉRÉES à la volée depuis une base de concepts,
// avec répétition espacée (Leitner), mode Apprendre (flashcards),
// distracteurs ciblés (confusions / même catégorie) et feedback enrichi.

const OPTION_COUNT = 4;
const BOX_DAYS = [0, 1, 3, 7, 16, 30];   // Leitner : box -> jours avant réapparition
const MAX_BOX = BOX_DAYS.length - 1;     // box >= 4 = maîtrisé
const DAY = 86400000;

const state = {
  branches: new Set(),   // vide = tous les thèmes ; sinon clés de branche concrètes
  qtype: 'mix',       // 'mix' | 'def' | 'term' | 'situation' | 'cat'
  count: 10,          // 0 = tout
  mode: 'srs',        // 'srs' | 'review'
  questions: [], answers: [], index: 0,
  learn: [], lidx: 0,
};

let DB = null, ALL = [], CATS = [], BYTERM = {};

// Groupes de thèmes : une chip parent repliée + le détail des membres à la demande.
// id = identifiant de la chip parent ; test() reconnaît les clés de branche membres.
const GROUPS = [
  { id: 'cissp', label: 'CISSP', color: '#4CE0D2', test: (k) => /^cissp\d+$/.test(k) },
  { id: 'sscp', label: 'SSCP', color: '#35D07F', test: (k) => /^sscp\d+$/.test(k) },
  { id: 'ccsp', label: 'CCSP', color: '#27B3FF', test: (k) => /^ccsp\d+$/.test(k) },
  { id: 'cc', label: 'CC (ISC2)', color: '#FF9F43', test: (k) => /^cc\d+$/.test(k) },
  { id: 'ceh', label: 'CEH', color: '#FF6B81', test: (k) => /^ceh\d+$/.test(k) },
  { id: 'ignite', label: 'Réf. cyber', color: '#B15CFF', test: (k) => /^ig_/.test(k) },
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

const settings = Object.assign({ autoNext: true, sound: true, showCounts: false, closeDistractors: false }, lsGet('quizrev:settings:v1', {}));

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
function uniq(a) { return [...new Set(a)]; }
function uniqKeepFirst(a) { const s = new Set(), o = []; a.forEach(v => { if (v != null && !s.has(v)) { s.add(v); o.push(v); } }); return o; }
const $ = (id) => document.getElementById(id);
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Sélection vide = pas de filtre (tout le corpus).
function pool() {
  return state.branches.size ? ALL.filter(c => state.branches.has(c.branch)) : ALL;
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
    const types = hasDef(concept) ? ['def', 'term', 'situation'] : [];
    if (CATS.length >= OPTION_COUNT) types.push('cat');
    type = types[Math.floor(Math.random() * types.length)] || 'cat';
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
const views = { home: $('view-home'), quiz: $('view-quiz'), result: $('view-result'), fiches: $('view-fiches'), learn: $('view-learn'), mindmap: $('view-mindmap'), stats: $('view-stats') };
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

// Thèmes en chips multi-sélection. Chaque groupe (CISSP, Réf. cyber) est réduit à
// une chip parent ; le détail de ses membres n'apparaît que si le groupe est actif.
function renderBranchSelect() {
  const row = $('branch-row'), sub = $('cissp-row');
  const nb = (k) => ALL.filter(c => c.branch === k).length;
  const label = (l, n) => esc(l) + (settings.showCounts ? ` (${n})` : '');   // compteur optionnel
  const chip = (cls, key, l, n, on) =>
    `<button class="chip ${cls}${on ? ' active' : ''}" data-branch="${key}">${label(l, n)}</button>`;

  const plain = Object.entries(DB.branches).filter(([k]) => !groupOf(k));
  let rowHtml = plain.map(([k, l]) => chip('branch-chip', k, l, nb(k), state.branches.has(k))).join('');
  GROUPS.forEach(g => {
    const keys = groupKeys(g);
    if (keys.length) rowHtml += chip('branch-chip', 'grp:' + g.id, g.label, keys.reduce((n, k) => n + nb(k), 0), groupActive(g));
  });
  row.innerHTML = rowHtml;

  // sous-rangée : membres des groupes actifs
  let subHtml = '';
  GROUPS.forEach(g => {
    if (!groupActive(g)) return;
    subHtml += groupKeys(g).map(k => chip('sub-chip', k, DB.branches[k], nb(k), state.branches.has(k))).join('');
  });
  sub.innerHTML = subHtml;
  sub.classList.toggle('hidden', !subHtml);

  row.querySelectorAll('.branch-chip').forEach(c => c.addEventListener('click', () => toggleBranch(c.dataset.branch)));
  sub.querySelectorAll('.sub-chip').forEach(c => c.addEventListener('click', () => toggleBranch(c.dataset.branch)));
}

// Une chip « grp:<id> » bascule tous les membres du groupe d'un bloc.
function toggleBranch(key) {
  if (key.startsWith('grp:')) {
    const g = groupById(key.slice(4));
    if (groupActive(g)) groupKeys(g).forEach(k => state.branches.delete(k));
    else groupKeys(g).forEach(k => state.branches.add(k));
  } else if (state.branches.has(key)) {
    state.branches.delete(key);
  } else {
    state.branches.add(key);
  }
  renderBranchSelect(); renderHome();
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
}

// ---------- déroulé du quiz ----------
function startSession(mode) {
  state.mode = mode;
  state.questions = buildSession();
  if (!state.questions.length) return;
  state.answers = []; state.index = 0;
  showView('quiz'); renderQuestion();
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
    let html = `<div class="fb-head">${a.correct ? '✅ Correct' : '❌ Faux'}</div>`;
    html += `<div class="fb-line">📌 ${esc(q.reminder)}</div>`;
    if (q.tip) html += `<div class="fb-line tip">💡 ${esc(q.tip)}</div>`;
    if (q.ex) html += `<div class="fb-line ex">🔎 ${esc(q.ex)}</div>`;
    fb.innerHTML = html;
    fb.className = 'feedback show ' + (a.correct ? 'good' : 'bad');
  } else { fb.innerHTML = ''; fb.className = 'feedback'; }

  const next = $('btn-next');
  next.disabled = !a;
  next.textContent = state.index < state.questions.length - 1 ? 'Suivant' : 'Voir le score';
}

function selectOption(idx) {
  if (state.answers[state.index]) return;
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
  showView('result');
  if (perfect && total >= 3) launchFireworks();
}

// ---------- mode Apprendre (flashcards) ----------
function startLearn() {
  state.learn = pickConcepts('srs');
  if (state.count > 0) state.learn = state.learn.slice(0, state.count);
  if (!state.learn.length) return;
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

// ---------- fiches (référence) ----------
function renderFiches() {
  const list = pool();
  $('fiches-crumb').textContent = scopeLabel();
  const byCat = {};
  list.forEach(c => { (byCat[c.cat] = byCat[c.cat] || []).push(c); });
  $('fiches-content').innerHTML = Object.entries(byCat).map(([cat, items]) =>
    `<div class="card gram-section"><h3 class="gram-h3">${esc(cat)}</h3>` +
    items.map(c => `<div class="fiche"><div class="fiche-term">${esc(c.term)}</div><div class="fiche-def">${esc(c.def || 'Relève de : ' + c.cat)}</div>` +
      (c.tip ? `<div class="fiche-tip">💡 ${esc(c.tip)}</div>` : '') +
      (c.ex ? `<div class="fiche-ex">🔎 ${esc(c.ex)}</div>` : '') + `</div>`).join('') +
    `</div>`).join('');
}

// ---------- mind maps CISSP ----------
// Arbre issu de yyds-page/cissp-mind-map (GPL-3.0), converti par tools/build_cissp_mindmap.py.
// Chargé à la demande (156 Ko) : inutile de le payer au démarrage du quiz.
const MM = { data: null, domain: 0, query: '' };
const MM_SEARCH_MIN = 3;

async function loadMindmap() {
  if (MM.data) return MM.data;
  MM.data = await (await fetch('data/cissp_mindmap.json')).json();
  return MM.data;
}

function mmShortTitle(t) { return t.replace(/^Domain\s+\d+\.\s*/i, ''); }

function mmNodeHtml(node, depth) {
  const kids = node.c || [];
  if (!kids.length) return `<div class="mm-leaf">${esc(node.t)}</div>`;
  // Seul le 1er niveau est ouvert : au-delà l'arbre est trop dense sur mobile.
  const open = depth === 0 ? ' open' : '';
  return `<details class="mm-node mm-d${Math.min(depth, 3)}"${open}>` +
    `<summary>${esc(node.t)}<span class="mm-count">${kids.length}</span></summary>` +
    `<div class="mm-children">${kids.map(k => mmNodeHtml(k, depth + 1)).join('')}</div>` +
    `</details>`;
}

// Recherche : parcours complet, on garde le chemin pour situer chaque résultat.
function mmSearch(q) {
  const needle = q.toLowerCase();
  const hits = [];
  const walk = (node, path, domain) => {
    if (node.t.toLowerCase().includes(needle)) hits.push({ t: node.t, path, domain, leaf: !node.c });
    (node.c || []).forEach(k => walk(k, path.concat(node.t), domain));
    return hits;
  };
  MM.data.domains.forEach(d => (d.c || []).forEach(k => walk(k, [], d.t)));
  return hits;
}

function mmHighlight(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

function renderMindmap() {
  const box = $('mm-content'), chips = $('mm-domains');
  $('mm-source').textContent = 'Source : ' + MM.data.source;

  chips.innerHTML = MM.data.domains.map((d, i) =>
    `<button class="chip mm-chip${i === MM.domain && !MM.query ? ' active' : ''}" data-mm="${i}">${esc(mmShortTitle(d.t))}</button>`
  ).join('');
  chips.querySelectorAll('.mm-chip').forEach(c => c.addEventListener('click', () => {
    MM.domain = +c.dataset.mm; MM.query = ''; $('mm-search').value = '';
    renderMindmap(); window.scrollTo(0, 0);
  }));

  if (MM.query.length >= MM_SEARCH_MIN) {
    const hits = mmSearch(MM.query);
    $('mm-crumb').textContent = hits.length + ' résultat' + (hits.length > 1 ? 's' : '');
    box.innerHTML = hits.length
      ? `<div class="card">${hits.slice(0, 200).map(h =>
          `<div class="mm-hit"><div class="mm-hit-t">${mmHighlight(h.t, MM.query)}</div>` +
          `<div class="mm-hit-p">${esc(mmShortTitle(h.domain))}${h.path.length ? ' › ' + esc(h.path.join(' › ')) : ''}</div></div>`
        ).join('')}${hits.length > 200 ? '<div class="mm-hit-p">… ' + (hits.length - 200) + ' de plus, affine la recherche</div>' : ''}</div>`
      : '<div class="card"><div class="mm-hit-p">Aucun résultat</div></div>';
    return;
  }

  const d = MM.data.domains[MM.domain];
  $('mm-crumb').textContent = mmShortTitle(d.t);
  box.innerHTML = `<div class="card mm-tree"><h3 class="gram-h3">${esc(mmShortTitle(d.t))}</h3>` +
    (d.c || []).map(k => mmNodeHtml(k, 0)).join('') + '</div>';
}

async function openMindmap() {
  $('mm-content').innerHTML = '<div class="card"><div class="mm-hit-p">Chargement…</div></div>';
  showView('mindmap');
  try {
    await loadMindmap();
    renderMindmap();
  } catch (e) {
    $('mm-content').innerHTML = '<div class="card"><div class="mm-hit-p">Mind maps indisponibles hors ligne (première ouverture nécessite le réseau).</div></div>';
  }
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

// ---------- câblage ----------
$('btn-branch-all').addEventListener('click', () => {
  Object.keys(DB.branches).forEach(k => state.branches.add(k));
  renderBranchSelect(); renderHome();
});
$('btn-branch-none').addEventListener('click', () => {
  state.branches.clear();                  // vide = tout le corpus
  renderBranchSelect(); renderHome();
});
$('btn-fab-home').addEventListener('click', exitToHome);
$('btn-stats').addEventListener('click', () => { showView('stats'); renderStatsView(); });
$('btn-stats-home').addEventListener('click', exitToHome);
window.addEventListener('resize', () => { if (!views.stats.classList.contains('hidden')) renderStatsView(); });
document.querySelectorAll('.qtype-chip').forEach(c => c.addEventListener('click', () => { state.qtype = c.dataset.qtype; renderChips('.qtype-chip', state.qtype, 'qtype'); }));
document.querySelectorAll('.count-chip').forEach(c => c.addEventListener('click', () => { state.count = +c.dataset.count; renderChips('.count-chip', state.count, 'count'); }));

function exitToHome() { clearTimeout(autoNextTimer); showView('home'); renderHome(); }
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
$('btn-fiches').addEventListener('click', () => { renderFiches(); showView('fiches'); });
$('btn-fiches-home').addEventListener('click', exitToHome);
$('btn-mindmap').addEventListener('click', openMindmap);
$('btn-mindmap-home').addEventListener('click', exitToHome);

let mmDebounce = null;
$('mm-search').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(mmDebounce);
  mmDebounce = setTimeout(() => {
    // < 3 caractères : on retombe sur l'arbre du domaine courant
    if (q.length && q.length < MM_SEARCH_MIN) return;
    MM.query = q;
    if (MM.data) renderMindmap();
  }, 180);
});

function bindToggle(id, key, after) { const el = $(id); el.checked = settings[key]; el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); if (after) after(); }); }
bindToggle('opt-autonext', 'autoNext');
bindToggle('opt-sound', 'sound');
bindToggle('opt-counts', 'showCounts', renderBranchSelect);
bindToggle('opt-close', 'closeDistractors');

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
    ['quizrev:stats:v1', 'quizrev:wrong:v1', 'quizrev:srs:v1', 'quizrev:daily:v1'].forEach(k => localStorage.removeItem(k));
    settingsModal.classList.add('hidden'); renderHome();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- démarrage ----------
(async function init() {
  const empty = { branches: {}, concepts: [] };
  const [base, cissp, isc2, ceh, ignite] = await Promise.all([
    (await fetch('data/secu_concepts.json')).json(),
    (await fetch('data/cissp_concepts.json')).json().catch(() => empty),
    (await fetch('data/isc2_concepts.json')).json().catch(() => empty),
    (await fetch('data/ceh_concepts.json')).json().catch(() => empty),
    (await fetch('data/ignite_concepts.json')).json().catch(() => empty),
  ]);
  // Chaque source (homologation, CISSP, SSCP/CCSP/CC, CEH, mind maps Ignite) apporte
  // ses thèmes ; tous sont traités à l'identique par le quiz, les flashcards et le Leitner.
  const srcs = [base, cissp, isc2, ceh, ignite];
  DB = {
    branches: Object.assign({}, ...srcs.map(s => s.branches)),
    concepts: [].concat(...srcs.map(s => s.concepts)),
  };
  ALL = DB.concepts;
  CATS = uniq(ALL.map(c => c.cat));
  ALL.forEach(c => { BYTERM[c.term] = c; });
  renderBranchSelect();
  renderChips('.qtype-chip', state.qtype, 'qtype');
  renderChips('.count-chip', state.count, 'count');
  renderHome();
})();
