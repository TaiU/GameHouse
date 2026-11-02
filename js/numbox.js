// 數字框框：把盤面切成長方形，每塊恰好包含一個數字，面積等於該數字
(function () {
  const Q = {};
  const rnd = n => Math.floor(Math.random() * n);

  // 隨機切割：從左上第一個空格開始放一塊隨機大小的長方形
  function partition(W, H, maxA) {
    const owner = new Array(W * H).fill(-1), rects = [];
    for (let i = 0; i < W * H; i++) {
      if (owner[i] >= 0) continue;
      const r0 = Math.floor(i / W), c0 = i % W, opts = [];
      for (let h = 1; r0 + h <= H; h++) for (let w = 1; c0 + w <= W; w++) {
        if (w * h > maxA) break;
        let free = true;
        for (let r = r0; r < r0 + h && free; r++) for (let c = c0; c < c0 + w; c++) if (owner[r * W + c] >= 0) { free = false; break; }
        if (!free) break;
        const a = w * h; opts.push({ r: r0, c: c0, w, h, wt: a === 1 ? 0.15 : a <= 3 ? 1 : a <= 6 ? 1.6 : 1 });
      }
      let t = Math.random() * opts.reduce((s, o) => s + o.wt, 0), pick = opts[0];
      for (const o of opts) { t -= o.wt; if (t <= 0) { pick = o; break; } }
      for (let r = pick.r; r < pick.r + pick.h; r++) for (let c = pick.c; c < pick.c + pick.w; c++) owner[r * W + c] = rects.length;
      rects.push(pick);
    }
    return rects;
  }
  function candidates(W, H, clues, k) {
    const { r: cr, c: cc, n } = clues[k], out = [];
    for (let h = 1; h <= n; h++) {
      if (n % h) continue; const w = n / h;
      for (let r = cr - h + 1; r <= cr; r++) for (let c = cc - w + 1; c <= cc; c++) {
        if (r < 0 || c < 0 || r + h > H || c + w > W) continue;
        if (clues.some((o, j) => j !== k && o.r >= r && o.r < r + h && o.c >= c && o.c < c + w)) continue;
        out.push({ r, c, w, h });
      }
    }
    return out;
  }
  Q.solve = function (W, H, clues, limit) {
    const cand = clues.map((_, k) => candidates(W, H, clues, k));
    const cover = new Array(W * H).fill(-1), used = new Array(clues.length).fill(false);
    // 每格可被哪些 (clue, rect) 覆蓋
    const byCell = Array.from({ length: W * H }, () => []);
    cand.forEach((list, k) => list.forEach(R => { for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) byCell[r * W + c].push([k, R]); }));
    let count = 0, sol = null;
    const fits = R => { for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) if (cover[r * W + c] >= 0) return false; return true; };
    const paint = (R, v) => { for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) cover[r * W + c] = v; };
    const chosen = [];
    (function bt() {
      if (count >= limit) return;
      // 選可能性最少的空格
      let best = -1, bestOpts = null;
      for (let i = 0; i < W * H; i++) if (cover[i] < 0) {
        const o = byCell[i].filter(([k, R]) => !used[k] && fits(R));
        if (!o.length) return;
        if (!bestOpts || o.length < bestOpts.length) { best = i; bestOpts = o; if (o.length === 1) break; }
      }
      if (best < 0) { count++; if (!sol) sol = chosen.slice(); return; }
      for (const [k, R] of bestOpts) { used[k] = true; paint(R, k); chosen[k] = R; bt(); paint(R, -1); used[k] = false; if (count >= limit) return; }
    })();
    return { count, sol };
  };
  Q.generate = function (W, H) {
    const maxA = Math.max(6, Math.round(W * H / 6));
    for (let t = 0; t < 400; t++) {
      const rects = partition(W, H, maxA);
      if (rects.filter(R => R.w * R.h === 1).length > 2) continue;
      const clues = rects.map(R => ({ r: R.r + rnd(R.h), c: R.c + rnd(R.w), n: R.w * R.h }));
      if (Q.solve(W, H, clues, 2).count === 1) return { W, H, clues, rects, tries: t + 1 };
    }
    return null;
  };

  const PALETTE = ['#e8a6a1', '#f2c879', '#b6d98a', '#8fcfc4', '#9fb8ef', '#c7a6e6', '#f0a9cf', '#d9c3a0', '#a7d3ee', '#e0e08a'];
  const SIZES = [{ n: 6, name: '6×6' }, { n: 8, name: '8×8' }, { n: 10, name: '10×10' }];

  Q.mount = function (root, api) {
    let N = +api.load('numbox.n', 8), st, timer;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="nb-sizes">${SIZES.map(s => `<button data-n="${s.n}">${s.name}</button>`).join('')}</div>
        <div class="stat"><span id="nb-time">00:00</span></div>
      </div>
      <p class="rule">從一格拖到另一格畫出長方形。每個長方形要剛好框住一個數字，格子數等於那個數字，所有格子都要被框到。點一下已畫的框可以擦掉。</p>
      <div class="nb-grid" id="nb-grid"></div>
      <div class="tools center"><button id="nb-undo">復原</button><button id="nb-clear">清空</button><button id="nb-hint">提示</button><button id="nb-new" class="primary">新局</button></div>
      <p class="msg" id="nb-msg"></p>`;
    const $ = s => root.querySelector(s), grid = $('#nb-grid');
    function newGame() {
      const g = Q.generate(N, N);
      st = { ...g, boxes: [], hist: [], drag: null, t0: Date.now(), done: false };
      grid.style.setProperty('--n', N);
      $('#nb-msg').textContent = '';
      clearInterval(timer);
      timer = setInterval(() => { if (st.done) return; const s = Math.floor((Date.now() - st.t0) / 1000); $('#nb-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
      render();
    }
    const inside = (R, r, c) => r >= R.r && r < R.r + R.h && c >= R.c && c < R.c + R.w;
    function boxState(R) {
      const cl = st.clues.filter(q => inside(R, q.r, q.c));
      return cl.length === 1 && cl[0].n === R.w * R.h ? 'ok' : 'bad';
    }
    function render() {
      root.querySelectorAll('#nb-sizes button').forEach(b => b.classList.toggle('on', +b.dataset.n === N));
      let html = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const q = st.clues.find(q => q.r === r && q.c === c);
        html += `<div class="nb-cell" data-r="${r}" data-c="${c}">${q ? `<b>${q.n}</b>` : ''}</div>`;
      }
      st.boxes.forEach((R, i) => {
        const s = boxState(R);
        html += `<button class="nb-box ${s}" data-i="${i}" style="--r:${R.r};--c:${R.c};--w:${R.w};--h:${R.h};--col:${PALETTE[i % PALETTE.length]}" aria-label="長方形 ${R.w}×${R.h}，點一下擦掉"></button>`;
      });
      if (st.drag) { const D = dragRect(); html += `<div class="nb-ghost" style="--r:${D.r};--c:${D.c};--w:${D.w};--h:${D.h}"><span>${D.w * D.h}</span></div>`; }
      grid.innerHTML = html;
      const covered = new Set(); st.boxes.forEach(R => { for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) covered.add(r * N + c); });
      if (!st.done && covered.size === N * N && st.boxes.every(R => boxState(R) === 'ok')) {
        st.done = true; $('#nb-msg').textContent = `框完了！用時 ${$('#nb-time').textContent}。`; api.confetti();
      }
    }
    function dragRect() { const { a, b } = st.drag; return { r: Math.min(a[0], b[0]), c: Math.min(a[1], b[1]), w: Math.abs(a[1] - b[1]) + 1, h: Math.abs(a[0] - b[0]) + 1 }; }
    function cellAt(e) {
      const rc = grid.getBoundingClientRect();
      const c = Math.floor((e.clientX - rc.left) / rc.width * N), r = Math.floor((e.clientY - rc.top) / rc.height * N);
      return [Math.max(0, Math.min(N - 1, r)), Math.max(0, Math.min(N - 1, c))];
    }
    grid.addEventListener('pointerdown', e => {
      if (st.done) return;
      const box = e.target.closest('.nb-box');
      if (box) { st.pendingErase = +box.dataset.i; }
      const p = cellAt(e); st.drag = { a: p, b: p, moved: false };
      grid.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grid.addEventListener('pointermove', e => {
      if (!st.drag) return; const p = cellAt(e);
      if (p[0] !== st.drag.b[0] || p[1] !== st.drag.b[1]) { st.drag.b = p; st.drag.moved = true; render(); }
    });
    const end = () => {
      if (!st.drag) return;
      const D = dragRect(), moved = st.drag.moved; st.drag = null;
      if (!moved && st.pendingErase != null) { st.hist.push(st.boxes.slice()); st.boxes.splice(st.pendingErase, 1); }
      else {
        st.hist.push(st.boxes.slice());
        // 新框蓋掉重疊的舊框
        st.boxes = st.boxes.filter(R => R.r >= D.r + D.h || D.r >= R.r + R.h || R.c >= D.c + D.w || D.c >= R.c + R.w);
        st.boxes.push(D);
      }
      st.pendingErase = null; render();
    };
    grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', () => { st.drag = null; st.pendingErase = null; render(); });
    $('#nb-undo').onclick = () => { const h = st.hist.pop(); if (h && !st.done) { st.boxes = h; render(); } };
    $('#nb-clear').onclick = () => { if (st.done) return; st.hist.push(st.boxes.slice()); st.boxes = []; render(); };
    $('#nb-hint').onclick = () => {
      if (st.done) return;
      const sol = Q.solve(N, N, st.clues, 1).sol;
      const same = (A, B) => A.r === B.r && A.c === B.c && A.w === B.w && A.h === B.h;
      st.hist.push(st.boxes.slice());
      const wrong = st.boxes.findIndex(R => !sol.some(S => same(R, S)));
      if (wrong >= 0) { st.boxes.splice(wrong, 1); $('#nb-msg').textContent = '有一個框畫錯了，已經幫你擦掉。'; }
      else { const S = sol.find(S => !st.boxes.some(R => same(R, S))); if (S) st.boxes.push(S); $('#nb-msg').textContent = ''; }
      render();
    };
    $('#nb-new').onclick = newGame;
    $('#nb-sizes').onclick = e => { const b = e.target.closest('button'); if (!b) return; N = +b.dataset.n; api.save('numbox.n', N); newGame(); };
    newGame();
    return () => clearInterval(timer);
  };

  if (typeof module !== 'undefined') module.exports = Q; else window.GameRoom.register('numbox', Q);
})();
