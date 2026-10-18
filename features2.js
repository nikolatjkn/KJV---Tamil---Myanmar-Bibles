/* Study tools: verse of the day, search + word count, compare translations, memorize (spaced repetition), prayer journal, reading plan. */
(function () {
  const K = 'bs_feat2';
  const def = { cards: [], prayers: [], plan: null, votd: '', pn: 0, rem: [] };
  let D; try { D = Object.assign({}, def, JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) { D = Object.assign({}, def); }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(D)); } catch (e) {} };
  D.prayers.forEach((p) => { if (p.id == null) p.id = ++D.pn; D.pn = Math.max(D.pn, p.id); });
  D.rem.forEach((r) => { D.pn = Math.max(D.pn, r.id); });
  const DAY = 864e5, today = () => Math.floor(Date.now() / DAY);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BD = () => { try { return BIBLE_DATA; } catch (e) { return {}; } };
  const kjv = () => (BD().kjv || {}).books || {};
  const bookList = () => Object.keys(kjv());
  const vtxt = (ver, b, c, v) => { try { return BD()[ver].books[b].chapters[c][v - 1].replace(/^\d+\s*/, ''); } catch (e) { return ''; } };
  const parseRef = (s) => { const m = /^(.+?)\s+(\d+):(\d+)$/.exec((s || '').trim()); if (!m) return null; const b = bookList().find((x) => x.toLowerCase() === m[1].toLowerCase()); return b ? { b, c: m[2], v: +m[3] } : null; };
  const POOL = ['John 3:16', 'Psalms 23:1', 'Philippians 4:13', 'Romans 8:28', 'Jeremiah 29:11', 'Isaiah 41:10', 'Proverbs 3:5', 'Matthew 11:28', 'Joshua 1:9', 'Psalms 46:1', 'Romans 12:2', 'Isaiah 40:31', 'John 14:6', 'Psalms 119:105', '2 Timothy 1:7', 'Matthew 6:33', 'Hebrews 11:1', 'Galatians 5:22', 'Psalms 27:1', 'Romans 5:8'];
  const st = document.createElement('style');
  st.textContent = `
/* ---- top dock: the study button sits in a glass row at the top, left of the language flag ---- */
#bs2-btn{position:fixed!important;top:21px!important;right:76px!important;bottom:auto!important;left:auto!important;width:40px;height:40px;padding:0!important;margin:0!important;border-radius:50%;border:1px solid rgba(255,255,255,.35)!important;background:linear-gradient(135deg,#ff5d6c,#ff9a3c)!important;color:#fff;font-size:16px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(255,110,80,.45)!important;z-index:8000;transition:transform .15s}
#bs2-btn:active{transform:scale(.92)}
/* ---- Study tools sheet ---- */
#bs2-ov{position:fixed;inset:0;z-index:100000;background:rgba(4,6,18,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:none}
#bs2-box{position:absolute;left:0;right:0;bottom:0;top:48px;border-radius:28px 28px 0 0;padding:18px 16px 28px;overflow:auto;color:#fff;font:15px/1.5 system-ui,sans-serif;background:linear-gradient(165deg,#1d2340 0%,#12152a 45%,#0c0e1b 100%);border-top:1px solid rgba(255,255,255,.14);box-shadow:0 -10px 40px rgba(0,0,0,.5);animation:bs2up .28s cubic-bezier(.2,.9,.3,1)}
@keyframes bs2up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#bs2-box:before{content:"";display:block;width:42px;height:4px;border-radius:4px;background:rgba(255,255,255,.22);margin:-8px auto 12px}
#bs2-x{float:right;position:sticky;top:0;z-index:3;width:38px;height:38px;padding:0!important;border-radius:50%!important;background:rgba(255,255,255,.1)!important;font-size:16px}
#bs2-box button{margin:4px 5px 4px 0;padding:9px 15px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font-weight:600;font-size:14px}
#bs2-box button.p{background:linear-gradient(135deg,#4f8cff,#7a6cff);border-color:transparent;box-shadow:0 4px 14px rgba(79,140,255,.35)}
#bs2-box h3{font-size:23px;font-weight:800;margin:4px 0 12px;padding-right:44px;color:#fff;text-shadow:0 0 10px rgba(120,160,255,.75),0 0 24px rgba(150,110,255,.45)}
#bs2-box .ttl{font-size:34px;font-weight:900;letter-spacing:-.5px;line-height:1.1;color:#fff;display:inline-block;text-shadow:0 0 8px rgba(130,170,255,.95),0 0 22px rgba(130,110,255,.8),0 0 44px rgba(255,100,170,.55);animation:bs2glow 2.6s ease-in-out infinite alternate}
#bs2-box .ttl i{font-style:normal;color:#ffd479;text-shadow:0 0 10px #ffb347,0 0 24px #ff7a59;margin-right:6px}
@keyframes bs2glow{from{text-shadow:0 0 6px rgba(130,170,255,.7),0 0 16px rgba(130,110,255,.55),0 0 30px rgba(255,100,170,.3)}to{text-shadow:0 0 10px rgba(150,190,255,1),0 0 28px rgba(150,120,255,.95),0 0 58px rgba(255,100,170,.7)}}
#bs2-box .ttl+.sub{margin-top:4px}
#bs2-box .sub{color:rgba(255,255,255,.5);font-size:13px;margin:2px 0 14px}
#bs2-box .hero{display:block;width:100%;box-sizing:border-box;text-align:left;padding:16px 18px;margin:0 0 14px;border-radius:22px;background:linear-gradient(135deg,#3b4cc0,#8a4fd6 60%,#d65f9a);box-shadow:0 10px 28px rgba(110,80,220,.4);position:relative;overflow:hidden}
#bs2-box .hero:after{content:"\\201C";position:absolute;right:12px;top:-14px;font:900 90px/1 Georgia,serif;color:rgba(255,255,255,.14)}
#bs2-box .hero small{display:block;color:rgba(255,255,255,.75);font-weight:700;letter-spacing:1.5px;font-size:10.5px}
#bs2-box .hero .hp{display:block;margin:6px 0 8px;font:italic 16px/1.5 Georgia,serif;color:#fff}
#bs2-box .hero b{font-size:13px;color:rgba(255,255,255,.9)}
#bs2-box .tg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#bs2-box .tc{display:flex;flex-direction:column;align-items:flex-start;gap:3px;margin:0;padding:14px;border-radius:20px;text-align:left;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.09);position:relative}
#bs2-box .tc i{font-style:normal;width:40px;height:40px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:6px;background:var(--c);box-shadow:0 6px 16px rgba(0,0,0,.35)}
#bs2-box .tc b{font-size:15px}
#bs2-box .tc small{color:rgba(255,255,255,.5);font-size:12px;font-weight:400}
#bs2-box .tc em{position:absolute;right:12px;top:12px;font-style:normal;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#ff5d6c}
#bs2-box .tc:active,#bs2-box .hero:active{transform:scale(.97)}
#bs2-box input,#bs2-box textarea{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;margin:6px 0;font-size:15px;outline:none}
#bs2-box input:focus,#bs2-box textarea:focus{border-color:#4f8cff;box-shadow:0 0 0 3px rgba(79,140,255,.25)}
#bs2-box mark{background:#ffd479;color:#000;border-radius:4px;padding:0 2px}
#bs2-box .it{padding:12px 14px;margin:8px 0;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06)}
#bs2-box .chip{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(79,140,255,.2);color:#9db8ff;font-weight:700;font-size:13px;margin-bottom:4px}
#bs2-box small{color:rgba(255,255,255,.5)}
#bs2-box .tc.wide{grid-column:1/-1;flex-direction:row;align-items:center;gap:14px}
#bs2-box .tc.wide i{margin:0;flex:none}
#bs2-box .tc.wide .tx{display:flex;flex-direction:column;gap:2px}
#bs2-box .code{display:flex;align-items:center;justify-content:center;margin:8px 0 6px;padding:14px;border-radius:18px;font:900 32px/1 ui-monospace,monospace;letter-spacing:6px;color:#fff;background:linear-gradient(135deg,rgba(79,140,255,.25),rgba(160,100,255,.25));border:1px solid rgba(255,255,255,.2);text-shadow:0 0 12px rgba(140,170,255,.9),0 0 28px rgba(160,110,255,.6);box-shadow:0 0 24px rgba(110,100,255,.3)}
#bs2-box .msg{min-height:18px;margin:4px 0;font-size:13px;color:#9db8ff}
#bs2-box .chips button{padding:7px 13px;font-size:13px}
#bs2-box .big{font-size:22px;font-weight:800}
#bs2-btn.dot:after{content:"";position:absolute;top:1px;right:1px;width:11px;height:11px;border-radius:50%;background:#ff3b5c;border:2px solid #1c2030}
#bs2-box input[type=checkbox]{width:20px;height:20px;margin:0;padding:0;accent-color:#34d399}
#bs2-box input[type=time]{width:auto;min-width:140px;margin:0;color-scheme:dark}
#bs2-box .rm{display:flex;align-items:center;gap:10px;margin:6px 0;flex-wrap:wrap}
#bs2-box .rm label,#bs2-box .ck{color:rgba(255,255,255,.75);font-size:14px;display:flex;align-items:center;gap:8px}
#bs2-box .ck{margin:6px 0 10px}
#bs2-box .sec{font-size:12px;font-weight:800;letter-spacing:1.2px;color:rgba(255,255,255,.5);margin:16px 0 4px}
#bs2-box .pr{display:flex;align-items:flex-start;gap:12px}
#bs2-box .pr.dn .pt{text-decoration:line-through;color:rgba(255,255,255,.45)}
#bs2-box .pr .pb{flex:1;min-width:0}
#bs2-box .pr .pt{font-size:15px;line-height:1.4;word-break:break-word}
#bs2-box .tk{flex:none;width:30px;height:30px;margin:1px 0 0!important;padding:0!important;border-radius:50%!important;border:2px solid rgba(255,255,255,.4)!important;background:transparent!important;color:#06281c;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center}
#bs2-box .tk.on{background:linear-gradient(135deg,#34d399,#10a574)!important;border-color:transparent!important}
#bs2-box .xx{flex:none;margin:0!important;padding:6px 8px!important;background:transparent!important;border-color:transparent!important;opacity:.7}
`;
  document.head.appendChild(st);

  let ov, box;
  const open = (h) => { box.innerHTML = '<button id="bs2-x" style="float:right">✕</button>' + h; ov.style.display = 'block'; box.querySelector('#bs2-x').onclick = () => { ov.style.display = 'none'; }; };
  const $ = (s) => box.querySelector(s);
  const on = (s, f) => { const e = $(s); if (e) e.onclick = f; };

  function card(id, icon, title, sub, c, badge, wide) {
    return '<button class="tc' + (wide ? ' wide' : '') + '" id="' + id + '" style="--c:' + c + '"><i>' + icon + '</i>' + (wide ? '<span class="tx"><b>' + title + '</b><small>' + sub + '</small></span>' : '<b>' + title + '</b><small>' + sub + '</small>') + (badge ? '<em>' + badge + '</em>' : '') + '</button>';
  }
  function home() {
    const due = D.cards.filter((c) => c.due <= today()).length;
    const nrem = D.rem.filter((x) => x.on).length, unread = INBOX.filter((x) => !x.prayed).length;
    const r = parseRef(POOL[today() % POOL.length]);
    let hero = '';
    if (r) { const tx = vtxt('kjv', r.b, r.c, r.v); if (tx) hero = '<button class="hero" id="a1"><small>TODAY\'S VERSE</small><span class="hp">' + esc(tx.length > 150 ? tx.slice(0, 150) + '…' : tx) + '</span><b>' + esc(r.b + ' ' + r.c + ':' + r.v) + '  ·  tap to open</b></button>'; }
    if (!hero) hero = '<button class="hero" id="a1"><small>VERSE OF THE DAY</small><span class="hp">A fresh verse every day.</span><b>Tap to open</b></button>';
    open('<div class="ttl"><i>✦</i>Study tools</div><div class="sub">Go deeper in the Word</div>' + hero + '<div class="tg">' +
      card('a2', '🔎', 'Search', 'Word count &amp; verses', 'linear-gradient(135deg,#4f8cff,#3b6fe0)') +
      card('a3', '⚖️', 'Compare', 'Translations side by side', 'linear-gradient(135deg,#a084fc,#7a5cf0)') +
      card('a4', '🧠', 'Memorize', due ? due + ' verse' + (due > 1 ? 's' : '') + ' to review' : 'Spaced repetition', 'linear-gradient(135deg,#34d399,#10a574)', due ? due : '') +
      card('a5', '🙏', 'Prayer journal', 'List &amp; reminders', 'linear-gradient(135deg,#ff9a3c,#f0642e)') +
      card('a6', '📅', 'Reading plan', 'One year, daily chapters', 'linear-gradient(135deg,#ff5d8f,#d63a77)') +
      card('a7', '⏰', 'Reading reminder', nrem ? nrem + ' daily time' + (nrem > 1 ? 's' : '') : 'Daily Bible time', 'linear-gradient(135deg,#22c1e8,#2e7de0)') +
      card('a8', '🤝', 'Friends', 'Share prayer requests', 'linear-gradient(135deg,#f6c445,#e8892b)', unread || '', 'wide') +
      '</div>');
    on('#a1', votd); on('#a2', search); on('#a3', () => compare('')); on('#a4', memo); on('#a5', prayer); on('#a6', plan); on('#a7', remind); on('#a8', friends);
  }
  function votd() {
    const r = parseRef(POOL[today() % POOL.length]); if (!r) return open('<p>Bible data not loaded yet.</p>');
    const vs = Object.keys(BD()).filter((k) => vtxt(k, r.b, r.c, r.v));
    open('<h3>Verse of the day</h3><span class="chip">' + esc(r.b + ' ' + r.c + ':' + r.v) + '</span>' + vs.slice(0, 3).map((k) => '<div class="it"><small>' + esc((BD()[k].abbrev || k)) + '</small><br>' + esc(vtxt(k, r.b, r.c, r.v)) + '</div>').join('') + '<button id="m">Memorize this</button><button id="h">Back</button>');
    on('#m', () => addCard(r.b + ' ' + r.c + ':' + r.v)); on('#h', home);
  }
  function search() {
    open('<h3>Search</h3><input id="q" placeholder="Word or phrase (KJV)"><button id="o">All</button><button id="ot">Old T.</button><button id="nt">New T.</button><div id="res"></div><button id="h">Back</button>');
    on('#h', home);
    const run = (f) => {
      const q = $('#q').value.trim(); if (q.length < 2) return;
      const re = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); const bl = bookList(); let tot = 0, hits = []; const per = {};
      bl.forEach((b, i) => { if (f === 'ot' && i >= 39) return; if (f === 'nt' && i < 39) return;
        const ch = kjv()[b].chapters; Object.keys(ch).forEach((c) => ch[c].forEach((t, vi) => { const m = t.match(re); if (m) { tot += m.length; per[b] = (per[b] || 0) + m.length; hits.push([b, c, vi + 1, t.replace(/^\d+\s*/, '')]); } })); });
      const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0] + ' ' + x[1]).join(', ');
      $('#res').innerHTML = '<p><b>' + tot + '</b> times in <b>' + hits.length + '</b> verses.<br><small>Most in: ' + esc(top) + '</small></p>' + hits.slice(0, 40).map((h, i) => '<div class="it"><b>' + esc(h[0] + ' ' + h[1] + ':' + h[2]) + '</b><br>' + esc(h[3]).replace(new RegExp('\\b' + esc(q), 'gi'), (x) => '<mark>' + x + '</mark>') + '<br><button data-c="' + esc(h[0] + ' ' + h[1] + ':' + h[2]) + '">Compare</button><button data-m="' + esc(h[0] + ' ' + h[1] + ':' + h[2]) + '">Memorize</button></div>').join('');
      box.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => compare(b.dataset.c)); box.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => addCard(b.dataset.m));
    };
    on('#o', () => run('all')); on('#ot', () => run('ot')); on('#nt', () => run('nt'));
  }
  function compare(ref) {
    open('<h3>Compare translations</h3><input id="r" placeholder="e.g. John 3:16" value="' + esc(ref) + '"><button class="p" id="go">Show</button><div id="out"></div><button id="h">Back</button>'); on('#h', home);
    const go = () => { const r = parseRef($('#r').value); if (!r) { $('#out').innerHTML = '<p>Use format: Book 3:16 (English book name).</p>'; return; }
      $('#out').innerHTML = Object.keys(BD()).map((k) => { const t = vtxt(k, r.b, r.c, r.v); return t ? '<div class="it"><small>' + esc(BD()[k].name || k) + '</small><br>' + esc(t) + '</div>' : ''; }).join('') || '<p>Not found.</p>'; };
    on('#go', go); if (ref) go();
  }
  function addCard(ref) {
    if (!parseRef(ref)) return;
    if (!D.cards.some((c) => c.ref === ref)) D.cards.push({ ref, box: 0, due: today() });
    save(); memo();
  }
  function memo() {
    const c = D.cards.filter((x) => x.due <= today())[0];
    if (!c) return open('<h3>Memorize</h3><p>' + (D.cards.length ? 'All done for today! 🎉' : 'No verses yet. Add one from Search or Verse of the day.') + '</p><small>' + D.cards.length + ' verses saved</small><br><button id="h">Back</button>'), on('#h', home);
    const r = parseRef(c.ref), full = vtxt('kjv', r.b, r.c, r.v), w = full.split(' ');
    const masked = w.map((x, i) => (c.box >= 3 || i % 3 !== 0) ? '_'.repeat(Math.min(x.length, 8)) : x).join(' ');
    open('<h3>' + esc(c.ref) + '</h3><p id="t">' + esc(masked) + '</p><button id="rv">Reveal</button><button class="p" id="ok">Got it</button><button id="no">Missed</button><br><small>Level ' + c.box + ' · ' + D.cards.filter((x) => x.due <= today()).length + ' due</small>');
    on('#rv', () => { $('#t').textContent = full; });
    on('#ok', () => { c.box = Math.min(c.box + 1, 5); c.due = today() + Math.pow(2, c.box - 1); save(); memo(); });
    on('#no', () => { c.box = 0; c.due = today() + 1; save(); memo(); });
  }
  function fmtT(h, m) { return (((h + 11) % 12) + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM'); }
  // Sends every unticked prayer with a time, plus every reading reminder that is on, to the Android app, which sets the real alarms.
  function syncAlarms() {
    try {
      const A = window.AndroidPrayer; if (!A) return;
      const pr = D.prayers.filter((p) => !p.ans && p.h != null).map((p) => ({ id: p.id, t: p.t, h: p.h, m: p.m, daily: !!p.daily, at: p.at || 0 }));
      const rd = D.rem.filter((r) => r.on).map((r) => ({ id: r.id, kind: 'read', title: '\uD83D\uDCD6 Time to read the Bible', t: 'Open your Bible and read today\'s chapter.', h: r.h, m: r.m, daily: true, at: 0 }));
      A.sync(JSON.stringify(pr.concat(rd)));
    } catch (e) {}
  }
  function prayer() {
    const row = (p) => '<div class="it pr' + (p.ans ? ' dn' : '') + '"><button class="tk' + (p.ans ? ' on' : '') + '" data-k="' + p.id + '" aria-label="Tick">' + (p.ans ? '✓' : '') + '</button><div class="pb"><div class="pt">' + esc(p.t) + '</div><small>' +
      (p.h != null ? '⏰ ' + fmtT(p.h, p.m) + (p.daily ? ' · every day' : ' · once') + ' · ' : '') + (p.ans ? 'Done ' + esc(p.ans) : 'Added ' + esc(p.d)) + '</small></div><button class="xx" data-sh="' + p.id + '" aria-label="Send">📤</button><button class="xx" data-x="' + p.id + '" aria-label="Delete">🗑</button></div>';
    const todo = D.prayers.filter((p) => !p.ans), done = D.prayers.filter((p) => p.ans);
    open('<h3>Prayer journal</h3><textarea id="pt" rows="2" placeholder="What do you want to pray for?"></textarea>' +
      '<div class="rm"><label for="ptm">⏰ Remind me at</label><input id="ptm" type="time"></div>' +
      '<label class="ck"><input type="checkbox" id="pdy" checked> Repeat every day</label>' +
      '<button class="p" id="ad">Add to prayer list</button>' +
      (window.AndroidPrayer ? '<button id="tst">Test reminder</button>' : '<br><small>Reminders ring in the installed Android app.</small>') +
      '<div class="sec">TO PRAY (' + todo.length + ')</div>' + (todo.map(row).join('') || '<small>Nothing yet — add your first prayer above.</small>') +
      (done.length ? '<div class="sec">DONE ✓ (' + done.length + ')</div>' + done.map(row).join('') : '') + '<br><button id="h">Back</button>');
    on('#h', home);
    on('#tst', () => { try { window.AndroidPrayer.test(); } catch (e) {} });
    on('#ad', () => {
      const t = $('#pt').value.trim(); if (!t) return;
      const p = { id: ++D.pn, t, d: new Date().toLocaleDateString(), ans: '' };
      const m = /^(\d{1,2}):(\d{2})$/.exec($('#ptm').value || '');
      if (m) {
        p.h = +m[1]; p.m = +m[2]; p.daily = $('#pdy').checked;
        if (!p.daily) { const at = new Date(); at.setHours(p.h, p.m, 0, 0); if (at.getTime() <= Date.now() + 1000) at.setDate(at.getDate() + 1); p.at = at.getTime(); }
      }
      D.prayers.unshift(p); save(); syncAlarms(); prayer();
    });
    box.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { const p = D.prayers.find((x) => x.id === +b.dataset.k); if (p) { p.ans = p.ans ? '' : new Date().toLocaleDateString(); save(); syncAlarms(); prayer(); } });
    box.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { D.prayers = D.prayers.filter((x) => x.id !== +b.dataset.x); save(); syncAlarms(); prayer(); });
    box.querySelectorAll('[data-sh]').forEach((b) => b.onclick = () => { const p = D.prayers.find((x) => x.id === +b.dataset.sh); if (p) compose(p.t, null, prayer); });
  }
  function remind() {
    const rows = D.rem.slice().sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m)).map((r) =>
      '<div class="it pr"><div class="pb"><div class="big">' + fmtT(r.h, r.m) + '</div><small>Every day · ' + (r.on ? 'On' : 'Off') + '</small></div>' +
      '<label class="ck" style="margin:0"><input type="checkbox" data-t="' + r.id + '"' + (r.on ? ' checked' : '') + '> On</label><button class="xx" data-x="' + r.id + '" aria-label="Delete">🗑</button></div>').join('');
    open('<h3>Reading reminder</h3><div class="sub">A daily nudge to open your Bible.</div>' +
      '<div class="rm"><label for="rtm">⏰ Time</label><input id="rtm" type="time" value="07:00"></div>' +
      '<div class="chips"><button data-q="06:00">🌅 6:00 AM</button><button data-q="12:00">☀️ 12:00 PM</button><button data-q="20:00">🌙 8:00 PM</button></div>' +
      '<button class="p" id="radd">Add reminder</button>' + (window.AndroidPrayer ? '<button id="tst">Test</button>' : '<br><small>Reminders ring in the installed Android app.</small>') +
      '<div class="sec">YOUR REMINDERS (' + D.rem.length + ')</div>' + (rows || '<small>No reminder yet — pick a time above.</small>') + '<br><button id="h">Back</button>');
    on('#h', home);
    on('#tst', () => { try { window.AndroidPrayer.test(); } catch (e) {} });
    box.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { $('#rtm').value = b.dataset.q; });
    on('#radd', () => {
      const m = /^(\d{1,2}):(\d{2})$/.exec($('#rtm').value || ''); if (!m) return;
      if (D.rem.some((r) => r.h === +m[1] && r.m === +m[2])) return;
      D.rem.push({ id: ++D.pn, h: +m[1], m: +m[2], on: true }); save(); syncAlarms(); remind();
    });
    box.querySelectorAll('[data-t]').forEach((b) => b.onchange = () => { const r = D.rem.find((x) => x.id === +b.dataset.t); if (r) { r.on = b.checked; save(); syncAlarms(); remind(); } });
    box.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { D.rem = D.rem.filter((x) => x.id !== +b.dataset.x); save(); syncAlarms(); remind(); });
  }

  /* ---------- Friends: friend codes + prayer requests, stored in the app's Firebase (needs Google login) ---------- */
  let INBOX = [], FRIENDS = [], unsubs = [], hooked = false, firstInbox = true;
  const fb = () => (window.firebase && window.firebase.apps && window.firebase.apps.length ? window.firebase : null);
  const db = () => { const f = fb(); return f ? f.firestore() : null; };
  const me = () => { const f = fb(); return f ? f.auth().currentUser : null; };
  const myName = (u) => (u.displayName || (u.email || 'Friend').split('@')[0]).slice(0, 40);
  function myCode(uid) {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let h = 2166136261;
    for (let i = 0; i < uid.length; i++) { h ^= uid.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let c = ''; for (let i = 0; i < 6; i++) { c += A[h % A.length]; h = Math.floor(h / A.length); } return c;
  }
  const fdate = (t) => { try { return new Date(t).toLocaleDateString(); } catch (e) { return ''; } };
  function badge() { const b = document.getElementById('bs2-btn'); if (b) b.classList.toggle('dot', INBOX.some((x) => !x.prayed)); }
  function onAuth(u) {
    unsubs.forEach((f) => { try { f(); } catch (e) {} }); unsubs = []; INBOX = []; FRIENDS = []; firstInbox = true; badge();
    if (!u || !db()) return;
    const root = db().collection('profiles').doc(u.uid);
    root.set({ uid: u.uid, name: myName(u), code: myCode(u.uid) }, { merge: true }).catch(() => {});
    unsubs.push(root.collection('inbox').orderBy('at', 'desc').limit(50).onSnapshot((sn) => {
      INBOX = sn.docs.map((d) => Object.assign({ id: d.id }, d.data())); badge();
      if (!firstInbox) sn.docChanges().forEach((ch) => { if (ch.type === 'added' && !ch.doc.metadata.hasPendingWrites) { try { const x = ch.doc.data(); window.AndroidPrayer && window.AndroidPrayer.notify('🙏 Prayer request from ' + x.fromName, x.text); } catch (e) {} } });
      firstInbox = false;
    }, () => {}));
    unsubs.push(root.collection('friends').onSnapshot((sn) => { FRIENDS = sn.docs.map((d) => Object.assign({ id: d.id }, d.data())); }, () => {}));
  }
  function hookAuth() { if (hooked || !fb()) return; hooked = true; fb().auth().onAuthStateChanged(onAuth); }
  function shareOut(text) {
    const t = '🙏 Prayer request:\n' + text + '\n\n— sent from my Bible Study app';
    try { if (window.AndroidPrayer && window.AndroidPrayer.share) return window.AndroidPrayer.share(t); } catch (e) {}
    try { if (navigator.share) return navigator.share({ text: t }); } catch (e) {}
    try { navigator.clipboard.writeText(t); } catch (e) {}
  }
  function needLogin(title, back) {
    open('<h3>' + title + '</h3><p>' + (db() ? 'Log in with Google to connect with friends and send them prayer requests inside the app.' : 'Friends need an internet connection. Try again when you are online.') + '</p>' + (db() ? '<button class="p" id="li">Log in with Google</button>' : '') + '<button id="h">Back</button>');
    on('#h', back); on('#li', () => { try { ov.style.display = 'none'; window.__bsApp.signInWithGoogle(); } catch (e) {} });
  }
  function friends() {
    const u = me(); if (!u || !db()) return needLogin('Friends', home);
    const code = myCode(u.uid);
    const fr = FRIENDS.map((f) => '<div class="it pr"><div class="pb"><div class="pt">' + esc(f.name || 'Friend') + '</div></div><button data-s="' + f.id + '">🙏 Send</button><button class="xx" data-rf="' + f.id + '" aria-label="Remove">🗑</button></div>').join('');
    const inb = INBOX.map((x) => '<div class="it"><b>' + esc(x.fromName || 'Friend') + '</b> <small>' + fdate(x.at) + '</small><div class="pt" style="margin:6px 0">' + esc(x.text) + '</div>' +
      (x.prayed ? '<small>🙏 You prayed for this</small>' : '<button class="p" data-p="' + x.id + '">🙏 I prayed</button>') + '<button data-di="' + x.id + '">Delete</button></div>').join('');
    open('<h3>Friends</h3><div class="sub">Share prayer requests with people you trust.</div><small>YOUR FRIEND CODE</small><div class="code">' + code + '</div>' +
      '<button id="cp">Copy</button><button id="iv">Invite a friend</button>' +
      '<div class="sec">ADD A FRIEND</div><input id="fc" placeholder="Friend\'s code" maxlength="8" autocapitalize="characters"><button class="p" id="fa">Add friend</button><div class="msg" id="fm"></div>' +
      '<div class="sec">MY FRIENDS (' + FRIENDS.length + ')</div>' + (fr || '<small>No friends yet. Share your code, or enter theirs above.</small>') +
      '<div class="sec">PRAYER REQUESTS FROM FRIENDS (' + INBOX.length + ')</div>' + (inb || '<small>Nothing yet.</small>') + '<br><button id="h">Back</button>');
    on('#h', home);
    on('#cp', () => { try { navigator.clipboard.writeText(code); $('#fm').textContent = 'Code copied.'; } catch (e) { $('#fm').textContent = 'Your code: ' + code; } });
    on('#iv', () => shareOut2('Join me on my Bible Study app! Add me with my friend code: ' + code));
    on('#fa', async () => {
      const c = ($('#fc').value || '').trim().toUpperCase(), m = $('#fm'); if (c.length < 4) { m.textContent = 'Enter your friend\'s code.'; return; }
      if (c === code) { m.textContent = 'That is your own code.'; return; }
      m.textContent = 'Looking…';
      try {
        const q = await db().collection('profiles').where('code', '==', c).limit(1).get();
        if (q.empty) { m.textContent = 'No one found with that code.'; return; }
        const fid = q.docs[0].id, f = q.docs[0].data(), b = db().batch();
        b.set(db().doc('profiles/' + u.uid + '/friends/' + fid), { name: f.name || 'Friend', at: Date.now() });
        b.set(db().doc('profiles/' + fid + '/friends/' + u.uid), { name: myName(u), at: Date.now() });
        await b.commit(); m.textContent = '✓ ' + (f.name || 'Friend') + ' added!';
        setTimeout(() => { if (ov.style.display === 'block' && $('#fc')) friends(); }, 900);
      } catch (e) { m.textContent = 'Could not add: ' + (e.code === 'permission-denied' ? 'friend rules are not published yet in Firebase.' : (e.message || e)); }
    });
    box.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => compose('', b.dataset.s, friends));
    box.querySelectorAll('[data-rf]').forEach((b) => b.onclick = async () => { try { const id = b.dataset.rf; const bt = db().batch(); bt.delete(db().doc('profiles/' + u.uid + '/friends/' + id)); bt.delete(db().doc('profiles/' + id + '/friends/' + u.uid)); await bt.commit(); } catch (e) {} setTimeout(friends, 300); });
    box.querySelectorAll('[data-p]').forEach((b) => b.onclick = async () => { try { await db().doc('profiles/' + u.uid + '/inbox/' + b.dataset.p).update({ prayed: true }); } catch (e) {} setTimeout(friends, 300); });
    box.querySelectorAll('[data-di]').forEach((b) => b.onclick = async () => { try { await db().doc('profiles/' + u.uid + '/inbox/' + b.dataset.di).delete(); } catch (e) {} setTimeout(friends, 300); });
  }
  const shareOut2 = (t) => { try { if (window.AndroidPrayer && window.AndroidPrayer.share) return window.AndroidPrayer.share(t); } catch (e) {} try { if (navigator.share) return navigator.share({ text: t }); } catch (e) {} try { navigator.clipboard.writeText(t); } catch (e) {} };
  function compose(text, pre, back) {
    const u = me(), list = u ? FRIENDS : [];
    open('<h3>Send prayer request</h3><textarea id="ct" rows="4" placeholder="Your prayer request">' + esc(text || '') + '</textarea>' +
      (list.length ? '<div class="sec">SEND TO</div>' + list.map((f) => '<label class="ck"><input type="checkbox" data-f="' + f.id + '"' + (pre === f.id ? ' checked' : '') + '> ' + esc(f.name || 'Friend') + '</label>').join('') :
        '<small>' + (u ? 'No friends yet — add one with their code in Friends.' : 'Log in with Google to send to friends inside the app.') + '</small>') +
      '<div class="msg" id="cm"></div>' + (list.length ? '<button class="p" id="cs">Send</button>' : '') + '<button id="csh">Share via WhatsApp / other app</button><button id="h">Back</button>');
    on('#h', back || home);
    on('#csh', () => { const t = $('#ct').value.trim(); if (t) shareOut(t); });
    on('#cs', async () => {
      const t = $('#ct').value.trim(), ids = [].slice.call(box.querySelectorAll('[data-f]:checked')).map((x) => x.dataset.f), m = $('#cm');
      if (!t) { m.textContent = 'Write the prayer request first.'; return; } if (!ids.length) { m.textContent = 'Pick at least one friend.'; return; }
      m.textContent = 'Sending…';
      try { await Promise.all(ids.map((id) => db().collection('profiles').doc(id).collection('inbox').add({ fromUid: u.uid, fromName: myName(u), text: t, at: Date.now(), prayed: false }))); m.textContent = '✓ Sent to ' + ids.length + ' friend' + (ids.length > 1 ? 's' : '') + '.'; }
      catch (e) { m.textContent = 'Could not send: ' + (e.code === 'permission-denied' ? 'friend rules are not published yet in Firebase.' : (e.message || e)); }
    });
  }
  function plan() {
    const chs = []; bookList().forEach((b) => Object.keys(kjv()[b].chapters).forEach((c) => chs.push(b + ' ' + c)));
    if (!chs.length) return open('<p>Bible data not loaded yet.</p>');
    if (!D.plan) { D.plan = { start: today(), done: {} }; save(); }
    const per = Math.ceil(chs.length / 365), d = Math.max(0, today() - D.plan.start), mine = chs.slice(d * per, d * per + per);
    let streak = 0, i = d; if (!D.plan.done[i]) i--; while (i >= 0 && D.plan.done[i]) { streak++; i--; }
    const missed = []; for (let k = 0; k < d; k++) if (!D.plan.done[k]) missed.push(k);
    open('<h3>1-year reading plan</h3><p>Day ' + (d + 1) + ' of 365 · 🔥 ' + streak + '-day streak</p><p><b>Today:</b> ' + esc(mine.join(', ') || 'Plan complete!') + '</p><button class="p" id="dn">' + (D.plan.done[d] ? 'Done ✓ (undo)' : 'Mark today read') + '</button>' + (missed.length ? '<p><small>' + missed.length + ' catch-up days behind. First: Day ' + (missed[0] + 1) + ' — ' + esc(chs.slice(missed[0] * per, missed[0] * per + per).join(', ')) + '</small></p><button id="cu">Mark that catch-up day read</button>' : '') + '<br><button id="rs">Restart plan</button><button id="h">Back</button>');
    on('#dn', () => { D.plan.done[d] = !D.plan.done[d]; save(); plan(); }); on('#h', home);
    on('#cu', () => { D.plan.done[missed[0]] = true; save(); plan(); }); on('#rs', () => { D.plan = null; save(); plan(); });
  }
  function build() {
    const b = document.createElement('button'); b.id = 'bs2-btn'; b.textContent = '✦'; ov = document.createElement('div'); ov.id = 'bs2-ov'; box = document.createElement('div'); box.id = 'bs2-box'; ov.appendChild(box);
    document.body.append(b, ov); b.onclick = home;
    setTimeout(syncAlarms, 2000);
    hookAuth(); window.addEventListener('firebase-ready', hookAuth); setTimeout(hookAuth, 4000);
    if (D.votd !== String(today())) setTimeout(() => { if (!document.getElementById('bs3-gate') && ov.style.display !== 'block' && Object.keys(kjv()).length) { D.votd = String(today()); save(); votd(); } }, 3500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
