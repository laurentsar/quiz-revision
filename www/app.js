'use strict';

// Quizz Révision — questions GÉNÉRÉES à la volée depuis une base de concepts,
// avec répétition espacée (Leitner), mode Apprendre (flashcards),
// distracteurs ciblés (confusions / même catégorie) et feedback enrichi.

const OPTION_COUNT = 4;
const BOX_DAYS = [0, 1, 3, 7, 16, 30];   // Leitner : box -> jours avant réapparition
const MAX_BOX = BOX_DAYS.length - 1;     // box >= 4 = maîtrisé
const DAY = 86400000;

const state = {
  branch: 'all',
  qtype: 'mix',       // 'mix' | 'def' | 'term' | 'situation' | 'cat'
  count: 10,          // 0 = tout
  mode: 'srs',        // 'srs' | 'review'
  questions: [], answers: [], index: 0,
  learn: [], lidx: 0,
};

let DB = null, ALL = [], CATS = [], BYTERM = {};

const CISSP_RE = /^cissp\d+$/;   // cissp1..cissp7 = les domaines ; 'cissp' = les 7 réunis
function isCissp(k) { return k === 'cissp' || CISSP_RE.test(k); }
function branchLabel(k) {
  if (k === 'all') return 'Tout';
  if (k === 'cissp') return 'CISSP';
  return (DB.branches && DB.branches[k]) || k;
}

const settings = Object.assign({ autoNext: true, sound: true, showCounts: false }, lsGet('quizrev:settings:v1', {}));

// ---------- persistance ----------
function lsGet(k, d) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function saveSettings() { lsSet('quizrev:settings:v1', settings); }

function loadStats() { return Object.assign({ done: 0, bestPct: 0, lastPct: -1, totalQ: 0, totalC: 0 }, lsGet('quizrev:stats:v1', {})); }
function saveStats(s) { lsSet('quizrev:stats:v1', s); }

function getWrong() { return lsGet('quizrev:wrong:v1', []); }
function saveWrong(w) { lsSet('quizrev:wrong:v1', w); }
function addWrong(t) { const w = getWrong(); if (!w.includes(t)) { w.push(t); saveWrong(w); } }
function removeWrong(t) { saveWrong(getWrong().filter(x => x !== t)); }

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
// 'cissp' = thème parent : tous les domaines CISSP d'un coup.
function inBranch(c, branch) {
  if (branch === 'all') return true;
  if (branch === 'cissp') return CISSP_RE.test(c.branch);
  return c.branch === branch;
}
function pool() { return ALL.filter(c => inBranch(c, state.branch)); }
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
// Distracteurs ciblés : confusions explicites -> même catégorie -> même branche -> global.
function distractors(field, correct, concept, n) {
  const tier = (pred) => shuffle(uniq(ALL.filter(pred).map(c => c[field]))).filter(v => v && v !== correct);
  const t1 = shuffle((concept.confuse || []).map(t => fieldVal(t, field)).filter(v => v && v !== correct));
  const t2 = tier(c => c.cat === concept.cat && c.term !== concept.term);
  const t3 = tier(c => c.branch === concept.branch);
  const t4 = tier(() => true);
  return uniqKeepFirst([...t1, ...t2, ...t3, ...t4]).slice(0, n);
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
const views = { home: $('view-home'), quiz: $('view-quiz'), result: $('view-result'), fiches: $('view-fiches'), learn: $('view-learn'), mindmap: $('view-mindmap') };
let autoNextTimer = null;
function showView(name) { Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name)); window.scrollTo(0, 0); }
function renderChips(sel, current, attr) { document.querySelectorAll(sel).forEach(c => c.classList.toggle('active', c.dataset[attr] === String(current))); }

const BRANCH_COLORS = { all: '#27B3FF', archi: '#27B3FF', igi1300: '#8B9BFF', ii901: '#35D07F', igi2102: '#FF9F6B' };
function themeColor() {
  if (isCissp(state.branch)) return '#4CE0D2';
  return BRANCH_COLORS[state.branch] || '#27B3FF';
}

