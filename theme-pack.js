/* Bible Theme Pack — theme-pack.js
 * Seven selectable themes, offline, no dependencies.
 * Public API: window.BibleThemePack = { getCurrentTheme, getSettings, applyTheme, openPicker, reset, ... }
 * Storage: localStorage key "bible_theme_pack_v1" (only this key is ever written or removed).
 */
(function () {
  'use strict';
  if (window.BibleThemePack) return;                       // never initialise twice

  var KEY = 'bible_theme_pack_v1';
  var DEFAULTS = { theme: 'glass', glow: 60, blur: 16, motion: true };

  // ---- central registry: every theme supplies the same tokens ----
  var THEMES = [
    { id: 'glass', name: 'Glass Glow', desc: 'Midnight glass with cyan and violet light. The signature look.',
      light: false, glass: true, glowCap: 1,
      bg: '#070b1a', bgTop: '#0b1230', surface: 'rgba(255,255,255,0.055)', surface2: 'rgba(255,255,255,0.10)',
      strong: '#0f1630', text: '#f2f6ff', text2: 'rgba(226,234,255,0.78)', muted: 'rgba(204,216,255,0.60)',
      accent: '#38bdf8', accent2: '#a78bfa', accentHi: '#7dd3fc', accentLo: '#0369a1', onAccent: '#04121f',
      border: 'rgba(150,185,255,0.20)', borderStrong: 'rgba(150,185,255,0.34)', ink: '255,255,255', glow: '56,189,248', amb2: '139,92,246',
      preview: ['#070b1a', '#38bdf8', '#a78bfa'] },
    { id: 'emerald', name: 'Emerald Glass', desc: 'Deep forest green with mint and lime light.',
      light: false, glass: true, glowCap: 1,
      bg: '#04130d', bgTop: '#072419', surface: 'rgba(52,211,153,0.075)', surface2: 'rgba(52,211,153,0.13)',
      strong: '#082317', text: '#eafff5', text2: 'rgba(214,250,235,0.80)', muted: 'rgba(180,235,210,0.62)',
      accent: '#34d399', accent2: '#a3e635', accentHi: '#6ee7b7', accentLo: '#047857', onAccent: '#03150d',
      border: 'rgba(110,231,183,0.22)', borderStrong: 'rgba(110,231,183,0.36)', ink: '255,255,255', glow: '52,211,153', amb2: '163,230,53',
      preview: ['#04130d', '#34d399', '#a3e635'] },
    { id: 'midnight', name: 'Midnight Blue', desc: 'Calm navy with electric blue and cyan highlights.',
      light: false, glass: true, glowCap: 1,
      bg: '#050a1c', bgTop: '#081433', surface: 'rgba(77,141,255,0.08)', surface2: 'rgba(77,141,255,0.14)',
      strong: '#0a1534', text: '#eef3ff', text2: 'rgba(218,230,255,0.80)', muted: 'rgba(180,200,245,0.62)',
      accent: '#4d8dff', accent2: '#22d3ee', accentHi: '#8db8ff', accentLo: '#1d4ed8', onAccent: '#030a1c',
      border: 'rgba(100,150,255,0.22)', borderStrong: 'rgba(100,150,255,0.36)', ink: '255,255,255', glow: '77,141,255', amb2: '34,211,238',
      preview: ['#050a1c', '#4d8dff', '#22d3ee'] },
    { id: 'amethyst', name: 'Royal Amethyst', desc: 'Deep purple glass with lavender and pink glow.',
      light: false, glass: true, glowCap: 1,
      bg: '#0e0720', bgTop: '#1a0c38', surface: 'rgba(167,139,250,0.09)', surface2: 'rgba(167,139,250,0.15)',
      strong: '#1a0e38', text: '#f7f1ff', text2: 'rgba(238,226,255,0.82)', muted: 'rgba(214,196,250,0.66)',
      accent: '#b69cff', accent2: '#f472b6', accentHi: '#d3c2ff', accentLo: '#6d28d9', onAccent: '#140826',
      border: 'rgba(190,160,255,0.24)', borderStrong: 'rgba(190,160,255,0.38)', ink: '255,255,255', glow: '167,139,250', amb2: '244,114,182',
      preview: ['#0e0720', '#b69cff', '#f472b6'] },
    { id: 'gold', name: 'Holy Gold', desc: 'Near-black with warm gold and amber accents.',
      light: false, glass: true, glowCap: 0.8,
      bg: '#0a0805', bgTop: '#17110a', surface: 'rgba(214,160,70,0.075)', surface2: 'rgba(214,160,70,0.13)',
      strong: '#181109', text: '#f8f1e4', text2: 'rgba(245,232,208,0.80)', muted: 'rgba(222,205,172,0.64)',
      accent: '#e2b04a', accent2: '#f59e0b', accentHi: '#f2cf7d', accentLo: '#92610e', onAccent: '#1a1204',
      border: 'rgba(226,176,74,0.24)', borderStrong: 'rgba(226,176,74,0.38)', ink: '255,255,255', glow: '226,176,74', amb2: '245,158,11',
      preview: ['#0a0805', '#e2b04a', '#f59e0b'] },
    { id: 'frosted', name: 'Frosted Glass', desc: 'Bright, light frosted glass with blue and violet accents.',
      light: true, glass: true, glowCap: 0.6,
      bg: '#e6ecf6', bgTop: '#f4f7fc', surface: 'rgba(255,255,255,0.74)', surface2: 'rgba(255,255,255,0.92)',
      strong: '#ffffff', text: '#0f172a', text2: '#334155', muted: '#58667c',
      accent: '#1d4ed8', accent2: '#7c3aed', accentHi: '#1e40af', accentLo: '#1e3a8a', onAccent: '#ffffff',
      border: 'rgba(15,23,42,0.16)', borderStrong: 'rgba(15,23,42,0.28)', ink: '15,23,42', glow: '37,99,235', amb2: '124,58,237',
      preview: ['#e6ecf6', '#1d4ed8', '#7c3aed'] },
    { id: 'amoled', name: 'Pure AMOLED', desc: 'True black, charcoal panels, no blur. Simple and easy on battery.',
      light: false, glass: false, glowCap: 0,
      bg: '#000000', bgTop: '#000000', surface: '#0d0d10', surface2: '#16161b',
      strong: '#121216', text: '#f2f2f2', text2: 'rgba(255,255,255,0.80)', muted: 'rgba(255,255,255,0.60)',
      accent: '#6ea8ff', accent2: '#a78bfa', accentHi: '#9cc2ff', accentLo: '#2f5fd0', onAccent: '#02060f',
      border: 'rgba(255,255,255,0.12)', borderStrong: 'rgba(255,255,255,0.22)', ink: '255,255,255', glow: '110,168,255', amb2: '167,139,250',
      preview: ['#000000', '#6ea8ff', '#a78bfa'] }
  ];

  var root = document.documentElement;
  var settings = load();
  var supportsBlur = false;
  try {
    supportsBlur = !!(window.CSS && window.CSS.supports && (window.CSS.supports('backdrop-filter', 'blur(1px)') || window.CSS.supports('-webkit-backdrop-filter', 'blur(1px)')));
  } catch (e) { supportsBlur = false; }
  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  function byId(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return null; }
  function clamp(n, lo, hi, d) { n = Number(n); if (!isFinite(n)) return d; return Math.min(hi, Math.max(lo, Math.round(n))); }
  function rgbOf(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var v = parseInt(m[1], 16); return (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255); }
    var r = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c);
    return r ? r[1] + ',' + r[2] + ',' + r[3] : '0,0,0';
  }

  // ---- persistence (reads/writes ONLY KEY; corrupt data falls back to defaults) ----
  function load() {
    var s = { theme: DEFAULTS.theme, glow: DEFAULTS.glow, blur: DEFAULTS.blur, motion: DEFAULTS.motion };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (typeof o.theme === 'string' && byId(o.theme)) s.theme = o.theme;
          s.glow = clamp(o.glow, 0, 100, DEFAULTS.glow);
          s.blur = clamp(o.blur, 0, 30, DEFAULTS.blur);
          if (typeof o.motion === 'boolean') s.motion = o.motion;
        }
      }
    } catch (e) { /* corrupt or storage blocked: keep defaults */ }
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }

  // ---- apply: sets CSS variables + attributes, never reloads, never touches Bible content ----
  function apply() {
    var t = byId(settings.theme) || byId(DEFAULTS.theme);
    var i = t.glass ? (settings.glow / 100) * t.glowCap : 0;     // 0..1
    var rgb = t.glow;
    var st = root.style;
    function v(k, val) { st.setProperty('--bt-' + k, val); }
    v('bg', t.bg);
    v('bg-rgb', rgbOf(t.bg));
    v('bg-image', 'linear-gradient(180deg, ' + t.bgTop + ' 0%, ' + t.bg + ' 100%)');
    v('card', t.surface); v('card-2', t.surface2);
    v('strong', t.strong); v('strong-solid', t.strong); v('strong-rgb', rgbOf(t.strong));
    v('text', t.text); v('text2', t.text2); v('muted', t.muted);
    v('accent', t.accent); v('accent-rgb', rgbOf(t.accent));
    v('accent2', t.accent2); v('accent2-rgb', rgbOf(t.accent2));
    v('accent-hi', t.accentHi); v('accent-lo', t.accentLo); v('on-accent', t.onAccent);
    v('border', t.border); v('border-strong', t.borderStrong);
    v('ink-rgb', t.ink);
    v('amb1', 'rgba(' + rgb + ',0.55)'); v('amb2', 'rgba(' + t.amb2 + ',0.5)');
    v('amb-op', (t.glass && !t.light) ? (0.08 + 0.42 * i).toFixed(2) : (t.light ? (0.10 + 0.40 * i).toFixed(2) : '0'));
    if (i <= 0) {
      v('glow-xs', '0 0 0 0 transparent'); v('glow-sm', '0 0 0 0 transparent'); v('glow-md', '0 0 0 0 transparent');
    } else {
      v('glow-xs', '0 0 ' + Math.round(8 + 10 * i) + 'px rgba(' + rgb + ',' + (0.06 + 0.16 * i).toFixed(2) + ')');
      v('glow-sm', '0 0 ' + Math.round(10 + 14 * i) + 'px rgba(' + rgb + ',' + (0.12 + 0.36 * i).toFixed(2) + ')');
      v('glow-md', '0 0 ' + Math.round(14 + 22 * i) + 'px rgba(' + rgb + ',' + (0.16 + 0.44 * i).toFixed(2) + ')');
    }
    var useBlur = t.glass && supportsBlur && settings.blur > 0;
    v('bf', useBlur ? 'blur(' + settings.blur + 'px) saturate(1.25)' : 'none');
    root.setAttribute('data-bt', '1');
    root.setAttribute('data-bt-theme', t.id);
    if (t.light) root.setAttribute('data-bt-light', ''); else root.removeAttribute('data-bt-light');
    root.setAttribute('data-bt-motion', (t.id === 'glass' && settings.motion && !reduceMotion) ? 'on' : 'off');
    st.colorScheme = t.light ? 'light' : 'dark';
    try {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t.bg);
    } catch (e) {}
  }

  function emit() {
    try { window.dispatchEvent(new CustomEvent('bible-theme-change', { detail: { theme: settings.theme, settings: copy() } })); } catch (e) {}
    refreshPanels();
  }
  function copy() { return { theme: settings.theme, glow: settings.glow, blur: settings.blur, motion: settings.motion }; }

  // ---- public API ----
  function applyTheme(id) {
    if (!byId(id)) return false;
    settings.theme = id; save(); apply(); emit(); return true;
  }
  function setOptions(o) {
    if (!o) return;
    if (o.glow != null) settings.glow = clamp(o.glow, 0, 100, settings.glow);
    if (o.blur != null) settings.blur = clamp(o.blur, 0, 30, settings.blur);
    if (typeof o.motion === 'boolean') settings.motion = o.motion;
    save(); apply(); emit();
  }
  function reset() {
    settings = { theme: DEFAULTS.theme, glow: DEFAULTS.glow, blur: DEFAULTS.blur, motion: DEFAULTS.motion };
    try { localStorage.removeItem(KEY); } catch (e) {}    // only our own key
    apply(); emit();
  }
  function getCurrentTheme() {
    var t = byId(settings.theme) || byId(DEFAULTS.theme);
    return { id: t.id, name: t.name, description: t.desc, light: t.light, glass: t.glass };
  }
  function getSettings() { return copy(); }

  // ---- picker UI (plain DOM, works inside Settings and as a modal) ----
  var panels = [];
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function swatch(t) {
    var s = el('div', 'btp-swatch'); s.setAttribute('aria-hidden', 'true');
    s.style.background = t.preview[0];
    var a = el('i'); a.style.cssText = 'width:34px;height:34px;left:10px;top:6px;background:' + t.preview[1] + ';opacity:.9;filter:blur(' + (t.glass ? 6 : 0) + 'px)';
    var b = el('i'); b.style.cssText = 'width:30px;height:30px;right:10px;bottom:-6px;background:' + t.preview[2] + ';opacity:.9;filter:blur(' + (t.glass ? 6 : 0) + 'px)';
    var bar = el('i'); bar.style.cssText = 'left:10px;right:10px;bottom:7px;height:7px;border-radius:4px;background:' + (t.light ? 'rgba(15,23,42,.55)' : 'rgba(255,255,255,.6)');
    s.appendChild(a); s.appendChild(b); s.appendChild(bar);
    return s;
  }
  function buildPanel(host, withTitle) {
    host.textContent = '';
    var wrap = el('div', 'btp-panel');
    if (withTitle) wrap.appendChild(el('h3', 'btp-title', 'Appearance'));
    var grid = el('div', 'btp-grid');
    grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-label', 'Theme');
    var opts = [];
    THEMES.forEach(function (t, idx) {
      var b = el('button', 'btp-opt'); b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('data-theme', t.id);
      b.setAttribute('aria-label', t.name + '. ' + t.desc);
      b.appendChild(swatch(t));
      var nm = el('div', 'btp-name'); nm.appendChild(el('span', null, t.name)); nm.appendChild(el('span', 'btp-check', '\u2713 Selected'));
      b.appendChild(nm); b.appendChild(el('div', 'btp-desc', t.desc));
      b.addEventListener('click', function () { applyTheme(t.id); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!d) return; e.preventDefault();
        var n = THEMES[(idx + d + THEMES.length) % THEMES.length]; applyTheme(n.id);
        var nb = grid.querySelector('[data-theme="' + n.id + '"]'); if (nb) nb.focus();
      });
      grid.appendChild(b); opts.push(b);
    });
    wrap.appendChild(grid);

    var ctr = el('div', 'btp-controls');
    function slider(label, id, min, max, key, unit, note) {
      var row = el('div', 'btp-row');
      var lab = el('label'); lab.setAttribute('for', id);
      lab.appendChild(el('span', null, label)); var out = el('output', null, ''); out.setAttribute('for', id); lab.appendChild(out);
      var r = el('input', 'btp-range'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = 1;
      r.addEventListener('input', function () { var o = {}; o[key] = r.value; setOptions(o); });
      row.appendChild(lab); row.appendChild(r);
      if (note) row.appendChild(el('div', 'btp-note', note));
      ctr.appendChild(row);
      return { r: r, out: out, unit: unit, key: key };
    }
    var uid = 'btp' + Math.floor(Math.random() * 1e6);
    var glow = slider('Glow intensity', uid + 'g', 0, 100, 'glow', '%', 'At 0% the glow is off but theme colours stay.');
    var blur = slider('Glass blur', uid + 'b', 0, 30, 'blur', ' px', 'Higher blur uses more battery. Pure AMOLED never uses blur.');
    var row = el('div', 'btp-row'); var btns = el('div', 'btp-btns');
    var mo = el('button', 'btp-btn', ''); mo.type = 'button';
    mo.addEventListener('click', function () { setOptions({ motion: !settings.motion }); });
    var rs = el('button', 'btp-btn', 'Reset to default'); rs.type = 'button';
    rs.addEventListener('click', function () { reset(); });
    btns.appendChild(mo); btns.appendChild(rs); row.appendChild(btns);
    if (reduceMotion) row.appendChild(el('div', 'btp-note', 'Animated background is off because your device asks for reduced motion.'));
    ctr.appendChild(row);
    wrap.appendChild(ctr); host.appendChild(wrap);

    var p = {
      host: host,
      update: function () {
        opts.forEach(function (b) {
          var on = b.getAttribute('data-theme') === settings.theme;
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          b.tabIndex = on ? 0 : -1;
        });
        [glow, blur].forEach(function (s) { s.r.value = settings[s.key]; s.out.textContent = settings[s.key] + s.unit; });
        var t = byId(settings.theme);
        glow.r.disabled = !t.glass; blur.r.disabled = !t.glass;
        mo.textContent = 'Animated background: ' + (settings.motion && !reduceMotion ? 'On' : 'Off');
        mo.setAttribute('aria-pressed', settings.motion && !reduceMotion ? 'true' : 'false');
        mo.disabled = reduceMotion || t.id !== 'glass';
        mo.title = t.id !== 'glass' ? 'The animated background is part of Glass Glow' : '';
      }
    };
    panels.push(p); p.update(); return p;
  }
  function refreshPanels() {
    panels = panels.filter(function (p) { return p.host && document.body.contains(p.host); });
    panels.forEach(function (p) { p.update(); });
  }

  var modalEl = null, lastFocus = null;
  function closePicker() {
    if (!modalEl) return;
    document.removeEventListener('keydown', onKey, true);
    if (modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null; refreshPanels();
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function onKey(e) {
    if (!modalEl) return;
    if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
    if (e.key === 'Tab') {                                      // keep focus inside the dialog
      var f = modalEl.querySelectorAll('button:not([disabled]),input:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function openPicker() {
    if (modalEl) return;                                        // never two pickers
    lastFocus = document.activeElement;
    modalEl = el('div', 'btp-modal');
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closePicker(); });
    var card = el('div', 'btp-modal-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Appearance and themes');
    var head = el('div', 'btp-modal-head'); head.appendChild(el('h2', null, 'Appearance'));
    var x = el('button', 'btp-close', '\u2715'); x.type = 'button'; x.setAttribute('aria-label', 'Close appearance'); x.addEventListener('click', closePicker);
    head.appendChild(x); card.appendChild(head);
    var host = el('div'); card.appendChild(host); modalEl.appendChild(card);
    (document.body || root).appendChild(modalEl);
    buildPanel(host, false);
    document.addEventListener('keydown', onKey, true);
    x.focus();
  }

  // React hook-in: SettingsPage calls BibleThemePack.renderSettings(React). The host div has NO React
  // children, so React never reconciles the DOM we build inside it.
  function hostRef(node) {
    if (node) buildPanel(node, true);
    else refreshPanels();
  }
  function renderSettings(React) {
    return React.createElement('div', { className: 'btp-settings-card btp-settings-host', style: { marginBottom: 28 }, ref: hostRef });
  }

  apply();                                                       // runs from <head>: no flash of the old look
  window.BibleThemePack = {
    getCurrentTheme: getCurrentTheme, getSettings: getSettings, applyTheme: applyTheme,
    openPicker: openPicker, reset: reset,
    setOptions: setOptions, closePicker: closePicker, renderSettings: renderSettings,
    themes: function () { return THEMES.map(function (t) { return { id: t.id, name: t.name, description: t.desc, light: t.light }; }); }
  };
})();
