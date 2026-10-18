/* 1) "Aa" text-size button (top row)  2) 🎨 word-color button back at bottom-right, draggable  3) login page (Google or no login) */
(function () {
  const root = document.documentElement;
  const ls = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const st = document.createElement('style');
  st.textContent = `
/* ---- 🎨 word-color button: bottom-right, easy to reach; drag it anywhere ---- */
.word-mode-fab{top:auto!important;left:auto!important;right:var(--bs-wx,14px)!important;bottom:var(--bs-wy,calc(96px + env(safe-area-inset-bottom,0px)))!important;touch-action:none;-webkit-user-select:none;user-select:none;z-index:8000!important}
/* ---- Aa button + panel ---- */
#bs3-aa{position:fixed;top:21px;right:124px;width:40px;height:40px;padding:0;margin:0;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(28,32,48,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#fff;font:700 15px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);z-index:8000;transition:transform .15s}
#bs3-aa:active{transform:scale(.92)}
#bs3-aap{display:none;position:fixed;top:68px;right:12px;width:min(290px,calc(100vw - 24px));box-sizing:border-box;padding:14px 16px 16px;border-radius:20px;background:rgba(22,26,44,.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 34px rgba(0,0,0,.55);color:#fff;font:14px system-ui,sans-serif;z-index:8100}
#bs3-aap .r{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 10px}
#bs3-aap .r b{font-size:13px;color:rgba(255,255,255,.75)}
#bs3-aap .r span{font-size:12px;color:rgba(255,255,255,.5)}
#bs3-aap input[type=range]{flex:1;accent-color:#4f8cff;background:transparent;min-width:0}
#bs3-aap button{flex:none;min-width:40px;height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.09);color:#fff;font-weight:700;font-size:15px}
#bs3-aap button.rs{width:100%;margin-top:2px;font-size:13px}
/* ---- login page ---- */
#bs3-gate{position:fixed;inset:0;z-index:200000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;box-sizing:border-box;background:radial-gradient(120% 70% at 50% 0%,#3a4a8a,#0e1226 70%);color:#fff;text-align:center;font:16px/1.5 system-ui,sans-serif;overflow:auto}
#bs3-gate img{width:88px;height:88px;border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#bs3-gate h1{margin:18px 0 4px;font-size:30px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(90deg,#fff,#a9c1ff);-webkit-background-clip:text;background-clip:text;color:transparent}
#bs3-gate p{margin:0 0 30px;color:rgba(255,255,255,.65);max-width:300px}
#bs3-gate .g{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;max-width:320px;padding:14px 18px;border:none;border-radius:999px;background:#fff;color:#1f1f1f;font-size:16px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.35)}
#bs3-gate .g:disabled{opacity:.6}
#bs3-gate .n{margin-top:14px;width:100%;max-width:320px;padding:14px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;font-size:16px;font-weight:600}
#bs3-gate small{display:block;margin-top:22px;max-width:300px;color:rgba(255,255,255,.45);font-size:12.5px}
#bs3-gate .e{margin-top:12px;min-height:18px;font-size:13px;color:#ffb4b4}
`;
  document.head.appendChild(st);

  /* ================= 1) Aa ================= */
  function buildAa() {
    if (document.getElementById('bs3-aa')) return;
    const b = document.createElement('button'); b.id = 'bs3-aa'; b.textContent = 'Aa'; b.setAttribute('aria-label', 'Text size');
    const pn = document.createElement('div'); pn.id = 'bs3-aap';
    pn.innerHTML = '<div class="r"><b>Text size</b><span id="bs3-fv"></span></div>' +
      '<div class="r"><button data-f="-1">A−</button><input id="bs3-fs" type="range" min="0.7" max="1.6" step="0.05"><button data-f="1">A+</button></div>' +
      '<div class="r"><b>Line spacing</b><span id="bs3-lv"></span></div>' +
      '<div class="r"><input id="bs3-ls" type="range" min="1.2" max="2.8" step="0.05"></div>' +
      '<button class="rs" id="bs3-rs">Reset</button>';
    document.body.append(b, pn);
    const $ = (s) => pn.querySelector(s);
    const A = () => window.__bsApp;
    const show = () => { const a = A(); if (!a) return; $('#bs3-fs').value = a.fontSize; $('#bs3-ls').value = a.lineHeight; $('#bs3-fv').textContent = (+a.fontSize).toFixed(2); $('#bs3-lv').textContent = (+a.lineHeight).toFixed(2); };
    const setF = (v) => { const a = A(); if (!a) return; v = Math.max(0.7, Math.min(1.6, Math.round(v * 20) / 20)); a.setFontSize(v); $('#bs3-fs').value = v; $('#bs3-fv').textContent = v.toFixed(2); };
    const setL = (v) => { const a = A(); if (!a) return; a.setLineHeight(v); $('#bs3-lv').textContent = (+v).toFixed(2); };
    b.onclick = () => { if (pn.style.display === 'block') { pn.style.display = 'none'; return; } show(); pn.style.display = 'block'; };
    $('#bs3-fs').oninput = (e) => setF(parseFloat(e.target.value));
    $('#bs3-ls').oninput = (e) => setL(parseFloat(e.target.value));
    pn.querySelectorAll('[data-f]').forEach((x) => x.onclick = () => { const a = A(); if (a) setF(parseFloat($('#bs3-fs').value) + 0.05 * +x.dataset.f); });
    $('#bs3-rs').onclick = () => { setF(1.05); setL(1.9); };
    document.addEventListener('pointerdown', (e) => { if (pn.style.display === 'block' && !pn.contains(e.target) && e.target !== b) pn.style.display = 'none'; }, true);
  }

  /* ================= 2) draggable 🎨 ================= */
  (function wordFab() {
    try {
      const sv = JSON.parse(ls.get('bs_wpos') || 'null');
      if (sv && isFinite(sv.R) && isFinite(sv.B)) {
        root.style.setProperty('--bs-wx', Math.max(4, Math.min(innerWidth - 56, sv.R)) + 'px');
        root.style.setProperty('--bs-wy', Math.max(4, Math.min(innerHeight - 56, sv.B)) + 'px');
      }
    } catch (e) {}
    let d = null, moved = false, swallow = 0;
    const fab = (e) => (e.target && e.target.closest) ? e.target.closest('.word-mode-fab') : null;
    document.addEventListener('pointerdown', (e) => {
      const f = fab(e); if (!f) return;
      const r = f.getBoundingClientRect();
      d = { sx: e.clientX, sy: e.clientY, R0: innerWidth - r.right, B0: innerHeight - r.bottom }; moved = false;
    }, true);
    document.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!moved && Math.hypot(dx, dy) < 8) return;
      moved = true;
      d.R = Math.max(4, Math.min(innerWidth - 56, d.R0 - dx));
      d.B = Math.max(4, Math.min(innerHeight - 56, d.B0 - dy));
      root.style.setProperty('--bs-wx', d.R + 'px'); root.style.setProperty('--bs-wy', d.B + 'px');
    }, true);
    const end = () => { if (d && moved && d.R != null) { ls.set('bs_wpos', JSON.stringify({ R: d.R, B: d.B })); swallow = Date.now(); } d = null; };
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    // a drag must not count as a tap on the button
    document.addEventListener('click', (e) => { if (Date.now() - swallow < 500 && fab(e)) { e.stopPropagation(); e.preventDefault(); } }, true);
  })();

  /* ================= 3) login page ================= */
  // bs_gate: '' = not decided yet (show page) · 'guest' = chose no login · 'user' = signed in (show page again after sign-out)
  const GK = 'bs_gate';
  const G_SVG = '<svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  let gate = null;
  function showGate() {
    if (gate && document.body.contains(gate)) return;
    gate = document.createElement('div'); gate.id = 'bs3-gate';
    gate.innerHTML = '<img src="icon-192.png" alt=""><h1>Bible Study</h1><p>Read, study and pray — all in one place.</p>' +
      '<button class="g" id="bs3-g">' + G_SVG + '<span>Continue with Google</span></button>' +
      '<button class="n" id="bs3-n">Continue without login</button><div class="e" id="bs3-e"></div>' +
      '<small>Logging in backs up your bookmarks, notes and highlights. You can also log in later from Settings.</small>';
    document.body.appendChild(gate);
    const g = gate.querySelector('#bs3-g'), n = gate.querySelector('#bs3-n'), e = gate.querySelector('#bs3-e');
    n.onclick = () => { ls.set(GK, 'guest'); hideGate(); };
    g.onclick = async () => {
      const a = window.__bsApp;
      if (!a) { e.textContent = 'Still starting — please try again in a moment.'; return; }
      e.textContent = ''; g.disabled = true; g.querySelector('span').textContent = 'Signing in…';
      try { await a.signInWithGoogle(); } catch (x) {}
      g.disabled = false; g.querySelector('span').textContent = 'Continue with Google';
    };
  }
  function hideGate() { if (gate && gate.parentNode) gate.parentNode.removeChild(gate); gate = null; }

  // Called by the app whenever Firebase reports the signed-in user (or null).
  window.__bsAuthChanged = function (u) {
    if (u) { ls.set(GK, 'user'); hideGate(); }
    else if (ls.get(GK) === 'user') { ls.set(GK, ''); showGate(); } // signed out → show the login page again
  };

  function start() {
    buildAa();
    let signedBefore = false;
    try { signedBefore = Object.keys(localStorage).some((k) => k.indexOf('firebase:authUser') === 0); } catch (e) {}
    if (signedBefore && !ls.get(GK)) ls.set(GK, 'user');
    if (!ls.get(GK)) showGate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