// Le sélecteur de thème ne montre qu'une ligne « CISSP » : les 7 domaines sont
// un besoin ponctuel, ils restent dans un second sélecteur qui n'apparaît que
// lorsque CISSP est choisi.
function renderBranchSelect() {
  const sel = $('branch-select'), sub = $('cissp-select');
  const count = (k) => ALL.filter(c => inBranch(c, k)).length;
  // compteur affiché seulement si l'option est cochée (Réglages)
  const opt = (k, label) => `<option value="${k}">${esc(label)}${settings.showCounts ? ' (' + count(k) + ')' : ''}</option>`;

  const plain = Object.entries(DB.branches).filter(([k]) => !CISSP_RE.test(k));
  const cissp = Object.entries(DB.branches).filter(([k]) => CISSP_RE.test(k));

  sel.innerHTML = opt('all', 'Tout') + plain.map(([k, label]) => opt(k, label)).join('') +
    (cissp.length ? opt('cissp', 'CISSP') : '');
  sel.value = isCissp(state.branch) ? 'cissp' : state.branch;

  sub.innerHTML = opt('cissp', 'Tous les domaines') + cissp.map(([k, label]) => opt(k, label)).join('');
  sub.value = isCissp(state.branch) ? state.branch : 'cissp';
  sub.classList.toggle('hidden', !isCissp(state.branch));
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
  $('quiz-level').textContent = state.mode === 'review' ? '⟳ Révision erreurs' : branchLabel(state.branch);
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
  saveStats({ done: prev.done + 1, bestPct: Math.max(prev.bestPct, pct), lastPct: pct, totalQ: prev.totalQ + total, totalC: prev.totalC + score });

  const wrong = state.questions.map((q, i) => ({ prompt: q.promptText, correct: q.correctText, ok: state.answers[i] && state.answers[i].correct })).filter(x => !x.ok);
  $('result-sub').textContent = state.mode === 'review' ? 'Révision des erreurs terminée' : 'Quiz terminé';
  $('result-score').textContent = `${score}/${total}`;
  const wbox = $('result-wrong');
  wbox.innerHTML = wrong.length
    ? '<span class="wrong-title">À retravailler</span>' + wrong.map(w => `<div class="wrong-row"><span class="wrong-word">${esc(w.prompt)}</span><span class="wrong-answer">${esc(w.correct)}</span></div>`).join('')
    : '<span class="wrong-title">Parfait 🎉</span><span class="wrong-answer">Aucune erreur</span>';
  showView('result');
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
  $('learn-level').textContent = branchLabel(state.branch);
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
  if (state.lidx < state.learn.length - 1) { state.lidx++; renderFlash(); }
  else { showView('home'); renderHome(); }
}

// ---------- fiches (référence) ----------
function renderFiches() {
  const list = pool();
  $('fiches-crumb').textContent = branchLabel(state.branch);
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

// ---------- câblage ----------
$('branch-select').addEventListener('change', (e) => {
  state.branch = e.target.value;           // 'cissp' = les 7 domaines réunis
  renderBranchSelect();                    // affiche/masque le sélecteur de domaine
  renderHome();
});
$('cissp-select').addEventListener('change', (e) => { state.branch = e.target.value; renderHome(); });
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
    ['quizrev:stats:v1', 'quizrev:wrong:v1', 'quizrev:srs:v1'].forEach(k => localStorage.removeItem(k));
    settingsModal.classList.add('hidden'); renderHome();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- démarrage ----------
(async function init() {
  const [base, cissp] = await Promise.all([
    (await fetch('data/secu_concepts.json')).json(),
    (await fetch('data/cissp_concepts.json')).json().catch(() => ({ branches: {}, concepts: [] })),
  ]);
  // Les 7 domaines CISSP deviennent des thèmes à part entière : quiz, flashcards,
  // Leitner et « mes erreurs » les traitent comme n'importe quel autre concept.
  DB = { branches: Object.assign({}, base.branches, cissp.branches), concepts: base.concepts.concat(cissp.concepts) };
  ALL = DB.concepts;
  CATS = uniq(ALL.map(c => c.cat));
  ALL.forEach(c => { BYTERM[c.term] = c; });
  renderBranchSelect();
  renderChips('.qtype-chip', state.qtype, 'qtype');
  renderChips('.count-chip', state.count, 'count');
  renderHome();
})();
