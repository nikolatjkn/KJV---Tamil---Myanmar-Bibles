/* ============================================================
   bs_phase2.js  -  Phase 2: Word Study Pro + Translation Lab
   Plain <script>, no dependencies. Exposes ONE global: window.BS_P2

   The app creates the two pages once:
     BS_P2.create({ React, useApp, books })  ->  { WordStudyPage, CompareLabPage }

   Data used (nothing is invented):
     - window.HEBREW_STRONGS / window.GREEK_STRONGS  (dictionary)
     - ./interlinear/<Book>.json  (each word has its Strong's number and English gloss)
     - the Bible versions already loaded in the app (bibles)
   ============================================================ */
(function (root) {
    'use strict';
    var P2 = root.BS_P2 = root.BS_P2 || {};
    P2.version = '2.0.0';

    /* ---------------- small helpers ---------------- */
    function safeLS(key, fallback) { try { var v = root.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
    function safeLSset(key, val) { try { root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function stripNum(t) { return String(t == null ? '' : t).replace(/^[\d\u1040-\u1049\u0BE6-\u0BEF]+\s*/, ''); }
    function normCode(s) {
        var m = /^\s*([HhGg])\s*0*(\d+)\s*[a-zA-Z]?\s*$/.exec(String(s || ''));
        return m ? m[1].toUpperCase() + m[2] : null;
    }
    function fileFor(book) { return book.replace(/ /g, '_').replace(/'/g, '') + '.json'; }

    /* ---------------- own tiny IndexedDB (separate from BS.db) ---------------- */
    var dbp = null;
    function kvOpen() {
        if (dbp) return dbp;
        dbp = new Promise(function (res) {
            try {
                var rq = root.indexedDB.open('bs_phase2', 1);
                rq.onupgradeneeded = function () { rq.result.createObjectStore('kv', { keyPath: 'id' }); };
                rq.onsuccess = function () { res(rq.result); };
                rq.onerror = rq.onblocked = function () { res(null); };
            } catch (e) { res(null); }
        });
        return dbp;
    }
    function kvGet(id) {
        return kvOpen().then(function (db) {
            if (!db) return null;
            return new Promise(function (res) {
                try {
                    var r = db.transaction('kv').objectStore('kv').get(id);
                    r.onsuccess = function () { res(r.result || null); };
                    r.onerror = function () { res(null); };
                } catch (e) { res(null); }
            });
        });
    }
    function kvPut(rec) {
        return kvOpen().then(function (db) {
            if (!db) return false;
            return new Promise(function (res) {
                try {
                    var t = db.transaction('kv', 'readwrite');
                    t.objectStore('kv').put(rec);
                    t.oncomplete = function () { res(true); };
                    t.onerror = t.onabort = function () { res(false); };
                } catch (e) { res(false); }
            });
        });
    }
    P2.kvGet = kvGet; P2.kvPut = kvPut;

    /* ---------------- occurrence index (built once per testament, then cached) ----------------
       index = { v, kind:'H'|'G', books:[names], glosses:[strings], codes:{ H430:[verseId,glossId,...] } }
       verseId = bookIndex*1e6 + chapter*1e3 + verse   (bookIndex = position in index.books)          */
    var INDEX_VERSION = 1;
    var memIdx = {};

    function booksForKind(kind, allBooks) { return kind === 'H' ? allBooks.slice(0, 39) : allBooks.slice(39, 66); }

    P2.getCachedIndex = function (kind, allBooks) {
        if (memIdx[kind]) return Promise.resolve(memIdx[kind]);
        return kvGet('idx_' + kind).then(function (rec) {
            var want = booksForKind(kind, allBooks);
            if (rec && rec.v === INDEX_VERSION && rec.books && rec.books.join('|') === want.join('|') && rec.codes) {
                memIdx[kind] = rec; return rec;
            }
            return null;
        });
    };

    /** Reads every interlinear file of the testament, one at a time (memory stays small). */
    P2.buildIndex = function (kind, allBooks, onProgress, cancel) {
        var books = booksForKind(kind, allBooks);
        var glossId = {}, glosses = [], codes = {}, missing = [];
        function gid(g) { if (glossId[g] === undefined) { glossId[g] = glosses.length; glosses.push(g); } return glossId[g]; }
        var i = 0;
        function next() {
            if (cancel && cancel.cancelled) return Promise.resolve(null);
            if (i >= books.length) {
                var idx = { v: INDEX_VERSION, kind: kind, books: books, glosses: glosses, codes: codes, missing: missing };
                memIdx[kind] = idx;
                if (!missing.length) kvPut({ id: 'idx_' + kind, v: INDEX_VERSION, kind: kind, books: books, glosses: glosses, codes: codes });
                return Promise.resolve(idx);
            }
            var bi = i, book = books[i]; i++;
            if (onProgress) onProgress({ done: bi, total: books.length, book: book });
            return fetch('./interlinear/' + fileFor(book))
                .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
                .then(function (data) {
                    Object.keys(data).forEach(function (key) {
                        var m = /:(\d+):(\d+)$/.exec(key); if (!m) return;
                        var vid = bi * 1e6 + Number(m[1]) * 1e3 + Number(m[2]);
                        var words = data[key]; if (!Array.isArray(words)) return;
                        for (var k = 0; k < words.length; k++) {
                            var w = words[k]; if (!w || !w.strongs) continue;
                            var parts = String(w.strongs).split(/[\s,;]+/);
                            var g = null;
                            for (var p = 0; p < parts.length; p++) {
                                var c = normCode(parts[p]);
                                if (!c || c.charAt(0) !== kind) continue;
                                if (g === null) g = gid(String(w.english || '').trim().toLowerCase());
                                (codes[c] = codes[c] || []).push(vid, g);
                            }
                        }
                    });
                })
                .catch(function () { missing.push(book); })
                .then(next);
        }
        return next();
    };

    /** Everything the Word Study page shows for one Strong's number. */
    P2.query = function (index, code) {
        var arr = index.codes[code];
        if (!arr || !arr.length) return { total: 0, verses: 0, byBook: [], renderings: [], occ: [] };
        var occ = [], n = arr.length / 2;
        for (var i = 0; i < arr.length; i += 2) occ.push([arr[i], arr[i + 1]]);
        occ.sort(function (a, b) { return a[0] - b[0]; });
        var byBook = {}, gl = {}, seenV = {}, out = [];
        occ.forEach(function (o) {
            var bi = Math.floor(o[0] / 1e6), ch = Math.floor((o[0] % 1e6) / 1e3), v = o[0] % 1e3;
            var book = index.books[bi], g = index.glosses[o[1]] || '(not glossed)';
            byBook[book] = (byBook[book] || 0) + 1;
            gl[g] = (gl[g] || 0) + 1;
            seenV[o[0]] = 1;
            out.push({ book: book, chapter: ch, verse: v, ref: book + ' ' + ch + ':' + v, gloss: g });
        });
        return {
            total: n,
            verses: Object.keys(seenV).length,
            byBook: index.books.filter(function (b) { return byBook[b]; }).map(function (b) { return { book: b, n: byBook[b] }; }),
            renderings: Object.keys(gl).map(function (g) { return { g: g, n: gl[g] }; }).sort(function (a, b) { return b.n - a.n || (a.g < b.g ? -1 : 1); }),
            occ: out
        };
    };

    /** Dictionary lookup (exact number, or text search). */
    P2.entry = function (code) {
        var d = code.charAt(0) === 'H' ? root.HEBREW_STRONGS : root.GREEK_STRONGS;
        return (d && d[code]) || null;
    };
    var hayCache = {};
    /** lower-case and drop accents/diacritics so "agape" finds "agapē" */
    function fold(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    P2.fold = fold;
    P2.search = function (q, limit) {
        q = String(q || '').trim(); limit = limit || 40;
        if (!q) return [];
        var out = [], c = normCode(q);
        if (c && P2.entry(c)) out.push({ code: c, entry: P2.entry(c) });
        else if (/^\d+$/.test(q)) {
            ['H', 'G'].forEach(function (k) { var cc = k + String(Number(q)); if (P2.entry(cc)) out.push({ code: cc, entry: P2.entry(cc) }); });
        }
        if (out.length) return out;
        var ql = fold(q);
        [['H', root.HEBREW_STRONGS], ['G', root.GREEK_STRONGS]].forEach(function (pair) {
            var d = pair[1] || {};
            for (var k in d) {
                if (out.length >= limit) return;
                var e = d[k];
                if (hayCache[k] === undefined)
                    hayCache[k] = fold([e.lemma, e.xlit, e.translit, e.kjv_def, e.strongs_def].filter(Boolean).join(' '));
                if (hayCache[k].indexOf(ql) >= 0) out.push({ code: k, entry: e });
            }
        });
        return out.slice(0, limit);
    };

    /* ---------------- passage parsing + diff (pure functions, unit-tested) ---------------- */
    P2.matchBook = function (name, bookNames) {
        var n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!n) return { error: 'Type a passage, e.g. John 3:16-21' };
        var flat = function (s) { return s.toLowerCase().replace(/[\s.]/g, ''); };
        var exact = bookNames.filter(function (b) { return b.toLowerCase() === n || flat(b) === flat(n); });
        if (exact.length === 1) return { book: exact[0] };
        var pre = bookNames.filter(function (b) { return flat(b).indexOf(flat(n)) === 0; });
        if (pre.length === 1) return { book: pre[0] };
        if (pre.length > 1) return { error: 'Which book? ' + pre.slice(0, 6).join(', ') };
        return { error: 'Book "' + name + '" was not found.' };
    };
    /** "John 3:16-21" | "John 3:16" | "John 3" -> {book, chapter, start, end} (end/start null = whole chapter) */
    P2.parsePassage = function (text, bookNames) {
        var m = /^(.+?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?)?\s*$/.exec(String(text || '').trim());
        if (!m) return { error: 'Use a form like John 3:16-21, John 3:16 or John 3' };
        var b = P2.matchBook(m[1], bookNames);
        if (b.error) return b;
        var start = m[3] ? Number(m[3]) : null, end = m[4] ? Number(m[4]) : start;
        if (start && end && end < start) { var t = start; start = end; end = t; }
        return { book: b.book, chapter: Number(m[2]), start: start, end: end };
    };

    var TOKEN_RE = /[\p{L}\p{M}\p{N}'\u2019]+/gu;
    P2.tokenize = function (text) {
        var out = [], m; TOKEN_RE.lastIndex = 0;
        while ((m = TOKEN_RE.exec(text)) !== null) out.push({ w: m[0].toLowerCase().replace(/\u2019/g, "'"), s: m.index, e: m.index + m[0].length });
        return out;
    };
    /** Word-level LCS. Returns which tokens of each side are shared. */
    P2.diff = function (aText, bText) {
        var A = P2.tokenize(aText), B = P2.tokenize(bText), n = A.length, m = B.length;
        var dp = new Array(n + 1);
        for (var i = 0; i <= n; i++) { dp[i] = new Uint16Array(m + 1); }
        for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--)
            dp[i][j] = A[i].w === B[j].w ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        var sa = new Array(n).fill(false), sb = new Array(m).fill(false);
        i = 0; var jj = 0;
        while (i < n && jj < m) {
            if (A[i].w === B[jj].w) { sa[i] = true; sb[jj] = true; i++; jj++; }
            else if (dp[i + 1][jj] >= dp[i][jj + 1]) i++; else jj++;
        }
        var lcs = dp[0][0];
        return { a: A, b: B, sharedA: sa, sharedB: sb, lcs: lcs, similarity: (n + m) === 0 ? 1 : (2 * lcs) / (n + m) };
    };
    /** Split text into [{t, diff}] segments; tokens not shared are flagged. */
    P2.segments = function (text, tokens, shared) {
        var segs = [], pos = 0;
        tokens.forEach(function (tk, i) {
            if (tk.s > pos) segs.push({ t: text.slice(pos, tk.s), d: false });
            segs.push({ t: text.slice(tk.s, tk.e), d: !shared[i] });
            pos = tk.e;
        });
        if (pos < text.length) segs.push({ t: text.slice(pos), d: false });
        return segs;
    };

    function exportText(md, name, flash) {
        if (root.AndroidBackup && root.AndroidBackup.exportBackup) { root.AndroidBackup.exportBackup(md, name); return; }
        try {
            var url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
            var a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { flash('Export failed.'); }
    }
    function copyText(md, flash) {
        try { navigator.clipboard.writeText(md).then(function () { flash('Copied.'); }, function () { flash('Copy not available.'); }); }
        catch (e) { flash('Copy not available.'); }
    }

    /* ---------------- styles ---------------- */
    function injectStyle() {
        if (document.getElementById('p2-style')) return;
        var st = document.createElement('style'); st.id = 'p2-style';
        st.textContent = [
            '.p2-card{padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin-bottom:10px}',
            '.p2-h{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:6px}',
            '.p2-in{width:100%;max-width:520px;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f1f1f1;font-size:.95rem;outline:none;box-sizing:border-box}',
            '.p2-btn{padding:7px 12px;margin:3px 6px 3px 0;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e8e8e8;font-size:.82rem;cursor:pointer}',
            '.p2-btn.on{background:rgba(79,140,255,.25);border-color:rgba(79,140,255,.7);color:#fff}',
            '.p2-btn[disabled]{opacity:.4;cursor:default}',
            '.p2-note{font-size:.78rem;color:rgba(255,255,255,.45);margin:6px 0;line-height:1.5}',
            '.p2-err{font-size:.85rem;color:#ff9b9b;margin:8px 0}',
            '.p2-bar{height:8px;border-radius:4px;background:#4f8cff;min-width:2px}',
            '.p2-row{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:.85rem}',
            '.p2-row.sel{background:rgba(79,140,255,.12)}',
            '.p2-diff{background:rgba(255,196,0,.22);border-bottom:1px solid rgba(255,196,0,.7);border-radius:2px}',
            '.p2-chip{display:inline-block;padding:3px 9px;margin:3px 5px 3px 0;border-radius:14px;border:1px solid rgba(255,255,255,.15);font-size:.78rem;cursor:pointer;color:#ddd;background:rgba(255,255,255,.04)}',
            '.p2-chip.on{background:rgba(79,140,255,.28);border-color:#4f8cff;color:#fff}',
            '.p2-prog{height:10px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden;margin:8px 0}',
            '.p2-prog>div{height:100%;background:#4f8cff;transition:width .15s}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------------- React pages ---------------- */
    P2.create = function (ctx) {
        var React = ctx.React, useApp = ctx.useApp, BOOKS = ctx.books || [];
        var h = React.createElement, useState = React.useState, useEffect = React.useEffect,
            useMemo = React.useMemo, useRef = React.useRef;
        injectStyle();

        function openRef(ref, flash) {
            if (root.BS && root.BS.nav && root.BS.nav.isReady() && root.BS.nav.openPassage(ref)) return;
            flash('Not available in the selected Bible.');
        }
        function verseText(bibles, ver, book, ch, v) {
            var b = bibles[ver] && bibles[ver].books && bibles[ver].books[book];
            var c = b && b.chapters && b.chapters[String(ch)];
            return c && c[v - 1] ? stripNum(c[v - 1]) : null;
        }

        /* ===================== Word Study Pro ===================== */
        function WordStudyPage() {
            var app = useApp(), bibles = app.bibles || {}, activeVersion = app.activeVersion;
            var _q = useState(''), q = _q[0], setQ = _q[1];
            var _c = useState(null), code = _c[0], setCode = _c[1];
            var _i = useState(null), idx = _i[0], setIdx = _i[1];
            var _p = useState(null), prog = _p[0], setProg = _p[1];
            var _m = useState(''), msg = _m[0], setMsg = _m[1];
            var _s = useState(25), shown = _s[0], setShown = _s[1];
            var _g = useState(null), gloss = _g[0], setGloss = _g[1];
            var _b = useState(null), bookF = _b[0], setBookF = _b[1];
            var cancel = useRef({ cancelled: false });
            var flash = function (t) { setMsg(t); setTimeout(function () { setMsg(''); }, 2500); };

            useEffect(function () {
                if (root.__bsWordStudyCode) { var c = normCode(root.__bsWordStudyCode); root.__bsWordStudyCode = null; if (c) setCode(c); }
                return function () { cancel.current.cancelled = true; };
            }, []);

            useEffect(function () {
                setShown(25); setGloss(null); setBookF(null); setIdx(null);
                if (!code) return;
                var dead = false;
                P2.getCachedIndex(code.charAt(0), BOOKS).then(function (r) { if (!dead && r) setIdx(r); });
                return function () { dead = true; };
            }, [code]);

            var results = useMemo(function () { return code ? [] : P2.search(q, 40); }, [q, code]);
            var entry = code ? P2.entry(code) : null;
            var kind = code ? code.charAt(0) : null;
            var data = useMemo(function () { return code && idx ? P2.query(idx, code) : null; }, [code, idx]);

            var startScan = function () {
                cancel.current = { cancelled: false };
                setProg({ done: 0, total: 1, book: '' });
                P2.buildIndex(kind, BOOKS, function (p) { setProg(p); }, cancel.current).then(function (r) {
                    setProg(null);
                    if (r) { setIdx(r); if (r.missing && r.missing.length) flash('Could not read: ' + r.missing.join(', ')); }
                });
            };
            var cancelScan = function () { cancel.current.cancelled = true; setProg(null); };

            var occ = useMemo(function () {
                if (!data) return [];
                return data.occ.filter(function (o) { return (!gloss || o.gloss === gloss) && (!bookF || o.book === bookF); });
            }, [data, gloss, bookF]);

            var reportMd = function () {
                var e = entry || {};
                var s = '# Word study: ' + code + (e.lemma ? ' ' + e.lemma : '') + '\n\n';
                if (e.xlit || e.translit) s += 'Transliteration: ' + (e.xlit || e.translit) + '\n\n';
                if (e.strongs_def) s += 'Definition: ' + e.strongs_def + '\n\n';
                if (e.kjv_def) s += 'KJV: ' + e.kjv_def + '\n\n';
                if (data) {
                    s += 'Source: the interlinear data in this app. ' + data.total + ' occurrences in ' + data.verses + ' verses.\n\n## By book\n';
                    data.byBook.forEach(function (b) { s += '- ' + b.book + ': ' + b.n + '\n'; });
                    s += '\n## How it is rendered in English\n';
                    data.renderings.slice(0, 40).forEach(function (r) { s += '- ' + r.g + ': ' + r.n + '\n'; });
                    s += '\n## Verses' + (gloss || bookF ? ' (filtered)' : '') + '\n';
                    occ.forEach(function (o) { s += '- ' + o.ref + ' (' + o.gloss + ')\n'; });
                }
                return s;
            };

            var card = function (c) {
                var e = c.entry;
                return h('div', { key: c.code, className: 'p2-card', style: { cursor: 'pointer' }, onClick: function () { setCode(c.code); } },
                    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
                        h('span', { style: { fontSize: '.75rem', color: '#4f8cff', fontWeight: 600 } }, c.code),
                        h('span', { style: { fontSize: '1.1rem' } }, e.lemma || ''),
                        h('span', { style: { fontSize: '.85rem', color: 'rgba(255,255,255,.45)', fontStyle: 'italic' } }, e.xlit || e.translit || '')),
                    h('div', { className: 'p2-note' }, ((e.kjv_def || '') + ' ' + (e.strongs_def || '')).trim().slice(0, 140)));
            };

            var head = h('div', null,
                h('h2', { style: { fontSize: '1.4rem', fontWeight: 600, marginBottom: 6 } }, '\uD83D\uDD0E Word Study Pro'),
                h('div', { className: 'p2-note' }, 'Look up a Hebrew or Greek word by Strong\u2019s number (H430, G26) or by meaning (love, covenant), then see every verse where it is used and how it is translated.'));

            if (!code) {
                return h('div', { className: 'page-enter' }, head,
                    h('input', { className: 'p2-in', placeholder: 'H430, G26, love, agape\u2026', value: q, onChange: function (e) { setQ(e.target.value); } }),
                    q.trim() && results.length === 0 && h('div', { className: 'p2-note' }, 'No dictionary entry matched.'),
                    h('div', { style: { marginTop: 12 } }, results.map(card)));
            }

            var maxBook = data ? Math.max.apply(null, data.byBook.map(function (b) { return b.n; })) : 1;
            return h('div', { className: 'page-enter' }, head,
                h('button', { className: 'p2-btn', onClick: function () { setCode(null); } }, '\u2190 Back to search'),
                h('div', { className: 'p2-card' },
                    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
                        h('span', { style: { fontSize: '.85rem', color: '#4f8cff', fontWeight: 700 } }, code),
                        h('span', { style: { fontSize: '1.5rem' } }, entry ? entry.lemma : ''),
                        h('span', { style: { fontSize: '.9rem', color: 'rgba(255,255,255,.5)', fontStyle: 'italic' } }, entry ? (entry.xlit || entry.translit || '') : ''),
                        entry && entry.pron && h('span', { className: 'p2-note' }, '(' + entry.pron + ')')),
                    !entry && h('div', { className: 'p2-note' }, 'No dictionary entry for ' + code + '.'),
                    entry && entry.strongs_def && h('div', { style: { fontSize: '.9rem', margin: '6px 0' } }, entry.strongs_def),
                    entry && entry.kjv_def && h('div', { className: 'p2-note' }, 'KJV: ' + entry.kjv_def),
                    entry && entry.derivation && h('div', { className: 'p2-note' }, 'Derivation: ' + entry.derivation),
                    entry && entry.derivation && (entry.derivation.match(/[HG]\d+/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i && x !== code; }).slice(0, 6).map(function (r) {
                        return h('span', { key: r, className: 'p2-chip', onClick: function () { setCode(r); } }, r);
                    })),
                !data && !prog && h('div', { className: 'p2-card' },
                    h('div', { className: 'p2-note' }, 'To list every verse that uses ' + code + ', the app reads the ' + (kind === 'H' ? 'Old' : 'New') + ' Testament interlinear files once (' + (kind === 'H' ? '39' : '27') + ' books). This can take a while on a phone the first time; the result is then saved on the device so later lookups are instant.'),
                    h('button', { className: 'p2-btn on', onClick: startScan }, '\uD83D\uDD0D Find all occurrences')),
                prog && h('div', { className: 'p2-card' },
                    h('div', { className: 'p2-note' }, 'Reading ' + (prog.book || '\u2026') + ' (' + prog.done + ' of ' + prog.total + ')'),
                    h('div', { className: 'p2-prog' }, h('div', { style: { width: Math.round(100 * prog.done / Math.max(prog.total, 1)) + '%' } })),
                    h('button', { className: 'p2-btn', onClick: cancelScan }, 'Cancel')),
                data && data.total === 0 && h('div', { className: 'p2-card' }, h('div', { className: 'p2-note' }, 'No occurrences of ' + code + ' were found in the interlinear data.')),
                data && data.total > 0 && h('div', null,
                    h('div', { className: 'p2-card' },
                        h('div', { style: { fontSize: '1rem', fontWeight: 600 } }, data.total + ' occurrences in ' + data.verses + ' verses, ' + data.byBook.length + ' book' + (data.byBook.length === 1 ? '' : 's')),
                        idx && idx.missing && idx.missing.length > 0 && h('div', { className: 'p2-err' }, 'Some books could not be read, so counts are incomplete: ' + idx.missing.join(', '))),
                    h('div', { className: 'p2-card' },
                        h('div', { className: 'p2-h' }, 'Where it appears (tap a book to filter)'),
                        data.byBook.map(function (b) {
                            return h('div', { key: b.book, className: 'p2-row' + (bookF === b.book ? ' sel' : ''), onClick: function () { setBookF(bookF === b.book ? null : b.book); setShown(25); } },
                                h('span', { style: { width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.book),
                                h('div', { style: { flex: 1 } }, h('div', { className: 'p2-bar', style: { width: Math.max(2, Math.round(100 * b.n / maxBook)) + '%' } })),
                                h('span', { style: { width: 36, textAlign: 'right', color: 'rgba(255,255,255,.6)' } }, b.n));
                        })),
                    h('div', { className: 'p2-card' },
                        h('div', { className: 'p2-h' }, 'How it is rendered in English (tap to filter)'),
                        data.renderings.slice(0, 24).map(function (r) {
                            return h('span', { key: r.g, className: 'p2-chip' + (gloss === r.g ? ' on' : ''), onClick: function () { setGloss(gloss === r.g ? null : r.g); setShown(25); } }, r.g + ' \u00D7' + r.n);
                        }),
                        data.renderings.length > 24 && h('div', { className: 'p2-note' }, '+ ' + (data.renderings.length - 24) + ' more renderings (all are in the exported report).')),
                    h('div', { className: 'p2-card' },
                        h('div', { className: 'p2-h' }, 'Verses (' + occ.length + (gloss || bookF ? ' after filters' : '') + ')'),
                        (gloss || bookF) && h('button', { className: 'p2-btn', onClick: function () { setGloss(null); setBookF(null); } }, 'Clear filters'),
                        occ.slice(0, shown).map(function (o, i) {
                            var tx = verseText(bibles, activeVersion, o.book, o.chapter, o.verse);
                            return h('div', { key: o.ref + '#' + i, className: 'cx-item', style: { padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.05)' } },
                                h('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' } },
                                    h('span', { style: { color: '#4f8cff', fontWeight: 600, fontSize: '.85rem' } }, o.ref),
                                    h('span', { className: 'p2-chip', style: { cursor: 'default' } }, o.gloss)),
                                h('div', { style: { fontSize: '.88rem', color: 'rgba(255,255,255,.75)', margin: '4px 0' } }, tx ? (tx.length > 180 ? tx.slice(0, 180) + '\u2026' : tx) : 'Verse text is not in the selected Bible.'),
                                h('button', { className: 'p2-btn', onClick: function () { openRef(o.ref, flash); } }, '\uD83D\uDCD6 Read'));
                        }),
                        occ.length > shown && h('button', { className: 'p2-btn', onClick: function () { setShown(function (s) { return s + 25; }); } }, 'Show more (' + (occ.length - shown) + ' left)')),
                    h('div', null,
                        h('button', { className: 'p2-btn', onClick: function () { copyText(reportMd(), flash); } }, '\uD83D\uDCCB Copy report'),
                        h('button', { className: 'p2-btn', onClick: function () { exportText(reportMd(), 'wordstudy_' + code + '.md', flash); } }, '\uD83D\uDCE4 Export report'))),
                msg && h('div', { className: 'p2-note', style: { color: '#9fc0ff' } }, msg));
        }

        /* ===================== Translation Lab ===================== */
        var MAX_VERSES = 40, MAX_VERSIONS = 6;
        function CompareLabPage() {
            var app = useApp(), bibles = app.bibles || {}, activeVersion = app.activeVersion;
            var keys = Object.keys(bibles);
            var _t = useState((app.book && app.chapter) ? (app.book + ' ' + app.chapter) : 'John 3'), text = _t[0], setText = _t[1];
            var _sel = useState(function () {
                var saved = safeLS('bs_p2_lab_versions', null);
                if (Array.isArray(saved)) { var ok = saved.filter(function (k) { return bibles[k]; }); if (ok.length) return ok.slice(0, MAX_VERSIONS); }
                return activeVersion ? [activeVersion] : [];
            }), sel = _sel[0], setSel = _sel[1];
            var _base = useState(null), baseSel = _base[0], setBase = _base[1];
            var _go = useState(null), req = _go[0], setReq = _go[1];
            var _m = useState(''), msg = _m[0], setMsg = _m[1];
            var flash = function (t) { setMsg(t); setTimeout(function () { setMsg(''); }, 2500); };
            var base = (baseSel && sel.indexOf(baseSel) >= 0) ? baseSel : sel[0];
            var bookNames = useMemo(function () {
                var v = bibles[activeVersion] || bibles[keys[0]];
                return v && v.books ? Object.keys(v.books) : [];
            }, [bibles, activeVersion]);

            var toggle = function (k) {
                setSel(function (cur) {
                    var n = cur.indexOf(k) >= 0 ? cur.filter(function (x) { return x !== k; }) : (cur.length >= MAX_VERSIONS ? cur : cur.concat([k]));
                    safeLSset('bs_p2_lab_versions', n); return n;
                });
            };
            var run = function () { setReq({ text: text, at: Date.now() }); };
            useEffect(function () { if (!req && sel.length) run(); }, []);

            var result = useMemo(function () {
                if (!req) return null;
                if (!sel.length) return { error: 'Choose at least one version.' };
                var p = P2.parsePassage(req.text, bookNames);
                if (p.error) return p;
                var first = bibles[base];
                var chap = first && first.books[p.book] && first.books[p.book].chapters[String(p.chapter)];
                var anyChap = chap || sel.map(function (k) { var b = bibles[k].books[p.book]; return b && b.chapters[String(p.chapter)]; }).filter(Boolean)[0];
                if (!anyChap) return { error: p.book + ' ' + p.chapter + ' is not in the chosen versions.' };
                var total = anyChap.length;
                var s = p.start || 1, e = p.start ? Math.min(p.end, total) : total;
                if (s > total) return { error: p.book + ' ' + p.chapter + ' has only ' + total + ' verses.' };
                var capped = false;
                if (e - s + 1 > MAX_VERSES) { e = s + MAX_VERSES - 1; capped = true; }
                var baseLang = bibles[base].language;
                // Each language gets its own comparison base: the chosen base for its language,
                // otherwise the first selected version in that language. English can't be diffed
                // against Tamil, but two Tamil versions can be diffed against each other.
                var groupBase = {}, groupCount = {};
                groupBase[baseLang] = base;
                sel.forEach(function (k) {
                    var l = bibles[k].language;
                    groupCount[l] = (groupCount[l] || 0) + 1;
                    if (!groupBase[l]) groupBase[l] = k;
                });
                var hasMyanmar = sel.some(function (k) { return bibles[k].language === 'Myanmar' && groupCount['Myanmar'] > 1; });
                var rows = [], stats = {}, gbOf = {}, isBase = {};
                sel.forEach(function (k) {
                    var l = bibles[k].language;
                    gbOf[k] = groupBase[l];
                    isBase[k] = (k === base) || (k === groupBase[l] && groupCount[l] > 1);
                    stats[k] = { sum: 0, n: 0, diffVerses: 0, extra: {} };
                });
                for (var v = s; v <= e; v++) {
                    var texts = {};
                    sel.forEach(function (k) { texts[k] = verseText(bibles, k, p.book, p.chapter, v); });
                    var cols = sel.map(function (k) {
                        var t = texts[k], gb = gbOf[k];
                        var col = { key: k, text: t, segs: null, sim: null };
                        if (t == null) return col;
                        var diffable = bibles[k].language !== 'Myanmar';
                        if (k !== gb && diffable && texts[gb] != null) {
                            var d = P2.diff(texts[gb], t);
                            col.sim = d.similarity;
                            col.segs = P2.segments(t, d.b, d.sharedB);
                            stats[k].sum += d.similarity; stats[k].n++;
                            if (d.similarity < 0.999) stats[k].diffVerses++;
                            d.b.forEach(function (tk, i) { if (!d.sharedB[i]) stats[k].extra[tk.w] = (stats[k].extra[tk.w] || 0) + 1; });
                        } else col.segs = [{ t: t, d: false }];
                        return col;
                    });
                    rows.push({ verse: v, cols: cols });
                }
                return { p: p, s: s, e: e, rows: rows, stats: stats, capped: capped, base: base, baseLang: baseLang, gbOf: gbOf, isBase: isBase, hasMyanmar: hasMyanmar };
            }, [req, sel, base, bookNames]);

            var reportMd = function () {
                if (!result || result.error) return '';
                var r = result, label = function (k) { return (bibles[k].abbrev || k.toUpperCase()); };
                var s = '# Translation comparison: ' + r.p.book + ' ' + r.p.chapter + ':' + r.s + (r.e !== r.s ? '-' + r.e : '') + '\n\n';
                s += 'Versions: ' + sel.map(label).join(', ') + '. Each version is compared word by word with the base of its own language (' + sel.filter(function (k) { return r.isBase[k]; }).map(label).join(', ') + '). Words in **bold** differ from that base.\n';
                r.rows.forEach(function (row) {
                    s += '\n## ' + r.p.book + ' ' + r.p.chapter + ':' + row.verse + '\n';
                    row.cols.forEach(function (c) {
                        s += '- **' + label(c.key) + '**' + (c.sim != null ? ' (' + Math.round(c.sim * 100) + '% like ' + label(r.gbOf[c.key]) + ')' : '') + ': ';
                        s += c.segs ? c.segs.map(function (g) { return g.d ? '**' + g.t + '**' : g.t; }).join('') : '_not in this version_';
                        s += '\n';
                    });
                });
                return s;
            };

            var label = function (k) { return (bibles[k] && bibles[k].abbrev) || k.toUpperCase(); };
            var byLang = {};
            keys.forEach(function (k) { var l = bibles[k].language || 'Other'; (byLang[l] = byLang[l] || []).push(k); });

            return h('div', { className: 'page-enter' },
                h('h2', { style: { fontSize: '1.4rem', fontWeight: 600, marginBottom: 6 } }, '\u2696\uFE0F Translation Lab'),
                h('div', { className: 'p2-note' }, 'Compare the same passage in up to ' + MAX_VERSIONS + ' versions. Versions in the same language are compared word by word and the words that differ are highlighted.'),
                h('input', { className: 'p2-in', value: text, placeholder: 'John 3:16-21', onChange: function (e) { setText(e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') run(); } }),
                h('div', { style: { marginTop: 8 } },
                    Object.keys(byLang).map(function (l) {
                        return h('div', { key: l },
                            h('div', { className: 'p2-h', style: { marginTop: 8 } }, l),
                            byLang[l].map(function (k) {
                                return h('span', { key: k, className: 'p2-chip' + (sel.indexOf(k) >= 0 ? ' on' : ''), onClick: function () { toggle(k); } }, label(k));
                            }));
                    })),
                sel.length > 1 && h('div', { className: 'p2-note' }, 'Base version: ',
                    h('select', { value: base || '', onChange: function (e) { setBase(e.target.value); }, className: 'workspace-select' }, sel.map(function (k) { return h('option', { key: k, value: k }, label(k)); }))),
                h('div', null, h('button', { className: 'p2-btn on', onClick: run }, '\u25B6 Compare')),
                result && result.error && h('div', { className: 'p2-err' }, result.error),
                result && !result.error && h('div', null,
                    h('div', { className: 'p2-card' },
                        h('div', { style: { fontWeight: 600 } }, result.p.book + ' ' + result.p.chapter + ':' + result.s + (result.e !== result.s ? '\u2013' + result.e : '') + ' \u00B7 ' + result.rows.length + ' verse' + (result.rows.length === 1 ? '' : 's')),
                        result.capped && h('div', { className: 'p2-note' }, 'Showing the first ' + MAX_VERSES + ' verses to keep the page light. Choose a shorter range to see the rest.'),
                        result.hasMyanmar && h('div', { className: 'p2-note' }, 'Word highlighting is not available for Myanmar versions (the text has no word spaces); they are shown side by side.'),
                        sel.filter(function (k) { return !result.isBase[k] && bibles[k].language !== 'Myanmar'; }).map(function (k) {
                            var st = result.stats[k], gb = result.gbOf[k];
                            if (!st.n) return h('div', { key: k, className: 'p2-note' }, label(k) + ': no verse could be compared.');
                            var extra = Object.keys(st.extra).sort(function (a, b) { return st.extra[b] - st.extra[a] || (a < b ? -1 : 1); }).slice(0, 8);
                            return h('div', { key: k, className: 'p2-note' }, h('b', null, label(k)), ' is ' + Math.round(100 * st.sum / st.n) + '% like ' + label(gb) + ' on average; ' + st.diffVerses + ' of ' + st.n + ' verses differ.' + (extra.length ? ' Words it uses that ' + label(gb) + ' does not: ' + extra.join(', ') + '.' : ''));
                        })),
                    result.rows.map(function (row) {
                        return h('div', { key: row.verse, className: 'p2-card' },
                            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                                h('span', { style: { color: '#4f8cff', fontWeight: 700 } }, result.p.book + ' ' + result.p.chapter + ':' + row.verse),
                                h('button', { className: 'p2-btn', onClick: function () { openRef(result.p.book + ' ' + result.p.chapter + ':' + row.verse, flash); } }, '\uD83D\uDCD6 Read')),
                            row.cols.map(function (c) {
                                return h('div', { key: c.key, style: { margin: '6px 0', lineHeight: 1.6, fontSize: '.92rem' } },
                                    h('span', { style: { fontSize: '.72rem', fontWeight: 700, color: result.isBase[c.key] ? '#9fc0ff' : 'rgba(255,255,255,.5)', marginRight: 6 } }, label(c.key) + (result.isBase[c.key] ? ' (base)' : '') + (c.sim != null ? ' \u00B7 ' + Math.round(c.sim * 100) + '% like ' + label(result.gbOf[c.key]) : '')),
                                    c.segs ? c.segs.map(function (g, i) { return h('span', { key: i, className: g.d ? 'p2-diff' : null }, g.t); })
                                        : h('em', { style: { color: 'rgba(255,255,255,.35)' } }, 'not in this version'));
                            }));
                    }),
                    h('div', null,
                        h('button', { className: 'p2-btn', onClick: function () { copyText(reportMd(), flash); } }, '\uD83D\uDCCB Copy comparison'),
                        h('button', { className: 'p2-btn', onClick: function () { exportText(reportMd(), 'comparison_' + result.p.book.replace(/\s+/g, '_') + '_' + result.p.chapter + '.md', flash); } }, '\uD83D\uDCE4 Export comparison'))),
                msg && h('div', { className: 'p2-note', style: { color: '#9fc0ff' } }, msg));
        }

        return { WordStudyPage: WordStudyPage, CompareLabPage: CompareLabPage };
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = P2;
})(typeof window !== 'undefined' ? window : globalThis);
