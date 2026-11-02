// 星位：每排、每列、每個色塊各一顆星，星星彼此不可相鄰（含斜角）
(function () {
  const P = {};
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 隨機排列，且相鄰列的星不相鄰
  function placeStars(n) {
    const col = [];
    (function bt(r) {
      if (r === n) return true;
      for (const c of shuffle([...Array(n).keys()])) {
        if (col.includes(c)) continue;
        if (r > 0 && Math.abs(col[r - 1] - c) <= 1) continue;
        col[r] = c; if (bt(r + 1)) return true;
      }
      col.length = r; return false;
    })(0);
    return col;
  }
  // 從每顆星出發隨機長出色塊
  function growRegions(n, col) {
    const reg = new Array(n * n).fill(-1);
    const frontier = [];
    for (let r = 0; r < n; r++) { reg[r * n + col[r]] = r; frontier.push(r * n + col[r]); }
    let left = n * n - n;
    while (left > 0) {
      const k = rnd(frontier.length), i = frontier[k];
      const r = Math.floor(i / n), c = i % n;
      const nb = [];
      if (r > 0) nb.push(i - n); if (r < n - 1) nb.push(i + n); if (c > 0) nb.push(i - 1); if (c < n - 1) nb.push(i + 1);
      const free = nb.filter(j => reg[j] < 0);
      if (!free.length) { frontier.splice(k, 1); continue; }
      const j = free[rnd(free.length)]; reg[j] = reg[i]; frontier.push(j); left--;
    }
    return reg;
  }
  P.solve = function (n, reg, limit) {
    const col = [], usedC = new Array(n).fill(false), usedR = new Array(n).fill(false);
    let count = 0, first = null;
    (function bt(r) {
      if (count >= limit) return;
      if (r === n) { count++; if (!first) first = col.slice(); return; }
      for (let c = 0; c < n; c++) {
        if (usedC[c] || usedR[reg[r * n + c]]) continue;
        if (r > 0 && Math.abs(col[r - 1] - c) <= 1) continue;
        col[r] = c; usedC[c] = true; usedR[reg[r * n + c]] = true;
        bt(r + 1);
        usedC[c] = false; usedR[reg[r * n + c]] = false;
      }
    })(0);
    return { count, first };
  };
  function connected(n, reg, R) {
    const cells = []; reg.forEach((v, i) => { if (v === R) cells.push(i); });
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), q = [cells[0]];
    while (q.length) { const i = q.pop(), r = Math.floor(i / n), c = i % n;
      for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1])
        if (j >= 0 && reg[j] === R && !seen.has(j)) { seen.add(j); q.push(j); } }
    return seen.size === cells.length;
  }
  // 有多解時，把「另一組解」的星所在格子改到鄰近色塊，逐步收斂成唯一解
  function repair(n, reg, col) {
    const isStar = i => col[Math.floor(i / n)] === i % n;
    for (let step = 0; step < 300; step++) {
      const res = P.solve(n, reg, 2);
      if (res.count === 1) return true;
      let alt = res.first;
      if (alt.every((c, r) => c === col[r])) alt = (function () { // 找與正解不同的那組
        const all = []; const cc = [], uC = [], uR = [];
        (function bt(r) { if (all.length) return; if (r === n) { if (cc.some((c, k) => c !== col[k])) all.push(cc.slice()); return; }
          for (let c = 0; c < n; c++) { const R = reg[r * n + c]; if (uC[c] || uR[R] || (r > 0 && Math.abs(cc[r - 1] - c) <= 1)) continue;
            cc[r] = c; uC[c] = uR[R] = true; bt(r + 1); uC[c] = uR[R] = false; } })(0);
        return all[0];
      })();
      const rows = shuffle(alt.map((c, r) => r).filter(r => alt[r] !== col[r]));
      let moved = false;
      for (const r of rows) {
        const i = r * n + alt[r]; if (isStar(i)) continue;
        const R = reg[i], rr = Math.floor(i / n), c = i % n;
        const nbs = shuffle([rr > 0 ? i - n : -1, rr < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter(j => j >= 0 && reg[j] !== R));
        for (const j of nbs) { reg[i] = reg[j]; if (connected(n, reg, R)) { moved = true; break; } reg[i] = R; }
        if (moved) break;
      }
      if (!moved) return false;
    }
    return false;
  }
  P.generate = function (n) {
    for (let t = 0; t < 200; t++) {
      const col = placeStars(n), reg = growRegions(n, col);
      if (repair(n, reg, col)) return { n, reg, sol: col, tries: t + 1 };
    }
    return null;
  };

  const COLORS = ['#e8a6a1', '#f2c879', '#b6d98a', '#8fcfc4', '#9fb8ef', '#c7a6e6', '#f0a9cf', '#d9c3a0', '#a7d3ee', '#e0e08a'];
  const SIZES = [{ n: 6, name: '6×6' }, { n: 7, name: '7×7' }, { n: 8, name: '8×8' }, { n: 9, name: '9×9' }];

  P.mount = function (root, api) {
    let n = +api.load('stars.n', 7), st, timer;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="st-sizes">${SIZES.map(s => `<button data-n="${s.n}">${s.name}</button>`).join('')}</div>
        <div class="stat"><span id="st-time">00:00</span></div>
      </div>
      <p class="rule">點一下標 ×，點兩下放星。每排、每列、每個色塊都剛好一顆星，而且星星彼此不能碰到，連斜角也不行。</p>
      <div class="st-grid" id="st-grid"></div>
      <div class="tools center"><button id="st-undo">復原</button><button id="st-clear">清空</button><button id="st-hint">提示</button><button id="st-new" class="primary">新局</button></div>
      <p class="msg" id="st-msg"></p>`;
    const $ = s => root.querySelector(s), grid = $('#st-grid');

    function newGame() {
      const g = P.generate(n);
      st = { ...g, mark: new Array(n * n).fill(0), hist: [], t0: Date.now(), done: false };
      grid.style.setProperty('--n', n);
      grid.innerHTML = '';
      for (let i = 0; i < n * n; i++) {
        const d = document.createElement('button'); d.className = 'st-cell'; d.dataset.i = i;
        const r = Math.floor(i / n), c = i % n, R = g.reg[i];
        d.style.background = COLORS[R % COLORS.length];
        if (c < n - 1 && g.reg[i + 1] !== R) d.classList.add('wr');
        if (r < n - 1 && g.reg[i + n] !== R) d.classList.add('wb');
        d.setAttribute('aria-label', `第${r + 1}排第${c + 1}列`);
        grid.appendChild(d);
      }
      $('#st-msg').textContent = '';
      clearInterval(timer);
      timer = setInterval(() => { if (st.done) return; const s = Math.floor((Date.now() - st.t0) / 1000); $('#st-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
      render();
    }
    function conflicts() {
      const bad = new Set(), stars = [];
      st.mark.forEach((m, i) => { if (m === 2) stars.push(i); });
      for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
        const i = stars[a], j = stars[b], ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
        if (ri === rj || ci === cj || st.reg[i] === st.reg[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) { bad.add(i); bad.add(j); }
      }
      return { bad, stars };
    }
    function render() {
      root.querySelectorAll('#st-sizes button').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
      const { bad, stars } = conflicts();
      [...grid.children].forEach((el, i) => {
        el.classList.toggle('bad', bad.has(i));
        el.innerHTML = st.mark[i] === 2 ? '<span class="star">★</span>' : st.mark[i] === 1 ? '<span class="x">×</span>' : '';
      });
      if (!st.done && stars.length === n && bad.size === 0) {
        st.done = true; $('#st-msg').textContent = `解開了！用時 ${$('#st-time').textContent}。`; api.confetti();
      }
    }
    grid.addEventListener('click', e => {
      const b = e.target.closest('.st-cell'); if (!b || st.done) return;
      const i = +b.dataset.i; st.hist.push(st.mark.slice()); st.mark[i] = (st.mark[i] + 1) % 3; render();
    });
    $('#st-undo').onclick = () => { const h = st.hist.pop(); if (h && !st.done) { st.mark = h; render(); } };
    $('#st-clear').onclick = () => { if (st.done) return; st.hist.push(st.mark.slice()); st.mark.fill(0); render(); };
    $('#st-hint').onclick = () => {
      if (st.done) return;
      // 先清掉錯的星，否則補一顆正確的星
      const wrong = st.mark.findIndex((m, i) => m === 2 && st.sol[Math.floor(i / n)] !== i % n);
      st.hist.push(st.mark.slice());
      if (wrong >= 0) { st.mark[wrong] = 1; $('#st-msg').textContent = '這顆星放錯了，已改成 ×。'; }
      else { const r = st.sol.findIndex((c, r) => st.mark[r * n + c] !== 2); if (r >= 0) st.mark[r * n + st.sol[r]] = 2; $('#st-msg').textContent = ''; }
      render();
    };
    $('#st-new').onclick = newGame;
    $('#st-sizes').onclick = e => { const b = e.target.closest('button'); if (!b) return; n = +b.dataset.n; api.save('stars.n', n); newGame(); };
    newGame();
    return () => clearInterval(timer);
  };

  if (typeof module !== 'undefined') module.exports = P; else window.GameRoom.register('stars', P);
})();
