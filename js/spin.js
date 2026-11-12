// 旋轉拼板（第二種玩法「轉板接線」）：點一下把板子轉 90 度，讓所有線條首尾相接、不留斷頭
const SpinPipe = (function () {
  const S = {};
  // 方向位元：上 1、右 2、下 4、左 8
  const rot = m => ((m << 1) | (m >> 3)) & 15;
  S.generate = function (W, H) {
    for (let t = 0; t < 50; t++) {
      const mask = new Array(W * H).fill(0);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (c < W - 1 && Math.random() < .55) { mask[i] |= 2; mask[i + 1] |= 8; }
        if (r < H - 1 && Math.random() < .55) { mask[i] |= 4; mask[i + W] |= 1; }
      }
      // 不要太多空格與孤立端點
      const empty = mask.filter(m => !m).length, ends = mask.filter(m => [1, 2, 4, 8].includes(m)).length;
      if (empty > W * H * .08 || ends > W * H * .2) continue;
      const turns = mask.map(() => Math.floor(Math.random() * 4));
      const cur = mask.map((m, i) => { let x = m; for (let k = 0; k < turns[i]; k++) x = rot(x); return x; });
      if (S.solved(W, H, cur)) continue;
      return { W, H, cur, deg: turns.map(k => k * 90) };
    }
  };
  S.solved = function (W, H, m) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const x = m[r * W + c];
      if ((x & 1) !== ((r > 0 ? m[(r - 1) * W + c] : 0) & 4 ? 1 : 0)) return false;
      if ((x & 2 ? 1 : 0) !== ((c < W - 1 ? m[r * W + c + 1] : 0) & 8 ? 1 : 0)) return false;
      if ((x & 4 ? 1 : 0) !== ((r < H - 1 ? m[(r + 1) * W + c] : 0) & 1 ? 1 : 0)) return false;
      if ((x & 8 ? 1 : 0) !== ((c > 0 ? m[r * W + c - 1] : 0) & 2 ? 1 : 0)) return false;
    }
    return true;
  };
  // 以「原始方向」畫圖，旋轉交給 CSS
  function tileSVG(m0) {
    const P = { 1: [50, 0], 2: [100, 50], 4: [50, 100], 8: [0, 50] };
    const sides = [1, 2, 4, 8].filter(b => m0 & b);
    let d = '';
    if (sides.length === 2 && !((m0 === 5) || (m0 === 10))) {
      const [a, b] = sides.map(s => P[s]); d = `M${a[0]} ${a[1]} Q50 50 ${b[0]} ${b[1]}`;
    } else sides.forEach(s => { d += `M50 50 L${P[s][0]} ${P[s][1]} `; });
    const dot = sides.length === 1 ? '<circle cx="50" cy="50" r="13" />' : sides.length >= 3 ? '<circle cx="50" cy="50" r="10" />' : '';
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" /><g class="dot">${dot}</g></svg>`;
  }
  const SIZES = [{ n: 5, name: '5×5' }, { n: 7, name: '7×7' }, { n: 9, name: '9×9' }];

  S.mount = function (root, api) {
    let N = +api.load('spin.n', 5), st;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="sp-sizes">${SIZES.map(s => `<button data-n="${s.n}">${s.name}</button>`).join('')}</div>
        <div class="stat">轉了 <b id="sp-moves">0</b> 次</div>
      </div>
      <p class="rule">點一下板子就順時針轉 90 度。把每一條線都接起來，不能有線頭伸向空格或盤面外。</p>
      <div class="sp-grid" id="sp-grid"></div>
      <div class="tools center"><button id="sp-new" class="primary">新局</button></div>
      <p class="msg" id="sp-msg"></p>`;
    const $ = s => root.querySelector(s), grid = $('#sp-grid');
    function newGame() {
      const g = S.generate(N, N);
      st = { ...g, orig: g.cur.slice(), base: g.cur.slice(), moves: 0, done: false };
      // base 是畫圖用的方向，deg 從 0 開始累計
      st.deg = st.cur.map(() => 0);
      grid.style.setProperty('--n', N);
      grid.innerHTML = st.base.map((m, i) => `<button class="sp-tile" data-i="${i}" aria-label="板子 ${Math.floor(i / N) + 1}-${i % N + 1}"><span style="transform:rotate(0deg)">${tileSVG(m)}</span></button>`).join('');
      $('#sp-msg').textContent = ''; $('#sp-moves').textContent = 0;
      root.querySelectorAll('#sp-sizes button').forEach(b => b.classList.toggle('on', +b.dataset.n === N));
      grid.classList.remove('won');
      mark();
    }
    function mark() {
      // 標出與鄰居接好的板子
      const m = st.cur, W = N;
      [...grid.children].forEach((el, i) => {
        const r = Math.floor(i / W), c = i % W, x = m[i]; let ok = x !== 0;
        if (x & 1) ok = ok && r > 0 && (m[i - W] & 4); if (x & 2) ok = ok && c < W - 1 && (m[i + 1] & 8);
        if (x & 4) ok = ok && r < W - 1 && (m[i + W] & 1); if (x & 8) ok = ok && c > 0 && (m[i - 1] & 2);
        el.classList.toggle('ok', !!ok);
      });
    }
    grid.addEventListener('click', e => {
      const b = e.target.closest('.sp-tile'); if (!b || st.done) return;
      const i = +b.dataset.i;
      st.cur[i] = rot(st.cur[i]); st.deg[i] += 90; st.moves++;
      b.firstElementChild.style.transform = `rotate(${st.deg[i]}deg)`;
      $('#sp-moves').textContent = st.moves;
      mark();
      if (S.solved(N, N, st.cur)) { st.done = true; grid.classList.add('won'); $('#sp-msg').textContent = `全部接上了！轉了 ${st.moves} 次。`; api.confetti(); }
    });
    $('#sp-new').onclick = newGame;
    $('#sp-sizes').onclick = e => { const b = e.target.closest('button'); if (!b) return; N = +b.dataset.n; api.save('spin.n', N); newGame(); };
    newGame();
  };

  return S;
})();

// 旋轉拼板（主玩法「翻轉圖樣」）：每塊板子正反兩面顏色不同。
// 把一整排（或一整列）繞著中心轉半圈：順序左右（上下）顛倒，每塊同時翻到另一面。
// 用最少的轉動，讓盤面變成上方的目標圖樣。
const SpinFlip = (function () {
  const F = {};
  // 狀態：t[i] 板子編號、s[i] 0 正面 / 1 反面；cols[id] = [正面色, 反面色]
  F.apply = function (N, st, m) {
    const t = st.t.slice(), s = st.s.slice();
    for (let k = 0; k < N; k++) {
      const a = m < N ? m * N + k : k * N + (m - N);
      const b = m < N ? m * N + (N - 1 - k) : (N - 1 - k) * N + (m - N);
      t[a] = st.t[b]; s[a] = 1 - st.s[b];
    }
    return { t, s };
  };
  F.show = (cols, st) => st.t.map((id, i) => cols[id][st.s[i]]);
  const key = st => String.fromCharCode(...st.t.map((id, i) => id * 2 + st.s[i] + 48));
  // 廣度優先找最短解；回傳步驟陣列或 null
  F.solve = function (N, cols, st, goal, maxD) {
    const g = goal.join('');
    if (F.show(cols, st).join('') === g) return [];
    let front = [{ st, path: [] }]; const seen = new Set([key(st)]);
    for (let d = 1; d <= maxD; d++) {
      const next = [];
      for (const n of front) for (let m = 0; m < 2 * N; m++) {
        if (n.path.length && n.path[n.path.length - 1] === m) continue;
        const ns = F.apply(N, n.st, m), k = key(ns);
        if (seen.has(k)) continue; seen.add(k);
        const path = n.path.concat(m);
        if (F.show(cols, ns).join('') === g) return path;
        next.push({ st: ns, path });
      }
      front = next;
    }
    return null;
  };
  F.generate = function (N, K, steps, rnd = Math.random) {
    const ri = n => Math.floor(rnd() * n);
    let best = null;
    for (let tries = 0; tries < 12; tries++) {
      const cols = [];
      for (let i = 0; i < N * N; i++) { const a = ri(K); let b = ri(K - 1); if (b >= a) b++; cols.push([a, b]); }
      const start = { t: cols.map((_, i) => i), s: cols.map(() => ri(2)) };
      let g = start, last = -1;
      for (let k = 0; k < steps; k++) { let m; do m = ri(2 * N); while (m === last); g = F.apply(N, g, m); last = m; }
      const goal = F.show(cols, g);
      const sol = F.solve(N, cols, start, goal, steps);
      if (!sol || !sol.length) continue;
      const cand = { N, cols, start, goal, par: sol.length, sol };
      if (!best || cand.par > best.par) best = cand;
      if (cand.par >= steps) break;
    }
    return best;
  };

  // 翻轉圖樣的面色：遊戲間強調色加灰階
  const PAL = ['#FF5B2E', '#ECEAE4', '#6B6F80', '#3A3E4E', '#B9B7B0'];
  const LV = [
    { n: 3, k: 3, steps: 4, name: '3×3' },
    { n: 4, k: 4, steps: 6, name: '4×4' },
    { n: 5, k: 4, steps: 7, name: '5×5' },
  ];

  F.mount = function (root, api) {
    let L = Math.min(+api.load('spin.flip', 0) || 0, LV.length - 1), G, cur, hist, busy = false, done = false, timers = [];
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="sf-lv">${LV.map((l, i) => `<button data-i="${i}">${l.name}</button>`).join('')}</div>
        <div class="stat">轉了 <b id="sf-moves">0</b> 次 · 最少 <b id="sf-par">-</b> 次</div>
      </div>
      <p class="rule">在盤面上左右滑一排、上下滑一列（或點邊上的把手），那一排就繞中心轉半圈：順序顛倒，每塊翻到另一面的顏色。轉成上方的目標圖樣就過關。</p>
      <div class="sf-goal"><span>目標</span><div class="sf-mini" id="sf-goal"></div></div>
      <div class="sf-board" id="sf-board"></div>
      <div class="tools center">
        <button id="sf-undo">復原一步</button><button id="sf-reset">從頭來</button>
        <button id="sf-hint">提示</button><button id="sf-new" class="primary">新題目</button>
      </div>
      <p class="msg" id="sf-msg"></p>`;
    const $ = s => root.querySelector(s), board = $('#sf-board'), msg = t => { $('#sf-msg').textContent = t; };
    const N = () => G.N;

    function newGame() {
      const l = LV[L];
      G = F.generate(l.n, l.k, l.steps);
      cur = G.start; hist = []; done = false;
      root.querySelectorAll('#sf-lv button').forEach(b => b.classList.toggle('on', +b.dataset.i === L));
      $('#sf-par').textContent = G.par;
      const goal = $('#sf-goal'); goal.style.setProperty('--n', G.N);
      goal.innerHTML = G.goal.map(c => `<i style="background:${PAL[c]}"></i>`).join('');
      build(); msg('');
    }
    function build() {
      const n = N();
      board.style.setProperty('--n', n);
      let h = '<span></span>';
      for (let c = 0; c < n; c++) h += `<button class="sf-h col" data-m="${n + c}" aria-label="轉第 ${c + 1} 列">⇅</button>`;
      for (let r = 0; r < n; r++) {
        h += `<button class="sf-h row" data-m="${r}" aria-label="轉第 ${r + 1} 排">⇄</button>`;
        for (let c = 0; c < n; c++) h += `<div class="sf-t" data-i="${r * n + c}"><i class="fr"></i><i class="bk"></i></div>`;
      }
      board.innerHTML = h; paint();
    }
    function tiles() { return [...board.querySelectorAll('.sf-t')]; }
    function paint() {
      const show = F.show(G.cols, cur);
      tiles().forEach((el, i) => {
        el.style.transition = 'none'; el.style.transform = ''; el.classList.toggle('ok', show[i] === G.goal[i]);
        el.firstChild.style.background = PAL[show[i]];
        el.lastChild.style.background = PAL[G.cols[cur.t[i]][1 - cur.s[i]]];
      });
      $('#sf-moves').textContent = hist.length;
      $('#sf-undo').disabled = !hist.length || done;
    }
    function spin(m, record = true) {
      if (busy || done) return;
      board.querySelectorAll('.sf-h.hint').forEach(h => h.classList.remove('hint'));
      const n = N(), els = tiles(), isRow = m < n, idx = [];
      for (let k = 0; k < n; k++) idx.push(isRow ? m * n + k : k * n + (m - n));
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finish = () => {
        if (record) hist.push(cur);
        cur = F.apply(n, cur, m); busy = false; paint(); check();
      };
      if (reduce) return finish();
      busy = true;
      const box = idx.map(i => els[i].getBoundingClientRect());
      const mid = isRow ? (box[0].left + box[n - 1].right) / 2 : (box[0].top + box[n - 1].bottom) / 2;
      idx.forEach((i, k) => {
        const el = els[i], b = box[k];
        el.lastChild.style.transform = isRow ? 'rotateY(180deg)' : 'rotateX(180deg)';
        el.style.transformOrigin = isRow ? `${mid - b.left}px 50%` : `50% ${mid - b.top}px`;
        el.style.transition = 'none'; el.style.transform = '';
        el.getBoundingClientRect();
        el.style.transition = 'transform .42s cubic-bezier(.5,0,.3,1)';
        el.style.transform = isRow ? 'rotateY(180deg)' : 'rotateX(-180deg)';
        el.style.zIndex = 2;
      });
      timers.push(setTimeout(() => { idx.forEach(i => { els[i].style.zIndex = ''; els[i].lastChild.style.transform = ''; }); finish(); }, 440));
    }
    function check() {
      if (F.show(G.cols, cur).join('') !== G.goal.join('')) return;
      done = true; board.classList.add('won'); $('#sf-undo').disabled = true;
      const p = hist.length <= G.par;
      msg(p ? `完美！用最少的 ${hist.length} 次轉出目標。` : `轉出來了！用了 ${hist.length} 次，最少可以 ${G.par} 次。`);
      api.confetti();
    }
    board.addEventListener('click', e => { const b = e.target.closest('.sf-h'); if (b) spin(+b.dataset.m); });
    // 滑動：起點那塊決定是哪一排/列
    let p0 = null;
    board.addEventListener('pointerdown', e => { const t = e.target.closest('.sf-t'); if (t) p0 = { x: e.clientX, y: e.clientY, i: +t.dataset.i }; });
    const end = e => {
      if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y, n = N(), i = p0.i; p0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      spin(Math.abs(dx) > Math.abs(dy) ? Math.floor(i / n) : n + (i % n));
    };
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', () => { p0 = null; });
    $('#sf-undo').onclick = () => { if (busy || done || !hist.length) return; cur = hist.pop(); paint(); msg(''); };
    $('#sf-reset').onclick = () => { if (busy) return; cur = G.start; hist = []; done = false; board.classList.remove('won'); paint(); msg(''); };
    $('#sf-hint').onclick = () => {
      if (busy || done) return;
      // 先看是不是還走在出題時算好的最短路上，否則就地搜尋
      let sol = null, c = G.start; const k = key(cur);
      for (let j = 0; j <= G.sol.length && !sol; j++) { if (key(c) === k && j < G.sol.length) sol = G.sol.slice(j); if (j < G.sol.length) c = F.apply(N(), c, G.sol[j]); }
      if (!sol) sol = F.solve(N(), G.cols, cur, G.goal, G.N >= 5 ? 6 : 8);
      if (!sol) { msg('離目標有點遠了，先按「從頭來」再試試。'); return; }
      const m = sol[0], n = N(), h = board.querySelector(`.sf-h[data-m="${m}"]`);
      msg(`提示：轉${m < n ? `第 ${m + 1} 排` : `第 ${m - n + 1} 列`}，之後還要 ${sol.length - 1} 次。`);
      h.classList.add('hint'); timers.push(setTimeout(() => h.classList.remove('hint'), 1600));
    };
    $('#sf-new').onclick = () => { if (busy) return; board.classList.remove('won'); newGame(); };
    $('#sf-lv').onclick = e => { const b = e.target.closest('button'); if (!b || busy) return; L = +b.dataset.i; api.save('spin.flip', L); board.classList.remove('won'); newGame(); };
    newGame();
    return () => timers.forEach(clearTimeout);
  };
  return F;
})();

(function () {
  const S = { flip: SpinFlip, pipe: SpinPipe };
  S.mount = function (root, api) {
    let mode = api.load('spin.mode', 'flip') === 'pipe' ? 'pipe' : 'flip', cleanup = null;
    root.innerHTML = `<div class="seg sp-modes" id="sp-modes">
        <button data-m="flip">翻轉圖樣</button><button data-m="pipe">轉板接線</button></div><div id="sp-body"></div>`;
    const body = root.querySelector('#sp-body');
    function go(m) {
      if (cleanup) { cleanup(); cleanup = null; }
      mode = m; api.save('spin.mode', m);
      root.querySelectorAll('#sp-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      cleanup = S[m].mount(body, api) || null;
    }
    root.querySelector('#sp-modes').onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.m !== mode) go(b.dataset.m); };
    go(mode);
    return () => { if (cleanup) cleanup(); };
  };
  if (typeof module !== 'undefined') module.exports = S; else window.GameRoom.register('spin', S);
})();
