/* ============================================================
   bs_core.js  -  shared foundation for the study features.
   Loaded as a plain <script> (no modules, no dependencies) so it
   works in the Android WebView exactly like the other data files.

   Exposes ONE global: window.BS
     BS.ref    - one internal verse-reference format + helpers
     BS.graph  - bounded, loop-safe connection graph builder + layout
     BS.db     - small IndexedDB store (falls back to localStorage)
     BS.nav    - central "open this passage" helper (registered by the app)
     BS.events - tiny publish/subscribe bus

   Internal reference format ("canonical ref"):  "Book C:V"
   e.g. "John 3:16", "1 Samuel 17:4". This is the same format that
   the cross-reference targets and the app's own helpers already use.
   Data keys of the form "Book:C:V" (CROSS_REFERENCES keys) convert
   with BS.ref.fromKey / BS.ref.toKey.

   This file never copies or modifies Bible text.
   ============================================================ */
(function (root) {
    'use strict';
    var BS = root.BS = root.BS || {};
    BS.version = '1.0.0';

    /* ---------------- events ---------------- */
    var handlers = {};
    BS.events = {
        on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
        off: function (name, fn) { handlers[name] = (handlers[name] || []).filter(function (f) { return f !== fn; }); },
        emit: function (name, data) {
            (handlers[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { /* a bad listener must not break others */ } });
        }
    };

    /* ---------------- references ---------------- */
    var bookOrder = [];
    var bookIndex = {};
    var REF_RE = /^(.+?)\s+(\d+):(\d+)$/;

    BS.ref = {
        /** Give the module the app's canonical book order (array of book names). */
        setBookOrder: function (arr) {
            bookOrder = Array.isArray(arr) ? arr.slice() : [];
            bookIndex = {};
            bookOrder.forEach(function (b, i) { bookIndex[b] = i; });
        },
        /** "John 3:16" -> {book:'John', chapter:3, verse:16}  (null if not a single-verse ref) */
        parse: function (ref) {
            var m = REF_RE.exec(String(ref == null ? '' : ref).trim());
            return m ? { book: m[1], chapter: Number(m[2]), verse: Number(m[3]) } : null;
        },
        format: function (p) { return p ? p.book + ' ' + p.chapter + ':' + p.verse : ''; },
        /** "John 3:16" -> "John:3:16" (key used by CROSS_REFERENCES) */
        toKey: function (ref) {
            var p = BS.ref.parse(ref);
            return p ? p.book + ':' + p.chapter + ':' + p.verse : null;
        },
        /** "John:3:16" -> "John 3:16" */
        fromKey: function (key) {
            var m = /^(.+):(\d+):(\d+)$/.exec(String(key || ''));
            return m ? m[1] + ' ' + m[2] + ':' + m[3] : null;
        },
        /** Sort number following the canonical book order (unknown books sort last). */
        order: function (ref) {
            var p = BS.ref.parse(ref);
            if (!p) return 1e12;
            var bi = bookIndex.hasOwnProperty(p.book) ? bookIndex[p.book] : 99;
            return bi * 1e6 + p.chapter * 1e3 + p.verse;
        },
        shortRef: function (ref) {
            var p = BS.ref.parse(ref);
            if (!p) return String(ref);
            var b = /^\d/.test(p.book) ? p.book.slice(0, 4).replace(' ', '') : p.book.slice(0, 3);
            return b + ' ' + p.chapter + ':' + p.verse;
        },
        bookOf: function (ref) { var p = BS.ref.parse(ref); return p ? p.book : null; }
    };

    /* ---------------- connection graph ----------------
       getRefs(ref) must return an array of canonical refs (strings) that
       the data lists for `ref`. Nothing is invented: every edge exists
       in the source data. Caps (depth, perNode, maxNodes) keep it small
       on a phone: CROSS_REFERENCES has up to 326 links on one verse.      */
    BS.graph = {
        LIMITS: { maxDepth: 3, maxPerNode: 40, maxNodes: 120 },

        build: function (opts) {
            var L = BS.graph.LIMITS;
            var root = opts.root;
            var depth = Math.max(1, Math.min(L.maxDepth, opts.depth | 0 || 1));
            var perNode = Math.max(1, Math.min(L.maxPerNode, opts.perNode | 0 || 12));
            var maxNodes = Math.max(2, Math.min(L.maxNodes, opts.maxNodes | 0 || 60));
            var getRefs = opts.getRefs;
            var nodes = [{ ref: root, depth: 0, parent: null, hidden: 0 }];
            var index = {}; index[root] = 0;           // visited set = loop protection
            var edges = [], edgeSeen = {};
            var capped = false;

            function addEdge(a, b, kind) {
                var k = a < b ? a + '|' + b : b + '|' + a;
                if (edgeSeen[k]) return;
                edgeSeen[k] = 1;
                edges.push({ from: a, to: b, kind: kind });
            }

            var frontier = [root];
            for (var d = 1; d <= depth; d++) {
                var next = [];
                for (var i = 0; i < frontier.length; i++) {
                    var cur = frontier[i];
                    var list = (getRefs(cur) || []).filter(function (r) { return r && r !== cur && BS.ref.parse(r); });
                    // deterministic Bible order (the data carries no relevance score)
                    list = list.slice().sort(function (a, b) { return BS.ref.order(a) - BS.ref.order(b); });
                    var taken = 0;
                    for (var j = 0; j < list.length; j++) {
                        var r = list[j];
                        if (index.hasOwnProperty(r)) {          // already placed: draw the link, never re-expand (no loops)
                            if (nodes[index[r]].depth <= d) addEdge(cur, r, 'cross');
                            continue;
                        }
                        if (taken >= perNode) continue;
                        if (nodes.length >= maxNodes) { capped = true; continue; }
                        index[r] = nodes.length;
                        nodes.push({ ref: r, depth: d, parent: cur, hidden: 0 });
                        addEdge(cur, r, 'tree');
                        next.push(r);
                        taken++;
                    }
                    nodes[index[cur]].hidden = Math.max(0, list.filter(function (x) { return !index.hasOwnProperty(x); }).length);
                }
                frontier = next;
                if (!frontier.length) break;
            }
            return { root: root, nodes: nodes, edges: edges, capped: capped, depth: depth, perNode: perNode, maxNodes: maxNodes };
        },

        /** Radial layout: root in the centre, one ring per depth level. Returns {id->{x,y}} in a w*h box. */
        layout: function (g, w, h) {
            var cx = w / 2, cy = h / 2;
            var pos = {}; pos[g.root] = { x: cx, y: cy };
            var maxD = 0; g.nodes.forEach(function (n) { if (n.depth > maxD) maxD = n.depth; });
            var ringR = (Math.min(w, h) / 2 - 24) / Math.max(1, maxD);
            for (var d = 1; d <= maxD; d++) {
                var ring = g.nodes.filter(function (n) { return n.depth === d; });
                // keep children near their parent's angle
                ring.sort(function (a, b) {
                    var pa = pos[a.parent], pb = pos[b.parent];
                    var aa = pa ? Math.atan2(pa.y - cy, pa.x - cx) : 0, ab = pb ? Math.atan2(pb.y - cy, pb.x - cx) : 0;
                    return aa === ab ? BS.ref.order(a.ref) - BS.ref.order(b.ref) : aa - ab;
                });
                ring.forEach(function (n, i) {
                    var ang = (i / ring.length) * 2 * Math.PI - Math.PI / 2;
                    pos[n.ref] = { x: cx + ringR * d * Math.cos(ang), y: cy + ringR * d * Math.sin(ang) };
                });
            }
            return pos;
        },

        /** Group refs by book, in canonical order: [{book, refs:[...]}] */
        groupByBook: function (refs) {
            var map = {}, order = [];
            refs.forEach(function (r) {
                var b = BS.ref.bookOf(r); if (b == null) return;
                if (!map[b]) { map[b] = []; order.push(b); }
                map[b].push(r);
            });
            order.sort(function (a, b) { return BS.ref.order(map[a][0]) - BS.ref.order(map[b][0]); });
            return order.map(function (b) { return { book: b, refs: map[b] }; });
        }
    };

    /* ---------------- storage (IndexedDB with safe fallback) ----------------
       Object stores (all use the "id" field as key):
         studies - study projects (Study Workspace, later phase)
         items   - saved resources (words, people, places, prophecy, topics...)
         quiz    - quiz history / flashcard progress
         kv      - small misc records
       Existing localStorage data (bookmarks, notes, chains, ...) is NOT
       touched or moved by this file.
       Upgrades go through BS.db.MIGRATIONS: a failed upgrade aborts the
       IndexedDB transaction, which leaves the previous version intact.   */
    var DB_NAME = 'bs_study_db';
    var DB_VERSION = 1;
    var STORES = ['studies', 'items', 'quiz', 'kv'];
    var dbPromise = null;
    var mem = null;          // fallback mode
    var mode = 'unknown';

    function lsRead(store) { try { return JSON.parse(root.localStorage.getItem('bsdb_' + store) || '{}') || {}; } catch (e) { return {}; } }
    function lsWrite(store, obj) { try { root.localStorage.setItem('bsdb_' + store, JSON.stringify(obj)); return true; } catch (e) { return false; } }

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve) {
            var idb = root.indexedDB;
            if (!idb) { mode = 'localStorage'; return resolve(null); }
            var req;
            try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { mode = 'localStorage'; return resolve(null); }
            req.onupgradeneeded = function (ev) {
                var db = req.result, old = ev.oldVersion || 0;
                for (var v = old + 1; v <= DB_VERSION; v++) {
                    var fn = BS.db.MIGRATIONS[v];
                    if (fn) fn(db, req.transaction);   // throwing here aborts the upgrade; old data stays
                }
            };
            req.onsuccess = function () { mode = 'indexedDB'; resolve(req.result); };
            req.onerror = req.onblocked = function () { mode = 'localStorage'; resolve(null); };
        });
        return dbPromise;
    }

    BS.db = {
        STORES: STORES,
        MIGRATIONS: {
            1: function (db) {
                STORES.forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
            }
        },
        mode: function () { return mode; },
        ready: function () { return openDb().then(function () { return mode; }); },
        get: function (store, id) {
            return openDb().then(function (db) {
                if (!db) { var o = lsRead(store); return o[id] === undefined ? null : o[id]; }
                return new Promise(function (res, rej) {
                    var r = db.transaction(store).objectStore(store).get(id);
                    r.onsuccess = function () { res(r.result === undefined ? null : r.result); };
                    r.onerror = function () { rej(r.error); };
                });
            });
        },
        all: function (store) {
            return openDb().then(function (db) {
                if (!db) { var o = lsRead(store); return Object.keys(o).map(function (k) { return o[k]; }); }
                return new Promise(function (res, rej) {
                    var r = db.transaction(store).objectStore(store).getAll();
                    r.onsuccess = function () { res(r.result || []); };
                    r.onerror = function () { rej(r.error); };
                });
            });
        },
        put: function (store, rec) {
            if (!rec || rec.id == null) return Promise.reject(new Error('record needs an id'));
            return openDb().then(function (db) {
                if (!db) { var o = lsRead(store); o[rec.id] = rec; if (!lsWrite(store, o)) throw new Error('storage full'); return rec; }
                return new Promise(function (res, rej) {
                    var t = db.transaction(store, 'readwrite');
                    t.objectStore(store).put(rec);
                    t.oncomplete = function () { res(rec); };
                    t.onerror = t.onabort = function () { rej(t.error || new Error('write failed')); };
                });
            });
        },
        del: function (store, id) {
            return openDb().then(function (db) {
                if (!db) { var o = lsRead(store); delete o[id]; lsWrite(store, o); return true; }
                return new Promise(function (res, rej) {
                    var t = db.transaction(store, 'readwrite');
                    t.objectStore(store).delete(id);
                    t.oncomplete = function () { res(true); };
                    t.onerror = t.onabort = function () { rej(t.error || new Error('delete failed')); };
                });
            });
        }
    };

    /* ---------------- central navigation ----------------
       The React app registers real handlers once at start-up
       (see AppContent in index.html). Until then openPassage reports
       false instead of pretending.                                    */
    var navHandlers = null;
    BS.nav = {
        register: function (h) { navHandlers = h; },
        isReady: function () { return !!navHandlers; },
        /** Open a canonical ref ("John 3:16") in the Bible reader. Returns true if it could be opened. */
        openPassage: function (ref) {
            var p = BS.ref.parse(ref);
            if (!p || !navHandlers || !navHandlers.openPassage) return false;
            return !!navHandlers.openPassage(p);
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = BS;
})(typeof window !== 'undefined' ? window : globalThis);
