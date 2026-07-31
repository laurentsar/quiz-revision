'use strict';

// CyberRévision — questions GÉNÉRÉES à la volée depuis une base de concepts,
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

let DB = null, ALL = [], CATS = [], BYTERM = {}, BRANCH_VIDEOS = {}, CATEGORY_VIDEOS = {};

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
  { id: 'prog', label: 'Programmation', icon: '💻', dot: '🐍', color: '#FFD166', test: (k) => k.startsWith('py') },
];
function groupOf(k) { return GROUPS.find(g => g.test(k)); }
function groupById(id) { return GROUPS.find(g => g.id === id); }
function groupKeys(g) { return Object.keys(DB.branches).filter(g.test); }
function groupActive(g) { return [...state.branches].some(g.test); }
function branchLabel(k) { return (DB.branches && DB.branches[k]) || k; }
// Langue du contenu d'un thème : homologation/réglementation/réf. FR sont en français,
// tout le reste (certifications ISC2/EC-Council) est en anglais (référentiels officiels EN).
function branchLang(b) { return (b === 'archi' || b === 'igi1300' || b === 'ii901' || b === 'igi2102' || b.startsWith('ig_') || b.startsWith('py')) ? 'fr' : 'en'; }

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

// ---------- campagnes ----------
function getCampaignStore() { return lsGet('quizrev:campaigns:v1', {}); }
function saveCampaignStore(c) { lsSet('quizrev:campaigns:v1', c); }
function markRoundPlayed(campaignCode, roundN) {
  const c = getCampaignStore();
  if (!c[campaignCode]) c[campaignCode] = { roundsPlayed: [] };
  if (!c[campaignCode].roundsPlayed.includes(roundN)) c[campaignCode].roundsPlayed.push(roundN);
  saveCampaignStore(c);
}
function hasPlayedRound(campaignCode, roundN) {
  const c = getCampaignStore();
  return !!(c[campaignCode] && c[campaignCode].roundsPlayed.includes(roundN));
}
function generateCampaignCode() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  const h = Array.from(b).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join('');
  return h.slice(0, 4) + '-' + h.slice(4);
}
function campaignCurrentRound(config) {
  const elapsed = Date.now() - config.startTs;
  return Math.min(Math.floor(elapsed / (config.freqDays * 86400000)), config.totalRounds - 1);
}
function campaignRoundSeed(config, roundN) {
  return (config.seed ^ (roundN * 0x9E3779B9)) >>> 0;
}
function campaignIsEnded(config) {
  return Date.now() >= config.startTs + config.totalRounds * config.freqDays * 86400000;
}
function campaignNextRoundDate(config, roundN) {
  return new Date(config.startTs + (roundN + 1) * config.freqDays * 86400000);
}
function fmtDate(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function campaignFreqLabel(freqDays) {
  return freqDays === 1 ? 'Quotidien' : freqDays === 3 ? 'Tous les 3 jours' : 'Hebdomadaire';
}

// ---------- audit qualité ----------
const AUDIT_ISSUES = {
  def_short:   'Définition trop courte',
  def_missing: 'Définition manquante',
  ex_short:    'Exemple trop court',
};

function conceptIssues(c) {
  const ov = getOverrides()[c.term] || {};
  const def = (ov.def !== undefined ? ov.def : c.def) || '';
  const ex  = (ov.ex  !== undefined ? ov.ex  : c.ex)  || '';
  const issues = [];
  if (!def) issues.push('def_missing');
  else if (def.trim().length < 20) issues.push('def_short');
  if (ex && ex.trim().length < 20) issues.push('ex_short');
  return issues;
}

// Scan léger : auto-flag uniquement les vrais défauts (def trop courte)
function runQualityCheck() {
  const flags = getFlags();
  let changed = false;
  ALL.forEach(c => {
    if (flags[c.term] && flags[c.term].status === 'open') return;
    const issues = conceptIssues(c).filter(i => i !== 'def_missing'); // ne pas mass-flaguer
    if (!issues.length) return;
    flags[c.term] = { type: 'auto', note: issues.map(i => AUDIT_ISSUES[i]).join(', '),
      promptLabel: '', ts: Date.now(), status: 'open', source: 'auto' };
    changed = true;
  });
  if (changed) saveFlags(flags);
}

// Stats par branche pour l'audit
function auditStatsByBranch() {
  const result = {};
  ALL.forEach(c => {
    if (!result[c.branch]) result[c.branch] = { branch: c.branch, label: branchLabel(c.branch), total: 0, no_def: 0, short_def: 0, short_ex: 0 };
    const s = result[c.branch]; s.total++;
    const issues = conceptIssues(c);
    if (issues.includes('def_missing')) s.no_def++;
    if (issues.includes('def_short'))   s.short_def++;
    if (issues.includes('ex_short'))    s.short_ex++;
  });
  return Object.values(result).sort((a, b) => (b.no_def + b.short_def) - (a.no_def + a.short_def));
}

// Génère le prompt structuré à coller dans Claude
function buildAuditExport(branchKey, limit = 25) {
  const ov = getOverrides();
  const isMindmapTip = (t) => t && /^Mind map /i.test(t.trim());
  const candidates = ALL.filter(c => {
    if (branchKey !== 'all' && c.branch !== branchKey) return false;
    return conceptIssues(c).length > 0;
  });
  const batch = candidates.slice(0, limit);
  const branchLbl = branchKey === 'all' ? 'Tous les thèmes' : branchLabel(branchKey);
  const today = new Date().toLocaleDateString('fr-FR');
  const lines = [
    `# CyberRévision — Audit qualité · ${branchLbl} · ${today}`,
    `# ${batch.length} concepts à compléter (sur ${candidates.length} identifiés)`,
    ``,
    `## Contexte`,
    `Application quiz de cybersécurité (PWA + APK). Les questions à choix multiples`,
    `utilisent ces champs : **def** (affiché comme réponse), **ex** (mise en situation),`,
    `**tip** (conseil affiché après réponse). Format court, précis, sans jargon excessif.`,
    ``,
    `## Tâche`,
    `Pour chaque concept ci-dessous, propose :`,
    `- **def** : définition 1-2 phrases, max 180 caractères, claire pour un quiz QCM`,
    `- **ex** : mise en situation concrète 1 phrase, max 150 caractères (optionnel si trop abstrait)`,
    `- **tip** : conseil mnémotechnique ou info clé 1 phrase (optionnel)`,
    ``,
    `Format de réponse attendu (un bloc par terme) :`,
    `### [Terme]`,
    `- def: ...`,
    `- ex: ...`,
    `- tip: ...`,
    ``,
    `---`,
    ``,
    `## Concepts`,
    ``,
  ];
  batch.forEach(c => {
    const ovC = ov[c.term] || {};
    const curDef = (ovC.def !== undefined ? ovC.def : c.def) || '';
    const curEx  = (ovC.ex  !== undefined ? ovC.ex  : c.ex)  || '';
    const curTip = (ovC.tip !== undefined ? ovC.tip : c.tip) || '';
    const realTip = isMindmapTip(curTip) ? '' : curTip;
    const issues = conceptIssues(c).map(i => AUDIT_ISSUES[i]).join(', ');
    lines.push(`### ${c.term} (${c.cat})`);
    lines.push(`- Branche : ${branchLabel(c.branch)}`);
    lines.push(`- Problème : ${issues}`);
    if (curDef) lines.push(`- def actuelle : ${curDef}`);
    if (curEx)  lines.push(`- ex actuel : ${curEx}`);
    if (realTip) lines.push(`- tip actuel : ${realTip}`);
    lines.push('');
  });
  if (candidates.length > limit) lines.push(`*(${candidates.length - limit} autres concepts non inclus dans ce batch)*`);
  return lines.join('\n');
}

// Rendu de la modale audit
function renderAuditModal() {
  const stats = auditStatsByBranch();
  const totalIssues = stats.reduce((s, b) => s + b.no_def + b.short_def + b.short_ex, 0);
  const selVal = $('audit-branch-select').value || 'all';

  // Summary tiles
  const totalNoDef   = stats.reduce((s, b) => s + b.no_def, 0);
  const totalShortDef = stats.reduce((s, b) => s + b.short_def, 0);
  $('audit-summary').innerHTML =
    `<div class="stile"><b>${totalIssues}</b><span>anomalies</span></div>` +
    `<div class="stile"><b>${totalNoDef}</b><span>sans définition</span></div>` +
    `<div class="stile"><b>${totalShortDef}</b><span>déf. trop courtes</span></div>`;

  // Branch select
  const sel = $('audit-branch-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="all">⭐ Tous les thèmes</option>' +
    stats.filter(b => b.no_def + b.short_def + b.short_ex > 0).map(b =>
      `<option value="${esc(b.branch)}">${esc(b.label)} (${b.no_def + b.short_def + b.short_ex})</option>`
    ).join('');
  if (prev) sel.value = prev;

  // Concept list preview
  const branchFilter = sel.value || 'all';
  const candidates = ALL.filter(c => {
    if (branchFilter !== 'all' && c.branch !== branchFilter) return false;
    return conceptIssues(c).length > 0;
  }).slice(0, 8);
  $('audit-preview').innerHTML = candidates.length
    ? candidates.map(c => {
        const issues = conceptIssues(c).map(i => `<span class="audit-tag">${esc(AUDIT_ISSUES[i])}</span>`).join(' ');
        return `<div class="audit-item"><span class="audit-term">${esc(c.term)}</span>${issues}</div>`;
      }).join('')
    : '<p class="mm-source">Aucune anomalie pour ce thème. 🎉</p>';

  const count = ALL.filter(c => (branchFilter === 'all' || c.branch === branchFilter) && conceptIssues(c).length > 0).length;
  $('audit-export-btn').textContent = `📋 Copier l'export pour Claude (${Math.min(count, 25)}/${count})`;
  $('audit-export-btn').disabled = count === 0;
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

function computeDailyStreak() {
  const m = lsGet('quizrev:daily:v1', {});
  const d = new Date();
  // If today has no activity yet, start checking from yesterday
  const todayKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (!(m[todayKey] && m[todayKey].q > 0)) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!(m[k] && m[k].q > 0)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
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
const views = { home: $('view-home'), quiz: $('view-quiz'), result: $('view-result'), fiches: $('view-fiches'), mindmap: $('view-mindmap'), learn: $('view-learn'), resources: $('view-resources'), stats: $('view-stats') };
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
  const seen = p.filter(c => srs[c.term] && srs[c.term].seen > 0).length;
  const mastered = p.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
  const due = p.filter(c => srs[c.term] && srs[c.term].due <= now).length;
  $('stat-seen').textContent = seen + ' / ' + p.length;
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
  // Tableau de bord global (tous thèmes)
  const globalSeen = ALL.filter(c => srs[c.term] && srs[c.term].seen > 0).length;
  const globalMastered = ALL.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
  const pct = ALL.length ? Math.round(100 * globalMastered / ALL.length) : 0;
  const dayStreak = computeDailyStreak();
  $('dash-streak').textContent = '🔥 ' + dayStreak;
  $('dash-seen-global').textContent = globalSeen;
  $('dash-mastered-global').textContent = globalMastered;
  $('dash-fill').style.width = pct + '%';
  $('dash-label').textContent = pct + ' % maîtrisé — ' + globalMastered + ' / ' + ALL.length + ' concepts';
}

// ---------- déroulé du quiz ----------
function startSession(mode) {
  if (window.FirebaseChallenge) FirebaseChallenge.removeListener();
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
    if (v) v.addEventListener('click', () => openConceptVideo(v.dataset.term));
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
function resumeExamTimer() {
  if (!state.examEndTime) return;
  clearInterval(state.examInterval);
  const el = $('quiz-timer');
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
function startExamTimer(minutes) {
  state.examEndTime = Date.now() + minutes * 60000;
  $('quiz-timer').classList.remove('urgent');
  resumeExamTimer();
}
function stopExamTimer() {
  clearInterval(state.examInterval); state.examInterval = null;
  state.examEndTime = 0;
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
let pomoInterval = null, pomoSeconds = 0, studying = false, pomoBreakTick = null;
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
// On gèle minuteur + Pomodoro + chrono examen, on reprend au retour sans perdre le contexte.
function pauseStudyTimers() {
  stopQTick();
  pomoStop();
  if (state.examInterval) { clearInterval(state.examInterval); state.examInterval = null; }
}
function resumeStudyTimers() {
  if (!views.quiz.classList.contains('hidden') && !state.answers[state.index]) qTick();
  if (state.examMode && state.examEndTime > Date.now()) resumeExamTimer();
  pomoStart();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseStudyTimers();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  } else {
    resumeStudyTimers();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
});
// Bonus : capteur de proximité s'il est exposé (rare hors natif) — main proche = éloigné.
if ('ondeviceproximity' in window || 'onuserproximity' in window) {
  window.addEventListener('userproximity', (e) => { if (e.near) pauseStudyTimers(); else resumeStudyTimers(); });
}
function showPomodoroBreak() {
  clearTimeout(autoNextTimer); clearQTimer();
  clearInterval(pomoBreakTick); pomoBreakTick = null;
  const modal = $('pomodoro-modal'), cd = $('pomo-countdown');
  let left = POMODORO_BREAK;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  cd.textContent = fmt(left);
  modal.classList.remove('hidden');
  vibrate(false);
  pomoBreakTick = setInterval(() => { left--; cd.textContent = fmt(left); if (left <= 0) endBreak(); }, 1000);
  function endBreak() { clearInterval(pomoBreakTick); pomoBreakTick = null; modal.classList.add('hidden'); pomoStart(); }
  $('btn-pomo-resume').onclick = endBreak;
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
    const ch = state.challenge;
    const code = ch.code;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '✅' : '💪';
    const pseudo = getPseudo();
    if (ch.isCampaign) {
      markRoundPlayed(code, ch.roundN);
      const nextDate = campaignNextRoundDate(ch, ch.roundN);
      const nextPart = ch.roundN + 1 < ch.totalRounds ? ` · Prochaine session : ${fmtDate(nextDate)}` : ' · Campagne terminée !';
      const shareText = `📅 Campagne CyberRévision [${code}]\nSession ${ch.roundN + 1}/${ch.totalRounds} : ${score}/${total} — ${pct}% ${emoji}${nextPart}`;
      $('challenge-result-code').textContent = code;
      $('result-sub').textContent = `Campagne · Session ${ch.roundN + 1}/${ch.totalRounds}`;
      $('btn-share-result').dataset.shareText = shareText;
      cr.classList.remove('hidden');
      if (window.FirebaseChallenge && FirebaseChallenge.isReady()) {
        FirebaseChallenge.pushCampaignScore(code, ch.roundN, pseudo, score, total);
        lb.classList.remove('hidden');
        $('leaderboard-status').textContent = `Classement général · ${pseudo}`;
        renderLeaderboard([], pseudo);
        FirebaseChallenge.listenCampaignLeaderboard(code, rows => renderLeaderboard(rows, pseudo));
      } else {
        lb.classList.add('hidden');
      }
    } else {
      const shareText = `⚔️ Défi CyberRévision [${code}]\n${score}/${total} — ${pct}% ${emoji}\nTu fais mieux ?`;
      $('challenge-result-code').textContent = code;
      $('btn-share-result').dataset.shareText = shareText;
      cr.classList.remove('hidden');
      if (window.FirebaseChallenge && FirebaseChallenge.isReady()) {
        FirebaseChallenge.pushScore(code, pseudo, score, total);
        lb.classList.remove('hidden');
        $('leaderboard-status').textContent = `Vous jouez en tant que : ${pseudo}`;
        renderLeaderboard([], pseudo);
        FirebaseChallenge.listenLeaderboard(code, rows => renderLeaderboard(rows, pseudo));
      } else {
        lb.classList.add('hidden');
      }
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
    a.addEventListener('click', () => openConceptVideo(a.dataset.term)));
}

// ---------- mind map (vision par thème / certification) ----------
// Reconstruit l'arbre branche -> catégorie -> concept depuis les données déjà en
// mémoire (ALL) : aucun fetch supplémentaire, disponible hors ligne dès le 1er lancement.
let mmSel = 'grp:cissp', mmDomain = null, mmQuery = '';
const MM_SEARCH_MIN = 2;

function mmSelLabel() {
  if (mmSel === 'all') return 'Tous les thèmes';
  if (mmSel.startsWith('grp:')) { const g = groupById(mmSel.slice(4)); return g ? g.label : mmSel; }
  return branchLabel(mmSel);
}
function mmList() {
  if (mmSel === 'all') return ALL;
  if (mmSel.startsWith('grp:')) { const g = groupById(mmSel.slice(4)); return ALL.filter(c => g.test(c.branch)); }
  return ALL.filter(c => c.branch === mmSel);
}
// Ordre stable des branches présentes, celui de DB.branches (cohérent avec le reste de l'appli).
function mmBranchesOf(list) {
  const present = new Set(list.map(c => c.branch));
  return Object.keys(DB.branches).filter(k => present.has(k));
}
// Libellé court d'un domaine : sans préfixe de groupe (« CC · », « SSCP · »…) pour tenir en chip.
function mmDomainShort(b) { return branchLabel(b).replace(/^[^·]+·\s*/, ''); }
function mmMastery(list) {
  const srs = getSrs();
  const total = list.length;
  const mastered = list.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
  return { total, mastered, pct: total ? Math.round(100 * mastered / total) : 0 };
}
function mmBoxClass(term, srs) {
  const e = srs[term];
  if (e && e.box >= 4) return 'mm-box-mastered';   // vert — maîtrisé
  if (e && e.box >= 1) return 'mm-box-progress';    // orange — à moitié
  return 'mm-box-new';                              // blanc — le reste
}
function mmHighlight(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

function renderMindmapSelect() {
  const sel = $('mm-select');
  sel.innerHTML = themeOptionsHtml();
  sel.value = mmSel;
}

// Anneau de progression (maîtrise Leitner) au centre de la mind map : motive à
// continuer, cohérent avec le tableau de bord de l'accueil.
function renderMindmapHub(list) {
  const m = mmMastery(list);
  $('mm-hub-ring').style.background = `conic-gradient(var(--sky) ${m.pct * 3.6}deg, rgba(255,255,255,0.12) 0deg)`;
  $('mm-hub-pct').textContent = m.pct + '%';
  $('mm-hub-title').textContent = mmSelLabel();
  $('mm-hub-sub').textContent = `${m.mastered} / ${m.total} concepts maîtrisés`;
}

function renderMindmapDomains(list) {
  const branches = mmBranchesOf(list);
  if (!branches.includes(mmDomain)) mmDomain = branches[0] || null;
  const srs = getSrs();
  $('mm-domains').innerHTML = branches.map(b => {
    const items = list.filter(c => c.branch === b);
    const mastered = items.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
    const active = b === mmDomain && !mmQuery;
    return `<button class="chip mm-chip${active ? ' active' : ''}" data-mm-domain="${esc(b)}">${esc(mmDomainShort(b))}<span class="mm-count">${mastered}/${items.length}</span></button>`;
  }).join('');
  $('mm-domains').querySelectorAll('[data-mm-domain]').forEach(btn => btn.addEventListener('click', () => {
    mmDomain = btn.dataset.mmDomain; mmQuery = ''; $('mm-search').value = '';
    renderMindmapDomains(mmList()); renderMindmapBody(); window.scrollTo(0, 0);
  }));
}

function mmTermBody(c) {
  return `<div class="mm-term-body">` +
    `<p class="mm-term-def">${esc(c.def || 'Relève de : ' + c.cat)}</p>` +
    (c.tip ? `<p class="mm-term-tip">💡 ${esc(c.tip)}</p>` : '') +
    (c.ex ? `<p class="mm-term-ex">🔎 ${esc(c.ex)}</p>` : '') +
    `<a class="fiche-video" data-term="${esc(c.term)}">🎥 Vidéo</a>` +
    `</div>`;
}
function mmTermHtml(c, srs) {
  return `<details class="mm-term ${mmBoxClass(c.term, srs)}"><summary><span class="mm-term-row"><span class="mm-dot"></span>${esc(c.term)}</span></summary>${mmTermBody(c)}</details>`;
}
function mmHitHtml(c, srs) {
  return `<details class="mm-term ${mmBoxClass(c.term, srs)}"><summary><span class="mm-term-row"><span class="mm-dot"></span>${mmHighlight(c.term, mmQuery)}</span><span class="mm-hit-crumb">${esc(mmDomainShort(c.branch))} › ${esc(c.cat)}</span></summary>${mmTermBody(c)}</details>`;
}

function renderMindmapBody() {
  const list = mmList();
  const box = $('mm-content');
  const srs = getSrs();
  if (mmQuery.length >= MM_SEARCH_MIN) {
    const needle = mmQuery.toLowerCase();
    const hits = list.filter(c => c.term.toLowerCase().includes(needle) || c.cat.toLowerCase().includes(needle));
    $('mm-crumb').textContent = hits.length + ' résultat' + (hits.length > 1 ? 's' : '');
    box.innerHTML = hits.length
      ? `<div class="card mm-terms">${hits.slice(0, 150).map(c => mmHitHtml(c, srs)).join('')}</div>`
      : '<div class="card"><p class="mm-hit-p">Aucun résultat</p></div>';
  } else {
    const items = list.filter(c => c.branch === mmDomain);
    $('mm-crumb').textContent = mmDomain ? mmDomainShort(mmDomain) : '';
    const byCat = {};
    items.forEach(c => (byCat[c.cat] = byCat[c.cat] || []).push(c));
    box.innerHTML = Object.entries(byCat).map(([cat, arr]) => {
      const mastered = arr.filter(c => srs[c.term] && srs[c.term].box >= 4).length;
      return `<div class="card mm-cat-card"><div class="mm-cat-head"><h3 class="gram-h3">${esc(cat)}</h3><span class="mm-count">${mastered}/${arr.length}</span></div>` +
        `<div class="mm-terms">${arr.map(c => mmTermHtml(c, srs)).join('')}</div></div>`;
    }).join('') || '<div class="card"><p class="mm-hit-p">Aucun concept.</p></div>';
  }
  box.querySelectorAll('.fiche-video').forEach(a => a.addEventListener('click', () => openConceptVideo(a.dataset.term)));
}

function renderMindmap() {
  renderMindmapSelect();
  const list = mmList();
  renderMindmapHub(list);
  renderMindmapDomains(list);
  renderMindmapBody();
}
function openMindmap() {
  mmQuery = ''; const s = $('mm-search'); if (s) s.value = '';
  showView('mindmap'); renderMindmap();
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
// Requête vidéo adaptée à la langue/contexte du concept : un terme de certification
// (contenu EN) cherche en anglais avec le nom de la certif en contexte (« AIC triad
// CISSP explained » >> « AIC triad cybersécurité », hors sujet en FR) ; un concept
// francophone (homologation, réglementation, réf. cyber) garde la recherche FR.
function videoSearchUrl(term) {
  const c = BYTERM[term];
  const q = term.replace(/\([^)]*\)/g, '').trim();
  if (c && branchLang(c.branch) === 'en') {
    const g = groupOf(c.branch);
    const ctx = g ? g.label.replace(/^Certification\s+/, '') : '';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + (ctx ? ' ' + ctx : '') + ' explained') + '&hl=en&gl=US';
  }
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' cybersécurité');
}

// Vidéo de référence choisie à la main (data/category_videos.json, data/branch_videos.json),
// même principe que quiz-langue (video Url/title curés, pas de recherche live ni de
// clé API). Priorité : vidéo de la catégorie précise du concept > vidéo du domaine
// entier > recherche YouTube externe (si rien n'est encore curé pour ce concept).
function openConceptVideo(term) {
  const c = BYTERM[term];
  const catVideo = c && CATEGORY_VIDEOS[c.branch] && CATEGORY_VIDEOS[c.branch][c.cat];
  const branchVideo = c && BRANCH_VIDEOS[c.branch];
  const curated = catVideo || branchVideo;
  openExternal(curated ? curated.url : videoSearchUrl(term));
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
  // Concepts les plus difficiles (box < 4, vus >= 2, taux d'erreur > 0)
  const weak = Object.entries(srs)
    .filter(([, e]) => e.seen >= 2 && e.wrong > 0 && e.box < 4)
    .map(([term, e]) => ({ term, rate: Math.round(100 * e.wrong / e.seen), wrong: e.wrong, seen: e.seen }))
    .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong)
    .slice(0, 10);
  $('weak-concepts').innerHTML = weak.length
    ? weak.map(e => `<div class="weak-item"><span class="weak-term">${esc(e.term)}</span><span class="weak-rate">${e.rate}% faux (${e.wrong}/${e.seen})</span></div>`).join('')
    : '<p class="mm-source" style="margin:8px 0">Pas encore assez de données.</p>';
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

function challengeDuration(count) {
  if (!count) return null;
  const min = Math.round(count * 0.75);
  return '≈ ' + min + ' min';
}

function isCampaignMode() {
  return parseInt($('challenge-freq-select').value, 10) > 0;
}

function refreshChallengeMode() {
  const campaign = isCampaignMode();
  $('challenge-quick-duration-row').classList.toggle('hidden', campaign);
  $('challenge-campaign-duration-row').classList.toggle('hidden', !campaign);
  $('challenge-quick-section').classList.toggle('hidden', campaign);
  $('challenge-campaign-section').classList.toggle('hidden', !campaign);
  if (campaign) updateCampaignPreview(); else refreshChallengeCode();
}

function refreshChallengeCode() {
  const v = $('challenge-theme-select').value;
  const scope = valueToScope(v);
  const count = parseInt($('challenge-count-select').value, 10) || 0;
  const qtype = state.qtype;
  const code = encodeChallenge(scope, count, qtype, _challengeSeed) || '—';
  $('challenge-code').textContent = code;
  const qtypeLabel = { mix: 'Mélange', def: 'Terme→déf.', term: 'Déf.→terme', situation: 'Mise en situation', cat: 'Catégorie' }[qtype] || qtype;
  const dur = challengeDuration(count);
  $('challenge-duration').textContent = dur || '—';
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
  const cntSel = $('challenge-count-select');
  const defaultCount = CHALLENGE_COUNTS.includes(state.count) ? String(state.count) : '10';
  cntSel.value = defaultCount;
  $('challenge-freq-select').value = '0';
  refreshChallengeMode();
  $('challenge-error').classList.add('hidden');
  $('challenge-code-input').value = '';
  $('campaign-join-info').classList.add('hidden');
  $('challenge-fb-warning').classList.add('hidden');
  $('challenge-create-row').classList.remove('hidden');
  $('challenge-created-section').classList.add('hidden');
  _currentCampaign = null;
  $('challenge-modal').classList.remove('hidden');
}

function updateCampaignPreview() {
  const freqDays = parseInt($('challenge-freq-select').value, 10);
  const durationDays = parseInt($('challenge-duration-select').value, 10);
  const totalRounds = Math.floor(durationDays / freqDays);
  const endDate = new Date(Date.now() + durationDays * 86400000);
  const countVal = parseInt($('challenge-count-select').value, 10) || 0;
  const dur = challengeDuration(countVal);
  const durPart = dur ? ` · ${dur}/session` : '';
  $('challenge-campaign-preview').textContent =
    `📅 ${totalRounds} sessions · ${campaignFreqLabel(freqDays)} · du ${fmtDate(new Date())} au ${fmtDate(endDate)}${durPart}`;
}

let _currentCampaign = null; // config en cours pour jointure

async function createCampaignFlow() {
  const ready = window.FirebaseChallenge && FirebaseChallenge.isReady();
  if (!ready) {
    const reason = window.FirebaseChallenge?.getInitError?.() || 'module FirebaseChallenge absent';
    $('challenge-fb-warning').textContent = 'Firebase non prêt : ' + reason;
    $('challenge-fb-warning').classList.remove('hidden');
    return;
  }
  $('challenge-fb-warning').classList.add('hidden');
  const scope = valueToScope($('challenge-theme-select').value);
  const count = parseInt($('challenge-count-select').value, 10) || 0;
  const qtype = state.qtype;
  const freqDays = parseInt($('challenge-freq-select').value, 10);
  const durationDays = parseInt($('challenge-duration-select').value, 10);
  const totalRounds = Math.floor(durationDays / freqDays);
  const seed = (Math.random() * 0x100000000) >>> 0;
  const code = generateCampaignCode();
  const config = { scope, count, qtype, freqDays, startTs: Date.now(), totalRounds, seed };
  const btn = $('btn-create-campaign');
  btn.disabled = true; btn.textContent = 'Création…';
  let ok = false;
  try { ok = await FirebaseChallenge.createCampaign(code, config); } catch (e) { console.warn('createCampaignFlow:', e); }
  btn.disabled = false; btn.textContent = '🚀 Créer la campagne';
  if (!ok) {
    const err = window.FirebaseChallenge?.getOpError?.() || 'erreur inconnue';
    $('challenge-fb-warning').textContent = 'Échec écriture Firebase : ' + err;
    $('challenge-fb-warning').classList.remove('hidden');
    return;
  }
  _currentCampaign = { config, code };
  $('campaign-code').textContent = code;
  const endDate = new Date(config.startTs + durationDays * 86400000);
  $('campaign-created-info').textContent =
    `${challengeScopeLabel(scope)} · ${count || 'Tout'} q/session · ${totalRounds} sessions · jusqu'au ${fmtDate(endDate)}`;
  $('btn-start-campaign-round').textContent = '▶ Jouer la session 1';
  $('challenge-create-row').classList.add('hidden');
  $('challenge-created-section').classList.remove('hidden');
}

async function deleteCampaignFlow() {
  if (!_currentCampaign) return;
  const { code } = _currentCampaign;
  if (!confirm(`Supprimer la campagne ${code} ?\nCette action est irréversible.`)) return;
  const btn = $('btn-delete-campaign');
  btn.disabled = true; btn.textContent = 'Suppression…';
  let ok = false;
  try { ok = await FirebaseChallenge.deleteCampaign(code); } catch (e) { console.warn('deleteCampaignFlow:', e); }
  btn.disabled = false; btn.textContent = '🗑 Supprimer cette campagne';
  if (!ok) {
    const err = FirebaseChallenge.getOpError?.() || 'erreur inconnue';
    $('challenge-fb-warning').textContent = 'Échec suppression : ' + err;
    $('challenge-fb-warning').classList.remove('hidden');
    return;
  }
  _currentCampaign = null;
  $('challenge-created-section').classList.add('hidden');
  $('challenge-create-row').classList.remove('hidden');
  $('challenge-fb-warning').textContent = 'Campagne supprimée.';
  $('challenge-fb-warning').classList.remove('hidden');
  setTimeout(() => $('challenge-fb-warning').classList.add('hidden'), 3000);
}

async function searchCampaign(rawInput) {
  const raw = (rawInput || '').replace(/-/g, '').trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(raw)) {
    $('challenge-error').textContent = 'Format invalide (ex : ABCD-EF12).';
    $('challenge-error').classList.remove('hidden');
    return;
  }
  const code = raw.slice(0, 4) + '-' + raw.slice(4);
  $('challenge-error').classList.add('hidden');
  $('campaign-join-info').classList.add('hidden');
  if (!window.FirebaseChallenge || !FirebaseChallenge.isReady()) {
    $('challenge-error').textContent = 'Firebase requis — vérifiez votre connexion.';
    $('challenge-error').classList.remove('hidden');
    return;
  }
  const config = await FirebaseChallenge.fetchCampaign(code);
  if (!config) {
    $('challenge-error').textContent = 'Campagne introuvable. Vérifiez le code.';
    $('challenge-error').classList.remove('hidden');
    return;
  }
  _currentCampaign = { config, code };
  const roundN = campaignCurrentRound(config);
  const ended = campaignIsEnded(config);
  const played = hasPlayedRound(code, roundN);
  $('cji-theme').textContent = `${challengeScopeLabel(config.scope)} · Session ${roundN + 1}/${config.totalRounds}`;
  if (ended) {
    $('cji-progress').textContent = 'Terminée';
    $('cji-next').textContent = '';
    $('btn-play-campaign-round').classList.add('hidden');
  } else if (played) {
    const nextDate = campaignNextRoundDate(config, roundN);
    $('cji-progress').textContent = '✅ Session jouée';
    $('cji-next').textContent = `Prochaine session : ${fmtDate(nextDate)}`;
    $('btn-play-campaign-round').classList.add('hidden');
  } else {
    $('cji-progress').textContent = '';
    $('cji-next').textContent = '';
    $('btn-play-campaign-round').textContent = `▶ Jouer la session ${roundN + 1}`;
    $('btn-play-campaign-round').classList.remove('hidden');
  }
  $('campaign-join-info').classList.remove('hidden');
}

function startCampaignRound() {
  if (!_currentCampaign) return;
  const { config, code } = _currentCampaign;
  const roundN = campaignCurrentRound(config);
  const roundSeed = campaignRoundSeed(config, roundN);
  state.branches.clear();
  if (config.scope.startsWith('grp:')) {
    const g = groupById(config.scope.slice(4));
    if (g) groupKeys(g).forEach(k => state.branches.add(k));
  } else if (config.scope !== 'all') {
    state.branches.add(config.scope);
  }
  state.count = config.count;
  state.qtype = config.qtype;
  state.challenge = {
    seed: roundSeed, code,
    isCampaign: true, roundN, totalRounds: config.totalRounds,
    freqDays: config.freqDays, startTs: config.startTs,
    campaignScope: config.scope,
  };
  state.examMode = false; state.mode = 'srs';
  state.questions = buildSession();
  if (!state.questions.length) { state.challenge = null; alert('Aucun concept disponible pour ce thème.'); return; }
  state.answers = []; state.index = 0;
  studying = true; pomoStart();
  $('challenge-modal').classList.add('hidden');
  showView('quiz'); stopExamTimer(); renderQuestion();
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

function buildReformulationPrompt(term, flag, c, curDef, curEx, curTip) {
  const TYPE_LABELS = { floue: 'Formulation floue', rep: 'Mauvaise réponse attendue', ex: 'Exemple trompeur', autre: 'Autre' };
  const lines = [
    `Je développe un quiz de révision en cybersécurité (app mobile). Ce concept a été signalé comme mal formulé — aide-moi à l'améliorer.`,
    ``,
    `**Terme :** ${term}`,
    `**Catégorie :** ${c.cat || '—'}`,
    curDef  ? `**Définition actuelle :** ${curDef}` : '',
    curEx   ? `**Exemple / situation actuel(le) :** ${curEx}` : '',
    curTip  ? `**Conseil actuel :** ${curTip}` : '',
    ``,
    `**Problème signalé :** ${TYPE_LABELS[flag.type] || flag.type || 'Non précisé'}`,
    flag.note ? `**Note :** ${flag.note}` : '',
    flag.promptLabel ? `**Type de question concernée :** ${flag.promptLabel}` : '',
    ``,
    `Propose une version améliorée de chaque champ présent (garde le même format court, adapté à un quiz à choix multiples) :`,
    curDef  ? `- **Définition :** (1–2 phrases, claire et précise)` : '',
    curEx   ? `- **Exemple / situation :** (scénario concret, sans ambiguïté)` : '',
    curTip  ? `- **Conseil :** (aide mnémotechnique ou approfondissement bref)` : '',
    ``,
    `Réponds uniquement avec les champs reformulés, sans explication.`,
  ].filter(l => l !== null && l !== undefined);
  return lines.join('\n');
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
      ${flag.note ? `<p class="flag-note-display">💬 ${esc(flag.note)}</p>` : ''}

      <div class="flag-current-block">
        ${curDef ? `<p class="flag-current-line"><span class="flag-field-label">Déf.</span> ${esc(curDef)}</p>` : ''}
        ${curEx  ? `<p class="flag-current-line"><span class="flag-field-label">Ex.</span> ${esc(curEx)}</p>`  : ''}
        ${curTip ? `<p class="flag-current-line"><span class="flag-field-label">💡</span> ${esc(curTip)}</p>`  : ''}
      </div>

      <button class="flag-claude-btn" data-term="${esc(term)}">🤖 Copier le prompt pour Claude</button>
      <p class="flag-claude-hint">Colle ce prompt dans claude.ai, récupère les champs reformulés et colle-les ci-dessous.</p>

      ${curDef ? `<label class="flag-field-label">Nouvelle définition</label><textarea class="flag-textarea" data-field="def" rows="2" placeholder="Colle ici la reformulation…">${esc(curDef)}</textarea>` : ''}
      ${curEx  ? `<label class="flag-field-label">Nouvel exemple / situation</label><textarea class="flag-textarea" data-field="ex" rows="2" placeholder="Colle ici la reformulation…">${esc(curEx)}</textarea>` : ''}
      ${curTip ? `<label class="flag-field-label">Nouveau conseil</label><textarea class="flag-textarea" data-field="tip" rows="2" placeholder="Colle ici la reformulation…">${esc(curTip)}</textarea>` : ''}

      <div class="flag-item-actions">
        <button class="primary flag-save-btn" style="margin-top:0">💾 Sauvegarder</button>
        <button class="ghost-sm flag-resolve-btn">✓ Résolu sans modif</button>
      </div>
    </div>`;
  }).join('<hr class="flag-sep" />');

  $('flags-list').querySelectorAll('.flag-claude-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const term = btn.dataset.term;
      const flag = getFlags()[term] || {};
      const c = BYTERM[term] || {};
      const ov = getOverrides();
      const curDef = (ov[term] && ov[term].def !== undefined ? ov[term].def : c.def) || '';
      const curEx  = (ov[term] && ov[term].ex  !== undefined ? ov[term].ex  : c.ex)  || '';
      const curTip = (ov[term] && ov[term].tip !== undefined ? ov[term].tip : c.tip) || '';
      const prompt = buildReformulationPrompt(term, flag, c, curDef, curEx, curTip);
      try { await navigator.clipboard.writeText(prompt); } catch (e) {}
      btn.textContent = '✅ Prompt copié !';
      setTimeout(() => { btn.textContent = '🤖 Copier le prompt pour Claude'; }, 2500);
      openExternal('https://claude.ai');
    });
  });

  $('flags-list').querySelectorAll('.flag-save-btn').forEach(btn => {
    const item = btn.closest('.flag-item');
    btn.addEventListener('click', () => {
      const term = item.dataset.term;
      const o = getOverrides(); o[term] = o[term] || {};
      item.querySelectorAll('.flag-textarea').forEach(ta => { const v = ta.value.trim(); if (v) o[term][ta.dataset.field] = v; });
      saveOverrides(o);
      if (BYTERM[term]) Object.assign(BYTERM[term], o[term]);
      btn.textContent = '✅ Sauvegardé !';
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
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { if (!views.stats.classList.contains('hidden')) renderStatsView(); }, 200);
});
document.querySelectorAll('.qtype-chip').forEach(c => c.addEventListener('click', () => { state.qtype = c.dataset.qtype; renderChips('.qtype-chip', state.qtype, 'qtype'); }));
document.querySelectorAll('.count-chip').forEach(c => c.addEventListener('click', () => { state.count = +c.dataset.count; renderChips('.count-chip', state.count, 'count'); }));

function exitToHome() {
  clearTimeout(autoNextTimer); clearQTimer(); stopExamTimer(); studying = false; pomoStop();
  clearInterval(pomoBreakTick); pomoBreakTick = null;
  $('pomodoro-modal').classList.add('hidden');
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
$('btn-mindmap').addEventListener('click', openMindmap);
$('btn-mindmap-home').addEventListener('click', exitToHome);
$('mm-select').addEventListener('change', (e) => { mmSel = e.target.value; mmDomain = null; mmQuery = ''; $('mm-search').value = ''; renderMindmap(); window.scrollTo(0, 0); });
$('mm-search').addEventListener('input', (e) => { mmQuery = e.target.value.trim(); renderMindmapDomains(mmList()); renderMindmapBody(); });

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
  const ch = $('challenge-modal')._challenge;
  if (!ch) return;
  const code = ch.code;
  const qtypeLabel = { mix: 'Mélange', def: 'Terme→déf.', term: 'Déf.→terme', situation: 'Mise en situation', cat: 'Catégorie' }[ch.qtype] || ch.qtype;
  const countLabel = ch.count ? ch.count + ' questions' : 'Toutes les questions';
  const themeLabel = challengeScopeLabel(ch.scope);
  const dur = challengeDuration(ch.count);
  const repo = window.UPDATE_REPO || 'laurentsar/quiz-revision';
  const [owner, repoName] = repo.split('/');
  const appUrl = `https://${owner}.github.io/${repoName}/`;
  const durLine = dur ? `\n⏱️ Durée estimée : ${dur}` : '';
  const text = `⚔️ *Défi CyberRévision*\n\n📚 Thème : ${themeLabel}\n❓ ${countLabel} · ${qtypeLabel}${durLine}\n\n🔑 Code : *${code}*\n\n👉 Joue ici : ${appUrl}`;
  openExternal('https://wa.me/?text=' + encodeURIComponent(text));
});
$('btn-start-my-challenge').addEventListener('click', () => {
  const ch = $('challenge-modal')._challenge;
  if (ch) startChallengeSession(ch, ch.code);
});
$('btn-join-challenge').addEventListener('click', async () => {
  const raw = $('challenge-code-input').value.trim();
  const stripped = raw.replace(/-/g, '').toUpperCase();
  if (/^[0-9A-F]{10}$/.test(stripped)) {
    const ch = decodeChallenge(raw);
    if (!ch) { $('challenge-error').textContent = 'Code invalide. Vérifie la saisie.'; $('challenge-error').classList.remove('hidden'); return; }
    $('challenge-error').classList.add('hidden');
    startChallengeSession(ch, stripped.replace(/(.{5})(.{5})/, '$1-$2'));
  } else if (/^[0-9A-F]{8}$/.test(stripped)) {
    await searchCampaign(raw);
  } else {
    $('challenge-error').textContent = 'Code invalide. Vérifie la saisie.';
    $('challenge-error').classList.remove('hidden');
  }
});

// ---- Paramètres défi / campagne ----
$('challenge-freq-select').addEventListener('change', refreshChallengeMode);
$('challenge-theme-select').addEventListener('change', () => { if (!isCampaignMode()) refreshChallengeCode(); else updateCampaignPreview(); });
$('challenge-count-select').addEventListener('change', () => { if (!isCampaignMode()) refreshChallengeCode(); else updateCampaignPreview(); });
$('challenge-duration-select').addEventListener('change', updateCampaignPreview);

// ---- Campagne ----
$('btn-create-campaign').addEventListener('click', createCampaignFlow);
$('btn-delete-campaign').addEventListener('click', deleteCampaignFlow);
$('btn-campaign-new').addEventListener('click', () => {
  _currentCampaign = null;
  $('challenge-created-section').classList.add('hidden');
  $('challenge-create-row').classList.remove('hidden');
});
$('btn-copy-campaign-code').addEventListener('click', async () => {
  const code = $('campaign-code').textContent;
  try {
    await navigator.clipboard.writeText(code);
    const btn = $('btn-copy-campaign-code'); btn.textContent = '✅ Copié';
    setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000);
  } catch (e) {}
});
$('btn-whatsapp-campaign').addEventListener('click', () => {
  if (!_currentCampaign) return;
  const { config, code } = _currentCampaign;
  const repo = window.UPDATE_REPO || 'laurentsar/quiz-revision';
  const [owner, repoName] = repo.split('/');
  const appUrl = `https://${owner}.github.io/${repoName}/`;
  const countLabel = config.count ? config.count + ' q/session' : 'Toutes les questions';
  const durationDays = config.totalRounds * config.freqDays;
  const endDate = new Date(config.startTs + durationDays * 86400000);
  const text = `📅 *Campagne CyberRévision*\n\n📚 Thème : ${challengeScopeLabel(config.scope)}\n❓ ${countLabel} · ${campaignFreqLabel(config.freqDays)}\n🗓️ ${config.totalRounds} sessions · jusqu'au ${fmtDate(endDate)}\n\n🔑 Code : *${code}*\n\n👉 Rejoins la campagne : ${appUrl}`;
  openExternal('https://wa.me/?text=' + encodeURIComponent(text));
});
$('btn-start-campaign-round').addEventListener('click', startCampaignRound);
$('btn-play-campaign-round').addEventListener('click', startCampaignRound);
$('btn-share-result').addEventListener('click', async () => {
  const text = ($('btn-share-result').dataset.shareText || '').trim();
  if (navigator.share) { try { await navigator.share({ title: 'Défi CyberRévision', text }); return; } catch (e) {} }
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

// Audit qualité
$('btn-audit').addEventListener('click', () => {
  renderAuditModal();
  $('audit-modal').classList.remove('hidden');
});
$('audit-modal-close').addEventListener('click', () => $('audit-modal').classList.add('hidden'));
$('audit-modal').addEventListener('click', (e) => { if (e.target === $('audit-modal')) $('audit-modal').classList.add('hidden'); });
$('audit-branch-select').addEventListener('change', renderAuditModal);
$('audit-export-btn').addEventListener('click', async () => {
  const branch = $('audit-branch-select').value || 'all';
  const text = buildAuditExport(branch, 25);
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  const btn = $('audit-export-btn');
  const prev = btn.textContent;
  btn.textContent = '✅ Copié ! Colle dans Claude.';
  setTimeout(() => { btn.textContent = prev; }, 3000);
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
  const [base, cissp, isc2, ceh, ignite, prog, scen, branchVideos, categoryVideos] = await Promise.all([
    (await fetch('data/secu_concepts.json')).json(),
    (await fetch('data/cissp_concepts.json')).json().catch(() => empty),
    (await fetch('data/isc2_concepts.json')).json().catch(() => empty),
    (await fetch('data/ceh_concepts.json')).json().catch(() => empty),
    (await fetch('data/ignite_concepts.json')).json().catch(() => empty),
    (await fetch('data/prog_concepts.json')).json().catch(() => empty),
    (await fetch('data/scenarios.json')).json().catch(() => ({})),
    (await fetch('data/branch_videos.json')).json().catch(() => ({})),
    (await fetch('data/category_videos.json')).json().catch(() => ({})),
  ]);
  BRANCH_VIDEOS = branchVideos;
  CATEGORY_VIDEOS = categoryVideos;
  // Chaque source (homologation, CISSP, SSCP/CCSP/CC, CEH, mind maps Ignite, langages
  // de programmation) apporte ses thèmes ; tous sont traités à l'identique par le
  // quiz, les flashcards et le Leitner.
  const srcs = [base, cissp, isc2, ceh, ignite, prog];
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
  ALL.forEach(c => {
    const s = scen[normEx(c.term)];
    if (!c.ex && s && s.lang === branchLang(c.branch)) c.ex = s.ex;
  });
  CATS = uniq(ALL.map(c => c.cat));
  ALL.forEach(c => { BYTERM[c.term] = c; });
  applyOverrides();
  runQualityCheck();
  renderBranchSelect();
  renderChips('.qtype-chip', state.qtype, 'qtype');
  renderChips('.count-chip', state.count, 'count');
  updateConceptBadge();
  renderHome();
})();
