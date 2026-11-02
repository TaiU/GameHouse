// 迴廊幻境：等角視角下「畫面上看起來接上的路，就走得過去」。
// 轉動整座建築、推動滑塊、旋轉轉台，讓遠近高低不同的步道在畫面上對齊，帶提燈旅人走到發光的石碑。
//
// 這個檔是引擎與畫面。另外兩個檔各自獨立：
//   js/drift-levels.js  關卡資料：window.DriftLevels = [ ... ]（格式見 docs/drift-level-format.md）
//   js/drift-audio.js   原創音樂與音效：window.DriftAudio
// 兩個檔都不在時遊戲照樣能玩：用下面的示範關、沒有聲音。
(function () {
  const D = {};
  const C30 = Math.cos(Math.PI / 6);

  // ── 色票 ── 天空上/下、太陽、步道頂/左/右、石塊頂/左/右、機關頂/左/右、旅人
  D.THEMES = [
    { sky: ['#f6d9c4', '#e9a99a'], sun: '#fff1df', path: ['#fbf1e6', '#e3b7a5', '#c98c7f'], stone: ['#e8c7b6', '#c99a8c', '#a9776d'], mech: ['#f3cf8b', '#d9a35b', '#b97f3e'], hero: '#4a3550' },
    { sky: ['#cfe6e4', '#8fbcc0'], sun: '#f2fbf6', path: ['#f2f6ee', '#a8c9bf', '#7aa59d'], stone: ['#c3dcd4', '#8fb3aa', '#6b9089'], mech: ['#f1b9a0', '#d68a72', '#b46955'], hero: '#2c4450' },
    { sky: ['#d9d3ef', '#9d92c7'], sun: '#f6f1ff', path: ['#f4f0fb', '#bdb2de', '#9187c0'], stone: ['#cdc5e6', '#a198c9', '#7c72a8'], mech: ['#f5d38f', '#d8ad5d', '#b88a3e'], hero: '#3a2d55' },
    { sky: ['#2c2a4a', '#5a4a72'], sun: '#ffe9b8', path: ['#ece4f2', '#a99cc4', '#7a6f9b'], stone: ['#8f86ad', '#6c6390', '#4f4870'], mech: ['#f2c27a', '#cf9550', '#a8713a'], hero: '#f4ecd8' },
    { sky: ['#f3e3b0', '#d9a46a'], sun: '#fff8e4', path: ['#fff6e2', '#e2c08a', '#c39a62'], stone: ['#e9cf9d', '#c9a671', '#a6834f'], mech: ['#9fd0c4', '#6fa99c', '#4f8679'], hero: '#4b3326' },
    { sky: ['#13283a', '#2f5568'], sun: '#dff4ff', path: ['#e6f1f2', '#93b8c0', '#668e98'], stone: ['#6f94a0', '#4f727e', '#37545e'], mech: ['#f0b48c', '#cf8862', '#a96444'], hero: '#f4ecd8' },
  ];

  // ── 示範關（只在沒有 js/drift-levels.js 時使用）──
  D.SAMPLES = [
    {
      id: 'demo-slide', name: '示範：推橋', hint: '點浮在橋上的鈕，把橋推進缺口。', views: false, par: 2,
      blocks: [[1, 1, 1], [2, 1, 1], [3, 1, 1], [5, 1, 1], [6, 1, 1], [7, 1, 1], [2, 2, 0, 'n'], [6, 2, 0, 'n']],
      pieces: [{ label: '推橋', kind: 'slide', blocks: [[4, 3, 1]], states: [[0, 0, 0], [0, -1, 0], [0, -2, 0]] }],
      start: [1, 1, 1], goal: [7, 1, 1],
    },
    {
      id: 'demo-view', name: '示範：轉動建築', hint: '轉動整座建築，讓兩段路在畫面上接起來。', par: 1,
      blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
      start: [0, 0, 0], goal: [0, 4, 1],
    },
  ];

  // ── 幾何 ──
  const kstr = p => p[0] + ',' + p[1] + ',' + p[2];
  const depth = p => p[0] + p[1] + p[2];
  const scr = (x, y, z) => [(x - y) * C30, (x + y) * .5 - z]; // 螢幕單位座標：x 往右下、y 往左下、z 往上
  D.keyOf = p => [p[0] - p[2], p[1] - p[2]]; // 頂面在畫面上的格子
  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  function rotQ(v, axis, n) { // 繞 axis 轉 n 個 90°（z 軸 +1：(x,y)→(-y,x)，畫面上順時針）
    let [x, y, z] = v;
    for (let k = 0; k < ((n % 4) + 4) % 4; k++) {
      if (axis === 'z') [x, y] = [-y, x]; else if (axis === 'x') [y, z] = [-z, y]; else [z, x] = [-x, z];
    }
    return [x, y, z];
  }
  function rotA(v, k, a) { // 繞單位向量 k 轉 a 弧度（Rodrigues）
    const c = Math.cos(a), s = Math.sin(a), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c);
    return [v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * d, v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * d, v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * d];
  }
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  function insideBy(pts, q, m) { // 點在順時針凸多邊形內、離邊至少 m
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1];
      if ((ex * (q[1] - a[1]) - ey * (q[0] - a[0])) / Math.hypot(ex, ey) < m) return false;
    }
    return true;
  }

  // ── 世界模型 ──
  // 狀態 { v: 視角 0-3, p: [每個機關的狀態編號] }
  D.build = function (L) {
    const blocks = [], pieces = (L.pieces || []).map(P => {
      const turn = P.kind === 'turn', axis = turn ? P.axis || 'z' : null;
      return { ...P, axis, pivot: turn ? [P.pivot[0], P.pivot[1], P.pivot[2] || 0] : null, n: turn ? 4 : (P.states || []).length };
    });
    (L.blocks || []).forEach(b => blocks.push({ base: b.slice(0, 3), g: -1, walk: b[3] !== 'n' }));
    pieces.forEach((P, gi) => (P.blocks || []).forEach(b => blocks.push({ base: b.slice(0, 3), g: gi, walk: b[3] !== 'n' })));
    const find = p => (Array.isArray(p) ? blocks.findIndex(b => kstr(b.base) === kstr(p)) : -1);
    pieces.forEach(P => { P.leverIx = P.lever ? blocks.findIndex(b => b.g < 0 && kstr(b.base) === kstr(P.lever)) : -1; });
    // 視角繞 (cx,cy) 轉；cx+cy 與 cy-cx 都是整數，轉完座標仍是整數（中心只影響取景，不影響規則）
    let cx, cy;
    if (Array.isArray(L.center)) [cx, cy] = L.center;
    else {
      const xs = blocks.map(b => b.base[0]), ys = blocks.map(b => b.base[1]);
      cx = Math.round((Math.min(...xs) + Math.max(...xs))) / 2; cy = Math.round((Math.min(...ys) + Math.max(...ys))) / 2;
    }
    if (!Number.isInteger(cx + cy)) cy += .5;
    return { L, blocks, pieces, views: L.views !== false, cx, cy, start: find(L.start), goal: find(L.goal), cache: new Map() };
  };
  D.initState = W => ({ v: 0, p: W.pieces.map(() => 0) });
  const stKey = st => st.v + ':' + st.p.join(',');
  const viewPt = (W, p, v) => { let dx = p[0] - W.cx, dy = p[1] - W.cy; for (let k = 0; k < v; k++) [dx, dy] = [-dy, dx]; return [dx + W.cx, dy + W.cy, p[2]]; };
  const viewVec = (d, v) => rotQ(d, 'z', v);
  D.world = function (W, i, st) { // 機關移動後、還沒轉視角的位置
    const b = W.blocks[i]; if (b.g < 0) return b.base;
    const P = W.pieces[b.g], s = st.p[b.g];
    if (P.kind === 'turn') return add3(rotQ(sub3(b.base, P.pivot), P.axis, s), P.pivot);
    return add3(b.base, P.states[s]);
  };
  D.place = (W, i, st) => viewPt(W, D.world(W, i, st), st.v);
  D.layout = (W, st) => W.blocks.map((_, i) => D.place(W, i, st));
  // 可走的頂面：方塊可走，而且畫面格 K、K-(1,0)、K-(0,1)、K-(1,1) 裡沒有更靠前（深度更大）的方塊。
  // 兩個可走頂面的畫面格上下左右相鄰就連通。
  D.graph = function (W, st) {
    const key = stKey(st); if (W.cache.has(key)) return W.cache.get(key);
    const pos = D.layout(W, st), byCell = new Map();
    pos.forEach((p, i) => { const k = D.keyOf(p).join(); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(i); });
    const cellOf = new Map(), at = new Map();
    pos.forEach((p, i) => {
      if (!W.blocks[i].walk) return;
      const [u, w] = D.keyOf(p), d = depth(p);
      for (const [du, dw] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) for (const j of byCell.get((u + du) + ',' + (w + dw)) || []) if (j !== i && depth(pos[j]) > d) return;
      cellOf.set(i, [u, w]); at.set(u + ',' + w, i);
    });
    const adj = new Map();
    for (const [i, [u, w]] of cellOf) adj.set(i, [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([du, dw]) => at.get((u + du) + ',' + (w + dw))).filter(j => j !== undefined));
    const g = { pos, cellOf, adj };
    if (W.cache.size > 5000) W.cache.clear();
    W.cache.set(key, g); return g;
  };
  D.nodes = (W, st) => D.graph(W, st).cellOf;
  D.reach = function (W, st, from) {
    const { adj } = D.graph(W, st), prev = new Map();
    if (!adj.has(from)) return prev;
    prev.set(from, -1); const q = [from];
    while (q.length) { const i = q.shift(); for (const j of adj.get(i)) if (!prev.has(j)) { prev.set(j, i); q.push(j); } }
    return prev;
  };
  // 操作：g = 'view' 或機關編號，dir = ±1。成功回傳新狀態，否則 { jam: 原因 }
  D.operate = function (W, st, g, dir, player) {
    const ns = { v: st.v, p: st.p.slice() };
    if (g === 'view') { if (!W.views) return { jam: 'fixed' }; ns.v = (st.v + dir + 4) % 4; return ns; }
    const P = W.pieces[g];
    if (P.leverIx >= 0 && player !== P.leverIx) return { jam: 'lever' };
    if (P.kind === 'turn') {
      if (P.axis !== 'z' && W.blocks[player].g === g) return { jam: 'riding' };
      ns.p[g] = (st.p[g] + dir + 4) % 4;
    } else {
      let k = st.p[g] + dir;
      if (P.loop) k = (k + P.n) % P.n; else if (k < 0 || k >= P.n) return { jam: 'end' };
      ns.p[g] = k;
    }
    const seen = new Set();
    for (let i = 0; i < W.blocks.length; i++) { const k = kstr(D.world(W, i, ns)); if (seen.has(k)) return { jam: 'overlap' }; seen.add(k); }
    const pp = D.world(W, player, ns); if (seen.has(kstr([pp[0], pp[1], pp[2] + 1]))) return { jam: 'head' };
    return ns;
  };
  D.moves = W => [...(W.views ? [['view', 1], ['view', -1]] : []), ...W.pieces.flatMap((_, g) => [[g, 1], [g, -1]])];
  // 最少操作次數（走路不算）與一組解法 [{ stand, g, dir }]
  D.solve = function (W, maxOps = 20) {
    const moves = D.moves(W), s0 = [W.start, D.initState(W)], seen = new Set([W.start + '|' + stKey(s0[1])]);
    let frontier = [s0];
    for (let ops = 0; ops <= maxOps && frontier.length; ops++) {
      const next = [];
      for (const node of frontier) {
        const [p, st] = node, reach = D.reach(W, st, p);
        if (reach.has(W.goal)) {
          const plan = []; let n = node;
          while (n.from) { plan.unshift(n.from.m); n = n.from.node; }
          return { ops, plan };
        }
        for (const q of reach.keys()) for (const [g, dir] of moves) {
          const ns = D.operate(W, st, g, dir, q); if (ns.jam) continue;
          const k = q + '|' + stKey(ns); if (seen.has(k)) continue;
          seen.add(k); const nn = [q, ns]; nn.from = { node, m: { stand: q, g, dir } }; next.push(nn);
        }
      }
      frontier = next;
    }
    return { ops: -1, plan: null };
  };
  // 檢查關卡資料：{ errors, warnings, info }
  D.validate = function (L) {
    const errors = [], warnings = [], info = {};
    const isP = (p, n = 3) => Array.isArray(p) && p.length >= n && p.slice(0, n).every(Number.isInteger);
    if (!L || typeof L !== 'object') return { errors: ['不是物件'], warnings, info };
    if (!L.name) warnings.push('沒有 name');
    if (!Array.isArray(L.blocks) || !L.blocks.length) errors.push('blocks 必須是非空陣列');
    (L.blocks || []).forEach((b, i) => { if (!isP(b)) errors.push(`blocks[${i}] 不是整數座標`); else if (b[3] !== undefined && b[3] !== 'n') errors.push(`blocks[${i}] 第 4 欄只能是 'n'`); });
    (L.pieces || []).forEach((P, gi) => {
      const at = `pieces[${gi}]`;
      if (!Array.isArray(P.blocks) || !P.blocks.length || !P.blocks.every(b => isP(b))) errors.push(`${at}.blocks 必須是非空的整數座標陣列`);
      if (P.kind === 'slide') {
        if (!Array.isArray(P.states) || P.states.length < 2 || !P.states.every(s => isP(s))) errors.push(`${at}.states 至少要兩個整數位移，如 [[0,0,0],[0,0,1]]`);
      } else if (P.kind === 'turn') {
        const ax = P.axis || 'z';
        if (!['x', 'y', 'z'].includes(ax)) errors.push(`${at}.axis 只能是 'x'、'y' 或 'z'`);
        if (!isP(P.pivot, ax === 'z' ? 2 : 3)) errors.push(`${at}.pivot 必須是整數 ${ax === 'z' ? '[px,py]' : '[px,py,pz]'}`);
      } else errors.push(`${at}.kind 必須是 'slide' 或 'turn'`);
      if (P.lever !== undefined && !isP(P.lever)) errors.push(`${at}.lever 必須是整數座標`);
      if (!P.label) warnings.push(`${at} 沒有 label（按鈕上的字）`);
    });
    if (L.center !== undefined && !(Array.isArray(L.center) && L.center.length === 2 && L.center.every(v => Number.isInteger(v * 2)))) errors.push('center 必須是 [cx,cy]，整數或 .5');
    if (errors.length) return { errors, warnings, info };
    const W = D.build(L);
    if (W.start < 0) errors.push('start 不是任何方塊的座標'); else if (!W.blocks[W.start].walk) errors.push("start 的方塊標成 'n'");
    if (W.goal < 0) errors.push('goal 不是任何方塊的座標'); else if (!W.blocks[W.goal].walk) errors.push("goal 的方塊標成 'n'");
    W.pieces.forEach((P, gi) => { if (P.lever && P.leverIx < 0) errors.push(`pieces[${gi}].lever 不是任何靜態方塊的座標`); });
    const seen = new Set(); W.blocks.forEach(b => { const k = kstr(b.base); if (seen.has(k)) errors.push(`兩個方塊重疊在 [${k}]`); seen.add(k); });
    if (errors.length) return { errors, warnings, info };
    const st0 = D.initState(W);
    if (!D.nodes(W, st0).has(W.start)) errors.push('起點一開始就被擋住（頂面被前面的方塊蓋到）');
    if (D.reach(W, st0, W.start).has(W.goal)) warnings.push('不用任何操作就走得到終點');
    const sol = D.solve(W); info.minOps = sol.ops; info.plan = sol.plan;
    if (sol.ops < 0) errors.push('解不出來（20 次操作內走不到終點）');
    else if (L.par !== undefined && L.par !== sol.ops) warnings.push(`par 寫 ${L.par}，引擎算出最少 ${sol.ops} 次`);
    info.blocks = W.blocks.length; info.nodes = D.nodes(W, st0).size;
    return { errors, warnings, info };
  };

  // ── 聲音：交給 js/drift-audio.js；沒有就安靜 ──
  const AU = () => window.DriftAudio || null;
  const sfx = (name, n) => { const a = AU(); if (a && a.sfx) try { a.sfx(name, n); } catch (e) { /* 音效失敗不影響遊戲 */ } };

  // ── 畫面 ──
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  ];
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const mix = (cols, w) => { const s = w[0] + w[1] + w[2] || 1; return 'rgb(' + [0, 1, 2].map(k => Math.round((cols[0][k] * w[0] + cols[1][k] * w[1] + cols[2][k] * w[2]) / s)).join(',') + ')'; };
  const ease = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function themeOf(L, i) {
    const base = D.THEMES[(Number.isInteger(L.theme) ? L.theme : i) % D.THEMES.length];
    return L.theme && typeof L.theme === 'object' ? { ...base, ...L.theme } : { ...base };
  }

  D.mount = function (root, api) {
    const LEVELS = Array.isArray(window.DriftLevels) && window.DriftLevels.length ? window.DriftLevels : D.SAMPLES, N = LEVELS.length;
    const qs = new URLSearchParams(location.search), dev = qs.has('drift-dev');
    let unlocked = dev ? N - 1 : Math.max(0, Math.min(N - 1, +api.load('drift.unlocked', 0) || 0));
    let level = qs.has('drift-level') ? Math.max(0, Math.min(N - 1, +qs.get('drift-level') || 0)) : Math.min(unlocked, +api.load('drift.level', 0) || 0);
    let W, T, st, player, anim = null, walk = null, done = false, steps = 0, ops = 0, raf = 0, alive = true, tapFx = null, handleHits = [], motes = [];
    let view = { s: 40, ox: 0, oy: 0, w: 640, h: 560 }, winTimer = 0, goalWasReachable = false, audioWoken = false;
    let musicPref = api.load('drift.music', '1') === '1';
    root.innerHTML = `
      <div class="game-head">
        <div class="seg dr-levels" id="dr-levels">${LEVELS.map((L, i) => `<button data-i="${i}" title="${(L.name || '').replace(/"/g, '')}">${i + 1}</button>`).join('')}</div>
        <div class="stat">第 <b id="dr-no">1</b> 章 · <b id="dr-name"></b> · 操作 <b id="dr-ops">0</b> 次<span id="dr-par"></span></div>
      </div>
      <p class="rule">點地面，提燈旅人就會走過去。轉動建築或撥動發光的機關，這裡只有一條規則：<b>畫面上看起來接上的路，就走得過去。</b></p>
      <div class="dr-stage" id="dr-stage"><canvas id="dr-cv" aria-label="迴廊幻境場景"></canvas></div>
      <p class="dr-hint" id="dr-hint"></p>
      <div class="tools center" id="dr-ctrl"></div>
      <div class="tools center"><button id="dr-reset">重來這章</button><button id="dr-music" aria-pressed="false">♪ 音樂</button><button id="dr-next" class="primary" hidden>下一章 →</button></div>
      <p class="msg" id="dr-msg" aria-live="polite"></p>`;
    const $ = s => root.querySelector(s), cv = $('#dr-cv'), ctx = cv.getContext('2d'), stage = $('#dr-stage');
    const say = t => { $('#dr-msg').textContent = t; };
    const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    function load(i) {
      clearTimeout(winTimer);
      level = i; api.save('drift.level', i);
      const L = LEVELS[i];
      W = D.build(L); T = themeOf(L, i);
      T.c = { path: T.path.map(hex), stone: T.stone.map(hex), mech: T.mech.map(hex) };
      st = D.initState(W); player = W.start; anim = walk = null; done = false; steps = ops = 0;
      sfx('step', 0);
      const a = AU(); if (a && a.setMood) try { a.setMood(Number.isInteger(L.mood) ? L.mood : i); } catch (e) { /* 忽略 */ }
      $('#dr-no').textContent = i + 1; $('#dr-name').textContent = L.name || ''; $('#dr-ops').textContent = 0;
      $('#dr-par').textContent = Number.isInteger(L.par) ? ` · 最少 ${L.par} 次` : '';
      $('#dr-hint').textContent = L.hint || ''; say(''); $('#dr-next').hidden = true;
      root.querySelectorAll('#dr-levels button').forEach((b, k) => { b.classList.toggle('on', k === i); b.disabled = k > unlocked; });
      $('#dr-ctrl').innerHTML = (W.views ? '<button data-g="view" data-d="-1" title="向左轉（←）">↺ 向左轉</button><button data-g="view" data-d="1" title="向右轉（→）">向右轉 ↻</button>' : '') +
        W.pieces.map((P, g) => `<span class="dr-piece"><button data-g="${g}" data-d="-1" aria-label="${P.label || '機關'} 往回">‹</button><b>${P.label || '機關'}</b><button data-g="${g}" data-d="1" aria-label="${P.label || '機關'} 往前">›</button></span>`).join('');
      motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.8, v: .004 + Math.random() * .01, p: Math.random() * 6 }));
      fit();
    }
    // 取景：四個視角 × 每個機關的每種位置都算進去，轉動時整座建築不會出界
    function fit() {
      const w = Math.min(stage.clientWidth || 640, 760), h = Math.round(Math.max(340, Math.min(w * .92, 620)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const pt = (x, y, z) => { const [sx, sy] = scr(x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); };
      const box = p => { pt(p[0] - .5, p[1] - .5, p[2] + 2); pt(p[0] + .5, p[1] - .5, p[2] - .5); pt(p[0] - .5, p[1] + .5, p[2] - .5); pt(p[0] + .5, p[1] + .5, p[2] - .5); };
      const st0 = D.initState(W);
      for (let v = 0; v < (W.views ? 4 : 1); v++) W.blocks.forEach((b, i) => {
        const n = b.g < 0 ? 1 : W.pieces[b.g].n;
        for (let k = 0; k < n; k++) { const s = { v, p: st0.p.slice() }; if (b.g >= 0) s.p[b.g] = k; box(D.place(W, i, s)); }
      });
      const pad = 22, s = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0), 60);
      view = { s, w, h, ox: w / 2 - (x0 + x1) / 2 * s, oy: h / 2 - (y0 + y1) / 2 * s };
    }
    const P = (x, y, z) => { const [sx, sy] = scr(x, y, z); return [view.ox + sx * view.s, view.oy + sy * view.s]; };

    // 每個方塊目前（含動畫中）的中心與旋轉：{ c, k: 旋轉軸, a: 角度 }
    function poses() {
      const pos = D.layout(W, st);
      if (!anim) return pos.map(c => ({ c }));
      const e = ease(anim.t);
      if (anim.g === 'view') {
        const a = (e - 1) * anim.dir * Math.PI / 2, ctr = [W.cx, W.cy, 0];
        return pos.map(c => ({ c: add3(rotA(sub3(c, ctr), AX.z, a), ctr), k: AX.z, a }));
      }
      const Pc = W.pieces[anim.g];
      return pos.map((c, i) => {
        if (W.blocks[i].g !== anim.g) return { c };
        if (Pc.kind === 'turn') {
          const k = viewVec(AX[Pc.axis], st.v), pv = viewPt(W, Pc.pivot, st.v), a = (e - 1) * anim.dir * Math.PI / 2;
          return { c: add3(rotA(sub3(c, pv), k, a), pv), k, a };
        }
        const d = viewVec(anim.delta, st.v);
        return { c: [c[0] - d[0] * (1 - e), c[1] - d[1] * (1 - e), c[2] - d[2] * (1 - e)] };
      });
    }
    function poly(pts) { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
    function drawCube(i, pz, nodes) {
      const b = W.blocks[i], cols = b.g >= 0 ? T.c.mech : b.walk ? T.c.path : T.c.stone, lever = W.pieces.some(Pc => Pc.leverIx === i);
      for (const F of FACES) {
        const n = pz.k ? rotA(F.n, pz.k, pz.a) : F.n;
        if (n[0] + n[1] + n[2] < 1e-3) continue;
        const pts = F.c.map(cb => { let o = [cb[0] - .5, cb[1] - .5, cb[2] - .5]; if (pz.k) o = rotA(o, pz.k, pz.a); return P(pz.c[0] + o[0], pz.c[1] + o[1], pz.c[2] + o[2]); });
        const fill = mix(cols, [Math.max(0, n[2]) ** 2, Math.max(0, n[1]) ** 2, Math.max(0, n[0]) ** 2]);
        poly(pts); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.stroke();
        if (n[2] > .999 && nodes.has(i) && !anim) { // 走得到的頂面畫內框；拉桿畫成圓形踏板
          const c = [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2];
          if (lever) { ctx.fillStyle = T.mech[1]; ctx.beginPath(); ctx.ellipse(c[0], c[1], view.s * .42, view.s * .24, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.mech[0]; ctx.beginPath(); ctx.ellipse(c[0], c[1] - view.s * .04, view.s * .32, view.s * .17, 0, 0, Math.PI * 2); ctx.fill(); }
          poly(pts.map(p => [c[0] + (p[0] - c[0]) * .68, c[1] + (p[1] - c[1]) * .68]));
          ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1, view.s * .03); ctx.stroke();
        } else if (n[2] < .5 && !b.walk && b.g < 0) { // 石塊側面的細紋
          ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2); ctx.lineTo((pts[2][0] + pts[3][0]) / 2, (pts[2][1] + pts[3][1]) / 2); ctx.stroke();
        }
      }
    }
    function drawGoal(c, now) { // 終點：細長石碑上方浮著一圈光環
      const [x, y] = P(c[0], c[1], c[2] + .5), s = view.s, pulse = .6 + .4 * Math.sin(now / 600);
      const g = ctx.createRadialGradient(x, y - s * .9, 1, x, y - s * .9, s * 1.3);
      g.addColorStop(0, `rgba(255,248,220,${.55 * pulse})`); g.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = g; ctx.fillRect(x - s * 1.4, y - s * 2.3, s * 2.8, s * 2.8);
      ctx.fillStyle = T.path[1]; ctx.beginPath(); ctx.moveTo(x - s * .16, y); ctx.lineTo(x - s * .12, y - s * 1.15); ctx.lineTo(x, y - s * 1.32); ctx.lineTo(x, y + s * .05); ctx.fill();
      ctx.fillStyle = T.path[2]; ctx.beginPath(); ctx.moveTo(x + s * .16, y); ctx.lineTo(x + s * .12, y - s * 1.15); ctx.lineTo(x, y - s * 1.32); ctx.lineTo(x, y + s * .05); ctx.fill();
      const ry = y - s * (1.48 + .06 * Math.sin(now / 500));
      ctx.strokeStyle = `rgba(255,250,230,${.7 + .3 * pulse})`; ctx.lineWidth = Math.max(1.5, s * .05);
      ctx.beginPath(); ctx.ellipse(x, ry, s * .3, s * .11, 0, 0, Math.PI * 2); ctx.stroke();
    }
    function drawHero(x, y, now, moving) { // 提燈旅人：斗篷、圓頭、紅圍巾、一盞小燈
      const s = view.s, bob = moving ? Math.abs(Math.sin(now / 90)) * s * .06 : Math.sin(now / 700) * s * .015;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, s * .22, s * .1, 0, 0, Math.PI * 2); ctx.fill();
      const by = y - bob;
      ctx.fillStyle = T.hero; ctx.beginPath(); ctx.moveTo(x - s * .2, by); ctx.quadraticCurveTo(x - s * .17, by - s * .5, x, by - s * .62); ctx.quadraticCurveTo(x + s * .17, by - s * .5, x + s * .2, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c5432f'; ctx.fillRect(x - s * .12, by - s * .5, s * .24, s * .07);
      ctx.fillStyle = '#f7ecdc'; ctx.beginPath(); ctx.arc(x, by - s * .68, s * .13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.hero; ctx.beginPath(); ctx.arc(x, by - s * .72, s * .135, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      const lx = x + s * .27, ly = by - s * .22 + Math.sin(now / 300) * s * .02;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * .4); g.addColorStop(0, 'rgba(255,220,140,.75)'); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, s * .4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.hero; ctx.lineWidth = Math.max(1, s * .025); ctx.beginPath(); ctx.moveTo(x + s * .14, by - s * .32); ctx.lineTo(lx, ly - s * .08); ctx.stroke();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(lx, ly, s * .065, 0, Math.PI * 2); ctx.fill();
    }
    // 機關的鈕：有拉桿的浮在拉桿上，轉台浮在轉軸上，滑塊浮在第一塊上
    function handlePos(g, pzs) {
      const Pc = W.pieces[g];
      if (Pc.leverIx >= 0) { const c = pzs[Pc.leverIx].c; return P(c[0], c[1], c[2] + 1.75); }
      let idx = -1;
      if (Pc.kind === 'turn') idx = W.blocks.findIndex(b => b.g === g && b.base[0] === Pc.pivot[0] && b.base[1] === Pc.pivot[1] && (Pc.axis === 'z' || b.base[2] === Pc.pivot[2]));
      if (idx < 0) idx = W.blocks.findIndex(b => b.g === g);
      const c = pzs[idx].c; return P(c[0], c[1], c[2] + 1.75);
    }
    function knobDir(g) { // 點鈕時會往哪一邊：能往前就往前，到底就往回
      const ok = d => !D.operate(W, st, g, d, player).jam || D.operate(W, st, g, d, player).jam === 'lever';
      return ok(1) ? 1 : ok(-1) ? -1 : 1;
    }
    function drawHandle(g, p, now) {
      const Pc = W.pieces[g], s = view.s, r = Math.max(9, s * .26), busy = !!anim && anim.g === g;
      const live = Pc.leverIx < 0 || player === Pc.leverIx;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.globalAlpha = live ? 1 : .45;
      if (live) { const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2); gl.addColorStop(0, 'rgba(255,240,200,.5)'); gl.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = T.mech[0]; ctx.strokeStyle = T.mech[2]; ctx.lineWidth = Math.max(1.5, s * .05);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = Math.max(1.2, s * .04); ctx.lineCap = 'round'; ctx.beginPath();
      if (Pc.kind === 'turn') {
        const a0 = (busy ? anim.dir * ease(anim.t) * Math.PI / 2 : 0) + (live && !reduce() ? now / 5000 : 0);
        for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .72, Math.sin(a) * r * .72); }
      } else { // 箭頭指向下一次會移動的方向（畫面上）
        const d = knobDir(g), cur = Pc.states[st.p[g]], nx = Pc.states[Pc.loop ? (st.p[g] + d + Pc.n) % Pc.n : Math.max(0, Math.min(Pc.n - 1, st.p[g] + d))];
        const v = viewVec(sub3(nx, cur), st.v), sv = scr(v[0], v[1], v[2]), len = Math.hypot(sv[0], sv[1]) || 1, ux = sv[0] / len, uy = sv[1] / len;
        ctx.moveTo(-ux * r * .5, -uy * r * .5); ctx.lineTo(ux * r * .5, uy * r * .5);
        ctx.moveTo(ux * r * .5 - (ux * .35 - uy * .3) * r, uy * r * .5 - (uy * .35 + ux * .3) * r); ctx.lineTo(ux * r * .5, uy * r * .5); ctx.lineTo(ux * r * .5 - (ux * .35 + uy * .3) * r, uy * r * .5 - (uy * .35 - ux * .3) * r);
      }
      ctx.stroke(); ctx.restore();
    }
    function heroAt(pzs) {
      const top = i => { const c = pzs[i].c; return { p: P(c[0], c[1], c[2] + .5), d: depth(c) }; };
      if (!walk) { const a = top(player); return { x: a.p[0], y: a.p[1], d: a.d + 1.5 }; }
      const a = top(walk.path[walk.k]), b = top(walk.path[walk.k + 1]), t = walk.t;
      return { x: a.p[0] + (b.p[0] - a.p[0]) * t, y: a.p[1] + (b.p[1] - a.p[1]) * t, d: Math.max(a.d, b.d) + 1.5 };
    }
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (anim) { anim.t = Math.min(1, (now - anim.t0) / anim.dur); if (anim.t >= 1) { anim = null; afterOperate(); } }
      if (walk) {
        walk.t = Math.min(1, (now - walk.t0) / (reduce() ? 120 : 240));
        if (walk.t >= 1) {
          walk.k++; steps++; walk.t = 0; walk.t0 = now; player = walk.path[walk.k]; sfx('step', steps);
          if (walk.k >= walk.path.length - 1) { walk = null; if (player === W.goal) win(); }
        }
      }
      const { w, h, s } = view;
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, T.sky[0]); sky.addColorStop(1, T.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const sg = ctx.createRadialGradient(w * .8, h * .18, 0, w * .8, h * .18, w * .32); sg.addColorStop(0, T.sun); sg.addColorStop(.22, T.sun + 'cc'); sg.addColorStop(1, T.sun + '00');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      motes.forEach(m => { if (!reduce()) m.y -= m.v / 60; if (m.y < -.02) m.y = 1.02; ctx.fillStyle = `rgba(255,255,255,${.25 + .2 * Math.sin(now / 900 + m.p)})`; ctx.beginPath(); ctx.arc(m.x * w + Math.sin(now / 2000 + m.p) * 8, m.y * h, m.r, 0, Math.PI * 2); ctx.fill(); });

      const pzs = poses(), nodes = D.nodes(W, st);
      const items = pzs.map((pz, i) => ({ d: depth(pz.c), f: () => drawCube(i, pz, nodes) }));
      const gc = pzs[W.goal].c; items.push({ d: depth(gc) + 1.4, f: () => drawGoal(gc, now) });
      const hero = heroAt(pzs); items.push({ d: hero.d, f: () => drawHero(hero.x, hero.y, now, !!walk) });
      items.sort((a, b) => a.d - b.d).forEach(it => it.f());
      if (tapFx) {
        const t = (now - tapFx.t0) / 450;
        if (t >= 1) tapFx = null;
        else { ctx.strokeStyle = tapFx.bad ? `rgba(197,67,47,${1 - t})` : `rgba(255,255,255,${1 - t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tapFx.x, tapFx.y, s * .45 * (.4 + t), s * .26 * (.4 + t), 0, 0, Math.PI * 2); ctx.stroke(); }
      }
      handleHits = W.pieces.map((_, g) => { const p = handlePos(g, pzs); drawHandle(g, p, now); return { g, x: p[0], y: p[1], r: Math.max(18, s * .45) }; });
    }
    function afterOperate() {
      $('#dr-ops').textContent = ops;
      if (!goalWasReachable && D.reach(W, st, player).has(W.goal)) sfx('unlock');
    }
    const JAM = { lever: '要站在發光的踏板上才能動它。', riding: '站在上面的時候不能翻轉它。', end: '已經推到底了。', overlap: '卡住了，那邊有東西擋著。', head: '會撞到旅人的頭，動不了。', fixed: '這一章的建築轉不動。' };
    function operate(g, dir) {
      if (anim || walk || done) return;
      const ns = D.operate(W, st, g, dir, player);
      if (ns.jam) { sfx('blocked'); say(JAM[ns.jam] || '動不了。'); return; }
      const Pc = g === 'view' ? null : W.pieces[g];
      const delta = Pc && Pc.kind === 'slide' ? sub3(Pc.states[ns.p[g]], Pc.states[st.p[g]]) : null;
      goalWasReachable = D.reach(W, st, player).has(W.goal);
      st = ns; ops++; say('');
      sfx(Pc && Pc.kind === 'slide' ? 'slide' : 'rotate', dir);
      anim = { g, dir, delta, t: 0, t0: performance.now(), dur: reduce() ? 1 : Pc && Pc.kind === 'slide' ? 520 : 750 };
    }
    function win() {
      done = true; sfx('door'); winTimer = setTimeout(() => sfx('win'), 700); api.confetti();
      if (level + 1 < N) { unlocked = Math.max(unlocked, level + 1); api.save('drift.unlocked', unlocked); $('#dr-next').hidden = false; root.querySelectorAll('#dr-levels button').forEach((b, k) => { b.disabled = k > unlocked; }); }
      const par = LEVELS[level].par, best = Number.isInteger(par) && ops <= par ? '，正好是最少的操作次數' : '';
      say(level + 1 < N ? `抵達了！走了 ${steps} 步、操作 ${ops} 次${best}。` : `最後一章也走完了！全部 ${N} 章都抵達了。`);
    }
    function hitTop(mx, my) {
      const pos = D.layout(W, st), nodes = D.nodes(W, st); let best = -1, bd = -Infinity;
      for (const i of nodes.keys()) {
        const p = pos[i], pts = [P(p[0] - .5, p[1] - .5, p[2] + .5), P(p[0] + .5, p[1] - .5, p[2] + .5), P(p[0] + .5, p[1] + .5, p[2] + .5), P(p[0] - .5, p[1] + .5, p[2] + .5)];
        if (insideBy(pts, [mx, my], 0) && depth(p) > bd) { bd = depth(p); best = i; }
      }
      return best;
    }
    function wakeAudio() {
      const a = AU(); if (!a) return;
      if (!audioWoken) { audioWoken = true; try { if (a.unlock) a.unlock(); } catch (e) { /* 忽略 */ } }
      if (musicPref && !a.on) startMusic();
    }
    function startMusic() { const a = AU(); if (!a) return; try { a.start(); } catch (e) { return; } $('#dr-music').classList.add('on'); $('#dr-music').setAttribute('aria-pressed', 'true'); }
    function onTap(e) {
      wakeAudio();
      const rc = cv.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top;
      const hh = handleHits.find(o => Math.hypot(o.x - mx, o.y - my) < o.r);
      if (hh) { operate(hh.g, knobDir(hh.g)); return; }
      if (anim || walk || done) return;
      const i = hitTop(mx, my); if (i < 0 || i === player) return;
      const p = D.layout(W, st)[i], c = P(p[0], p[1], p[2] + .5), prev = D.reach(W, st, player);
      tapFx = { x: c[0], y: c[1], t0: performance.now(), bad: !prev.has(i) };
      if (!prev.has(i)) { sfx('blocked'); say('從這裡走不過去，轉轉看或動動機關。'); return; }
      sfx('tap');
      const path = []; for (let j = i; j !== -1; j = prev.get(j)) path.unshift(j);
      say(''); walk = { path, k: 0, t: 0, t0: performance.now() };
    }
    cv.addEventListener('pointerdown', onTap);
    root.addEventListener('pointerdown', wakeAudio);
    $('#dr-ctrl').onclick = e => { const b = e.target.closest('button'); if (!b) return; operate(b.dataset.g === 'view' ? 'view' : +b.dataset.g, +b.dataset.d); };
    $('#dr-levels').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { sfx('ui'); load(+b.dataset.i); } };
    $('#dr-reset').onclick = () => { sfx('ui'); load(level); };
    $('#dr-next').onclick = () => { sfx('ui'); load(Math.min(N - 1, level + 1)); };
    if (!AU()) { $('#dr-music').disabled = true; $('#dr-music').title = '音樂檔還沒放進來'; }
    $('#dr-music').onclick = () => {
      const a = AU(); if (!a) return;
      if (a.on) { try { a.stop(); } catch (e) { /* 忽略 */ } musicPref = false; $('#dr-music').classList.remove('on'); $('#dr-music').setAttribute('aria-pressed', 'false'); }
      else { musicPref = true; startMusic(); }
      api.save('drift.music', musicPref ? '1' : '0');
    };
    const onKey = e => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowLeft' && W.views) { e.preventDefault(); operate('view', -1); }
      if (e.key === 'ArrowRight' && W.views) { e.preventDefault(); operate('view', 1); }
    };
    document.addEventListener('keydown', onKey);
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    load(level); raf = requestAnimationFrame(frame);
    if (dev) { // 給截圖工具用：?drift-dev 解鎖全部章節並開放這組介面
      window.__drift = {
        get W() { return W; }, get st() { return st; }, get player() { return player; }, get busy() { return !!(anim || walk); }, load,
        screenOf(i) { const p = D.place(W, i, st); return P(p[0], p[1], p[2] + .5); },
        apply(plan) { plan.forEach(m => { player = m.stand; const ns = D.operate(W, st, m.g, m.dir, player); if (!ns.jam) { st = ns; ops++; } }); anim = null; walk = null; },
      };
    }
    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(winTimer);
      window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey);
      const a = AU(); if (a) try { if (a.dispose) a.dispose(); else if (a.stop) a.stop(); } catch (e) { /* 忽略 */ }
      if (dev) delete window.__drift;
    };
  };

  if (typeof module !== 'undefined') module.exports = D; else window.GameRoom.register('drift', D);
})();
